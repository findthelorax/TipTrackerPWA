const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Team = require('./TeamModel');
const { startOfWeek, endOfWeek, isSameOrAfter, isSameOrBefore, isValid } = require('date-fns');
const DailyTotalSchema = require('./DailyTotalSchema');
const WeeklyTotalSchema = require('./WeeklyTotalSchema');
const WorkScheduleSchema = require('./WorkScheduleSchema');

const TeamMemberSchema = new mongoose.Schema({
	firstName: String,
	lastName: String,
	position: String,
	teams: [{ type: Schema.Types.ObjectId, ref: 'Team' }],
    workSchedule: [WorkScheduleSchema],
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
	const duplicateDate = this.dailyTotals.some((total) => new Date(total.date).getTime() === date.getTime());

	if (duplicateDate) {
		throw new Error('A daily total already exists for this date.');
	}

	const isValidTotal =
		isValid(date) && dailyTotal.foodSales && dailyTotal.barSales && dailyTotal.nonCashTips && dailyTotal.cashTips;

	if (!isValidTotal) {
		throw new Error('Invalid daily total.');
	}

	if (this.position.toLowerCase() !== 'server') {
		dailyTotal.potentialTipOuts = null;
	}

	return dailyTotal;
};

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
		workScheduleItem.addDate(date);
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
		workScheduleItem.removeDate(date);

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