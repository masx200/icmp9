// sha256.js
import { createHash } from "crypto";

/**
 * 计算字符串的 SHA-256 值
 * @param {string} str 任意字符串
 * @returns {string} 64 位小写十六进制哈希值
 */
function sha256(str) {
  return createHash("sha256").update(str, "utf8").digest("hex");
}

/* ---------- 使用示例 ---------- */
// if (require.main === module) {
//   const src = process.argv[2] || 'hello';
//   console.log(`sha256("${src}") = ${sha256(src)}`);
// }

export default sha256;
