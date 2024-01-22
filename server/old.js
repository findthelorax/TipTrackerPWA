const { TeamMember } = require('../../models/DatabaseModel');
require('dotenv').config();
const { parseISO, getYear, getMonth } = require('date-fns');
const { handleServerLogic, handleBartenderLogic } = require('../../utils/teamMemberUtils');

async function findTeamMembers(team, year, month, date) {
	// Find teamMembers by workSchedule date
	const teamMembers = await TeamMember.find({
		teams: team,
		'workSchedule.year': year,
		'workSchedule.month': month,
		'workSchedule.dates': date,
	});

	// For each teamMember, get the dailyTotal that matches the date
	const teamMembersWithDailyTotal = await Promise.all(
		teamMembers.map(async (teamMember) => {
			return await TeamMember.findOne(
				{ _id: teamMember._id, 'dailyTotals.year': year, 'dailyTotals.month': month, 'dailyTotals.date': date },
				{ position: 1, 'dailyTotals.$': 1 } // Fetch position and the first matching dailyTotal
			);
		})
	);

	// Return an object that includes both the team members and their positions
	return {
		teamMembers: teamMembersWithDailyTotal,
		positions: separateMembersByPosition(teamMembersWithDailyTotal),
		positionCounts: countPositions(teamMembersWithDailyTotal),
	};
}

function separateMembersByPosition(members) {
	const positions = {
		bartender: [],
		server: [],
		runner: [],
		host: [],
	};

	members.forEach((member) => {
		const position = member.position.toLowerCase();
		if (positions[position]) {
			positions[position].push(member);
		}
	});

	return positions;
}

function countPositions(teamMembers) {
	return teamMembers.reduce((counts, member) => {
		counts[member.position] = (counts[member.position] || 0) + 1;
		return counts;
	}, {});
}

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

exports.createDailyTotal = async (req, res, next) => {
	try {
		const { teamMemberId } = req.params;
		const dailyTotal = req.body;

		const teamMember = await TeamMember.findById(teamMemberId);
		if (!teamMember) {
			return res.status(404).json({ message: 'Team member not found' });
		}

		const position = teamMember.position.toLowerCase();
		const team = teamMember.teams;

		const date = parseISO(dailyTotal.date);
		const year = date.getUTCFullYear();
		const month = date.getUTCMonth() + 1;

		teamMember.validateDailyTotal(dailyTotal);
		teamMember.addDateToWorkSchedule(year, month, date);

		await teamMember.addDailyTotal(dailyTotal);
		await teamMember.save();

        const { teamMembers, positions, positionCounts } = await findTeamMembers(team, year, month, date);
        console.log("🚀 ~ file: DailyTotalController.js:130 ~ exports.createDailyTotal= ~ positionCounts:", positionCounts)

        const bartenders = positions.bartender;
        const servers = positions.server;
        const runners = positions.runner;
        const hosts = positions.host;

        // Find the current server in the servers array
        const currentServer = servers.find(server => server._id.toString() === teamMemberId);
        console.log("🚀 ~ file: DailyTotalController.js:141 ~ exports.createDailyTotal= ~ currentServer:", currentServer)
        if (!currentServer) {
            throw new Error('Current server not found in servers array');
        }

        // Get the daily total of the current server
        const currentServerDailyTotal = currentServer.dailyTotals[0];
        if (!currentServerDailyTotal) {
            throw new Error('Current server does not have a daily total');
        }

		// Based on the position of the teamMember whose dailyTotal is being added, perform the necessary logic

        // Logic for when a server's dailyTotal is added
        if (position === 'server') {
            await handleServerLogic(currentServer._id, currentServerDailyTotal, servers, bartenders, runners, hosts);
        } else if (position === 'bartender') {
            await handleBartenderLogic(bartenders, servers);
        }

		await teamMember.save();

		res.status(200).json({
			success: true,
			message: 'Daily totals submitted successfully',
		});
	} catch (error) {
		next(error);
	}
};

exports.removeDailyTotal = async (req, res, next) => {
	try {
		const { teamMemberId, dailyTotalId } = req.params;
		const teamMember = await TeamMember.findById(teamMemberId);

		if (!teamMember) {
			return res.status(404).send({ message: 'Team member not found' });
		}

		const dailyTotal = teamMember.dailyTotals.id(dailyTotalId);
		if (!dailyTotal) {
			return res.status(404).send({ message: 'Daily total not found' });
		}

		const date = new Date(dailyTotal.date);
		const year = date.getFullYear();
		const month = date.getMonth() + 1;

		await teamMember.removeDailyTotal(dailyTotalId);
		teamMember.removeDateFromWorkSchedule(year, month, date);
		await teamMember.save();

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

exports.createDailyTotal = async (req, res, next) => {
    try {
        const { teamMemberId } = req.params;
        const dailyTotal = req.body;

        const teamMember = await TeamMember.findById(teamMemberId);
        if (!teamMember) {
            return res.status(404).json({ message: 'Team member not found' });
        }

        const teamMemberPosition = teamMember.position.toLowerCase();
        const teamMemberTeam = teamMember.teams;

        const dailyTotalDate = parseISO(dailyTotal.date);
        const dailyTotalYear = date.getUTCFullYear();
        const dailyTotalMonth = date.getUTCMonth() + 1;

        await teamMember.addDailyTotal(dailyTotal);
        teamMember.addDateToWorkSchedule(year, month, date);

        const teamMembersOnSameTeamYearMonthAndDate = await findTeamMembers(teamMemberTeam, dailyTotalYear, dailyTotalMonth, dailyTotalDate, teamMemberId);

        const positionCounts = countPositions(teamMembersOnSameTeamYearMonthAndDate);
        console.log('🚀 ~ positionCounts ~ positionCounts:', positionCounts);

        await handleDailyTotalLogic(teamMembersOnSameTeamYearMonthAndDate, teamMemberPosition);
        await teamMember.save();

        res.status(200).json({
            success: true,
            message: 'Daily totals submitted successfully',
        });
    } catch (error) {
        next(error);
    }
};