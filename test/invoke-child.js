'use strict';
var util = require('util');
var config = require('../config.json');
var helper = require('../app/helper.js');
// 引入 events 模块
var events = require('events');
// 创建 eventEmitter 对象
var emitter = new events.EventEmitter();
var logger = helper.getLogger('invoke-child-process');


var chaincodeName = "mycc";
var channelName = "mychannel";
var fcn = "move";
var username = "SomeBodyB"
var org = "org1"
var INTERVAL = 5000


var client = helper.getClientForOrg(org);
var channel = helper.getChannelForOrg(org);
//var tx_id = null;
var returnCount = 0;
var sendCount = 0;
var emitCount = 0;
var table = {}; //存放流水号
var timeoutTable = [];

var cmdArgs = process.argv.splice(2);
logger.info('所传递的参数是：', cmdArgs);


//参数传入为string
var processNum = parseInt(cmdArgs[0]);
var peerUrl = cmdArgs[1];
var times = parseInt(cmdArgs[2]);


var callCCArgsNumBase = processNum * times;

var peersUrls = [];
peersUrls.push(peerUrl);

var targets = helper.newPeers(peersUrls);

emitter.on("endorsement", function(message) {
	if (typeof message == "string") {
		timeoutTable.push(message);
	}
	if (++emitCount == times) {
		if (timeoutTable.length > 0) {
			setTimeout(function() {
				logger.info("time out tx id :\n", timeoutTable);
			}, 500);
		}
	}
});

var invoke = function(user) {
	oneRoundInvoke(user, 0, times, 1);
}


var oneRoundInvoke = function(user, roundNum, invokeTimes, endRound) {
	var startTime = new Date();
	logger.info("Round:" + roundNum + ",start time:" + startTime.toString());
	var startNum = roundNum * invokeTimes + callCCArgsNumBase;
	for (var i = 0; i < invokeTimes; i++) {
		var args = ["a" + (startNum + i), "b" + (startNum + i), "10"];
		logger.info(args);

		send(user, args).then(collectEndorsment, (err) => {
			logger.error('Failed to send proposal due to error: ' + err.stack ? err.stack :
				err);
			return 'Failed to send proposal due to error: ' + err.stack ? err.stack :
				err;
		}).then(check, (err) => {
			logger.error('Failed to send transaction due to error: ' + err.stack ? err
				.stack : err);
			return 'Failed to send transaction due to error: ' + err.stack ? err.stack :
				err;
		}).then(function(message) {
			var endTime = new Date();
			var total = times + callCCArgsNumBase;
			logger.info("return No.:", ++returnCount, "/", total, "send No.:", table[message],
				"invoke complete after:", (endTime - startTime).toString(), "ms\n",
				"tx_id:", message);
			delete table[message];
			logger.debug("not return transaction:", table);
		})
	}
	if (roundNum < endRound - 1) {
		setTimeout(oneRoundInvoke, INTERVAL, user, roundNum + 1, invokeTimes, endRound);
	}
}



var send = function(user, args) {
	var tx_id = client.newTransactionID();
	table[tx_id.getTransactionID()] = ++sendCount;
	logger.debug(util.format('Sending transaction "%j"', tx_id));
	// send proposal to a random endorser
	// send proposal to endorser
	var request = {
		targets: targets,
		chaincodeId: chaincodeName,
		fcn: fcn,
		args: args,
		chainId: channelName,
		txId: tx_id
	};
	//return channel.sendTransactionProposal(request);

	let sendPromise = new Promise((resolve, reject) => {

		channel.sendTransactionProposal(request).then((results) => {
			resolve([results, tx_id]);
		}, (err) => {
			reject(err);
		});

	});

	return sendPromise;
}



var collectEndorsment = function(results) {
	var sendResult = results[0];
	var tx_id = results[1];
	var proposalResponses = sendResult[0];
	var proposal = sendResult[1];
	var header = sendResult[2];
	var all_good = true;
	for (var i in proposalResponses) {
		let one_good = false;
		if (proposalResponses && proposalResponses[0].response &&
			proposalResponses[0].response.status === 200) {
			one_good = true;
			logger.debug('transaction proposal was good');
		} else {
			logger.error('transaction proposal was bad');
		}
		all_good = all_good & one_good;
	}
	if (all_good) {
		logger.debug(util.format(
			'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s',
			proposalResponses[0].response.status, proposalResponses[0].response.message,
			proposalResponses[0].response.payload, proposalResponses[0].endorsement
			.signature));
		var request = {
			proposalResponses: proposalResponses,
			proposal: proposal,
			header: header
		};
		// set the transaction listener and set a timeout of 30sec
		// if the transaction did not get committed within the timeout period,
		// fail the test
		var transactionID = tx_id.getTransactionID();
		var eventPromises = [];

		var eventhubs = helper.newEventHubs(peersUrls, org);
		for (let key in eventhubs) {
			let eh = eventhubs[key];
			eh.connect();

			let txPromise = new Promise((resolve, reject) => {
				let handle = setTimeout(() => {
					eh.disconnect();
					reject(transactionID);
				}, config.eventWaitTime);

				eh.registerTxEvent(transactionID, (tx, code) => {
					clearTimeout(handle);
					eh.unregisterTxEvent(transactionID);
					eh.disconnect();

					if (code !== 'VALID') {
						logger.error(
							'The balance transfer transaction was invalid, code = ' + code);
						reject();
					} else {
						logger.debug(
							'The balance transfer transaction has been committed on peer ' +
							eh._ep._endpoint.addr);
						resolve();
					}
				});
			});
			eventPromises.push(txPromise);
		};

		var sendPromise = channel.sendTransaction(request);
		return Promise.all([sendPromise].concat(eventPromises)).then((results) => {
			logger.debug(' event promise all complete and testing complete');
			emitter.emit("endorsement");
			var endorsmentResults = results[0]; // the first returned value is from the 'sendPromise' which is from the 'sendTransaction()' call
			//results[0] contains {"status":status},and property txId for dispaly
			endorsmentResults["txId"] = transactionID;
			return endorsmentResults;
		}).catch((err) => {
			emitter.emit("endorsement", err);
			logger.warn(err);
			logger.warn(
				'Failed to send transaction and get notifications within the timeout period.'
			);
			return 'Failed to send transaction and get notifications within the timeout period.';
		});
	} else {
		logger.error(
			'Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...'
		);
		return 'Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...';
	}
}



var check = function(response) {
	if (response.status === 'SUCCESS') {
		logger.debug('Successfully sent transaction to the orderer.');
		return response.txId;
	} else {
		logger.error('Failed to order the transaction. Error code: ' + response.status);
		return 'Failed to order the transaction. Error code: ' + response.status;
	}
}


helper.getRegisteredUsers(username, org).then(invoke, (err) => {
	logger.error('Failed to enroll user \'' + username + '\'. ' + err);
	throw new Error('Failed to enroll user \'' + username + '\'. ' + err);
});

