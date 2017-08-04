# Fabric benchmark

## Environment

Vmware Workstation 9.0

ubuntu 16.04 LTS 64 bit

5.7 GiB

Intel® Core™ i5-5200U CPU @ 2.20GHz × 4 

Docker version 17.06.0-ce, build 02c1d87

Fabric-SDK-Node


node ./app/invoke-batch.js


## 1

### BatchTimeout = 2s

### MaxMessageCount =10

### 1 orderer solo mode

### 4 peer 

### send proposal to 1 of 4 peers randomly

transaction	|	time

10			|	1055ms

50			|	4710ms

100			|	13129ms

200			|	28451ms

200			|	36996ms  23s watched by explorer, event not all received

200			|	22s watched by explorer, event not all received

400			|	35s watched by explorer, event not all received

500			|	37s watched by explorer, event not all received


### send all proposal to 1 peer 

transaction	|	time

10			|	886ms

20 			|	1163ms

30			|	1990ms

40			|	2556ms   event not all received

50			|	2454ms

60			|	4070ms

70			|	4889ms	event not all received

100			|	11500ms watched by explorer, event not all received

200			|	15771ms

200			|	18000ms watched by explorer, event not all received

300			|	23460ms watched by explorer, event not all received

400			|	28000ms watched by explorer, event not all received

500			|	34000ms watched by explorer, event not all received



### BatchTimeout = 2s
### MaxMessageCount =50

### 1 orderer solo mode
### 4 peer 


### send all proposal to 1 peer 

transaction	|	time

100			|	10111ms

200			|	19015ms

300			|	33972ms  ,  21000ms watched by explorer, event not all received

400			|	28000ms watched by explorer, event not all received

500			|	31000ms	watched by explorer, event not all received

1000		|	59000ms watched by explorer, event not all received

### conclusion
time spend in waiting for endorsement

bottleneck is cpu, usage 100% when send trasactions


## 2

### BatchTimeout = 2s
### MaxMessageCount =10

### 1 orderer kafka mode
3 zk 4 kafka
### 4 peer 
### send proposal to 1 of 4 peers randomly

transaction	|	time

10			|	1045ms

50			|	5375ms

100			|	14975ms

200			|	18790ms watched by explorer, event not all received

500			|	43470ms watched by explorer, event not all received

### send all proposal to 1 peer 

transaction	|	time

50			|	8380ms watched by explorer, event not all received

200			|	19130ms watched by explorer, event not all received

500			|	43160ms watched by explorer, event not all received


### BatchTimeout = 2s
### MaxMessageCount =50

### 1 orderer kafka mode
3 zk 4 kafka
### 4 peer 
### send proposal to 1 of 4 peers randomly
transaction	|	time

50			|	5868ms

200			|	19350ms  watched by explorer, event not all received

500			|	39410ms  watched by explorer, event not all received

1000		|	>60s and occurs a error

### conclusion
kafka not better in one machine situation

need better hardware
