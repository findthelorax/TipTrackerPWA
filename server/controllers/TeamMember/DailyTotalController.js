const { TeamMember } = require('../../models/DatabaseModel');
require('dotenv').config();

// Get All Daily Totals
exports.getAllDailyTotals = async (req, res, next) => {
	try {
		const teamMembers = await TeamMember.find({});
		const dailyTotalsAll = teamMembers.flatMap((teamMember) => teamMember.dailyTotals);
		res.json(dailyTotalsAll);
	} catch (error) {
		console.error(`Error getting daily totals: ${error.message}`);
		next(error);
	}
};

// Route to get daily totals for a specific team member
exports.getDailyTotals = async (req, res, next) => {
	try {
		const { teamMemberId } = req.params;
		const teamMember = await TeamMember.findById(teamMemberId);

		if (!teamMember) {
			return res.status(404).json({ error: 'Team member not found' });
		}
		res.json(teamMember.dailyTotals);
	} catch (error) {
		next(error);
	}
};

// Route to get a specific team member's daily total for a specific date
exports.getDailyTotal = async (req, res, next) => {
	try {
		const { teamMemberId, dailyTotalId } = req.params;

		const teamMember = await TeamMember.findById(teamMemberId);
		if (!teamMember) {
			return res.status(404).send({ message: 'Team member not found' });
		}

		const dailyTotalIndex = teamMember.dailyTotals.findIndex(
			(dailyTotal) => dailyTotal._id.toString() === dailyTotalId
		);
		if (dailyTotalIndex === -1) {
			return res.status(404).send({ message: 'Daily total not found' });
		}

		const dailyTotal = teamMember.dailyTotals[dailyTotalIndex];
		res.json(dailyTotal);
	} catch (error) {
		next(error);
	}
};

