const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Team = require('./TeamModel');
const { startOfWeek, endOfWeek, isSameOrAfter, isSameOrBefore, parseISO, isValid } = require('date-fns');

const TIP_OUT_RATES = {
	host: 0.015,
	runner: 0.04,
	bartender: 0.05,
};

const DailyTotalSchema = new mongoose.Schema({
	year: Number,
	month: Number,
	date: Date,
	foodSales: Number,
	barSales: Number,
	nonCashTips: Number,
	cashTips: Number,
	barTipOuts: Number,
	runnerTipOuts: Number,
	hostTipOuts: Number,
	potentialTipOuts: {
		host: {
			type: Number,
			default: function () {
				return this.foodSales * TIP_OUT_RATES.host;
			},
		},
		runner: {
			type: Number,
			default: function () {
				return this.foodSales * TIP_OUT_RATES.runner;
			},
		},
		bartender: {
			type: Number,
			default: function () {
				return this.barSales * TIP_OUT_RATES.bartender;
			},
		},
	},
	totalTipOut: {
		type: Number,
		default: function () {
			return (this.barTipOuts || 0) + (this.runnerTipOuts || 0) + (this.hostTipOuts || 0);
		},
	},
	tipsReceived: {
		type: Number,
		default: function () {
			return (this.nonCashTips || 0) + (this.cashTips || 0);
		},
	},
	totalPayrollTips: {
		type: Number,
		default: function () {
			return (this.nonCashTips || 0) + (this.cashTips || 0) - (this.totalTipOut || 0);
		},
	},
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
	totalTipOut: {
		type: Number,
		default: function () {
			return (this.barTipOuts || 0) + (this.runnerTipOuts || 0) + (this.hostTipOuts || 0);
		},
	},
	tipsReceived: {
		type: Number,
		default: function () {
			return (this.nonCashTips || 0) + (this.cashTips || 0);
		},
	},
	totalPayrollTips: {
		type: Number,
		default: function () {
			return (this.nonCashTips || 0) + (this.cashTips || 0) - (this.totalTipOut || 0);
		},
	},
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
	this.year = this.date.getUTCFullYear();
	this.month = this.date.getUTCMonth() + 1;
	next();
});

WeeklyTotalSchema.pre('save', function (next) {
	this.year = this.weekStart.getUTCFullYear();
	this.month = this.weekStart.getUTCMonth() + 1;
	this.weekStart = startOfWeek(this.date, { weekStartsOn: 1 });
	this.weekEnd = endOfWeek(this.date, { weekStartsOn: 1 });
	next();
});

TeamMemberSchema.methods.validateDailyTotal = function (dailyTotal) {
	const date = new Date(dailyTotal.date);

	// Check for duplicate date
	const duplicateDate = this.dailyTotals.some((total) => new Date(total.date).getTime() === date.getTime());

	// If a duplicate date is found, throw an error
	if (duplicateDate) {
		throw new Error('A daily total already exists for this date.');
	}

	// Check if the date is valid and the required fields are present
	const isValidTotal =
		isValid(date) && dailyTotal.foodSales && dailyTotal.barSales && dailyTotal.nonCashTips && dailyTotal.cashTips;

	// If the daily total is not valid, throw an error
	if (!isValidTotal) {
		throw new Error('Invalid daily total.');
	}

	// If the position is not 'server', set the potentialTipOuts to null
	if (this.position.toLowerCase() !== 'server') {
		dailyTotal.potentialTipOuts = null;
	}

	// If all checks pass, return the dailyTotal object
	return dailyTotal;
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

TeamMemberSchema.methods.calculateFoodTipOut = function (position, foodSales) {
	return foodSales * (TIP_OUT_RATES[position] || 0);
};

TeamMemberSchema.methods.calculateBarTipOut = function (barSales) {
	return barSales * TIP_OUT_RATES.bartender;
};

TeamMemberSchema.methods.updateTipOuts = async function (date, operation) {
	const year = date.getUTCFullYear();
	const month = date.getUTCMonth() + 1;

	const workers = await this.model('TeamMember').find({
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

	const servers = workers.filter((worker) => worker.position.toLowerCase() === 'server');
	const hosts = workers.filter((worker) => worker.position.toLowerCase() === 'host');
	const runners = workers.filter((worker) => worker.position.toLowerCase() === 'runner');

	const foodTipOut = servers.reduce((total, server) => {
		const dailyTotal = server.dailyTotals.find((total) => total.date.getTime() === date.getTime());
		return total + (dailyTotal ? dailyTotal.potentialTipOuts[this.position] : 0);
	}, 0);

	const updateServers = {
		$set: {
			hostTipOuts: this.position === 'host' ? foodTipOut : 0,
			runnerTipOuts: this.position === 'runner' ? foodTipOut : 0,
		},
	};

	const updateHostsRunners = {
		$inc: {
			tipsReceived: operation === 'add' ? foodTipOut : -foodTipOut,
		},
	};

	await this.model('TeamMember').updateMany({ _id: { $in: servers.map((server) => server._id) } }, updateServers);
	await this.model('TeamMember').updateMany({ _id: { $in: hosts.map((host) => host._id) } }, updateHostsRunners);
	await this.model('TeamMember').updateMany(
		{ _id: { $in: runners.map((runner) => runner._id) } },
		updateHostsRunners
	);
};

TeamMemberSchema.methods.addDailyTotal = async function (dailyTotal) {
	// Validate the daily total and get the validated dailyTotal
	dailyTotal = this.validateDailyTotal(dailyTotal);

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

TeamMemberSchema.methods.removeDailyTotal = function (dailyTotalId) {
	const dailyTotal = this.dailyTotals.id(dailyTotalId);
	if (!dailyTotal) {
		throw new Error('No daily total found with this id');
	}
	
	// Remove the date from the work schedule
	this.removeDateFromWorkSchedule(dailyTotal.date);

	dailyTotal.remove();
	return this.save();
};

TeamMemberSchema.methods.removeDateFromWorkSchedule = function (date) {
	const year = date.getUTCFullYear();
	const month = date.getUTCMonth();

	const workScheduleItem = this.workSchedule.find((item) => item.year === year && item.month === month);

	if (workScheduleItem) {
		const dateIndex = workScheduleItem.dates.findIndex((item) => item.getTime() === date.getTime());

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
	const year = date.getUTCFullYear();
	const month = date.getUTCMonth() + 1;

	let workScheduleItem = this.workSchedule.find((item) => item.year === year && item.month === month);

	if (workScheduleItem) {
		const hasDate = workScheduleItem.dates.some((existingDate) => existingDate.getTime() === date.getTime());

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

TeamMemberSchema.methods.getWorkScheduleForYearAndMonth = function (year, month) {
	return this.workSchedule.find((schedule) => schedule.month === month && schedule.year === year);
};

const TeamMember = mongoose.model('TeamMember', TeamMemberSchema, 'teamMembers');

TeamMember.ensureIndexes()
	.then(() => console.log('Indexes ensured'))
	.catch((err) => console.log('Error ensuring indexes:', err));

module.exports = TeamMember;
