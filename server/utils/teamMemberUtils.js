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
}

async function updateServersTipOuts(servers, position) {
	console.log("🚀 ~ file: teamMemberUtils.js:52 ~ updateServersTipOuts ~ servers:", servers)
	console.log("🚀 ~ file: teamMemberUtils.js:52 ~ updateServersTipOuts ~ position:", position)
	for (let server of servers) {
		const dailyTotal = server.dailyTotals[0];
		if (dailyTotal.potentialTipOuts) { // Check if potentialTipOuts is not null
			const tipOut = dailyTotal.potentialTipOuts[position] || 0;
			dailyTotal[`${position}TipOuts`] = tipOut;
			// Only calculate totalTipOut for the positions that worked
			dailyTotal.totalTipOut = Object.keys(dailyTotal.potentialTipOuts)
				.filter(pos => pos === position)
				.reduce((total, pos) => total + dailyTotal.potentialTipOuts[pos], 0);
		}
		await mongoose
			.model('TeamMember')
			.updateOne(
				{ _id: server._id, 'dailyTotals.date': dailyTotal.date },
				{ $set: { 'dailyTotals.$': dailyTotal } }
			);
	}
}

async function distributeTips(teamMembers, totalTipOut) {
	const splitTipOut = totalTipOut / teamMembers.length;
	for (let teamMember of teamMembers) {
		const teamMemberDailyTotal = teamMember.dailyTotals[0];
		teamMemberDailyTotal.serverTipsReceived = splitTipOut;
		teamMemberDailyTotal.totalPayrollTips = teamMemberDailyTotal.guestTipsReceived + teamMemberDailyTotal.serverTipsReceived - teamMemberDailyTotal.totalTipOut;

		await mongoose
			.model('TeamMember')
			.updateOne(
				{ _id: teamMember._id, 'dailyTotals.date': teamMemberDailyTotal.date },
				{ $set: { 'dailyTotals.$': teamMemberDailyTotal } }
			);
	}
}
function separateMembersByPosition(teamMembers) {
    const positions = {
        bartender: [],
        server: [],
        runner: [],
        host: [],
    };

    teamMembers.forEach((teamMember) => {
        const position = teamMember.position.toLowerCase();
        if (positions[position]) {
            positions[position].push(teamMember);
        }
    });

    return positions;
}

async function handlePositionLogic(servers, positionMembers, position) {
    await updateServersTipOuts(servers, position);

    const totalTipOut = servers.reduce((total, server) => total + server.dailyTotals[0][`${position}TipOuts`], 0);
    console.log("🚀 ~ handlePositionLogic ~ totalTipOut:", totalTipOut)

    await distributeTips.call(this, positionMembers, totalTipOut);
}

async function handleServerAddedLogic(servers, bartenders, runners, hosts) {
console.log("🚀 ~ file: teamMemberUtils.js:109 ~ handleServerAddedLogic ~ servers:", servers)

	if (bartenders.length > 0) {
		await updateServersTipOuts(servers, 'bartender');
	}
	if (runners.length > 0) {
		await updateServersTipOuts(servers, 'runner');
	}
	if (hosts.length > 0) {
		await updateServersTipOuts(servers, 'host');
	}

	const totalBartenderTipOut = servers.reduce((total, server) => total + (server.dailyTotals[0].bartenderTipOuts || 0), 0);
	const totalRunnerTipOut = servers.reduce((total, server) => total + (server.dailyTotals[0].runnerTipOuts || 0), 0);
	const totalHostTipOut = servers.reduce((total, server) => total + (server.dailyTotals[0].hostTipOuts || 0), 0);

	// Distribute tips to each position only once
	await distributeTips.call(this, bartenders, totalBartenderTipOut);
	await distributeTips.call(this, runners, totalRunnerTipOut);
	await distributeTips.call(this, hosts, totalHostTipOut);
}

exports.handleDailyTotalLogic = async function (teamMembers) {
	const positions = separateMembersByPosition(teamMembers);

	if (positions.server.length > 0) {
		console.log("🚀 ~ position: server")
		await handleServerAddedLogic(positions.server, positions.bartender, positions.runner, positions.host);
	} else {
		for (const position of ['bartender', 'runner', 'host']) {
			if (positions[position].length > 0) {
				await handlePositionLogic(positions.server, positions[position], position);
			}
		}
	}
}