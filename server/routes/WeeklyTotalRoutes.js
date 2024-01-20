const express = require('express');
const router = express.Router();
const WeeklyTotalController = require('../controllers/TeamMember/WeeklyTotalController');

router.get('/teamMembers/:teamMemberId/weeklyTotals/', WeeklyTotalController.getOneTMWeeklyTotals);
router.get('/teamMembers/:teamMemberId/weeklyTotals/:week', WeeklyTotalController.getOneWeeklyTotals);

router.get('/teamMembers/allWeeklyTotals', WeeklyTotalController.getAllWeeklyTotals);

router.post('/teamMembers/:teamMemberId/weeklyTotals/:week', WeeklyTotalController.createWeeklyTotals);

router.put('/teamMembers/:teamMemberId/updateWeeklyTotals', WeeklyTotalController.updateWeeklyTotalsPut);
router.patch('/teamMembers/:teamMemberId/weeklyTotals/:week', WeeklyTotalController.updateWeeklyTotalsPatch);

router.delete('/teamMembers/:teamMemberId/weeklyTotals/:week', WeeklyTotalController.deleteWeeklyTotals);

module.exports = router;