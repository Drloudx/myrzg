const fs = require('fs');
const up = JSON.parse(fs.readFileSync('e:\\Desktop\\html\\myrzg\\vue-myrzg\\public\\data\\hero\\heroSkillUpgrade.json', 'utf8')).datas;

console.log('skillOne (rare 3) levels:');
up.skillOne['3'].forEach(l => {
  console.log(`  level=${l.level}, heroLevel=${l.heroLevel}`);
});
