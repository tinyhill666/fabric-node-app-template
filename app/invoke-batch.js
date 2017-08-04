/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
'use strict';
var path = require('path');
var fs = require('fs');
var util = require('util');
var hfc = require('fabric-client');
var Peer = require('fabric-client/lib/Peer.js');
var config = require('../config.json');
var helper = require('./helper.js');
var logger = helper.getLogger('invoke-chaincode');
var EventHub = require('fabric-client/lib/EventHub.js');
hfc.addConfigFile(path.join(__dirname, 'network-config.json'));
var ORGS = hfc.getConfigSetting('network-config');

var peersUrls = ["localhost:7051","localhost:7056","localhost:8051","localhost:8056"];
//var peersUrls = ["localhost:7051"];
var chaincodeName = "mycc";
var channelName = "mychannel";
var fcn = "move";
var username = "SomeBodyB"
var org = "org1"
var INTERVAL = 5000


//var batchInvokeChaincode = function(peersUrls, channelName, chaincodeName, fcn, args, username, org) {
logger.debug(util.format('\n============ invoke transaction on organization %s ============\n', org));
var client = helper.getClientForOrg(org);
var channel = helper.getChannelForOrg(org);
var targets = helper.newPeers(peersUrls);
var tx_id = null;

var multiInvoke = function(user) {
	oneRoundInvoke(user, 0, 200, 1);
}


var oneRoundInvoke = function(user, roundNum, invokeTimes, endRound) {
	var startTime = new Date();
	logger.info("Round:" + roundNum + ",start time:" + startTime.toString());
	var startNum = roundNum * invokeTimes;
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
			logger.info(message);
			var endTime = new Date();
			logger.info("invoke complete after:" + (endTime - startTime).toString() + "ms");

		})
	}
	if (roundNum < endRound - 1) {
		setTimeout(oneRoundInvoke, INTERVAL, user, roundNum + 1, invokeTimes, endRound);
	}
}



var send = function(user, args) {
	tx_id = client.newTransactionID();
	logger.debug(util.format('Sending transaction "%j"', tx_id));
	// send proposal to a random endorser
	var randomTargets = [];
	var target = Math.floor(Math.random() * targets.length);
	logger.info("target num:" + target);
	randomTargets.push(targets[target]);
	// send proposal to endorser
	var request = {
		targets: randomTargets,
		chaincodeId: chaincodeName,
		fcn: fcn,
		args: args,
		chainId: channelName,
		txId: tx_id
	};
	return channel.sendTransactionProposal(request);
}



var collectEndorsment = function(results) {
	logger.info("wait endorsement:" + (new Date()).toString());
	var proposalResponses = results[0];
	var proposal = results[1];
	var header = results[2];
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
					reject();
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
			return results[0]; // the first returned value is from the 'sendPromise' which is from the 'sendTransaction()' call
		}).catch((err) => {
			logger.error(
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
	logger.info("wait orderer response:" + (new Date()).toString());
	if (response.status === 'SUCCESS') {
		logger.debug('Successfully sent transaction to the orderer.');
		return tx_id.getTransactionID();
	} else {
		logger.error('Failed to order the transaction. Error code: ' + response.status);
		return 'Failed to order the transaction. Error code: ' + response.status;
	}
}



//return 
helper.getRegisteredUsers(username, org).then(multiInvoke, (err) => {
	logger.error('Failed to enroll user \'' + username + '\'. ' + err);
	throw new Error('Failed to enroll user \'' + username + '\'. ' + err);
});
//};

//exports.invokeChaincode = batchInvokeChaincode;