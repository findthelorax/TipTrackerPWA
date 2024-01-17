const { TeamMember } = require('../../models/DatabaseModel');
const { parseISO, getMonth, isEqual } = require('date-fns');
require('dotenv').config();

const calculateTipOut = (position, foodSales) => {
	const tipOutRates = {
		host: 0.015,
		runner: 0.04,
	};

	return foodSales * (tipOutRates[position] || 0);
};

const updateTipOutsAndTipsReceived = async (teamMember, date, month) => {
	const servers = await TeamMember.find({
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

	for (const server of servers) {
		const tipOut = calculateTipOut(teamMember.position, server.foodSales);
		if (teamMember.position === 'host') server.hostTipOuts += tipOut;
		if (teamMember.position === 'runner') server.runnerTipOuts += tipOut;
		teamMember.tipsReceived += tipOut;
		await server.save();
	}

	await teamMember.save();
};

const updateTipOutsAndTipsReceivedForRemoval = async (teamMember, date, month) => {
	const servers = await TeamMember.find({
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

	for (const server of servers) {
		const tipOut = calculateTipOut(teamMember.position, server.foodSales);
		if (teamMember.position === 'host') server.hostTipOuts -= tipOut;
		if (teamMember.position === 'runner') server.runnerTipOuts -= tipOut;
		teamMember.tipsReceived -= tipOut;
		await server.save();
	}

	await teamMember.save();
};

//* Work Schedule
exports.getAllWorkSchedules = async (req, res) => {
	try {
		const teamMembers = await TeamMember.find({});
		let workSchedulesAll = teamMembers.map((teamMember) => ({
			name: teamMember.firstName + ' ' + teamMember.lastName,
			position: teamMember.position,
			workSchedule: teamMember.workSchedule,
		}));

		// Filter out team members without work schedules
		workSchedulesAll = workSchedulesAll.filter((teamMember) => teamMember.workSchedule.length > 0);

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
		const month = parseInt(req.params.month, 10);
		if (isNaN(month) || month < 0 || month > 11) {
			return res.status(400).json({ message: 'Invalid month' });
		}
		const workSchedule = teamMember.getWorkScheduleForMonth(month);
		res.json(workSchedule);
	} catch (err) {
		res.json({ message: err });
	}
};

exports.getWorkScheduleByTeam = async (req, res) => {
	try {
		const teamMembers = await TeamMember.find({ teams: req.params.teamId });
		const workSchedules = teamMembers.flatMap((teamMember) => teamMember.workSchedule);
		res.json(workSchedules);
	} catch (error) {
		console.error(`Error getting work schedules: ${error.message}`);
		next(error);
	}
};

exports.addWorkDate = async (req, res) => {
	try {
		const updatedTeamMember = await TeamMember.findByIdAndUpdate(
			req.params.teamMemberId,
			{ $push: { workSchedule: req.body.workDate } },
			{ new: true }
		);
		res.json(updatedTeamMember);
	} catch (err) {
		res.json({ message: err });
	}
};

exports.createWorkSchedule = async (req, res) => {
	try {
		const updatedTeamMember = await TeamMember.findByIdAndUpdate(
			req.params.teamMemberId,
			{ workSchedule: req.body.workSchedule },
			{ new: true }
		);
		res.json(updatedTeamMember);
	} catch (err) {
		res.json({ message: err });
	}
};

exports.deleteWorkSchedule = async (req, res) => {
	try {
		const teamMember = await TeamMember.findById(req.params.teamMemberId);
		if (!teamMember) {
			return res.status(404).send();
		}

		teamMember.workSchedule = [];
		await teamMember.save();

		res.send(teamMember);
	} catch (error) {
		res.json({ message: error });
	}
};

exports.addDateToWorkSchedule = async (req, res) => {
	try {
		const teamMember = await TeamMember.findById(req.params.teamMemberId);
		const workDate = req.body.date;

		// Parse the workDate and get the month
		const date = parseISO(workDate);
        const month = date.getUTCMonth() + 1;
		// Find the work schedule for the month
		let workSchedule = teamMember.workSchedule.find((schedule) => schedule.month === month);

		// If no work schedule exists for the month, create a new one
		if (!workSchedule) {
			workSchedule = { month, dates: [workDate] };
			teamMember.workSchedule.push(workSchedule);
		} else {
			// Check if the dates array already contains the new workDate
			const hasDate = workSchedule.dates.some((existingDate) => isEqual(existingDate, date));

			// If the dates array contains the new workDate, throw an error
			if (hasDate) {
				throw new Error('The date already exists in the work schedule for this month.');
			} else {
				// If the dates array does not contain the new workDate, add it
				workSchedule.dates.push(date);
                workSchedule.dates.sort((a, b) => a - b);
				teamMember.markModified('workSchedule');
			}
		}

		// If the team member is a host or a runner
		if (['host', 'runner'].includes(teamMember.position)) {
			await updateTipOutsAndTipsReceived(teamMember, date, month);
		}

		await teamMember.save();
		res.json(teamMember);
	} catch (err) {
		res.json({ message: err });
	}
};

exports.removeDateFromWorkSchedule = async (req, res) => {
	try {
		const teamMember = await TeamMember.findById(req.params.teamMemberId);
		const workDate = req.body.date;

		// Parse the workDate and get the month
		const date = parseISO(workDate);
        const month = date.getUTCMonth() + 1;

		// Find the work schedule for the month
		let workSchedule = teamMember.workSchedule.find((schedule) => schedule.month === month);

		// If a work schedule exists for the month
		if (workSchedule) {
			// Find the index of the workDate in the dates array
			const dateIndex = workSchedule.dates.findIndex((existingDate) => isEqual(existingDate, date));

			// If the dates array contains the workDate, remove it
			if (dateIndex !== -1) {
				workSchedule.dates.splice(dateIndex, 1);

				// If the team member is a host or a runner
				if (['host', 'runner'].includes(teamMember.position)) {
					await updateTipOutsAndTipsReceivedForRemoval(teamMember, date, month);
				}
			}
		}

		await teamMember.save();

		res.json(teamMember);
	} catch (err) {
		res.json({ message: err });
	}
};

// exports.addDateToWorkSchedule = async (req, res) => {
//     try {
//         const teamMember = await TeamMember.findById(req.params.teamMemberId);
//         const currentMonth = new Date(req.body.date).getMonth() + 1;
//         console.log("🚀 ~ exports.addDateToWorkSchedule= ~ req.body.date:", req.body.date)
//         let workSchedule = teamMember.workSchedule.find(schedule => schedule.month === currentMonth);

//         if (workSchedule) {
//             workSchedule.dates.push(new Date(req.body.date));
//         } else {
//             workSchedule = {
//                 month: currentMonth,
//                 dates: [new Date(req.body.date)]
//             };
//             teamMember.workSchedule.push(workSchedule);
//         }

//         const updatedTeamMember = await teamMember.save();
//         res.json(updatedTeamMember);
//     } catch (err) {
//         res.json({ message: err });
//     }
// };

// exports.removeDateFromWorkSchedule = async (req, res) => {
//     try {
//         const teamMember = await TeamMember.findById(req.params.teamMemberId);
//         const currentMonth = new Date(req.body.date).getMonth() + 1;
//         const workSchedule = teamMember.workSchedule.find(schedule => schedule.month === currentMonth);

//         if (workSchedule) {
//             const dateToRemove = new Date(req.body.date);
//             const index = workSchedule.dates.findIndex(date => {
//                 return date.getUTCFullYear() === dateToRemove.getUTCFullYear() &&
//                     date.getUTCMonth() === dateToRemove.getUTCMonth() &&
//                     date.getUTCDate() === dateToRemove.getUTCDate();
//             });
//             if (index > -1) {
//                 workSchedule.dates.splice(index, 1);
//             }
//         }

//         const updatedTeamMember = await teamMember.save();
//         res.json(updatedTeamMember);
//     } catch (err) {
//         res.json({ message: err });
//     }
// };
