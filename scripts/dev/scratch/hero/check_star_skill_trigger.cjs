const fs = require('fs');
const trigger = JSON.parse(fs.readFileSync('e:\\Desktop\\html\\myrzg\\vue-myrzg\\public\\data\\skillTrigger.json', 'utf8'));

console.log('00105:', trigger['00105']);
console.log('00106:', trigger['00106']);
console.log('00107:', trigger['00107']);
console.log('00108:', trigger['00108']);
