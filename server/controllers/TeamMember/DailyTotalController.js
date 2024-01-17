const { TeamMember } = require('../../models/DatabaseModel');
require('dotenv').config();
const { parseISO, isValid } = require('date-fns');

function validateDailyTotal(dailyTotal) {
    dailyTotal.date = parseISO(dailyTotal.date);
    return (
        isValid(dailyTotal.date) && dailyTotal.foodSales && dailyTotal.barSales && dailyTotal.nonCashTips && dailyTotal.cashTips
    );
}

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
exports.getDailyTotals = async (req, res) => {
	try {
		const { teamMemberId } = req.params;
		const teamMember = await TeamMember.findById(teamMemberId);

		if (!teamMember) {
			return res.status(404).json({ error: 'Team member not found' });
		}
		res.json(teamMember.dailyTotals);
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: error.message });
	}
};

// Route to get a specific team member's daily total for a specific date
exports.getDailyTotal = async (req, res) => {
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
		console.error('Error getting daily total:', error);
		res.status(500).json({ error: error.message });
	}
};

// Create daily total for a specific team member
exports.createDailyTotal = async (req, res) => {
    try {
		const { teamMemberId } = req.params;
		const dailyTotal = req.body;
        
		// Validate dailyTotal
		if (!validateDailyTotal(dailyTotal)) {
            return res.status(400).json({
                success: false,
				message: 'dailyTotal must have all required fields.',
			});
		}

		// Check if a daily total for the same date and teamMember already exists
		const existingEntry = await TeamMember.findOne({
            _id: teamMemberId,
			dailyTotals: { $elemMatch: { date: dailyTotal.date } },
		});
        
		if (existingEntry) {
            return res.status(400).json({
				success: false,
				message: 'A daily total for this date and team member already exists.',
			});
		}

		const teamMember = await TeamMember.findById(teamMemberId);
		teamMember.addDailyTotal(dailyTotal);
		// teamMember.updateWeeklyTotals();
		teamMember.markModified('dailyTotals');
		await teamMember.save();
        
		res.status(200).json({
            success: true,
			message: 'Daily totals submitted successfully',
		});
	} catch (error) {
        console.error('Error processing dailyTotals request:', error);
		res.status(500).json({
            success: false,
			message: 'Failed to submit daily totals',
		});
	}
};

// Remove a daily total
exports.removeDailyTotal = async (req, res) => {
    try {
        const { teamMemberId, dailyTotalId } = req.params;

        const teamMember = await TeamMember.findById(teamMemberId);
        if (!teamMember) {
            return res.status(404).send({ message: 'Team member not found' });
        }

        try {
            teamMember.removeDailyTotal(dailyTotalId);
            teamMember.markModified('dailyTotals');
            await teamMember.save();
            res.send({ message: 'Daily total deleted successfully' });
        } catch (err) {
            console.error('Error deleting daily total:', err);
            next(err);
        }
    } catch (error) {
        console.error('Error deleting daily total:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// Delete daily totals for a specific team member
exports.deleteDailyTotal = async (req, res) => {
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

		// Save the date of the daily total before removing it
		const dailyTotalDate = teamMember.dailyTotals[dailyTotalIndex].date;

		teamMember.dailyTotals.splice(dailyTotalIndex, 1);
		teamMember.updateWeeklyTotals(dailyTotalDate);
		teamMember.markModified('dailyTotals');

		try {
			await teamMember.save();
			res.send({ message: 'Daily total deleted successfully' });
		} catch (err) {
			console.error('Error deleting daily total:', err);
			next(err);
		}
	} catch (error) {
		console.error('Error deleting daily total:', error);
		res.status(500).json({ message: 'Internal Server Error' });
	}
};

// Update daily totals for a specific team member
exports.updateDailyTotal = async (req, res) => {
	try {
		const { teamMemberId, dailyTotalId } = req.params;
		const updatedDailyTotal = req.body;
		const teamMember = await TeamMember.findById(teamMemberId);

		if (!teamMember) {
			return res.status(404).json({ message: 'Team member not found' });
		}

		const dailyTotal = teamMember.dailyTotals.id(dailyTotalId);

		if (!dailyTotal) {
			return res.status(404).json({ message: 'Daily total not found' });
		}

		dailyTotal.set(updatedDailyTotal);
		teamMember.updateWeeklyTotals();
		teamMember.markModified('dailyTotals');

		try {
			await teamMember.save();
		} catch (saveError) {
			console.error('Error saving team member:', saveError);
			throw saveError;
		}

		res.status(200).json({
			success: true,
			message: 'Daily total updated successfully',
		});
	} catch (error) {
		console.error('Error updating daily total:', error);
		res.status(500).json({
			success: false,
			message: 'Internal Server Error',
		});
	}
};