// Create daily total for a specific team member
exports.createDailyTotal = async (req, res, next) => {
	try {
		const { teamMemberId } = req.params;
		const dailyTotal = req.body;

		// Validate dailyTotal
		const teamMember = await TeamMember.findById(teamMemberId);
		if (!teamMember) {
			return res.status(404).json({ message: 'Team member not found' });
		}
		if (!teamMember.validateDailyTotal(dailyTotal)) {
			return res.status(400).json({
				success: false,
				message: 'dailyTotal must have all required fields.',
			});
		}

		// Add dailyTotal
		await teamMember.addDailyTotal(dailyTotal); // Use addDailyTotal method

		// Add date to workSchedule
		const date = new Date(dailyTotal.date); // assuming dailyTotal.date is the date you want to add
		teamMember.addDateToWorkSchedule(date);

		// Get the team of the teamMember
		const team = teamMember.teams;

		// Get the year, month, and date from the dailyTotal date
		const year = date.getFullYear();
		const month = date.getMonth() + 1;

		// Find all team members who are on the same team, worked in the same year, in the same month, and on the same date
		const teamMembersOnSameTeamYearMonthAndDate = await TeamMember.find({
			teams: team,
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

		// Group team members by position and count the number of members in each position
		const positionCounts = teamMembersOnSameTeamYearMonthAndDate.reduce((counts, member) => {
			counts[member.position] = (counts[member.position] || 0) + 1;
			return counts;
		}, {});

		const position = teamMember.position.toLowerCase();
		// Based on the position of the teamMember whose dailyTotal is being added, perform the necessary logic

		// Logic for when a server's dailyTotal is added
		if (position === 'server') {
			await handleServerLogic(teamMember, teamMembersOnSameTeamYearMonthAndDate, date);
		} else if (position === 'bartender') {
			await handleBartenderLogic(teamMember, teamMembersOnSameTeamYearMonthAndDate, date);
		}

		teamMember.markModified('workSchedule');
		await teamMember.save();

		res.status(200).json({
			success: true,
			message: 'Daily totals submitted successfully',
		});
	} catch (error) {
		next(error);
	}
};

async function handleServerLogic(server, teamMembers, date) {
	const bartenders = filterMembersByPosition(teamMembers, 'bartender');
	const runners = filterMembersByPosition(teamMembers, 'runner');
	const hosts = filterMembersByPosition(teamMembers, 'host');

	const serverDailyTotal = findDailyTotalByDate(server.dailyTotals, date);

	if (bartenders.length > 0) serverDailyTotal.barTipOuts = serverDailyTotal.potentialTipOuts.bartender;
	if (runners.length > 0) serverDailyTotal.runnerTipOuts = serverDailyTotal.potentialTipOuts.runner;
	if (hosts.length > 0) serverDailyTotal.hostTipOuts = serverDailyTotal.potentialTipOuts.host;

	serverDailyTotal.barTipOuts = serverDailyTotal.barTipOuts || 0;
    serverDailyTotal.runnerTipOuts = serverDailyTotal.runnerTipOuts || 0;
    serverDailyTotal.hostTipOuts = serverDailyTotal.hostTipOuts || 0;

	// Calculate totalTipOut and tipsReceived
	serverDailyTotal.totalTipOut =
		serverDailyTotal.barTipOuts + serverDailyTotal.runnerTipOuts + serverDailyTotal.hostTipOuts;
	serverDailyTotal.tipsReceived = serverDailyTotal.nonCashTips + serverDailyTotal.cashTips;
	serverDailyTotal.totalPayrollTips = serverDailyTotal.tipsReceived - serverDailyTotal.totalTipOut;

	await server.save(); 
	
	await distributeTips(bartenders, server.barTipOuts, date);
	await distributeTips(runners, server.runnerTipOuts, date);
	await distributeTips(hosts, server.hostTipOuts, date);

	await server.save(); 
}

async function handleBartenderLogic(bartender, teamMembers, date) {
	const servers = filterMembersByPosition(teamMembers, 'server');
	const bartenders = filterMembersByPosition(teamMembers, 'bartender');

	// Update the barTipOuts for each server
	await updateBarTipOuts(servers, date);

	// Recalculate totalBarTipOut after updating the barTipOuts for each server
	const totalBarTipOut = servers.reduce(
		(total, server) => total + findDailyTotalByDate(server.dailyTotals, date).barTipOuts,
		0
	);

	// Distribute the tips among the bartenders
	await distributeTips(bartenders, totalBarTipOut, date);
}

function filterMembersByPosition(members, position) {
	return members.filter((member) => member.position.toLowerCase() === position);
}

function findDailyTotalByDate(dailyTotals, date) {
	return dailyTotals.find((total) => total.date.getTime() === date.getTime());
}

async function updateBarTipOuts(servers, date) {
	for (let server of servers) {
		const serverDailyTotal = findDailyTotalByDate(server.dailyTotals, date);
		if (!serverDailyTotal) continue;

		serverDailyTotal.barTipOuts = serverDailyTotal.potentialTipOuts.bartender;
		await server.save();
	}
}

async function distributeTips(members, totalTipOut, date) {
	const splitTipOut = totalTipOut / members.length;
	for (let member of members) {
		const memberDailyTotal = findDailyTotalByDate(member.dailyTotals, date);
		if (!memberDailyTotal) continue;

		memberDailyTotal.tipsReceived += splitTipOut;
		memberDailyTotal.totalPayrollTips = memberDailyTotal.tipsReceived - memberDailyTotal.totalTipOut;
		await member.save();
	}
}

// Remove a daily total
exports.removeDailyTotal = async (req, res, next) => {
	try {
		const { teamMemberId, dailyTotalId } = req.params;

		// Retrieve the dailyTotal before removing it
		const teamMember = await TeamMember.findOne(
			{ _id: teamMemberId, 'dailyTotals._id': dailyTotalId },
			{ 'dailyTotals.$': 1 }
		);
		if (!teamMember) {
			return res.status(404).send({ message: 'Team member or daily total not found' });
		}

		const dailyTotal = teamMember.dailyTotals[0];
		const date = new Date(dailyTotal.date); // assuming dailyTotal.date is the date you want to remove
		const year = date.getFullYear();
		const month = date.getMonth();

		// Use MongoDB's $pull operator to directly remove the daily total we're interested in
		const result = await TeamMember.updateOne(
			{ _id: teamMemberId },
			{ $pull: { dailyTotals: { _id: dailyTotalId }, workSchedule: { year: year, month: month } } }
		);

		if (result.nModified === 0) {
			return res.status(404).send({ message: 'Team member or daily total not found' });
		}

		res.send({ message: 'Daily total deleted successfully' });
	} catch (err) {
		next(err);
	}
};

exports.updateDailyTotal = async (req, res, next) => {
	try {
		const { teamMemberId, dailyTotalId } = req.params;
		const updatedDailyTotal = req.body;

		const updatedTeamMember = await TeamMember.updateDailyTotal(teamMemberId, dailyTotalId, updatedDailyTotal);

		if (!updatedTeamMember) {
			return res.status(404).json({ message: 'Team member or daily total not found' });
		}

		res.status(200).json({
			success: true,
			message: 'Daily total updated successfully',
		});
	} catch (error) {
		next(error);
	}
};
