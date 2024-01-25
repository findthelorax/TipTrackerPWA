const mongoose = require('mongoose');
const { TIP_OUT_RATES } = require('../utils/constants');

const DailyTotalSchema = new mongoose.Schema({
	teamMember: { type: mongoose.Schema.Types.ObjectId, ref: 'TeamMember' },
	year: Number,
	month: Number,
	date: Date,
	foodSales: Number,
	barSales: Number,
	nonCashTips: Number,
	cashTips: Number,
	bartenderTipOuts: Number,
	runnerTipOuts: Number,
	hostTipOuts: Number,
	potentialTipOuts: {
		host: {
			type: Number,
			default: function () {
				return this.foodSales * TIP_OUT_RATES.host;
			},
		},
		runner: {
			type: Number,
			default: function () {
				return this.foodSales * TIP_OUT_RATES.runner;
			},
		},
		bartender: {
			type: Number,
			default: function () {
				return this.barSales * TIP_OUT_RATES.bartender;
			},
		},
	},
	totalTipOut: {
		type: Number,
		default: function () {
			return (this.barTipOuts || 0) + (this.runnerTipOuts || 0) + (this.hostTipOuts || 0);
		},
	},
	guestTipsReceived: {
		type: Number,
		default: function () {
			return (this.nonCashTips || 0) + (this.cashTips || 0);
		},
	},
	serverTipsReceived: Number,
	totalPayrollTips: {
		type: Number,
		default: function () {
			return (this.guestTipsReceived || 0) + (this.serverTipsReceived || 0) - (this.totalTipOut || 0);
		},
	},
});

DailyTotalSchema.pre('save', function (next) {
	this.year = this.date.getUTCFullYear();
	this.month = this.date.getUTCMonth() + 1;
	next();
});

module.exports = DailyTotalSchema;