const fs = require('fs');
const skill = JSON.parse(fs.readFileSync('e:\\Desktop\\html\\myrzg\\vue-myrzg\\public\\data\\skill.json', 'utf8'));

const skillId = '00102'; // a skill from hero_001
const s = skill.datas[skillId] || skill[skillId];
console.log(`Skill ${skillId} detail:`, JSON.stringify(s, null, 2));
