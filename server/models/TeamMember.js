const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Team = require('./team');
const { getMonth, startOfWeek, endOfWeek, isSameDay, isAfter, isBefore, isEqual, parseISO } = require('date-fns');

const DailyTotalSchema = new mongoose.Schema({
	date: Date,
	month: Number,
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
	teamMemberFirstName: String,
	teamMemberLastName: String,
	position: String,
	teams: [{ type: Schema.Types.ObjectId, ref: 'Team' }],
	workSchedule: [
		{
			month: Number,
			dates: [Date],
		},
	],
	timeZone: {
		type: String,
		default: 'UTC',
	},
	dailyTotals: [DailyTotalSchema],
	weeklyTotals: [WeeklyTotalSchema],
});

TeamMemberSchema.index({ teamMemberFirstName: 1, teamMemberLastName: 1, position: 1 }, { unique: true });
TeamMemberSchema.index({ workSchedule: 1 });
TeamMemberSchema.index({ 'dailyTotals.date': 1 });
TeamMemberSchema.index({ 'weeklyTotals.weekStart': 1 });

TeamMemberSchema.pre('save', function (next) {
	if (this.teamMemberFirstName && this.isModified('teamMemberFirstName')) {
		this.teamMemberFirstName = this.teamMemberFirstName.charAt(0).toUpperCase() + this.teamMemberFirstName.slice(1);
	}
	if (this.teamMemberLastName && this.isModified('teamMemberLastName')) {
		this.teamMemberLastName = this.teamMemberLastName.charAt(0).toUpperCase() + this.teamMemberLastName.slice(1);
	}
	next();
});

TeamMemberSchema.methods.addWorkDate = function (date) {
    const month = date.getMonth();
    let monthSchedule = this.workSchedule.find(schedule => schedule.month === month);

    if (!monthSchedule) {
        monthSchedule = { month, dates: [] };
        this.workSchedule.push(monthSchedule);
    }

    monthSchedule.dates.push(date);
};

TeamMemberSchema.methods.removeWorkDate = function (dateToRemove) {
    const month = dateToRemove.getMonth();
    let monthSchedule = this.workSchedule.find(schedule => schedule.month === month);

    if (monthSchedule) {
        const dateIndex = monthSchedule.dates.findIndex(date => date.getTime() === dateToRemove.getTime());

        if (dateIndex !== -1) {
            monthSchedule.dates.splice(dateIndex, 1);
        }

        // If there are no more dates in this month, remove the month from the workSchedule
        if (monthSchedule.dates.length === 0) {
            const monthIndex = this.workSchedule.findIndex(schedule => schedule.month === month);
            this.workSchedule.splice(monthIndex, 1);
        }
    }
};

TeamMemberSchema.methods.removeDailyTotal = function (dailyTotalId) {
    const dailyTotalIndex = this.dailyTotals.findIndex((dailyTotal) => dailyTotal._id.toString() === dailyTotalId);

    if (dailyTotalIndex === -1) {
        throw new Error('Daily total not found');
    }

    // Remove the date from the work schedule
    this.removeWorkDate(this.dailyTotals[dailyTotalIndex].date);

    // Remove the daily total
    this.dailyTotals.splice(dailyTotalIndex, 1);
};

TeamMemberSchema.methods.addDailyTotal = function (dailyTotal) {
    dailyTotal.month = getMonth(dailyTotal.date);
    // Add the daily total
    this.dailyTotals.push(dailyTotal);

    // Add the date to the work schedule
    this.addWorkDate(dailyTotal.date);
};

TeamMemberSchema.methods.removeDailyTotal = function (dailyTotalId) {
	const dailyTotalIndex = this.dailyTotals.findIndex((dailyTotal) => dailyTotal._id.toString() === dailyTotalId);

	if (dailyTotalIndex === -1) {
		throw new Error('Daily total not found');
	}
	// Remove the daily total
	this.dailyTotals.splice(dailyTotalIndex, 1);
};

