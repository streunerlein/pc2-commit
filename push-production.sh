#!/bin/bash

coordinator="46.101.241.144"
node0="128.199.162.96"
node1="45.55.65.163"

for address in $coordinator $node0 $node1
do
  ssh -i ~/.ssh/id_metanet root@$address "cd ~/pc2-commit && rm -f *.log && git pull && cp config.do.sample.js config.js && npm install && pm2 restart all"
done