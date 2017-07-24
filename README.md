# start fabric network
./startFabric

# start node server
./runApp.sh

# test restful post
./script/testAPIs.sh

in this script, you will create channel, join channel ,install chaincode , instantiate chaincode, invoke and query chaincode.

# more
you can put your chaincode in /gopath/src

modify /script/update-chaincode.sh to install and instantiate.

more details see app.js and /script/testAPIs.sh
