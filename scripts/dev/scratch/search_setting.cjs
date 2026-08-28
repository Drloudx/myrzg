const fs = require('fs');
const setting = JSON.parse(fs.readFileSync('e:\\Desktop\\html\\myrzg\\vue-myrzg\\public\\data\\gameSetting.json', 'utf8'));

console.log('Keys in gameSetting:', Object.keys(setting.data));
// search for element or element translation in keys or values of setting.data
function searchObj(obj, parent = '') {
  for (const k of Object.keys(obj)) {
    const val = obj[k];
    const path = parent ? `${parent}.${k}` : k;
    if (k.toLowerCase().includes('element') || k.toLowerCase().includes('job')) {
      console.log(`Found key: ${path}`);
    }
    if (val && typeof val === 'object') {
      searchObj(val, path);
    } else if (typeof val === 'string' && (val.includes('火') || val.includes('水') || val.includes('风') || val.includes('地') || val.includes('光') || val.includes('暗'))) {
      console.log(`Found string in ${path}: ${val}`);
    }
  }
}
searchObj(setting.data);
