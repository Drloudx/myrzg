const fs = require('fs');
const up = JSON.parse(fs.readFileSync('e:\\Desktop\\html\\myrzg\\vue-myrzg\\public\\data\\hero\\heroSkillUpgrade.json', 'utf8')).datas;

console.log('Upgrade keys:', Object.keys(up));
// print some item from skillOne, skillTwo, etc.
Object.keys(up).forEach(k => {
  console.log(`${k} subkeys:`, Object.keys(up[k]));
});
