const fs = require('fs');
const setting = JSON.parse(fs.readFileSync('e:\\Desktop\\html\\myrzg\\vue-myrzg\\public\\data\\gameSetting.json', 'utf8'));

console.log(JSON.stringify(setting, null, 2).slice(0, 2000));
