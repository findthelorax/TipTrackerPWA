const { TeamMember } = require('../../models/DatabaseModel');
require('dotenv').config();

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

exports.getWeeklyTotals = async (req, res, next) => {
	try {
		const teamMember = await TeamMember.findById(req.params.id);
		if (!teamMember) {
			return res.status(404).send();
		}

		const weeklyTotal = teamMember.getWeeklyTotals(req.query.weekStart);
		res.send(weeklyTotal);
	} catch (error) {
        next(error);
	}
};

exports.getOneTMWeeklyTotals = async (req, res, next) => {
	try {
		const { teamMemberId } = req.params;
		const teamMember = await TeamMember.findById(teamMemberId).select('weeklyTotals');

		if (!teamMember) {
			return res.status(404).json({ error: 'Team member not found' });
		}
		res.json(teamMember.weeklyTotals);
	} catch (error) {
        next(error);
	}
};

exports.getOneWeeklyTotals = async (req, res, next) => {
	try {
		const teamMember = await TeamMember.findById(req.params.teamMemberId);

		if (!teamMember) {
			return res.status(404).json({ message: 'Team member not found' });
		}

		const weekStart = moment(req.params.week);

		const weeklyTotal = teamMember.getWeeklyTotals(weekStart);

		if (!weeklyTotal) {
			return res.status(404).json({ message: 'Weekly total not found' });
		}

		res.status(200).json(weeklyTotal);
	} catch (error) {
        next(error);
	}
};

exports.createWeeklyTotals = async (req, res, next) => {
	try {
		const memberId = req.params.teamMemberId;
		const week = req.params.week;
		const weeklyTotalsData = { ...req.body, week };

		await TeamMember.updateOne({ _id: memberId }, { $push: { weeklyTotals: weeklyTotalsData } });

		const teamMember = await TeamMember.findById(memberId);
		res.json(teamMember.weeklyTotals);
	} catch (error) {
        next(error);
	}
};

// Delete a specific team member's weekly totals for a specific week
exports.deleteWeeklyTotals = async (req, res, next) => {
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
        next(error);
	}
};

exports.updateWeeklyTotalsPut = async (req, res, next) => {
	try {
		const teamMember = await TeamMember.findById(req.params.teamMemberId);

		if (!teamMember) {
			return res.status(404).json({ message: 'Team member not found' });
		}

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
        next(error);
	}
};

exports.updateWeeklyTotalsPatch = async (req, res, next) => {
	try {
		const weekStartLocal = moment(req.params.week).local().startOf('day').toDate();
		const weekStart = moment(req.params.week).startOf('week').toDate();

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
        next(error);
	}
};