const express = require('express');
const router = express.Router();
const WorkScheduleController = require('../controllers/TeamMember/WorkScheduleController');

router.route('/teamMembers/allWorkSchedules')
    .get((req, res, next) => WorkScheduleController.getAllWorkSchedules(req, res, next));

router.route('/teamMembers/:teamMemberId/workSchedule')
    .get((req, res, next) => WorkScheduleController.getWorkSchedule(req, res, next))
    .post((req, res, next) => WorkScheduleController.createWorkSchedule(req, res, next))
    .delete((req, res, next) => WorkScheduleController.deleteWorkSchedule(req, res, next))
    .put((req, res, next) => WorkScheduleController.addDateToWorkSchedule(req, res, next));

router.route('/teamMembers/:teamId/workSchedule')
    .get((req, res, next) => WorkScheduleController.getWorkScheduleByTeam(req, res, next));

router.route('/teamMembers/:teamMemberId/workSchedule/:year/:month')
    .get((req, res, next) => WorkScheduleController.getWorkScheduleForYearAndMonth(req, res, next))
    .delete((req, res, next) => WorkScheduleController.deleteWorkScheduleForMonth(req, res, next));

router.route('/teamMembers/:teamMemberId/workSchedule/addDate')
    .post((req, res, next) => WorkScheduleController.addWorkDate(req, res, next))
    .put((req, res, next) => WorkScheduleController.addDateToWorkSchedule(req, res, next));

router.route('/teamMembers/:teamMemberId/workSchedule/removeDate')
    .put((req, res, next) => WorkScheduleController.removeDateFromWorkSchedule(req, res, next));

module.exports = router;