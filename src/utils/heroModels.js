/**
 * 角色模型图（Q 版小人立绘）清单。
 *
 * 数据来源：`public/images/chara/Q/hero-models.json`——由
 * `scripts/dev/export-skin-models.mjs` 同族的导出流程生成，含每个模型的
 * 骨架名 / 皮肤名 / 动作 / 源包路径与输入哈希（溯源用）。
 *
 * 这里只取前端需要的「哪些角色有模型图」与图片路径：
 *   - 图片在 `public/images/chara/Q/<heroId>.webp`
 *   - **只有 34 个角色有模型图**，其余角色不显示切换按钮
 *
 * 为什么用静态 import 而不是 fetch：数据是构建期固定的元数据（22 KB），
 * 静态 import 让 Vite 直接打进产物，避免首屏多一次请求与「未加载时按钮闪烁」。
 */
import heroModels from '../../public/images/chara/Q/hero-models.json'

/** heroId → 模型图 URL（已带 /images 前缀，交给 getImageUrl 处理版本号） */
export const HERO_MODEL_IMAGES = Object.fromEntries(
  Object.entries(heroModels).map(([id, meta]) => [id, `/images/chara/Q/${meta.image}`])
)

/**
 * 主角的**性别变体**模型。
 *
 * 主角希尔是唯一有性别变体的角色：`hero.json` 的 viewData 只登记了女主骨架
 * （Npc_001_girl，对应 `hero_001.webp`），男主骨架 Npc_001_boy 在资源包里存在
 * 但不在表里，故用导出工具单独导出：
 *   node scripts/dev/export-skin-models.mjs --skeleton Npc_001_boy:skill_off --output-dir <dir>
 * 产物落在 `public/images/chara/Q/hero_001_male.webp`。
 *
 * 不做成通用规则（如「所有 hero_xxx_male」）：只有主角有性别变体，
 * 用显式映射比隐式命名约定更不容易出错。
 */
const PROTAGONIST_MODEL_BY_GENDER = {
  female: '/images/chara/Q/hero_001.webp',
  male: '/images/chara/Q/hero_001_male.webp',
}

/** 该角色是否有模型图 */
export function hasHeroModel(heroId) {
  return Boolean(heroId && HERO_MODEL_IMAGES[heroId])
}

/**
 * 取模型图 URL；无则返回空串。
 * @param {string} heroId
 * @param {'female'|'male'} [gender] 主角传当前性别以取对应模型；其他角色忽略
 */
export function getHeroModelImage(heroId, gender) {
  if (heroId === 'hero_001' && gender && PROTAGONIST_MODEL_BY_GENDER[gender]) {
    return PROTAGONIST_MODEL_BY_GENDER[gender]
  }
  return HERO_MODEL_IMAGES[heroId] || ''
}

/** 有模型图的角色数（供测试与日志断言） */
export const HERO_MODEL_COUNT = Object.keys(HERO_MODEL_IMAGES).length
