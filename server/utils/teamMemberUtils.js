const { TIP_OUT_RATES } = require('./constants');

function calculateFoodTipOut(position, foodSales) {
    return foodSales * (TIP_OUT_RATES[position] || 0);
}

function calculateBarTipOut(barSales) {
    return barSales * TIP_OUT_RATES.bartender;
}

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

	serverDailyTotal.barTipOuts = serverDailyTotal.barTipOuts || 0;
    serverDailyTotal.runnerTipOuts = serverDailyTotal.runnerTipOuts || 0;
    serverDailyTotal.hostTipOuts = serverDailyTotal.hostTipOuts || 0;

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

async function handleBartenderLogic(bartender, servers, bartenders) {
console.log("🚀 ~ handleBartenderLogic ~ servers:", servers)
console.log("🚀 ~ handleBartenderLogic ~ bartenders:", bartenders)
console.log("🚀 ~ handleBartenderLogic ~ bartender:", bartender)

    // Update the barTipOuts for each server
    await updateBarTipOuts(servers);

    // Recalculate totalBarTipOut after updating the barTipOuts for each server
    const totalBarTipOut = servers.reduce(
        (total, server) => total + server.dailyTotals[0].barTipOuts,
        0
    );
    console.log("🚀 ~ handleBartenderLogic ~ totalBarTipOut:", totalBarTipOut)

    const allBartenders = [...bartenders, bartender];
    console.log("🚀 ~ handleBartenderLogic ~ allBartenders:", allBartenders)
    await distributeTips(allBartenders, totalBarTipOut);
}

async function updateBarTipOuts(servers) {
    for (let server of servers) {

        // Update the barTipOuts for each server
        server.dailyTotals[0].barTipOuts = calculateBarTipOuts(server);
        await server.save();
    }
}

async function distributeTips(members, totalTipOut) {
	console.log("🚀 ~ distributeTips ~ members:", members)
	const splitTipOut = totalTipOut / members.length;
	for (let member of members) {
		const memberDailyTotal = member.dailyTotals;
		if (!memberDailyTotal) continue;

		memberDailyTotal.tipsReceived += splitTipOut;
		memberDailyTotal.totalPayrollTips = memberDailyTotal.tipsReceived - memberDailyTotal.totalTipOut;
		await member.save();
	}
}

module.exports = {
    calculateFoodTipOut,
    calculateBarTipOut,
    updateTipOuts,
    handleServerLogic,
    handleBartenderLogic,
};