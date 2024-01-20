const mongoose = require('mongoose');

async function updateTipOuts(date, operation) {
	const year = date.getUTCFullYear();
	const month = date.getUTCMonth() + 1;

	const workers = await this.model('TeamMember').find({
		workSchedule: {
			$elemMatch: {
				year: year,
				month: month,
				dates: {
					$elemMatch: {
						$eq: date,
					},
				},
			},
		},
	});

	const servers = workers.filter((worker) => worker.position.toLowerCase() === 'server');
	const hosts = workers.filter((worker) => worker.position.toLowerCase() === 'host');
	const runners = workers.filter((worker) => worker.position.toLowerCase() === 'runner');

	const foodTipOut = servers.reduce((total, server) => {
		const dailyTotal = server.dailyTotals.find((total) => total.date.getTime() === date.getTime());
		return total + (dailyTotal ? dailyTotal.potentialTipOuts[this.position] : 0);
	}, 0);

	const updateServers = {
		$set: {
			hostTipOuts: this.position === 'host' ? foodTipOut : 0,
			runnerTipOuts: this.position === 'runner' ? foodTipOut : 0,
		},
	};

	const updateHostsRunners = {
		$inc: {
			tipsReceived: operation === 'add' ? foodTipOut : -foodTipOut,
		},
	};

	await this.model('TeamMember').updateMany({ _id: { $in: servers.map((server) => server._id) } }, updateServers);
	await this.model('TeamMember').updateMany({ _id: { $in: hosts.map((host) => host._id) } }, updateHostsRunners);
	await this.model('TeamMember').updateMany(
		{ _id: { $in: runners.map((runner) => runner._id) } },
		updateHostsRunners
	);
};

async function handleServerLogic(server, bartenders, runners, hosts) {

	const serverDailyTotal = server.dailyTotals[0];

	if (bartenders.length > 0) serverDailyTotal.barTipOuts = serverDailyTotal.potentialTipOuts.bartender;
	if (runners.length > 0) serverDailyTotal.runnerTipOuts = serverDailyTotal.potentialTipOuts.runner;
	if (hosts.length > 0) serverDailyTotal.hostTipOuts = serverDailyTotal.potentialTipOuts.host;

	// Calculate totalTipOut and tipsReceived
	serverDailyTotal.totalTipOut =
		serverDailyTotal.barTipOuts + serverDailyTotal.runnerTipOuts + serverDailyTotal.hostTipOuts;
	serverDailyTotal.tipsReceived = serverDailyTotal.nonCashTips + serverDailyTotal.cashTips;
	serverDailyTotal.totalPayrollTips = serverDailyTotal.tipsReceived - serverDailyTotal.totalTipOut;

	await server.save(); 
	
	await distributeTips(bartenders, server.barTipOuts);
	await distributeTips(runners, server.runnerTipOuts);
	await distributeTips(hosts, server.hostTipOuts);

	await server.save(); 
}

async function handleBartenderLogic(bartenders, servers) {

    // Update the barTipOuts for each server
    await updateBarTipOuts(servers);

    // Recalculate totalBarTipOut after updating the barTipOuts for each server
    const totalBarTipOut = servers.reduce(
        (total, server) => total + server.dailyTotals[0].barTipOuts,
        0
    );
    console.log("🚀 ~ handleBartenderLogic ~ totalBarTipOut:", totalBarTipOut)

    await distributeTips.call(this, bartenders, totalBarTipOut);
}

async function updateBarTipOuts(servers) {
    for (let server of servers) {
        const dailyTotal = server.dailyTotals[0];
        dailyTotal.barTipOuts = dailyTotal.potentialTipOuts.bartender;
        await mongoose.model('TeamMember').updateOne(
            { _id: server._id, 'dailyTotals.date': dailyTotal.date },
            { $set: { 'dailyTotals.$': dailyTotal } }
        );
    }
}

async function distributeTips(members, totalTipOut) {
    const splitTipOut = totalTipOut / members.length;
    for (let member of members) {
        const memberDailyTotal = member.dailyTotals[0];
        memberDailyTotal.tipsReceived += splitTipOut;
        memberDailyTotal.totalPayrollTips = memberDailyTotal.tipsReceived - memberDailyTotal.totalTipOut;
        await mongoose.model('TeamMember').updateOne(
            { _id: member._id, 'dailyTotals.date': memberDailyTotal.date },
            { $set: { 'dailyTotals.$': memberDailyTotal } }
        );
    }
}

module.exports = {
    updateTipOuts,
    handleServerLogic,
    handleBartenderLogic,
};