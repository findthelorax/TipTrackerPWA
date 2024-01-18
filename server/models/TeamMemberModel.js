const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Team = require('./TeamModel');
const { startOfWeek, endOfWeek, isSameOrAfter, isSameOrBefore, parseISO, isValid } = require('date-fns');

const TIP_OUT_RATES = {
    host: 0.015,
    runner: 0.04,
    bartender: 0.05
};

const DailyTotalSchema = new mongoose.Schema({
	year: Number,
	month: Number,
	date: Date,
	foodSales: Number,
	barSales: Number,
	nonCashTips: Number,
	cashTips: Number,
	potentialTipOuts: {
        host: Number,
        runner: Number,
        bartender: Number,
    },
	barTipOuts: Number,
	runnerTipOuts: Number,
	hostTipOuts: Number,
	totalTipOut: Number,
	tipsReceived: Number,
	totalPayrollTips: Number,
});

const WeeklyTotalSchema = new mongoose.Schema({
	year: Number,
	month: Number,
	weekStart: Date,
	weekEnd: Date,
	foodSales: Number,
	barSales: Number,
	nonCashTips: Number,
	cashTips: Number,
	barTipOuts: Number,
	runnerTipOuts: Number,
	hostTipOuts: Number,
	totalTipOut: Number,
	tipsReceived: Number,
	totalPayrollTips: Number,
});

const TeamMemberSchema = new mongoose.Schema({
	firstName: String,
	lastName: String,
	position: String,
	teams: [{ type: Schema.Types.ObjectId, ref: 'Team' }],
	workSchedule: [
		{
			year: Number,
			month: Number,
			dates: [Date],
		},
	],
	dailyTotals: [DailyTotalSchema],
	weeklyTotals: [WeeklyTotalSchema],
});


DailyTotalSchema.pre('save', function (next) {
	this.year = this.date.getFullYear();
	this.month = this.date.getMonth() + 1;
	next();
});

WeeklyTotalSchema.pre('save', function (next) {
	this.year = this.weekStart.getFullYear();
	this.month = this.weekStart.getMonth() + 1;
	this.weekStart = startOfWeek(this.date, { weekStartsOn: 1 });
	this.weekEnd = endOfWeek(this.date, { weekStartsOn: 1 });
	next();
});

TeamMemberSchema.methods.validateDailyTotal = function(dailyTotal) {
    dailyTotal.date = parseISO(dailyTotal.date);
    return (
        isValid(dailyTotal.date) && dailyTotal.foodSales && dailyTotal.barSales && dailyTotal.nonCashTips && dailyTotal.cashTips
    );
};

TeamMemberSchema.index({ firstName: 1, lastName: 1, position: 1 }, { unique: true });
TeamMemberSchema.index({ 'workSchedule.year': 1, 'workSchedule.month': 1 });
TeamMemberSchema.index({ 'dailyTotals.year': 1, 'dailyTotals.month': 1, 'dailyTotals.date': 1 });
TeamMemberSchema.index({ 'weeklyTotals.year': 1, 'weeklyTotals.month': 1, 'weeklyTotals.weekStart': 1 });

TeamMemberSchema.pre('save', function (next) {
	if (this.firstName && this.isModified('firstName')) {
		this.firstName = this.firstName.charAt(0).toUpperCase() + this.firstName.slice(1);
	}
	if (this.firstName && this.isModified('lastName')) {
		this.lastName = this.lastName.charAt(0).toUpperCase() + this.lastName.slice(1);
	}
	next();
});

TeamMemberSchema.pre('remove', async function (next) {
	const teamMember = this;
	await Team.updateMany({ teamMembers: teamMember._id }, { $pull: { teamMembers: teamMember._id } });
	next();
});

TeamMemberSchema.methods.calculateFoodTipOut = function(position, foodSales) {
    return foodSales * (TIP_OUT_RATES[position] || 0);
};

TeamMemberSchema.methods.calculateBarTipOut = function(barSales) {
    return barSales * TIP_OUT_RATES.bartender;
};

