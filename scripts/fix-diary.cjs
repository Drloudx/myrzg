const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../public/data/diary.json');

try {
  let content = fs.readFileSync(targetPath, 'utf8');

  // 1. 处理字符串内部的真实换行符和非法控制字符
  content = content.replace(/"text"\s*:\s*"([\s\S]*?)"(?=\s*,|\s*\})/g, (match, p1) => {
    // 将真实换行符替换为合法的 \n 转义字符，并移除一些非法的不可见控制字符
    let cleaned = p1.replace(/\r\n|\n|\r/g, '\\n').replace(/[\x00-\x1F]/g, '');
    return '"text":"' + cleaned + '"';
  });

  // 2. 移除对象或数组末尾多余的逗号（Trailing commas）
  content = content.replace(/,\s*([\}\]])/g, '$1');

  // 3. 验证是否已经是合法的 JSON
  JSON.parse(content);

  // 4. 写回文件
  fs.writeFileSync(targetPath, content, 'utf8');
  console.log('✅ diary.json 数据修复成功！');
} catch (error) {
  console.error('❌ 修复失败，原因：', error.message);
}