TeamMemberSchema.pre('remove', async function (next) {
	const teamMember = this;

	// Find the team that the member is part of and remove the member from it
	await Team.updateMany({ teamMembers: teamMember._id }, { $pull: { teamMembers: teamMember._id } });

	next();
});


TeamMemberSchema.statics.updateDailyTotalsForSameWorkDate = async function (teamMemberId, dailyTotal) {
    // Find the team member who submitted the daily total
    const teamMember = await this.findById(teamMemberId);

    if (!teamMember) {
        throw new Error('Team member not found');
    }

    // Calculate the tipOuts for the server
    dailyTotal.barTipOuts = dailyTotal.barSales * 0.05;
    dailyTotal.runnerTipOuts = dailyTotal.foodSales * 0.04;
    dailyTotal.hostTipOuts = dailyTotal.foodSales * 0.015;

    dailyTotal.totalTipOut = dailyTotal.barTipOuts + dailyTotal.runnerTipOuts + dailyTotal.hostTipOuts;
    // Add the daily total to the team member's daily totals
    teamMember.addDailyTotal(dailyTotal);
    await teamMember.save();

    // Find all other team members who have the same work date in their work schedule
    const month = dailyTotal.date.getMonth();
    const day = dailyTotal.date.getDate();
    const otherTeamMembers = await this.find({
        _id: { $ne: teamMemberId },
        workSchedule: {
            $elemMatch: {
                month: month,
                dates: { $elemMatch: { $eq: new Date(dailyTotal.date.getFullYear(), month, day) } }
            }
        }
    });

    // Calculate the total tip out for each position
    const positionCounts = { runner: 0, host: 0, bartender: 0 };
    for (let otherTeamMember of otherTeamMembers) {
        positionCounts[otherTeamMember.position]++;
    }

    // Update the daily totals of each other team member
    for (let otherTeamMember of otherTeamMembers) {
        // Calculate the tip out based on the position of the team member
        const tipOut = calculateServerTipOut(dailyTotal, otherTeamMember.position, positionCounts);

        // Add the tip out to the other team member's daily total
        otherTeamMember.addDailyTotal({ ...dailyTotal, tipsReceived: tipOut });
        await otherTeamMember.save();
    }
};

function calculateServerTipOut(dailyTotal, position, positionCounts) {
    // Calculate the tip out based on the position
    switch (position) {
        case 'runner':
            return dailyTotal.runnerTipOuts / positionCounts.runner;
        case 'host':
            return dailyTotal.hostTipOuts / positionCounts.host;
        case 'bartender':
            return dailyTotal.barTipOuts / positionCounts.bartender;
        default:
            return 0;
    }
}


TeamMemberSchema.methods.updateTipOutsForNewWorkDate = async function (date) {
    // Find all other team members who have the same work date in their work schedule
    const month = date.getMonth();
    const day = date.getDate();
    const otherTeamMembers = await this.model('TeamMember').find({
        _id: { $ne: this._id },
        workSchedule: {
            $elemMatch: {
                month: month,
                dates: { $elemMatch: { $eq: new Date(date.getFullYear(), month, day) } }
            }
        }
    });

    // Calculate the total tip out for each position
    const positionCounts = { runner: 0, host: 0, bartender: 0 };
    for (let otherTeamMember of otherTeamMembers) {
        positionCounts[otherTeamMember.position]++;
    }

    // Update the daily totals of each other team member
    for (let otherTeamMember of otherTeamMembers) {
        // Find the daily total for the work date
        const dailyTotalIndex = otherTeamMember.dailyTotals.findIndex(dailyTotal => dailyTotal.date.getTime() === date.getTime());

        if (dailyTotalIndex !== -1) {
            // Calculate the tip out based on the position of the team member
            const tipOut = calculateServerTipOut(otherTeamMember.dailyTotals[dailyTotalIndex], this.position, positionCounts);

            // Update the tip out in the daily total
            otherTeamMember.dailyTotals[dailyTotalIndex].totalTipOut += tipOut;
            await otherTeamMember.save();
        }
    }
};

const TeamMember = mongoose.model('TeamMember', TeamMemberSchema, 'teamMembers');

module.exports = TeamMember;