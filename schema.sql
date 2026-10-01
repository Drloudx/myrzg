-- 评论功能 D1 表结构
-- 应用：wrangler d1 execute myrzg-comments --file=./schema.sql --remote
-- 设计依据见 docs/technical/COMMENTS_BACKEND.md 第四节。
--
-- 全部使用 IF NOT EXISTS，可重复执行（幂等）。
-- 注意：D1 的写入按「行」计费，索引写入也算行。本文件只建 2 个索引，
-- 新增索引前请先读方案 2.2 节，确认仍在免费额度内。

-- 评论主表
CREATE TABLE IF NOT EXISTS comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  page_key   TEXT    NOT NULL,            -- 'item:30047'
  parent_id  INTEGER DEFAULT NULL,        -- 预留楼中楼，一期不使用
  nick       TEXT    NOT NULL,
  email_hash TEXT    DEFAULT NULL,        -- SHA-256，绝不留明文邮箱
  body       TEXT    NOT NULL,
  status     INTEGER NOT NULL DEFAULT 1,  -- 1 正常 / 0 待审 / 2 已隐藏（软删除）
  created_at INTEGER NOT NULL,            -- Unix 秒
  ip_hash    TEXT    NOT NULL,            -- SHA-256(ip + 服务端盐)，仅限流与追溯
  ua_hash    TEXT    DEFAULT NULL,
  token_hash TEXT    DEFAULT NULL,        -- 浏览器自删令牌的 SHA-256；明文只回给浏览器一次
  review_reason TEXT DEFAULT NULL         -- 命中的审核词表类别（'外链'/'赌博'…），干净为 NULL
);

-- 增量迁移（建库时已含上面字段则可忽略；D1 不支持 ADD COLUMN IF NOT EXISTS，
-- 重复执行会报 "duplicate column name"，属预期，不影响已有数据）：
--   ALTER TABLE comments ADD COLUMN token_hash TEXT DEFAULT NULL;
--   ALTER TABLE comments ADD COLUMN review_reason TEXT DEFAULT NULL;

-- 列表查询：按 page_key + status 过滤、created_at 倒序
CREATE INDEX IF NOT EXISTS idx_comments_page
  ON comments(page_key, status, created_at DESC);

-- 限流按小时桶 UPSERT，避免每次留言新增一行
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket  TEXT    NOT NULL,               -- 'ip:<sha256>:<YYYYMMDDHH>'
  counter INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket)
);
