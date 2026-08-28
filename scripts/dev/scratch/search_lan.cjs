const fs = require('fs');
const lan = JSON.parse(fs.readFileSync('e:\\Desktop\\html\\myrzg\\vue-myrzg\\public\\data\\lan.json', 'utf8'));

lan.data.forEach(item => {
  if (item.desc_cn && (item.desc_cn === '火' || item.desc_cn === '水' || item.desc_cn === '风' || item.desc_cn === '土' || item.desc_cn === '光' || item.desc_cn === '暗' || item.desc_cn === '雷' || item.desc_cn === '冰' || item.desc_cn.includes('属性'))) {
    console.log(`lan.json match: ${item.name} -> ${item.desc_cn}`);
  }
});
