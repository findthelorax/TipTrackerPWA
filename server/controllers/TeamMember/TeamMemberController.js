const { Team, TeamMember } = require('../../models/DatabaseModel');
require('dotenv').config();

exports.getTeamMembers = async (req, res, next) => {
	try {
		const teamMembers = await TeamMember.find();
		res.json(teamMembers);
	} catch (err) {
        next(err);
	}
};

exports.getTeamMember = async (req, res, next) => {
	const teamMemberId = req.params.teamMemberId;
	if (!teamMemberId) {
		return res.status(400).json({
			success: false,
			message: 'Team member ID is required',
		});
	}
	try {
		const teamMember = await TeamMember.findById(teamMemberId);
		if (!teamMember) {
			return res.status(404).json({
				success: false,
				message: 'Team member not found',
			});
		}
		return res.status(200).json({
			success: true,
			data: teamMember,
		});
	} catch (err) {
        next(err);
	}
};

exports.createTeamMember = async (req, res, next) => {
	const { firstName, lastName, position, teams } = req.body;

	if (!firstName || !lastName || !position) {
		return res.status(400).json({ error: 'First name, last name, and position are required' });
	}

	try {
		for (const teamId of teams) {
			const team = await Team.findById(teamId);
			if (!team) {
				return res.status(400).json({ error: `Team with id ${teamId} does not exist` });
			}
		}

		const newTeamMember = new TeamMember({
			firstName,
			lastName,
			position,
			teams
		});

		const savedTeamMember = await newTeamMember.save();

		for (const teamId of teams) {
            await Team.updateOne(
                { _id: teamId },
                { $push: { teamMembers: savedTeamMember._id } }
            );
        }
		
		res.status(201).json(savedTeamMember);
	} catch (err) {
		next(err);
	}
};

exports.updateTeamMember = async (req, res, next) => {
	const { firstName, lastName, position, teamId } = req.body;
	const teamMemberId = req.params.teamMemberId;

	if (!firstName || !lastName || !position) {
		return res.status(400).json({ error: 'Both first name, last name and position are required' });
	}

	try {
		const updatedMember = await TeamMember.findByIdAndUpdate(
			teamMemberId,
			{ firstName, lastName, position, teamId },
			{ new: true }
		);

		if (!updatedMember) {
			return res.status(404).json({ error: 'Team member not found' });
		}

		res.json(updatedMember);
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
};

exports.deleteTeamMember = async (req, res, next) => {
	const teamMemberId = req.params.teamMemberId;
	const teamMember = await TeamMember.findById(teamMemberId);
	if (!teamMember) {
		return res.status(404).json({
			success: false,
			message: 'Team member not found',
		});
	}
	try {
		for (const teamId of teamMember.teams) {
			await Team.updateOne(
				{ _id: teamId },
				{ $pull: { teamMembers: teamMemberId } }
			);
		}

		const deleted = await TeamMember.findByIdAndDelete(teamMemberId);
		if (!deleted) throw new Error('Deletion failed');
		res.json({
			message: `Team member ${teamMember.firstName} ${teamMember.lastName} (${teamMember.position}) was deleted`,
		});
	} catch (err) {
        next(err);
	}
};