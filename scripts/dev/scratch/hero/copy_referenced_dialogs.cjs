const fs = require('fs');
const path = require('path');

const workspaceDir = 'e:\\Desktop\\html\\myrzg\\vue-myrzg';
const gaoNanoDir = 'E:\\Desktop\\html\\myrzg\\GAoNano_decrypted';
const destDir = path.join(workspaceDir, 'public', 'data', 'dialogs');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// 1. Read behavior dialogs
const behaviorPath = path.join(workspaceDir, 'public', 'data', 'hero', 'heroBehavior.json');
const behaviorData = JSON.parse(fs.readFileSync(behaviorPath, 'utf8')).datas || {};

const dialogKeys = new Set();

Object.values(behaviorData).forEach(hero => {
  if (hero.chat) {
    hero.chat.forEach(c => { if (c.dialog) dialogKeys.add(c.dialog); });
  }
  if (hero.heroEvent) {
    hero.heroEvent.forEach(e => { if (e.dialog) dialogKeys.add(e.dialog); });
  }
  if (hero.motou) {
    hero.motou.forEach(m => { if (m.dialog) dialogKeys.add(m.dialog); });
  }
  if (hero.luguo) {
    hero.luguo.forEach(l => { if (l.dialog) dialogKeys.add(l.dialog); });
  }
});

// 2. Read archives dialogs
const archivesPath = path.join(workspaceDir, 'public', 'data', 'hero', 'heroArchives.json');
const archivesData = JSON.parse(fs.readFileSync(archivesPath, 'utf8')).archives || {};

Object.values(archivesData).forEach(archivesList => {
  archivesList.forEach(a => {
    if (a.taskTypeId) dialogKeys.add(a.taskTypeId);
  });
});

console.log(`Total unique dialog files referenced: ${dialogKeys.size}`);

// 3. Copy referenced files
let copiedCount = 0;
let missingCount = 0;
const missingList = [];

dialogKeys.forEach(key => {
  if (!key) return;
  const fileName = `${key}.json`;
  const srcPath = path.join(gaoNanoDir, fileName);
  const destPath = path.join(destDir, fileName);
  
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    copiedCount++;
  } else {
    missingCount++;
    missingList.push(key);
  }
});

console.log(`Copied ${copiedCount} files to public/data/dialogs/`);
console.log(`Missing ${missingCount} files:`, missingList.slice(0, 15));
