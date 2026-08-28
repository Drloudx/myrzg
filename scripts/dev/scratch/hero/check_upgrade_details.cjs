const fs = require('fs');
const up = JSON.parse(fs.readFileSync('e:\\Desktop\\html\\myrzg\\vue-myrzg\\public\\data\\hero\\heroSkillUpgrade.json', 'utf8')).datas;

console.log('skillOne for rare=3, first 3 levels:');
console.log(JSON.stringify(up.skillOne['3'].slice(0, 3), null, 2));

console.log('skillTwo for rare=3, first 3 levels:');
console.log(JSON.stringify(up.skillTwo['3'].slice(0, 3), null, 2));
