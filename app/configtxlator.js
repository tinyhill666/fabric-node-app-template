var helper = require("./helper.js");
var logger = helper.getLogger('configtxlator');
var superagent = require('superagent');
var agent = require('superagent-promise')(require('superagent'), Promise);
var requester = require('request');
var path = require('path');
var fs = require('fs');

var config_proto = null;
var original_config_proto = null;
var original_config_json = null;
var updated_config_proto = null;
var updated_config_json = null;
var signatures = [];

function readAllFiles(dir) {
    var files = fs.readdirSync(dir);
    var certs = [];
    files.forEach((file_name) => {
        let file_path = path.join(dir, file_name);
        logger.debug(' looking at file ::' + file_path);
        let data = fs.readFileSync(file_path);
        certs.push(data);
    });
    return certs;
}

function getOrdererAdmin(tmpClient) {
    var admin = helper.ORGS['orderer'].admin;
    var keyPath = path.join(__dirname, admin.key);
    var keyPEM = Buffer.from(readAllFiles(keyPath)[0]).toString();
    var certPath = path.join(__dirname, admin.cert);
    var certPEM = readAllFiles(certPath)[0];

    return Promise.resolve(tmpClient.createUser({
        username: 'ordererAdmin',
        mspid: 'OrdererMSP',
        cryptoContent: {
            privateKeyPEM: keyPEM.toString(),
            signedCertPEM: certPEM.toString()
        }
    }));
}

function signConfig(tmpClient, config) {
    var admins = [];
    var signatures = [];
    // get all orgAdmin from config
    //1 get orderer admin 
    return getOrdererAdmin(tmpClient).then((admin)=>{
        admins.push(admin);
        return ;
    }).then(()=>{
        //2 get all config org admins
        let orgs = helper.ORGS;
        let promises = [];
        for (let key in orgs) {
            if (key.indexOf('org') === 0) {
                let promise = helper.getOrgAdmin(key).then((admin)=>{
                    admins.push(admin);
                });
                promises.push(promise);
            }
        }
        return Promise.all(promises).then(()=>{
            // sign updated_config by all admins
            for (var i=0;i<admins.length;i++){
                tmpClient._userContext = admins[i];
                let signature = tmpClient.signChannelConfig(config_proto);
                signatures.push(signature);
            }
            logger.info(signatures);
            return signatures;
        });
    })
}

exports.updateChannelConfig = function (channel_name, org_name, inputUpdateJson) {
    var client = helper.getClientForOrg(org_name);
    var channel = helper.getChannelForOrg(org_name);
    return helper.getOrgAdmin(org_name)
        .then((admin) => {
            return channel.getChannelConfig();
        })
        .then((config_envelope) => {
            logger.info('Successfully read the current channel configuration');
            // we just need the config from the envelope and configtxlator
            // works with bytes
            original_config_proto = config_envelope.config.toBuffer();

            // lets get the config converted into JSON, so we can edit JSON to
            // make our changes
            return agent.post('http://127.0.0.1:7059/protolator/decode/common.Config',
                original_config_proto)
                .buffer();
        }).then((response) => {
            logger.info('Successfully decoded the current configuration config proto into JSON');
            original_config_json = response.text.toString();
            logger.info(' original_config_json :: %s', original_config_json);

            //get updated_config from input
            var updated_config = inputUpdateJson;

            updated_config_json = JSON.stringify(updated_config);
            logger.info(' updated_config_json :: %s', updated_config_json);

            // lets get the updated JSON encoded
            return agent.post('http://127.0.0.1:7059/protolator/encode/common.Config',
                updated_config_json.toString())
                .buffer();
        }).then((response) => {
            logger.info('Successfully encoded the updated config from the JSON input');
            updated_config_proto = response.body;

            var formData = {
                channel: channel_name,
                original: {
                    value: original_config_proto,
                    options: {
                        filename: 'original.proto',
                        contentType: 'application/octet-stream'
                    }
                },
                updated: {
                    value: updated_config_proto,
                    options: {
                        filename: 'updated.proto',
                        contentType: 'application/octet-stream'
                    }
                }
            };

            return new Promise((resolve, reject) => {
                requester.post({
                    url: 'http://127.0.0.1:7059/configtxlator/compute/update-from-configs',
                    formData: formData
                }, function optionalCallback(err, res, body) {
                    if (err) {
                        logger.error('Failed to get the updated configuration ::' + err);
                        reject(err);
                    } else {
                        var proto = new Buffer(body, 'binary');
                        resolve(proto);
                    }
                });
            });
        }).then((response) => {
            logger.info('Successfully had configtxlator compute the updated config object');
            config_proto = response;
            //sign config_proto
            return signConfig(client, config_proto);
        }).then((response) => { 
            signatures=response;
            return helper.getOrgAdmin(org_name);
        }).then((admin) => {
            let request = {
                config: config_proto,
                signatures: signatures,
                name: channel_name,
                orderer: channel.getOrderers()[0],
                txId: client.newTransactionID()
            };

            // send to orderer
            return client.updateChannel(request);
        }, (err) => {
            logger.error('Failed to enroll user \'' + '\'. Error: ' + err);
            throw new Error('Failed to enroll user \'' + '\'' + err);
        }).then((response) => {
            logger.debug(' response ::%j', response);
            if (response && response.status === 'SUCCESS') {
                logger.debug('Successfully updated the channel.');
                let response = {
                    success: true,
                    message: 'Channel \'' + channel_name + '\' updated Successfully'
                };
                return response;
            } else {
                logger.error('\n!!!!!!!!! Failed to update the channel \'' + channel_name +
                    '\' !!!!!!!!!\n\n');
                throw new Error('Failed to update the channel \'' + channel_name + '\'');
            }
        }, (err) => {
            logger.error('Failed to initialize the channel: ' + err.stack ? err.stack :
                err);
            throw new Error('Failed to initialize the channel: ' + err.stack ? err.stack : err);
        });
};

