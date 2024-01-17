const express = require('express');
const router = express.Router();
const WorkScheduleController = require('../controllers/TeamMember/WorkScheduleController');

// WorkSchedule Routes
router.get('/teamMembers/allWorkSchedules', WorkScheduleController.getAllWorkSchedules);

router.get('/teamMembers/:teamMemberId/workSchedule', WorkScheduleController.getWorkSchedule);
router.get('/teamMembers/:teamMemberId/workSchedule/:month', WorkScheduleController.getWorkScheduleForMonth);

router.get('/teamMembers/:teamId/workSchedule', WorkScheduleController.getWorkScheduleByTeam);

// Create a new work schedule for a team member
router.post('/teamMembers/:teamMemberId/workSchedule', WorkScheduleController.createWorkSchedule);

router.put('/teamMembers/:teamMemberId/workSchedule/addDate', WorkScheduleController.addDateToWorkSchedule);
router.put('/teamMembers/:teamMemberId/workSchedule/removeDate', WorkScheduleController.removeDateFromWorkSchedule);

module.exports = router;