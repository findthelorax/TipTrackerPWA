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

TeamMemberSchema.methods.addWorkDate = async function(workDate) {
	// Parse the workDate and get the month
	const date = parseISO(workDate);
	const month = getMonth(date);

	// Find the work schedule for the month
	let workSchedule = this.workSchedule.find((schedule) => schedule.month === month);

	// If no work schedule exists for the month, create a new one
	if (!workSchedule) {
		workSchedule = { month, dates: [] };
		this.workSchedule.push(workSchedule);
	}

	// Check if the dates array already contains the new workDate
	const hasDate = workSchedule.dates.some((existingDate) => isEqual(existingDate, date));

	// If the dates array does not contain the new workDate, add it
	if (!hasDate) {
		workSchedule.dates.push(date);
	}

	await this.save();

	// If the team member is a host
	if (this.position === 'host') {
		// Find all servers who worked on the same date
		const servers = await this.model('TeamMember').find({
			position: 'server',
			workSchedule: {
				$elemMatch: {
					month,
					dates: {
						$elemMatch: {
							$eq: date,
						},
					},
				},
			},
		});

		// Update the hostTipOuts field for each server and the tipsReceived field for the host
		for (const server of servers) {
			const tipOut = server.foodSales * 0.015;
			server.hostTipOuts += tipOut;
			this.tipsReceived += tipOut;
			await server.save();
		}
		await this.save();
	}
	// If the team member is a runner
	else if (this.position === 'runner') {
		// Find all servers who worked on the same date
		const servers = await this.model('TeamMember').find({
			position: 'server',
			workSchedule: {
				$elemMatch: {
					month,
					dates: {
						$elemMatch: {
							$eq: date,
						},
					},
				},
			},
		});

		// Update the runnerTipOuts field for each server and the tipsReceived field for the runner
		for (const server of servers) {
			const tipOut = server.foodSales * 0.04;
			server.runnerTipOuts += tipOut;
			this.tipsReceived += tipOut;
			await server.save();
		}
		await this.save();
	}
};

TeamMemberSchema.methods.removeWorkDate = async function(workDate) {
	// Parse the workDate and get the month
	const date = parseISO(workDate);
	const month = getMonth(date);

	// Find the work schedule for the month
	let workSchedule = this.workSchedule.find((schedule) => schedule.month === month);

	// If a work schedule exists for the month
	if (workSchedule) {
		// Find the index of the workDate in the dates array
		const dateIndex = workSchedule.dates.findIndex((existingDate) => isEqual(existingDate, date));

		// If the dates array contains the workDate, remove it
		if (dateIndex !== -1) {
			workSchedule.dates.splice(dateIndex, 1);

			// If the team member is a host
			if (this.position === 'host') {
				// Find all servers who worked on the same date
				const servers = await this.model('TeamMember').find({
					position: 'server',
					workSchedule: {
						$elemMatch: {
							month,
							dates: {
								$elemMatch: {
									$eq: date,
								},
							},
						},
					},
				});

				// Update the hostTipOuts field for each server and the tipsReceived field for the host
				for (const server of servers) {
					const tipOut = server.foodSales * 0.015;
					server.hostTipOuts -= tipOut;
					this.tipsReceived -= tipOut;
					await server.save();
				}
				await this.save();
			}
			// If the team member is a runner
			else if (this.position === 'runner') {
				// Find all servers who worked on the same date
				const servers = await this.model('TeamMember').find({
					position: 'server',
					workSchedule: {
						$elemMatch: {
							month,
							dates: {
								$elemMatch: {
									$eq: date,
								},
							},
						},
					},
				});

				// Update the runnerTipOuts field for each server and the tipsReceived field for the runner
				for (const server of servers) {
					const tipOut = server.foodSales * 0.04;
					server.runnerTipOuts -= tipOut;
					this.tipsReceived -= tipOut;
					await server.save();
				}
				await this.save();
			}
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