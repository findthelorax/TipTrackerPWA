const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TeamSchema = new Schema({
    teamName: {
        type: String,
        required: true,
        unique: true,
    },
    teamMembers: [{
        type: Schema.Types.ObjectId,
        ref: 'TeamMember'
    }]
});

TeamSchema.index({ teamName: 1 }, { unique: true });

const Team = mongoose.model('Team', TeamSchema, 'teams');

module.exports = Team;