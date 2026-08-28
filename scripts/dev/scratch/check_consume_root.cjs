const fs = require('fs');
const consume = JSON.parse(fs.readFileSync('e:\\Desktop\\html\\myrzg\\vue-myrzg\\public\\data\\consume.json', 'utf8'));

console.log('Consume top level keys:', Object.keys(consume));
if (consume.datas) {
  console.log('datas keys count:', Object.keys(consume.datas).length);
}
