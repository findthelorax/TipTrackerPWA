const { TeamMember } = require('../../models/DatabaseModel');
const { parseISO, isEqual } = require('date-fns');
require('dotenv').config();

//* Work Schedule
exports.getAllWorkSchedules = async (req, res, next) => {
    try {
        const teamMembers = await TeamMember.find({});
        let workSchedulesAll = teamMembers.map(({ firstName, lastName, position, workSchedule }) => ({
            name: `${firstName} ${lastName}`,
            position,
            workSchedule,
        }));

        // Filter out team members without work schedules
        workSchedulesAll = workSchedulesAll.filter(({ workSchedule }) => workSchedule.length > 0);

        res.json(workSchedulesAll);
    } catch (error) {
        console.error(`Error getting work schedules: ${error.message}`);
        next(error);
    }
};

exports.getWorkSchedule = async (req, res) => {
	try {
		const teamMember = await TeamMember.findById(req.params.teamMemberId);
		res.json({ workSchedule: teamMember.workSchedule });
	} catch (err) {
		res.json({ message: err });
	}
};

exports.getWorkScheduleForMonth = async (req, res) => {
	try {
		const teamMember = await TeamMember.findById(req.params.teamMemberId);
		const year = parseInt(req.params.year, 10);
		const month = parseInt(req.params.month, 10);
		if (isNaN(year) || isNaN(month) || month < 0 || month > 11) {
			return res.status(400).json({ message: 'Invalid year or month' });
		}
		const workSchedule = teamMember.getWorkScheduleForMonthAndYear(year, month);
		res.json(workSchedule);
	} catch (err) {
		res.json({ message: err });
	}
};

exports.getWorkScheduleByTeam = async (req, res, next) => {
	try {
		const teamMembers = await TeamMember.find({ teams: req.params.teamId });
		const workSchedules = teamMembers.flatMap((teamMember) => teamMember.workSchedule);
		res.json(workSchedules);
	} catch (error) {
		console.error(`Error getting work schedules: ${error.message}`);
		next(error);
	}
};

exports.createWorkSchedule = async (req, res, next) => {
	try {
		const workDates = req.body.workSchedule;
		const workSchedule = [];

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
		}

		const updatedTeamMember = await TeamMember.findByIdAndUpdate(
			req.params.teamMemberId,
			{ workSchedule },
			{ new: true }
		);

        if (['host', 'runner'].includes(updatedTeamMember.position)) {
            for (const workDate of workDates) {
                const date = new Date(workDate);
                await updatedTeamMember.updateTipOuts(date, 'add');
            }
        }

		res.json(updatedTeamMember);
	} catch (err) {
        next(error);
	}
};

exports.deleteWorkSchedule = async (req, res, next) => {
	try {
		const teamMember = await TeamMember.findById(req.params.teamMemberId);
		if (!teamMember) {
			return res.status(404).send();
		}

        if (['host', 'runner'].includes(teamMember.position)) {
            for (const workSchedule of teamMember.workSchedule) {
                for (const workDate of workSchedule.dates) {
                    const date = new Date(workDate);
                    await teamMember.updateTipOuts(date, 'remove');
                }
            }
        }

		// Remove empty months
		teamMember.workSchedule = [];
		await teamMember.save();

		res.send(teamMember);
	} catch (error) {
        next(error);
	}
};

exports.deleteWorkScheduleForMonth = async (req, res, next) => {
	try {
		const teamMember = await TeamMember.findById(req.params.teamMemberId);
		const year = parseInt(req.params.year, 10);
		const month = parseInt(req.params.month, 10);

		if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
			return res.status(400).json({ message: 'Invalid year or month' });
		}

		// Find the work schedule for the year and month
		let workScheduleIndex = teamMember.workSchedule.findIndex((schedule) => schedule.year === year && schedule.month === month);

		// If a work schedule exists for the year and month, remove it
		if (workScheduleIndex !== -1) {
			if (['host', 'runner'].includes(teamMember.position)) {
				for (const workDate of teamMember.workSchedule[workScheduleIndex].dates) {
					const date = new Date(workDate);
					await updateTipOutsAndTipsReceivedForRemoval(teamMember, date);
				}
			}

			teamMember.workSchedule.splice(workScheduleIndex, 1);
			await teamMember.save();
		}

		res.json(teamMember);
	} catch (err) {
		next(error);
	}
};

exports.addDateToWorkSchedule = async (req, res, next) => {
	try {
		const teamMember = await TeamMember.findById(req.params.teamMemberId);
		const workDate = parseISO(req.body.date);

		teamMember.addDateToWorkSchedule(workDate);

		if (['host', 'runner'].includes(teamMember.position)) {
			await teamMember.updateTipOuts(workDate, 'add');
		}

		teamMember.markModified('workSchedule');
		await teamMember.save();
		res.json(teamMember);
	} catch (err) {
		next(err);
	}
};

exports.removeDateFromWorkSchedule = async (req, res, next) => {
	try {
		const teamMember = await TeamMember.findById(req.params.teamMemberId);
		const workDate = parseISO(req.body.date);

		teamMember.removeDateFromWorkSchedule(workDate);

		if (['host', 'runner'].includes(teamMember.position)) {
			await teamMember.updateTipOuts(workDate, 'remove');
		}

		teamMember.markModified('workSchedule');
		await teamMember.save();

		res.json(teamMember);
	} catch (err) {
		next(err);
	}
};