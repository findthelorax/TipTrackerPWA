const { TeamMember } = require('../../models/DatabaseModel');
require('dotenv').config();

// Get All Weekly Totals
exports.getAllWeeklyTotals = async (req, res, next) => {
	try {
		const teamMembers = await TeamMember.find({});
		const weeklyTotalsAll = teamMembers.flatMap((teamMember) => teamMember.weeklyTotals);
		res.json(weeklyTotalsAll);
	} catch (error) {
		console.error(`Error getting weekly totals: ${error.message}`);
		next(error);
	}
};

// Get weekly totals
exports.getWeeklyTotals = async (req, res) => {
	try {
		const teamMember = await TeamMember.findById(req.params.id);
		if (!teamMember) {
			return res.status(404).send();
		}

		const weeklyTotal = teamMember.getWeeklyTotals(req.query.weekStart);
		res.send(weeklyTotal);
	} catch (error) {
		res.status(500).send(error);
	}
};


// Route to get all weekly totals for a specific team member
exports.getOneTMWeeklyTotals = async (req, res) => {
	try {
		const { teamMemberId } = req.params;
		const teamMember = await TeamMember.findById(teamMemberId).select('weeklyTotals');

		if (!teamMember) {
			return res.status(404).json({ error: 'Team member not found' });
		}
		res.json(teamMember.weeklyTotals);
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: error.message });
	}
};

// Route to get a specific team member's weekly totals for a specific week
exports.getOneWeeklyTotals = async (req, res) => {
	try {
		const teamMember = await TeamMember.findById(req.params.teamMemberId);

		if (!teamMember) {
			return res.status(404).json({ message: 'Team member not found' });
		}

		// Parse the week parameter into a Date object
		const weekStart = moment(req.params.week);

		const weeklyTotal = teamMember.getWeeklyTotals(weekStart);

		if (!weeklyTotal) {
			return res.status(404).json({ message: 'Weekly total not found' });
		}

		res.status(200).json(weeklyTotal);
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
};

// Route to create a specific team member's weekly totals for a specific week
exports.createWeeklyTotals = async (req, res) => {
	try {
		const memberId = req.params.teamMemberId;
		const week = req.params.week;
		const weeklyTotalsData = { ...req.body, week };

		await TeamMember.updateOne({ _id: memberId }, { $push: { weeklyTotals: weeklyTotalsData } });

		const teamMember = await TeamMember.findById(memberId);
		res.json(teamMember.weeklyTotals);
	} catch (error) {
		console.error('Error adding weekly totals:', error);
		res.status(500).json({ error: 'Internal Server Error' });
	}
};

// Delete a specific team member's weekly totals for a specific week
exports.deleteWeeklyTotals = async (req, res) => {
	try {
		const memberId = req.params.teamMemberId;
		const week = req.params.week;
		const teamMember = await TeamMember.findById(memberId);

		// Filter out the week to be deleted
		// teamMember.weeklyTotals = teamMember.weeklyTotals.filter(total => total.week !== week);
		teamMember.weeklyTotals = teamMember.weeklyTotals.filter((total) => total.week !== week.toString());
		await teamMember.save();
		res.json({
			message: `Weekly totals for the week ${week} for team member ${memberId} deleted`,
		});
	} catch (error) {
		console.error(`Error deleting weekly totals for team member ${memberId}:`, error);
		res.status(500).json({ error: 'Internal Server Error' });
	}
};

exports.updateWeeklyTotalsPut = async (req, res) => {
	try {
		const teamMember = await TeamMember.findById(req.params.teamMemberId);

		if (!teamMember) {
			return res.status(404).json({ message: 'Team member not found' });
		}

		// Create a new date using moment and set it to the start of the week
		const weekStartLocal = moment().local().startOf('week').toDate();
		const weekStart = moment().startOf('week').toDate();

		const existingWeeklyTotal = teamMember.weeklyTotals.find((total) =>
			moment(total.week).local().startOf('week').isSame(weekStart, 'week')
		);
		if (existingWeeklyTotal) {
			return res.status(400).json({ message: 'Weekly total for this week already exists' });
		}

		teamMember.updateWeeklyTotals();

		await teamMember.save();

		res.status(200).json(teamMember);
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
};

exports.updateWeeklyTotalsPatch = async (req, res) => {
	try {
		// Parse the date string from the client using moment
		const weekStartLocal = moment(req.params.week).local().startOf('day').toDate();
		const weekStart = moment(req.params.week).startOf('week').toDate();

		// Check for existing weekly total for the same week
		const existingWeeklyTotal = await TeamMember.findOne({
			_id: req.params.teamMemberId,
			'weeklyTotals.week': weekStart,
		});
		if (existingWeeklyTotal) {
			return res.status(400).json({ message: 'Weekly total for this week already exists' });
		}

		const result = await TeamMember.updateOne(
			{ _id: req.params.teamMemberId, 'weeklyTotals.week': weekStart },
			{
				$set: {
					'weeklyTotals.$[elem].foodSales': req.body.foodSales,
					'weeklyTotals.$[elem].barSales': req.body.barSales,
					'weeklyTotals.$[elem].nonCashTips': req.body.nonCashTips,
					'weeklyTotals.$[elem].cashTips': req.body.cashTips,
					'weeklyTotals.$[elem].barTipOuts': req.body.barTipOuts,
					'weeklyTotals.$[elem].runnerTipOuts': req.body.runnerTipOuts,
					'weeklyTotals.$[elem].hostTipOuts': req.body.hostTipOuts,
					'weeklyTotals.$[elem].totalTipOut': req.body.totalTipOut,
					'weeklyTotals.$[elem].tipsReceived': req.body.tipsReceived,
					'weeklyTotals.$[elem].totalPayrollTips': req.body.totalPayrollTips,
				},
			},
			{
				arrayFilters: [{ 'elem.week': weekStart }],
			}
		);

		if (result.nModified === 0) {
			return res.status(404).json({ message: 'Weekly total not found' });
		}

		res.status(200).json({ message: 'Weekly total updated' });
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
};