exports.getChannelConfig = function (channel_name, org_name) {
    var client = helper.getClientForOrg(org_name);
    var channel = helper.getChannelForOrg(org_name);
    return helper.getOrgAdmin(org_name)
        .then((admin) => {
            return channel.getChannelConfig();
        })
        .then((config_envelope) => {
            logger.info('Successfully read the current channel configuration');
            // we just need the config from the envelope and configtxlator
            // works with bytes
            original_config_proto = config_envelope.config.toBuffer();

            // lets get the config converted into JSON, so we can edit JSON to
            // make our changes
            return agent.post('http://127.0.0.1:7059/protolator/decode/common.Config',
                original_config_proto)
                .buffer();
        }).then((response) => {
            logger.info('Successfully decoded the current configuration config proto into JSON');
            return JSON.parse(response.text.toString());
        });
};

exports.updateChannelConfigByFile = function (channel_name, org_name, channelConfigPath) {
    // read in the envelope for the channel config raw bytes
	var envelope = fs.readFileSync(path.join(__dirname, channelConfigPath));
    var client = helper.getClientForOrg(org_name);
    var channel = helper.getChannelForOrg(org_name);
    return helper.getOrgAdmin(org_name)
        .then((admin) => {
            config_proto = envelope;
            //sign config_proto
            return signConfig(client, config_proto);
        }).then((response) => { 
            signatures=response;
            return helper.getOrgAdmin(org_name);
        }).then((admin) => {
            let request = {
                config: config_proto,
                signatures: signatures,
                name: channel_name,
                orderer: channel.getOrderers()[0],
                txId: client.newTransactionID()
            };

            // send to orderer
            return client.updateChannel(request);
        }, (err) => {
            logger.error('Failed to enroll user \'' + '\'. Error: ' + err);
            throw new Error('Failed to enroll user \'' + '\'' + err);
        }).then((response) => {
            logger.debug(' response ::%j', response);
            if (response && response.status === 'SUCCESS') {
                logger.debug('Successfully updated the channel.');
                let response = {
                    success: true,
                    message: 'Channel \'' + channel_name + '\' updated Successfully'
                };
                return response;
            } else {
                logger.error('\n!!!!!!!!! Failed to update the channel \'' + channel_name +
                    '\' !!!!!!!!!\n\n');
                throw new Error('Failed to update the channel \'' + channel_name + '\'');
            }
        }, (err) => {
            logger.error('Failed to initialize the channel: ' + err.stack ? err.stack :
                err);
            throw new Error('Failed to initialize the channel: ' + err.stack ? err.stack : err);
        });
};