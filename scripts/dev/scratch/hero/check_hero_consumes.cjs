const fs = require('fs');
const consume = JSON.parse(fs.readFileSync('e:\\Desktop\\html\\myrzg\\vue-myrzg\\public\\data\\consume.json', 'utf8'));

const datas = consume.datas || consume;
const heroRandKeys = Object.keys(datas).filter(k => k.startsWith('heroRand'));

console.log(`Found ${heroRandKeys.length} heroRand keys`);
heroRandKeys.sort().forEach(k => {
  const item = datas[k];
  console.log(`${k}: name="${item.name}", money=${item.money}, items=${JSON.stringify(item.items)}`);
});
