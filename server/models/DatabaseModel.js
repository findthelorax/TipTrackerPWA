const mongoose = require('mongoose');
const TeamMember = require('./TeamMemberModel');
const Team = require('./TeamModel');
// const { User } = require('./user');
require('dotenv').config();

const db = mongoose.createConnection(process.env.MONGODB);

// const UserModel = db.model('User', User.schema, 'users');
const TeamModel = db.model('Team', Team.schema, 'teams');
const TeamMemberModel = db.model('TeamMember', TeamMember.schema, 'teamMembers');

module.exports = { Team: TeamModel, TeamMember: TeamMemberModel };