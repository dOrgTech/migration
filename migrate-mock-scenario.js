async function migrateMockScenario({ web3, spinner, confirm, opts, logTx, previousMigration: { base, dao } }) {
	if (!(await confirm('About to migrate mock scenraio. Continue?'))) {
		return;
	}

	if (!dao || !base || dao.founders.filter(f => f.privateKey).length < 3) {
		const msg = `The mock scenario requires a migrated base, dao and at least 3 founders with an available privateKey`;
		spinner.fail(msg);
		throw new Error(msg);
	}

	spinner.start('Migrating mock scenario...');
	let tx;

	const { DAOToken, ContributionReward, GenesisProtocol, Redeemer } = base;
	const { name, Avatar, NativeReputation, NativeToken, founders } = dao;
	const members = founders.filter(f => f.privateKey);
	members.forEach(({ privateKey }) => web3.eth.accounts.wallet.add(web3.eth.accounts.privateKeyToAccount(privateKey)));

	const daoToken = new web3.eth.Contract(require('@daostack/arc/build/contracts/DAOToken.json').abi, DAOToken, opts);
	const contributionReward = new web3.eth.Contract(
		require('@daostack/arc/build/contracts/ContributionReward.json').abi,
		ContributionReward,
		opts
	);
	const genesisProtocol = new web3.eth.Contract(
		require('@daostack/arc/build/contracts/GenesisProtocol.json').abi,
		GenesisProtocol,
		opts
	);

	const redeemer = new web3.eth.Contract(require('@daostack/arc/build/contracts/Redeemer.json').abi, Redeemer, opts);

	const proposals = [],
		votes = [],
		stakes = [];
	async function propose(options) {
		options.proposer = options.proposer || web3.eth.defaultAccount;
		const {
			reputation,
			tokens,
			eth,
			externalTokens,
			periodLength,
			periods,
			externalTokenAddress,
			beneficiary,
			proposer,
		} = options;
		spinner.start('Proposing...');
		const propose = contributionReward.methods.proposeContributionReward(
			Avatar,
			'0x1234123412341234',
			reputation,
			[tokens, eth, externalTokens, periodLength, periods],
			externalTokenAddress,
			beneficiary
		);
		const proposalId = await propose.call({ from: proposer });
		const tx = await propose.send({ from: proposer });

		const out = {
			...options,
			proposalId,
			txHash: tx.tranactionHash,
		};
		logTx(tx, `Proposal(${proposalId}) ${JSON.stringify(out, undefined, 2)}`);
		proposals.push(out);
		return out;
	}

	async function vote(options) {
		options.voter = options.voter || web3.eth.defaultAccount;
		const { proposalId, vote, voter } = options;
		const tx = await genesisProtocol.methods.vote(proposalId, vote == 'Yes' ? 1 : 2, voter).send({ from: voter });
		const out = {
			...options,
			txHash: tx.tranactionHash,
		};
		logTx(tx, `Vote ${JSON.stringify(out, undefined, 2)}`);
		votes.push(out);
		return out;
	}

	async function stake(options) {
		options.staker = options.staker || web3.eth.defaultAccount;
		const { proposalId, vote, amount, staker } = options;
		const approveTx = await daoToken.methods
			.approve(GenesisProtocol, web3.utils.toWei(amount.toString(), 'gwei'))
			.send({ from: staker });
		logTx(approveTx, `Approved ${amount}GEN for GenesisProtocol`);
		const tx = await genesisProtocol.methods
			.stake(proposalId, vote == 'Yes' ? 1 : 2, web3.utils.toWei(amount.toString(), 'gwei'))
			.send({ from: staker });
		const out = {
			...options,
			txHash: tx.tranactionHash,
		};
		logTx(tx, `Stake ${JSON.stringify(out, undefined, 2)}`);
		stakes.push(out);
		return out;
	}

	await propose({
		reputation: 100,
		tokens: 10,
		eth: 0,
		externalTokens: 0,
		periodLength: 0,
		periods: 1,
		externalToken: NativeToken,
		beneficiary: members[1].address,
	});

	await vote({
		proposalId: proposals[0].proposalId,
		vote: 'Yes',
		voter: members[1].address,
	});
	await stake({
		proposalId: proposals[0].proposalId,
		vote: 'Yes',
		amount: 2,
		staker: members[2].address,
	});

	return {
		scenario: {
			proposals,
			votes,
			stakes,
		},
	};
}

module.exports = migrateMockScenario;
