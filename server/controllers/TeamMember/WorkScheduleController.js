const TeamMember = require('../../models/TeamMemberModel');
const { parseISO } = require('date-fns');
require('dotenv').config();
const { handleDailyTotalLogic } = require('../../utils/teamMemberUtils');

async function findTeamMembers(currentTeamMemberId, team, year, month, date) {
    const teamMembers = await TeamMember.find({
        teams: team,
        workSchedule: {
            $elemMatch: {
                year: year,
                month: month,
                dates: date,
            }
        }
    });

	const teamMembersWithDailyTotal = teamMembers.map((teamMember) => {
		const dailyTotalsForDate = teamMember.dailyTotals.filter((dailyTotal) => {
			// Convert both dates to 'YYYY-MM-DD' format for comparison
			const dailyTotalDate = new Date(dailyTotal.date).toISOString().split('T')[0];
			const queryDate = date.toISOString().split('T')[0];

			return dailyTotalDate === queryDate;
		});

		return {
			_id: teamMember._id,
			position: teamMember.position,
			dailyTotals: dailyTotalsForDate,
		};
	});
	return teamMembersWithDailyTotal;
}

function countPositions(teamMembers) {
	return teamMembers.reduce((counts, member) => {
		counts[member.position] = (counts[member.position] || 0) + 1;
		return counts;
	}, {});
}

exports.getAllWorkSchedules = async (req, res, next) => {
	try {
		const teamMembers = await TeamMember.find({});
		let workSchedulesAll = teamMembers.map(({ firstName, lastName, position, workSchedule }) => ({
			name: `${firstName} ${lastName}`,
			position,
			workSchedule,
		}));

		workSchedulesAll = workSchedulesAll.filter(({ workSchedule }) => workSchedule.length > 0);

		res.json(workSchedulesAll);
	} catch (err) {
		console.error(`Error getting work schedules: ${err.message}`);
		next(err);
	}
};

exports.getWorkSchedule = async (req, res, next) => {
	try {
		const teamMember = await TeamMember.findById(req.params.teamMemberId);
		res.json({ workSchedule: teamMember.workSchedule });
	} catch (err) {
		next({ message: err });
	}
};

exports.getWorkScheduleForYearAndMonth = async (req, res, next) => {
	try {
		const teamMember = await TeamMember.findById(req.params.teamMemberId);
		const year = parseInt(req.params.year, 10);
		const month = parseInt(req.params.month, 10);
		if (isNaN(year) || isNaN(month) || month < 0 || month > 11) {
			return res.status(400).json({ message: 'Invalid year or month' });
		}
		const workSchedule = teamMember.getWorkScheduleForYearAndMonth(year, month);
		res.json(workSchedule);
	} catch (err) {
		next({ message: err });
	}
};

exports.getWorkScheduleByTeam = async (req, res, next) => {
	try {
		const teamMembers = await TeamMember.find({ teams: req.params.teamId });
		const workSchedules = teamMembers.flatMap((teamMember) => teamMember.workSchedule);
		res.json(workSchedules);
	} catch (err) {
		console.error(`Error getting work schedules: ${err.message}`);
		next(err);
	}
};

exports.addWorkDate = async (req, res, next) => {
    const teamMemberId = req.params.teamMemberId;
    const date = req.body.date;
	
	const dateISO = parseISO(date);
	const year = dateISO.getUTCFullYear();
	const month = dateISO.getUTCMonth() + 1;
	
    try {
		const teamMember = await TeamMember.findById(teamMemberId);
        if (!teamMember) {
			return res.status(404).send({ message: 'Team member not found' });
        }
		const teamMemberPosition = teamMember.position.toLowerCase();
		
        await exports.addDateToWorkSchedule(teamMember, { date }, next);
		const teamMembersOnSameTeamYearMonthAndDate = await findTeamMembers(teamMember._id, teamMember.teams, year, month, dateISO);
		await handleDailyTotalLogic(teamMembersOnSameTeamYearMonthAndDate, teamMemberPosition);

		teamMember.markModified('workSchedule');
		await teamMember.save();
        res.status(200).send({ message: 'Date added to work schedule' });
    } catch (err) {
        next(err);
    }
};

exports.removeWorkDate = async (req, res, next) => {
	const teamMemberId = req.params.teamMemberId;
	const date = req.body.date;

	try {
		const teamMember = await TeamMember.findById(teamMemberId);
		if (!teamMember) {
			return res.status(404).send({ message: 'Team member not found' });
		}

		await exports.removeDateFromWorkSchedule(teamMember, { date }, next);
		res.status(200).send({ message: 'Date removed from work schedule' });
	} catch (err) {
		next(err);
	}
};

exports.createWorkSchedule = async (req, res, next) => {
	try {
		const workDates = req.body.workSchedule;
		const workSchedule = [];
		const teamMember = await TeamMember.findById(req.params.teamMemberId);
		const teamMemberPosition = teamMember.position.toLowerCase();

		for (const workDate of workDates) {
			const date = new Date(workDate);
			const year = date.getUTCFullYear();
			const month = date.getUTCMonth() + 1;

			let monthSchedule = workSchedule.find((schedule) => schedule.year === year && schedule.month === month);

			if (!monthSchedule) {
				monthSchedule = { year, month, dates: [workDate] };
				workSchedule.push(monthSchedule);
			} else {
				monthSchedule.dates.push(date);
				monthSchedule.dates.sort((a, b) => a - b);
			}

			// Recalculate tipOuts
			const teamMembersOnSameTeamYearMonthAndDate = await findTeamMembers(teamMember._id, teamMember.teams, year, month, date);
			await handleDailyTotalLogic(teamMembersOnSameTeamYearMonthAndDate, teamMemberPosition);
		}

		teamMember.workSchedule = workSchedule;
		await teamMember.save();
	} catch (err) {
		next(err);
	}
};

