// 简单测试 resolveDNS.js 的强制DNS映射

console.log("=== 验证 resolveDNS.js 中的强制DNS映射 ===\n");

// 读取 resolveDNS.js 文件内容
import fs from "fs";
const fileContent = fs.readFileSync("resolveDNS.js", "utf8");

// 查找 FORCED_DNS_MAPPING 的定义
const mappingMatch = fileContent.match(
  /const FORCED_DNS_MAPPING = \{[\s\S]*?\}/,
);

if (mappingMatch) {
  console.log("找到 DNS 映射配置:");
  console.log(mappingMatch[0]);
  console.log();

  // 验证是否包含我们想要的映射
  if (
    fileContent.includes(
      '"fresh-reverse-proxy-middle.masx201.dpdns.org": "104.21.9.230"',
    )
  ) {
    console.log("✅ 成功！强制DNS映射已更新:");
    console.log(
      "   fresh-reverse-proxy-middle.masx201.dpdns.org -> 104.21.9.230",
    );
  } else if (
    fileContent.includes('"fresh-reverse-proxy-middle.masx201.dpdns.org"')
  ) {
    console.log("⚠️ 找到域名映射，但IP地址可能不是最新的");
    // 提取当前的IP
    const ipMatch = fileContent.match(
      /"fresh-reverse-proxy-middle\.masx201\.dpdns\.org":\s*"([^"]+)"/,
    );
    if (ipMatch) {
      console.log(`   当前映射到: ${ipMatch[1]}`);
    }
  } else {
    console.log("❌ 未找到该域名的强制映射");
  }
} else {
  console.log("❌ 未找到 FORCED_DNS_MAPPING 配置");
}

console.log("\n=== 测试完成 ===");
