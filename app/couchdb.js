'use strict';
var log4js = require('log4js');
var logger = log4js.getLogger('couchdb');
var http = require('http');
var config = require('../config.json');


function richQuery(selector) {
	return new Promise(function (resolve, reject) { // 异步处理
		logger.info("selector:", selector);
		var returnJson = {};

		var options = {
			"method": "POST",
			"hostname": config.couchdb.host,
			"port": config.couchdb.port,
			"path": "/" + config.channelName + "/_find",
			"headers": {
				"content-type": "application/json"
			}
		};

		var req = http.request(options, function (res) {
			var chunks = [];

			res.on("data", function (chunk) {
				chunks.push(chunk);
			});

			res.on("end", function () {
				var body = Buffer.concat(chunks);
				returnJson = JSON.parse(body.toString());
				logger.debug("returnJson in end:", returnJson);
				resolve(returnJson);
			});
		});

		//couchdb 查询结果条数限制
		selector.limit = config.couchdb.limit;
		var sendBody = JSON.stringify(selector);
		logger.info("sendBody:", sendBody);
		req.write(sendBody);
		req.end();
	});
}
exports.richQuery = richQuery;