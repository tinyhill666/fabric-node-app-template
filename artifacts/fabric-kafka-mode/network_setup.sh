#!/bin/bash
#
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#


UP_DOWN="$1"

: ${CLI_TIMEOUT:="10000"}
: ${CH_NAME:="mychannel"}

COMPOSE_FILE=docker-compose.yaml

COMPOSE_FILE_COUCH=docker-compose-couch.yaml
#COMPOSE_FILE=docker-compose-e2e.yaml

function printHelp () {
	echo "Usage: ./network_setup <up|down> .\nThe arguments must be in order."
}

function validateArgs () {
	if [ -z "${UP_DOWN}" ]; then
		echo "Option up / down / restart not mentioned"
		printHelp
		exit 1
	fi
	if [ -z "${CH_NAME}" ]; then
		echo "setting to default channel 'mychannel'"
		CH_NAME=mychannel
	fi
}

function clearContainers () {
        CONTAINER_IDS=$(docker ps -aq)
        if [ -z "$CONTAINER_IDS" -o "$CONTAINER_IDS" = " " ]; then
                echo "---- No containers available for deletion ----"
        else
                docker rm -f $CONTAINER_IDS
        fi
}

function removeUnwantedImages() {
        DOCKER_IMAGE_IDS=$(docker images | grep "dev\|none\|test-vp\|peer[0-9]-" | awk '{print $3}')
        if [ -z "$DOCKER_IMAGE_IDS" -o "$DOCKER_IMAGE_IDS" = " " ]; then
                echo "---- No images available for deletion ----"
        else
                docker rmi -f $DOCKER_IMAGE_IDS
        fi
}

function networkUp () {
    #Generate all the artifacts that includes org certs, orderer genesis block,
    # channel configuration transaction

    CHANNEL_NAME=$CH_NAME TIMEOUT=$CLI_TIMEOUT docker-compose -f $COMPOSE_FILE up -d 2>&1

}

function networkDown () {
    docker-compose -f $COMPOSE_FILE down

    #Cleanup the chaincode containers
    clearContainers

    #Cleanup images
    removeUnwantedImages

    # remove orderer block and other channel configuration transactions and certs
    rm -rf channel-artifacts/* crypto-config

    #Cleanup the material
    rm -rf /tmp/hfc-test-kvs_peerOrg* $HOME/.hfc-key-store/ /tmp/fabric-client-kvs_peerOrg*


    rm configtx.yaml
}

validateArgs

#Create the network using docker compose
if [ "${UP_DOWN}" == "up" ]; then
	networkUp
elif [ "${UP_DOWN}" == "down" ]; then ## Clear the network
	networkDown
elif [ "${UP_DOWN}" == "restart" ]; then ## Restart the network
	networkDown
	networkUp
else
	printHelp
	exit 1
fi
