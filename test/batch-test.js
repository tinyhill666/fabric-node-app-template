var child_process = require('child_process')
	//var peersUrls = ["localhost:7051","localhost:7056","localhost:8051","localhost:8056"];
var peersUrls = ["localhost:7051"];

var cmdArgs = process.argv.splice(2);
console.log('所传递的参数是：', cmdArgs);

var eachPeerInvokeTime = cmdArgs[0];

if (eachPeerInvokeTime == undefined) {
	console.error('参数错误！node batch-test.js num');
	return;
}

var peers = peersUrls.length

for (var j = 0; j < peersUrls.length; j++) {
	var workerProcess = child_process.spawn('node', ['./invoke-child2.js', j, peersUrls[j], eachPeerInvokeTime]);

	workerProcess.stdout.on('data', function(data) {
		console.log('stdout: ' + data);
	});

	workerProcess.stderr.on('data', function(data) {
		console.log('stderr: ' + data);
	});

	workerProcess.on('close', function(code) {});
}