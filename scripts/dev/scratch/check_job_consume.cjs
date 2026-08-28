const fs = require('fs');
const up = JSON.parse(fs.readFileSync('e:\\Desktop\\html\\myrzg\\vue-myrzg\\public\\data\\hero\\heroSkillUpgrade.json', 'utf8')).datas;

const keysSet = new Set();
Object.values(up.skillOne).forEach(rareList => {
  rareList.forEach(entry => {
    Object.keys(entry.upgradeConsume).forEach(k => keysSet.add(k));
  });
});

console.log('Consume keys in skillOne entries:', Array.from(keysSet));

// Let's print out what a typical skillOne consume key contains in consume.json
const consume = JSON.parse(fs.readFileSync('e:\\Desktop\\html\\myrzg\\vue-myrzg\\public\\data\\consume.json', 'utf8')).datas;
console.log('skillOne13101 in consume.json:', consume['skillOne13101']);
console.log('skillOne13102 in consume.json:', consume['skillOne13102']);
console.log('skillOne13103 in consume.json:', consume['skillOne13103']);
console.log('skillOne13104 in consume.json:', consume['skillOne13104']);
