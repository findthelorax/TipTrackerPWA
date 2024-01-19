const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Team = require('./TeamModel');
const { startOfWeek, endOfWeek, isSameOrAfter, isSameOrBefore, isValid } = require('date-fns');
const DailyTotalSchema = require('./DailyTotalSchema');
const WeeklyTotalSchema = require('./WeeklyTotalSchema');
const { calculateFoodTipOut, calculateBarTipOut, updateTipOuts } = require('../utils/teamMemberUtils');

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

TeamMemberSchema.index({ firstName: 1, lastName: 1, position: 1 }, { unique: true });
TeamMemberSchema.index({ 'workSchedule.year': 1, 'workSchedule.month': 1, 'workSchedule.dates': 1 });
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

TeamMemberSchema.methods.calculateFoodTipOut = calculateFoodTipOut;
TeamMemberSchema.methods.calculateBarTipOut = calculateBarTipOut;
TeamMemberSchema.methods.updateTipOuts = updateTipOuts;

TeamMemberSchema.methods.addDailyTotal = async function (dailyTotal) {
	// Validate the daily total and get the validated dailyTotal
	dailyTotal = this.validateDailyTotal(dailyTotal);

	this.dailyTotals.push(dailyTotal);
	this.markModified('dailyTotals');
    return this.save().then(() => dailyTotal);
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
	dailyTotal.remove();
	return this.save();
};

TeamMemberSchema.methods.addDateToWorkSchedule = function (year, month, date) {
	let workScheduleItem = this.workSchedule.find((item) => {
		return item.year === year && item.month === month;
	});
	if (workScheduleItem) {
		const hasDate = workScheduleItem.dates.some((existingDate) => {
			return existingDate.getTime() === date.getTime();
		});
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

	this.markModified('workSchedule');
	return this;
};

TeamMemberSchema.methods.removeDateFromWorkSchedule = function (year, month, date) {
	const workScheduleItem = this.workSchedule.find((item) => item.year === year && item.month === month);

	if (workScheduleItem) {
		const dateIndex = workScheduleItem.dates.findIndex((item) => item.getTime() === date.getTime());

		if (dateIndex !== -1) {
			workScheduleItem.dates.splice(dateIndex, 1);
		}

		if (workScheduleItem.dates.length === 0) {
			this.workSchedule.pull(workScheduleItem);
		}
	}

	this.markModified('workSchedule');
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
