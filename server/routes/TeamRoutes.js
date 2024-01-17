const express = require('express');
const router = express.Router();
const TeamController = require('../controllers/TeamController');

router.get('/teams', TeamController.getTeams);
router.get('/teams/:teamId', TeamController.getTeam);

router.post('/teams', TeamController.createTeam);
router.delete('/teams/:teamId', TeamController.deleteTeam);
router.patch('/teams/:teamId', TeamController.updateTeam);

router.post('/teams/:teamId/:teamMemberId', TeamController.addTeamMember);
router.delete('/teams/:teamId/:teamMemberId', TeamController.removeTeamMember);

module.exports = router;