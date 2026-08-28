const fs = require('fs');
const consume = JSON.parse(fs.readFileSync('e:\\Desktop\\html\\myrzg\\vue-myrzg\\public\\data\\consume.json', 'utf8'));

const key = 'heroRand031';
console.log(`Key ${key} in consume.json:`, consume.datas[key] || consume[key] || 'Not found');
// Let's print first few keys in consume.datas to see structure
console.log('Consume keys sample:', Object.keys(consume.datas || consume).slice(0, 10));
