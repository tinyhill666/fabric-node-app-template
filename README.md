# fabric-node-app-template

./startFabric
# start fabric network

./runApp.sh
#start node server

./script/testAPIs.sh
#test restful post, in this script, you will create channel, join channel ,install chaincode , instantiate chaincode, invoke and query chaincode.

you can put your chaincode in /gopath/src
modify /script/update-chaincode.sh to install and instantiate.

more details see app.js and /script/testAPIs.sh
