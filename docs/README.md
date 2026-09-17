# 文档导航

首次接手先读 [SPEC](SPEC.md)，了解项目结构、各页面功能、主要数据链和维护约束；修改具体模块时再查对应专题。专题补充深入规则，不替代总规范中的功能说明。

| 文档 | 负责内容 |
| --- | --- |
| [SPEC](SPEC.md) | 项目总览、各页面功能与关键业务规则、共享模块、数据链、URL、资源与验收 |
| [ARCHITECTURE](ARCHITECTURE.md) | 目录职责、依赖、数据请求/缓存、构建和发布机制 |
| [UI_COMPONENT_LIBRARY](UI_COMPONENT_LIBRARY.md) | 公共组件 API、主题、布局、滚动和页面模板 |
| [KNOWN_BUGS_AND_FIXES](KNOWN_BUGS_AND_FIXES.md) | 可复用的故障现象、根因和排查入口 |

## features：功能专属规则

保留各功能不适合放入总规范的契约。文件不承担每天的修改记录，也不复制公共 UI 接口。

| 专题 | 何时查阅 |
| --- | --- |
| [营地设施](features/facilities/CAMP_FACILITIES.md) | 建筑当前/目标级、研究依赖、配置差异和来源定位 |
| [符石图鉴](features/runes/RUNE_CATALOG.md) | 正式合成映射、鉴定模拟边界和批量/单次行为 |
| [伙伴邮件](features/PARTNER_MAIL_SKIN.md) | 邮箱覆盖、邮件类型、奖励与固定阅读器 |
| [副本图鉴](features/DUNGEONS.md) | 路线/房间提取、掉落真实性和来源定位 |
| [模拟招募](features/gacha/GACHA.md) | 两池演出、模拟状态、资源生命周期与复刻边界 |
| [右栏吉祥物](features/SIDEBAR_MASCOT.md) | SVG 装配、动作、握点与角色适配 |

## technical：共用接口与离线工具

| 文档 | 保留用途 |
| --- | --- |
| [统一奖励规则](technical/ACQUISITION_RULES.md) | 多页面共用的数据结构、概率/数量语义与兼容接口 |
| [皮肤模型导出](technical/SKIN_MODEL_EXPORT.md) | 仍在使用的导出命令、输入/输出和资源限制 |
| [战斗机制与公式](technical/COMBAT_FORMULAS.md) | 源码及配置的完整通用伤害链、属性叠加、上限、Buff、护盾/回复、模式差异与尚未闭合的赋值问题 |

这两个目录按用途区分，不是过期文件收集处。新规则先找现有归属；小功能可留在 SPEC，不为一次改动新建专题。模块退休或内容完全被替代时再合并/归档，不能只因文件被引用就认定整篇都有保留价值。

## 历史与维护

稳定规则直接改负责文档，其他位置只更新必要摘要或链接。坐标、时长、素材清单以代码/原资源为准；历史概率核对、试错和测试计数放 [每日开发日志](dev-logs/README.md)，不能当作当前实现或验证结果。

[招募复刻审计](../backups/audits-archive/GACHA_REPLICA_AUDIT_2026-09-13.md) 已归档。[2026-09-16 整理前摘录](../backups/audits-archive/DOC_DETAILS_2026-09-16.md) 保留旧说明供恢复，均不与现行规范并列维护。
