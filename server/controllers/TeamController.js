const { Team } = require('../models/DatabaseModel');
const { TeamMember } = require('../models/DatabaseModel');
require('dotenv').config();

exports.createTeam = async (req, res, next) => {
    const team = new Team(req.body);
    try {
        await team.save();
        res.status(201).send(team);
    } catch (error) {
        next(error);
    }
};

exports.getTeams = async (req, res, next) => {
    try {
        const teams = await Team.find({});
        res.send(teams);
    } catch (error) {
        next(error);
    }
};

exports.getTeam = async (req, res, next) => {
    try {
        const team = await Team.findById(req.params.teamId).populate('teamMembers');
        if (!team) {
            return res.status(404).send();
        }
        res.send(team);
    } catch (error) {
        next(error);
    }
};

exports.updateTeam = async (req, res, next) => {
    try {
        const team = await Team.findByIdAndUpdate(req.params.teamId, req.body, { new: true, runValidators: true });
        if (!team) {
            return res.status(404).send();
        }
        res.send(team);
    } catch (error) {
        next(error);
    }
};

exports.deleteTeam = async (req, res, next) => {
    try {
        const team = await Team.findByIdAndDelete(req.params.teamId);
        if (!team) {
            return res.status(404).send();
        }
        res.send(team);
    } catch (error) {
        next(error);
    }
};

exports.addTeamMember = async (req, res, next) => {
    const { teamId, teamMemberId } = req.params;
    try {
        const team = await Team.findById(teamId);
        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }
        team.teamMembers.push(teamMemberId);
        await team.save();

        // Add the team to the team member's teams
        const teamMember = await TeamMember.findById(teamMemberId);
        if (teamMember) {
            teamMember.teams.push(teamId);
            await teamMember.save();
        }

        res.json({ message: 'Team member added successfully' });
    } catch (error) {
        next(error);
    }
};

exports.removeTeamMember = async (req, res, next) => {
    const { teamId, teamMemberId } = req.params;
    try {
        const team = await Team.findById(teamId);
        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }
        const index = team.teamMembers.indexOf(teamMemberId);
        if (index > -1) {
            team.teamMembers.splice(index, 1);
            await team.save();

            // Remove the team from the team member's teams
            const teamMember = await TeamMember.findById(teamMemberId);
            if (teamMember) {
                const teamIndex = teamMember.teams.indexOf(teamId);
                if (teamIndex > -1) {
                    teamMember.teams.splice(teamIndex, 1);
                    await teamMember.save();
                }
            }
        }
        res.json({ message: 'Team member removed successfully' });
    } catch (error) {
        next(error);
    }
};