const fs = require('fs');
const path = require('path');

const dir = 'E:\\Desktop\\html\\myrzg\\Config_decrypted';
const files = fs.readdirSync(dir);

files.forEach(file => {
  if (!file.endsWith('.json')) return;
  try {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    if (content.includes('element') && (content.includes('火') || content.includes('水') || content.includes('风') || content.includes('地') || content.includes('光') || content.includes('暗'))) {
      console.log(`Potential match in file: ${file}`);
    }
  } catch (e) {}
});
