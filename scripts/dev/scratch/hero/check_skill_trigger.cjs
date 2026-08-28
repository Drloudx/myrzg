const fs = require('fs');
const trigger = JSON.parse(fs.readFileSync('e:\\Desktop\\html\\myrzg\\vue-myrzg\\public\\data\\skillTrigger.json', 'utf8'));

console.log('Trigger keys:', Object.keys(trigger).slice(0, 10));
// let's print the entry for 00104 (talentSkillList of hero_001)
console.log('Trigger 00104:', trigger['00104'] || trigger.datas?.['00104']);
