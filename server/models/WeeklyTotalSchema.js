const mongoose = require('mongoose');

const WeeklyTotalSchema = new mongoose.Schema({
	team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
	teamMember: { type: mongoose.Schema.Types.ObjectId, ref: 'TeamMember' },
	year: Number,
	month: Number,
	weekStart: Date,
	weekEnd: Date,
	foodSales: Number,
	barSales: Number,
	nonCashTips: Number,
	cashTips: Number,
	barTipOuts: Number,
	runnerTipOuts: Number,
	hostTipOuts: Number,
	totalTipOut: {
		type: Number,
		default: function () {
			return (this.barTipOuts || 0) + (this.runnerTipOuts || 0) + (this.hostTipOuts || 0);
		},
	},
	tipsReceived: {
		type: Number,
		default: function () {
			return (this.nonCashTips || 0) + (this.cashTips || 0);
		},
	},
	totalPayrollTips: {
		type: Number,
		default: function () {
			return (this.nonCashTips || 0) + (this.cashTips || 0) - (this.totalTipOut || 0);
		},
	},
});

WeeklyTotalSchema.pre('save', function (next) {
	this.year = this.weekStart.getUTCFullYear();
	this.month = this.weekStart.getUTCMonth() + 1;
	this.weekStart = startOfWeek(this.date, { weekStartsOn: 1 });
	this.weekEnd = endOfWeek(this.date, { weekStartsOn: 1 });
	next();
});


module.exports = WeeklyTotalSchema;