const express = require('express');
const router = express.Router();
const TeamMembersController = require('../controllers/TeamMember/TeamMemberController');

router.get('/teamMembers', TeamMembersController.getTeamMembers);
router.get('/teamMembers/:teamMemberId', TeamMembersController.getTeamMember);

router.post('/teamMembers', TeamMembersController.createTeamMember);
router.patch('/teamMembers/:teamMemberId', TeamMembersController.updateTeamMember);
router.delete('/teamMembers/:teamMemberId', TeamMembersController.deleteTeamMember);

module.exports = router;