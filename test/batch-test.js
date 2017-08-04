var child_process = require('child_process')
var peersUrls = ["localhost:7051","localhost:7056","localhost:8051","localhost:8056"];
//var peersUrls = ["localhost:7051"];

var eachPeerInvokeTime = 100
var peers = peersUrls.length

for (var j = 0; j < peersUrls.length; j++) {
    var workerProcess = child_process.spawn('node', ['./invoke-child.js', j, peersUrls[j], eachPeerInvokeTime]);

    workerProcess.stdout.on('data', function(data) {
        console.log('stdout: ' + data);
    });

    workerProcess.stderr.on('data', function(data) {
        console.log('stderr: ' + data);
    });

    workerProcess.on('close', function(code) {});
}