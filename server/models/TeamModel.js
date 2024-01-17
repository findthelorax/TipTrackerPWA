const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TeamSchema = new Schema({
    teamName: {
        type: String,
        required: true,
    },
    teamMembers: [{
        type: Schema.Types.ObjectId,
        ref: 'TeamMember'
    }]
});

const Team = mongoose.model('Team', TeamSchema, 'teams');

module.exports = Team;