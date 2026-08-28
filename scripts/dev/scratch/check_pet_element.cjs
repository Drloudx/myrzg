const fs = require('fs');
const pet = JSON.parse(fs.readFileSync('e:\\Desktop\\html\\myrzg\\vue-myrzg\\public\\data\\pet.json', 'utf8'));

const petData = pet.datas || pet;
const petElements = new Set();
Object.values(petData).forEach(p => {
  if (p.element !== undefined) petElements.add(p.element);
});
console.log('Pet elements:', Array.from(petElements));

// Let's print name and element of first few pets
Object.values(petData).slice(0, 10).forEach(p => {
  console.log(`Pet name=${p.name}, element=${p.element}`);
});