exports.deleteWorkSchedule = async (req, res, next) => {
	try {
		const teamMember = await TeamMember.findById(req.params.teamMemberId);
		const teamMemberPosition = teamMember.position.toLowerCase();
		if (!teamMember) {
			return res.status(404).send();
		}

		// Get the dates from the team member's work schedule
		const dates = teamMember.workSchedule.flatMap(schedule => schedule.dates.map(date => ({
			date,
			year: schedule.year,
			month: schedule.month
		})));

		// Delete the work schedule
		await TeamMember.updateOne(
			{ _id: req.params.teamMemberId },
			{ $pull: { workSchedule: {} } }
		);

		// Recalculate tipOuts for each date in the team member's work schedule
		for (const { date, year, month } of dates) {
			const teamMembersOnSameTeamYearMonthAndDate = await findTeamMembers(null, teamMember.teams, year, month, date);
			await handleDailyTotalLogic(teamMembersOnSameTeamYearMonthAndDate, teamMemberPosition);
		}
	} catch (err) {
		next(err);
	}
};

exports.deleteWorkScheduleForMonth = async (req, res, next) => {
	try {
		const teamMember = await TeamMember.findById(req.params.teamMemberId);
		const teamMemberPosition = teamMember.position.toLowerCase();
		const year = parseInt(req.params.year, 10);
		const month = parseInt(req.params.month, 10);

		if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
			return res.status(400).json({ message: 'Invalid year or month' });
		}

		let workScheduleIndex = teamMember.workSchedule.findIndex(
			(schedule) => schedule.year === year && schedule.month === month
		);

		if (workScheduleIndex !== -1) {
			const workSchedule = teamMember.workSchedule[workScheduleIndex];
			
			// Recalculate tipOuts for each date in the work schedule
			for (const date of workSchedule.dates) {
				const teamMembersOnSameTeamYearMonthAndDate = await findTeamMembers(teamMember._id, teamMember.teams, year, month, date);
				await handleDailyTotalLogic(teamMembersOnSameTeamYearMonthAndDate, teamMemberPosition);
			}

			teamMember.workSchedule.splice(workScheduleIndex, 1);
			await teamMember.save();
		}
	} catch (err) {
		next(err);
	}
};

exports.addDateToWorkSchedule = async (teamMember, dailyTotal, next) => {
	try {
		const teamMemberPosition = teamMember.position.toLowerCase();
		const teamMemberTeam = teamMember.teams;

		const date = parseISO(dailyTotal.date);
		const year = date.getUTCFullYear();
		const month = date.getUTCMonth() + 1;

		// Check if the date already exists in the work schedule
		const dateExists = teamMember.workSchedule.some(schedule => 
			schedule.year === year && 
			schedule.month === month && 
			schedule.dates.some(d => d.getTime() === date.getTime())
		);

		if (dateExists) {
            return next(new Error('Date already exists in work schedule'));
        }

		// If the date doesn't exist, add it and recalculate the tipOuts
		if (!dateExists) {
			await teamMember.addDateToWorkSchedule(year, month, date);
			
			const teamMembersOnSameTeamYearMonthAndDate = await findTeamMembers(teamMember._id, teamMemberTeam, year, month, date);
			console.log("🚀 ~ exports.addDateToWorkSchedule= ~ teamMembersOnSameTeamYearMonthAndDate:", teamMembersOnSameTeamYearMonthAndDate)
			console.log("🚀 ~ exports.addDateToWorkSchedule= ~ teamMembersOnSameTeamYearMonthAndDate:", JSON.stringify(teamMembersOnSameTeamYearMonthAndDate, null, 2))

			const positionCounts = countPositions(teamMembersOnSameTeamYearMonthAndDate);
			console.log("🚀 ~ positionCounts ~ positionCounts:", positionCounts)

			await handleDailyTotalLogic(teamMembersOnSameTeamYearMonthAndDate, teamMemberPosition);

			teamMember.markModified('workSchedule');
			await teamMember.save();
		}
	} catch (err) {
		next(err);
	}
};

exports.removeDateFromWorkSchedule = async (teamMember, dailyTotal, next) => {
	try {
		const teamMemberPosition = teamMember.position.toLowerCase();
        const teamMemberTeam = teamMember.teams;

		const date = parseISO(dailyTotal.date);
		const year = date.getUTCFullYear();
		const month = date.getUTCMonth() + 1;

		teamMember.removeDateFromWorkSchedule(year, month, date);

		const teamMembersOnSameTeamYearMonthAndDate = await findTeamMembers(teamMember._id, teamMemberTeam, year, month, date);
		await handleDailyTotalLogic(teamMembersOnSameTeamYearMonthAndDate, teamMemberPosition);

		teamMember.markModified('workSchedule');
		await teamMember.save();
	} catch (err) {
		next(err);
	}
};