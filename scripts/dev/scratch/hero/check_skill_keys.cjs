const fs = require('fs');
const skill = JSON.parse(fs.readFileSync('e:\\Desktop\\html\\myrzg\\vue-myrzg\\public\\data\\skill.json', 'utf8'));

console.log('Skill keys:', Object.keys(skill).slice(0, 10));
if (skill.data) {
  console.log('Skill data is array? ', Array.isArray(skill.data));
  console.log('Skill data length:', skill.data.length);
}
