const express = require('express');
const router = express.Router();
const WorkScheduleController = require('../controllers/TeamMember/WorkScheduleController');

router.get('/teamMembers/allWorkSchedules', WorkScheduleController.getAllWorkSchedules);

router.get('/teamMembers/:teamMemberId/workSchedule', WorkScheduleController.getWorkSchedule);
router.get('/teamMembers/:teamId/workSchedule', WorkScheduleController.getWorkScheduleByTeam);
router.get('/teamMembers/:teamMemberId/workSchedule/:year/:month', WorkScheduleController.getWorkScheduleForYearAndMonth);


router.post('/teamMembers/:teamMemberId/workSchedule', WorkScheduleController.createWorkSchedule);
router.delete('/teamMembers/:teamMemberId/workSchedule', WorkScheduleController.deleteWorkSchedule);
router.delete('/teamMembers/:teamMemberId/workSchedule/:year/:month', WorkScheduleController.deleteWorkScheduleForMonth);

router.put('/teamMembers/:teamMemberId/workSchedule/addDate', WorkScheduleController.addDateToWorkSchedule);
router.put('/teamMembers/:teamMemberId/workSchedule/removeDate', WorkScheduleController.removeDateFromWorkSchedule);

module.exports = router;