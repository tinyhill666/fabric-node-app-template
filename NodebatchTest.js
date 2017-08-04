/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an 'AS IS' BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
'use strict';
var log4js = require('log4js');
var logger = log4js.getLogger('MyBatchTest');
var express = require('express');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var http = require('http');
var util = require('util');
var app = express();
var expressJWT = require('express-jwt');
var jwt = require('jsonwebtoken');
var bearerToken = require('express-bearer-token');
var cors = require('cors');
var config = require('./config.json');
var helper = require('./app/helper.js');
var channels = require('./app/create-channel.js');
var join = require('./app/join-channel.js');
var install = require('./app/install-chaincode.js');
var instantiate = require('./app/instantiate-chaincode.js');
var invoke = require('./app/invoke-batch.js');
var query = require('./app/query.js');
var host = process.env.HOST || config.host;
var port = process.env.PORT || config.port;

var peers = ["localhost:7051", "localhost:8051"];
var chaincodeName = "mycc";
var channelName = "mychannel";
var fcn = "move";
var username = "SomeBodyB"
var orgname = "org1"
var INTERVAL = 3000

var oneRoundInvoke = function(roundNum, invokeTimes, endRound) {
	var startTime = new Date();
	logger.info("Round:" + roundNum + ",start time:" + startTime.toString());
	var startNum = roundNum * invokeTimes;
	for (var i = 0; i < invokeTimes; i++) {
		var args = ["a" + (startNum + i), "b" + (startNum + i), "10"];
		logger.info(args);
		invoke.invokeChaincode(peers, channelName, chaincodeName, fcn, args, username, orgname)
			.then(function(message) {
				logger.info(message);
				var endTime = new Date();
				logger.info("invoke complete after:" + (endTime - startTime).toString() + "ms");
			});
	}
	if (roundNum < endRound - 1) {
		setTimeout(oneRoundInvoke, INTERVAL, roundNum + 1, invokeTimes, endRound);
	}
}

oneRoundInvoke(0, 10, 10);