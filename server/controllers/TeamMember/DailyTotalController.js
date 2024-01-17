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

// Remove a daily total
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

		// Remove date from workSchedule
		const date = new Date(dailyTotal.date); // assuming dailyTotal.date is the date you want to remove
		teamMember.removeDateFromWorkSchedule(date);

		// Remove dailyTotal
		try {
			teamMember.removeDailyTotal(dailyTotalId);
			teamMember.markModified('dailyTotals');
			teamMember.markModified('workSchedule');
			await teamMember.save();
			res.send({ message: 'Daily total deleted successfully' });
		} catch (err) {
			next(err);
		}
	} catch (error) {
		next(error);
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