TeamMemberSchema.methods.updateTipOuts = async function(date, operation) {
	const year = date.getUTCFullYear();
	const month = date.getUTCMonth() + 1;

	const servers = await this.model('TeamMember').find({
		position: 'server',
		workSchedule: {
			$elemMatch: {
				year: year,
				month: month,
				dates: {
					$elemMatch: {
						$eq: date,
					},
				},
			},
		},
	});

	const foodTipOut = this.calculateFoodTipOut(this.position, servers.reduce((total, server) => total + server.foodSales, 0));

	const update = {
		$inc: {
			[`${this.position}TipOuts`]: operation === 'add' ? foodTipOut : -foodTipOut,
		},
	};

	await this.model('TeamMember').updateMany({ _id: { $in: servers.map(server => server._id) } }, update);

	await this.model('TeamMember').findByIdAndUpdate(this._id, {
		$inc: {
			tipsReceived: operation === 'add' ? foodTipOut : -foodTipOut,
		},
	});
};

TeamMemberSchema.methods.addDailyTotal = async function (dailyTotal) {
	// Check if a daily total for the same date already exists
	const existingEntry = this.dailyTotals.find(
		(total) => total.date === dailyTotal.date
	);

	if (existingEntry) {
		throw new Error('A daily total for this date already exists.');
	}

	if (this.position.toLowerCase() === 'server') {
		dailyTotal.potentialTipOuts = {
			host: dailyTotal.foodSales * TIP_OUT_RATES.host,
			runner: dailyTotal.foodSales * TIP_OUT_RATES.runner,
			bartender: dailyTotal.barSales * TIP_OUT_RATES.bartender,
		};
	}
	// Calculate tipsReceived and totalPayrollTips
	dailyTotal.tipsReceived = (dailyTotal.nonCashTips || 0) + (dailyTotal.cashTips || 0);

	this.dailyTotals.push(dailyTotal);
	this.markModified('dailyTotals');
	await this.save();
};

TeamMemberSchema.statics.updateDailyTotal = function (teamMemberId, dailyTotalId, updatedDailyTotal) {
	const update = {};
	for (let [key, value] of Object.entries(updatedDailyTotal)) {
		update[`dailyTotals.$.${key}`] = value;
	}

	return this.findOneAndUpdate(
		{ _id: teamMemberId, 'dailyTotals._id': dailyTotalId },
		{ $set: update },
		{ new: true }
	);
};

TeamMemberSchema.methods.removeDateFromWorkSchedule = function (date) {
	const year = date.getFullYear();
	const month = date.getMonth();

	const workScheduleItem = this.workSchedule.find(
		(item) => item.year === year && item.month === month
	);

	if (workScheduleItem) {
		const dateIndex = workScheduleItem.dates.findIndex(
			(item) => item.getTime() === date.getTime()
		);

		if (dateIndex !== -1) {
			workScheduleItem.dates.splice(dateIndex, 1);
		}

		// If workScheduleItem is empty, remove it
		if (workScheduleItem.dates.length === 0) {
			this.workSchedule.pull(workScheduleItem);
		}
	}

	return this;
};

TeamMemberSchema.methods.addDateToWorkSchedule = function (date) {
	const year = date.getFullYear();
	const month = date.getMonth() + 1;

	let workScheduleItem = this.workSchedule.find(
		(item) => item.year === year && item.month === month
	);

	if (workScheduleItem) {
		const hasDate = workScheduleItem.dates.some(
			(existingDate) => existingDate.getTime() === date.getTime()
		);

		if (hasDate) {
			throw new Error('The date already exists in the work schedule for this month.');
		} else {
			workScheduleItem.dates.push(date);
			workScheduleItem.dates.sort((a, b) => a - b);
		}
	} else {
		this.workSchedule.push({
			year: year,
			month: month,
			dates: [date],
		});
	}

	return this;
};

TeamMemberSchema.methods.getWeeklyTotals = function (weekStart) {
	const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

	const weeklyTotal = this.weeklyTotals.find(
		(total) => isSameOrAfter(total.weekStart, weekStart) && isSameOrBefore(total.weekEnd, weekEnd)
	);

	return weeklyTotal;
};

TeamMemberSchema.methods.getWorkScheduleForMonthAndYear = function (year, month) {
	return this.workSchedule.find((schedule) => schedule.month === month && schedule.year === year);
};

const TeamMember = mongoose.model('TeamMember', TeamMemberSchema, 'teamMembers');

TeamMember.ensureIndexes()
	.then(() => console.log('Indexes ensured'))
	.catch((err) => console.log('Error ensuring indexes:', err));
	
module.exports = TeamMember;