// Auto-generated TypeScript definitions by scripts/parse/search.mjs

export interface RoleData {
  id: string;
  name: string;
  quality: number;
  class: '战士' | '游侠' | '法师' | '圣职';
  element: '光' | '暗' | '火' | '水' | '风' | '地' | '冰' | '土';
  desc: string;
  skillName: string;
}

export interface EquipData {
  id: string;
  name: string;
  quality: number;
  slot: '武器' | '头部' | '衣服' | '鞋子' | '饰品';
  mainStat: string;
  effect: string;
  starEffects: string[];
}

export interface IndexData {
  id: string;
  type: 'role' | 'equip' | 'pet' | 'pet_egg' | 'achievement' | 'recipe' | 'item' | 'monster' | 'exchange';
  name: string;
  quality: number;
  category: string;
  subTag: string;
  keywords: string;
}
