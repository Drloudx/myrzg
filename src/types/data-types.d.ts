// Auto-generated TypeScript definitions by scripts/clean-data.js
export type RarityType = '传说' | '史诗' | '稀有' | '普通';
export type RarityLevelType = 'SS' | 'S' | 'A' | 'B';

export interface RoleData {
  id: string;
  name: string;
  rarity: RarityType;
  rarityLevel: RarityLevelType;
  class: '战士' | '游侠' | '法师' | '圣职';
  element: '光' | '暗' | '火' | '水' | '风' | '地' | '冰' | '土';
  desc: string;
  skillName: string;
  skillEffect: string;
}

export interface EquipData {
  id: string;
  name: string;
  rarity: RarityType;
  rarityLevel: RarityLevelType;
  slot: '武器' | '头部' | '衣服' | '鞋子' | '饰品';
  mainStat: string;
  effect: string;
  starEffects: string[];
}

export interface SearchIndexItem {
  id: string;
  type: 'role' | 'equip';
  name: string;
  rarity: RarityType;
  rarityLevel: RarityLevelType;
  category: string;
  subTag: string;
  keywords: string;
}
