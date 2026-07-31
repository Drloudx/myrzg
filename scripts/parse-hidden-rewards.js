import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '../public/data');
const load = (f) => JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf-8'));

function parseHiddenRewards() {
  const rewardData = load('reward.json').datas || load('reward.json');
  const collectTypeData = load('roomCollectType.json').datas || load('roomCollectType.json');
  const collectData = load('roomCollect.json').datas || load('roomCollect.json');
  const roomData = load('room.json').datas || load('room.json');
  const levelRoomData = load('levelRoom.json').datas || load('levelRoom.json');
  const areaData = load('area.json').datas || load('area.json');

  const hiddenRewards = [];
  const globalSources = {};
  
  // Track unique keys to avoid dupes inside same room for same collect
  const seen = new Set();

  for (const [rId, r] of Object.entries(rewardData)) {
    if (r.category && r.category.includes('场景宝箱')) {
      let collectTypes = [];
      for (const [ctId, ct] of Object.entries(collectTypeData)) {
        if (ct.reward === r.typeId || ctId === r.typeId) {
          collectTypes.push(ct);
        }
      }

      let collects = [];
      for (const ct of collectTypes) {
        for (const [cId, c] of Object.entries(collectData)) {
          if (c.collectTypeId === ct.collectTypeId) {
            collects.push({ ...c, baseName: ct.name, tip: ct.tip });
          }
        }
      }

      let rooms = [];
      for (const c of collects) {
        for (const [rk, rm] of Object.entries(roomData)) {
          if (JSON.stringify(rm).includes(c.typeId)) {
            rooms.push({ room: rm, collectInfo: c, rewardInfo: r });
          }
        }
      }

      for (const mapping of rooms) {
        const rm = mapping.room;
        let lr = levelRoomData[rm.typeId];
        if (!lr) {
          lr = Object.values(levelRoomData).find(l => JSON.stringify(l).includes(rm.typeId));
        }
        
        if (lr) {
          const areaId = lr.areaId;
          const areaName = areaData[areaId] ? areaData[areaId].name : areaId;

          const parts = (areaId || '').split('_');
          const bigMapId = parts[0] ? parts[0] + '_map' : 'unknown_map';
          const bigMapName = areaData[bigMapId] ? areaData[bigMapId].name : '未知大地图';

          let sortKey = '99_99';
          if (lr.roomTypeId && lr.roomTypeId.includes('area')) {
            sortKey = lr.roomTypeId.split('area')[1] || sortKey;
          }

          const cName = mapping.collectInfo.baseName || mapping.collectInfo.name || '场景宝箱';
          const cTip = mapping.collectInfo.tip || '';
          
          const uniqueKey = `${lr.typeId}-${cName}-${JSON.stringify(mapping.rewardInfo.items)}`;
          if (!seen.has(uniqueKey)) {
            seen.add(uniqueKey);
            
            hiddenRewards.push({
              bigMapId,
              bigMapName,
              areaId,
              areaName,
              roomId: lr.typeId || rm.typeId,
              roomName: lr.name || rm.name,
              collectName: cName,
              collectTip: cTip,
              sortKey,
              rewardItems: mapping.rewardInfo.items
            });

            const locStr = `${bigMapName} - ${areaName} - ${lr.name || rm.name}`;
            if (mapping.rewardInfo.items) {
              mapping.rewardInfo.items.forEach(itemGrp => {
                if (itemGrp.rules) {
                  itemGrp.rules.forEach(rule => {
                    const tId = rule.typeId;
                    if (!globalSources[tId]) globalSources[tId] = [];
                    globalSources[tId].push({
                      type: 'hidden',
                      id: lr.typeId || rm.typeId,
                      name: '场景宝箱',
                      des: locStr,
                      bigMapId
                    });
                  });
                }
              });
            }
          }
        }
      }
    }
  }

  // Sort hidden rewards
  hiddenRewards.sort((a, b) => {
    if (a.bigMapId !== b.bigMapId) return a.bigMapId.localeCompare(b.bigMapId);
    
    const parseSort = (sk) => {
      const parts = sk.split('_').map(n => parseInt(n, 10));
      return (parts[0] || 0) * 1000 + (parts[1] || 0);
    };
    return parseSort(a.sortKey) - parseSort(b.sortKey);
  });

  const parsedDir = path.join(dataDir, 'parsed');
  if (!fs.existsSync(parsedDir)) fs.mkdirSync(parsedDir, { recursive: true });

  fs.writeFileSync(path.join(parsedDir, 'parsed-hidden.json'), JSON.stringify(hiddenRewards, null, 2));
  fs.writeFileSync(path.join(parsedDir, 'parsed-hidden-sources.json'), JSON.stringify(globalSources, null, 2));

  console.log(`✅ Parsed hidden rewards: ${hiddenRewards.length} chests mapped.`);
}

parseHiddenRewards();
