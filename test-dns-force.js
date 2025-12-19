#!/usr/bin/env node

import { resolveDNS } from "./resolveDNS.js";

/**
 * 测试强制DNS解析功能
 */
async function testForceDNS() {
  console.log("🧪 开始测试强制DNS解析功能...\n");

  try {
    // 测试1: 解析一个知名域名的AAAA记录
    console.log("📋 测试1: 解析 google.com 的AAAA记录");
    const result1 = await resolveDNS("google.com", "AAAA");
    console.log("✅ 测试1成功:", JSON.stringify(result1, null, 2));
    console.log("\n" + "=".repeat(60) + "\n");

    // 测试2: 解析另一个域名的A记录
    console.log("📋 测试2: 解析 baidu.com 的A记录");
    const result2 = await resolveDNS("baidu.com", "A");
    console.log("✅ 测试2成功:", JSON.stringify(result2, null, 2));
    console.log("\n" + "=".repeat(60) + "\n");

    // 测试3: 尝试解析一个不存在的域名
    console.log("📋 测试3: 解析不存在的域名 (预期失败)");
    try {
      const result3 = await resolveDNS(
        "nonexistent-domain-test-12345.com",
        "AAAA",
      );
      console.log("❌ 测试3意外成功:", result3);
    } catch (error) {
      console.log("✅ 测试3按预期失败:", error.message);
    }

    console.log("\n🎉 强制DNS解析测试完成！");
  } catch (error) {
    console.error("❌ 测试过程中发生错误:", error.message);
    console.error("详细错误:", error);
  }
}

// 运行测试
if (import.meta.main) {
  testForceDNS();
}

export default testForceDNS;
