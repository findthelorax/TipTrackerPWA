const TeamMember = require('../../models/TeamMemberModel');
require('dotenv').config();
const { handleDailyTotalLogic } = require('../../utils/teamMemberUtils');
const { addDateToWorkSchedule, removeDateFromWorkSchedule } = require('../TeamMember/WorkScheduleController');

exports.getAllDailyTotals = async (req, res, next) => {
	try {
		const teamMembers = await TeamMember.find({});
		const dailyTotalsAll = teamMembers.flatMap((teamMember) => teamMember.dailyTotals);
		res.json(dailyTotalsAll);
	} catch (err) {
		console.error(`Error getting daily totals: ${error.message}`);
		next(err);
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
	} catch (err) {
		next(err);
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
	} catch (err) {
		next(err);
	}
};

exports.createDailyTotal = async (req, res, next) => {
	try {
		const { teamMemberId } = req.params;
		const dailyTotal = req.body;

		let teamMember = await TeamMember.findById(teamMemberId);
		if (!teamMember) {
			return res.status(404).json({ message: 'Team member not found' });
		}

		teamMember = await teamMember.addDailyTotal(dailyTotal);
		await addDateToWorkSchedule(teamMember, dailyTotal, next);

		res.status(200).json({
			success: true,
			message: 'Daily totals submitted successfully',
		});
	} catch (err) {
		next(err);
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

		await teamMember.removeDailyTotal(dailyTotalId);
		await removeDateFromWorkSchedule(teamMember, dailyTotal);

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
		console.log('🚀 ~ exports.updateDailyTotal= ~ updatedTeamMember:', updatedTeamMember);

		if (!updatedTeamMember) {
			return res.status(404).json({ message: 'Team member or daily total not found' });
		}
		const teamMemberPosition = updatedTeamMember.position.toLowerCase();
		await handleDailyTotalLogic(updatedTeamMember, teamMemberPosition);

		res.status(200).json({
			success: true,
			message: 'Daily total updated successfully',
		});
	} catch (err) {
		next(err);
	}
};