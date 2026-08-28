const fs = require('fs');
const lan = JSON.parse(fs.readFileSync('e:\\Desktop\\html\\myrzg\\vue-myrzg\\public\\data\\lan.json', 'utf8'));

lan.data.forEach(item => {
  if (item.desc_cn && (item.desc_cn.includes('火') || item.desc_cn.includes('水') || item.desc_cn.includes('风') || item.desc_cn.includes('地') || item.desc_cn.includes('光') || item.desc_cn.includes('暗') || item.desc_cn.includes('雷') || item.desc_cn.includes('冰') || item.desc_cn.includes('木') || item.desc_cn.includes('岩'))) {
    console.log(`lan.json match: ${item.name} -> ${item.desc_cn}`);
  }
});
