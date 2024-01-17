const { TeamMember } = require('../../models/DatabaseModel');
const { Team } = require('../../models/DatabaseModel');
require('dotenv').config();

// Get All Team Members
exports.getTeamMembers = async (req, res) => {
	try {
		const teamMembers = await TeamMember.find();
		res.json(teamMembers);
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Server error' });
	}
};

exports.getTeamMember = async (req, res) => {
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
		console.log(err);
		return res.status(400).json({
			success: false,
			error: err,
		});
	}
};

exports.createTeamMember = async (req, res) => {
	const { firstName, lastName, position, teams } = req.body;
	if (!firstName || !lastName || !position) {
		return res.status(400).json({ error: 'Both first name, last name and position are required' });
	}

	const newMember = new TeamMember({ firstName, lastName, position, teams });

	try {
		const savedMember = await newMember.save();

		if (teams && teams.length > 0) {
			const team = await Team.findById(teams[0]);
			if (!team) {
				return res.status(404).json({ error: 'Team not found' });
			}
			team.teamMembers.push(savedMember._id);
			await team.save();
		}

		res.status(201).json(savedMember);
	} catch (error) {
		if (error.code === 11000) {
			res.status(400).json({
				error: `A team member ${firstName} ${lastName} - ${position} already exists.`,
			});
		} else {
			res.status(400).send({ message: error.message });
		}
	}
};

exports.updateTeamMember = async (req, res) => {
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

exports.deleteTeamMember = async (req, res) => {
	const teamMemberId = req.params.teamMemberId;
	const teamMember = await TeamMember.findById(teamMemberId);
	if (!teamMember) {
		return res.status(404).json({
			success: false,
			message: 'Team member not found',
		});
	}
	try {
		// Remove the team member from their teams
		for (const teamId of teamMember.teams) {
			await Team.updateOne(
				{ _id: teamId },
				{ $pull: { teamMembers: teamMemberId } }
			);
		}

		// Delete the team member
		const deleted = await TeamMember.findByIdAndDelete(teamMemberId);
		if (!deleted) throw new Error('Deletion failed');
		res.json({
			message: `Team member ${teamMember.firstName} ${teamMember.lastName} (${teamMember.position}) was deleted`,
		});
	} catch (error) {
		console.error(`Error deleting team member ${teamMemberId}:`, error);
		res.status(500).json({ error: 'Internal Server Error' });
	}
};