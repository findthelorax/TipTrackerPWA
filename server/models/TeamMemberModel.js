const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Team = require('./TeamModel');
const { startOfWeek, endOfWeek, isSameOrAfter, isSameOrBefore } = require('date-fns');

const DailyTotalSchema = new mongoose.Schema({
	month: Number,
	date: Date,
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

DailyTotalSchema.pre('save', function (next) {
	this.month = this.date.getMonth();
	next();
});

const WeeklyTotalSchema = new mongoose.Schema({
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

WeeklyTotalSchema.pre('save', function (next) {
	this.month = this.weekStart.getMonth();
	next();
});

const TeamMemberSchema = new mongoose.Schema({
	firstName: String,
	lastName: String,
	position: String,
	teams: [{ type: Schema.Types.ObjectId, ref: 'Team' }],
	workSchedule: [
		{
			month: Number,
			dates: [Date],
		},
	],
	dailyTotals: [DailyTotalSchema],
	weeklyTotals: [WeeklyTotalSchema],
});

TeamMemberSchema.index({ firstName: 1, lastName: 1, position: 1 }, { unique: true });
TeamMemberSchema.index({ 'workSchedule': 1 });
TeamMemberSchema.index({ 'dailyTotals.date': 1 });
TeamMemberSchema.index({ 'weeklyTotals.weekStart': 1 });

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

    await Team.updateMany(
        { teamMembers: teamMember._id },
        { $pull: { teamMembers: teamMember._id } }
    );

    next();
});

TeamMemberSchema.methods.getDailyTotals = function (date) {
	const dailyTotal = this.dailyTotals.find(
		(total) => total.date.getTime() === date.getTime()
	);

	return dailyTotal;
};

TeamMemberSchema.methods.getWeeklyTotals = function (weekStart) {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

    const weeklyTotal = this.weeklyTotals.find(
        (total) =>
            isSameOrAfter(total.weekStart, weekStart) &&
            isSameOrBefore(total.weekEnd, weekEnd)
    );

    return weeklyTotal;
};

TeamMemberSchema.methods.getWorkScheduleForMonth = function (month) {
	return this.workSchedule.find(schedule => schedule.month === month);
};

const TeamMember = mongoose.model('TeamMember', TeamMemberSchema, 'teamMembers');

module.exports = TeamMember;