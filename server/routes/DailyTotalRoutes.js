const express = require('express');
const router = express.Router();
const DailyTotalController = require('../controllers/TeamMember/DailyTotalController');

// DailyTotal Routes
router.get('/teamMembers/:teamMemberId/dailyTotals', DailyTotalController.getDailyTotals);
router.get('/teamMembers/:teamMemberId/:dailyTotalId', DailyTotalController.getDailyTotal);

router.get('/teamMembers/allDailyTotals', DailyTotalController.getAllDailyTotals);

router.post('/teamMembers/:teamMemberId/dailyTotals', DailyTotalController.createDailyTotal);
router.patch('/teamMembers/:teamMemberId/dailyTotals/:dailyTotalId', DailyTotalController.updateDailyTotal);
router.delete('/teamMembers/:teamMemberId/dailyTotals/:dailyTotalId', DailyTotalController.removeDailyTotal);

module.exports = router;