const fs = require('fs');
const skill = JSON.parse(fs.readFileSync('e:\\Desktop\\html\\myrzg\\vue-myrzg\\public\\data\\skill.json', 'utf8'));

const skillId = '00102';
console.log(`Skill ${skillId}:`, skill[skillId]);
