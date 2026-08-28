const fs = require('fs');
const up = JSON.parse(fs.readFileSync('e:\\Desktop\\html\\myrzg\\vue-myrzg\\public\\data\\hero\\heroSkillUpgrade.json', 'utf8')).datas;

console.log('skillOne levels per rarity:');
Object.keys(up.skillOne).forEach(rare => {
  console.log(`  rare ${rare}: max level = ${up.skillOne[rare].length}`);
});

console.log('skillTwo levels per rarity:');
Object.keys(up.skillTwo).forEach(rare => {
  console.log(`  rare ${rare}: max level = ${up.skillTwo[rare].length}`);
});
