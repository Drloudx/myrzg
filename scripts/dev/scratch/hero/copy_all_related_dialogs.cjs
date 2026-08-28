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

console.log(`Unique dialog base keys: ${dialogKeys.size}`);

// Get list of all decrypted json files
const allFiles = fs.readdirSync(gaoNanoDir).filter(f => f.endsWith('.json'));

let copiedCount = 0;

dialogKeys.forEach(key => {
  if (!key) return;
  // Match key exactly or key + suffix
  const matches = allFiles.filter(f => {
    const nameWithoutExt = path.basename(f, '.json');
    return nameWithoutExt === key || nameWithoutExt.startsWith(`${key}_`) || nameWithoutExt.startsWith(`${key}-`);
  });
  
  matches.forEach(file => {
    const srcPath = path.join(gaoNanoDir, file);
    const destPath = path.join(destDir, file);
    if (!fs.existsSync(destPath)) {
      fs.copyFileSync(srcPath, destPath);
      copiedCount++;
    }
  });
});

console.log(`Copied ${copiedCount} additional/matching dialog files to public/data/dialogs/`);
