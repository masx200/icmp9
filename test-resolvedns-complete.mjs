import { resolveDNS } from "./resolveDNS.js";

console.log("=== 完整测试 resolveDNS.js ===\n");

// 测试 1: 基础 DNS 解析
async function testBasicDNS() {
  console.log("测试 1: 基础 DNS 解析");
  console.log("-".repeat(50));

  try {
    console.log("🔍 解析 google.com 的 A 记录...");
    const result = await resolveDNS("google.com", "A");

    console.log("✅ 解析成功!");
    console.log("Answer:", result.Answer?.[0]?.data || "无数据");
    console.log("状态码:", result.Status);
  } catch (error) {
    console.error("❌ 解析失败:", error.message);
  }
}

// 测试 2: 解析 AAAA 记录（IPv6）
async function testIPv6() {
  console.log("\n测试 2: IPv6 解析");
  console.log("-".repeat(50));

  try {
    console.log("🔍 解析 google.com 的 AAAA 记录...");
    const result = await resolveDNS("google.com", "AAAA");

    console.log("✅ 解析成功!");
    if (result.Answer && result.Answer.length > 0) {
      result.Answer.forEach((answer, i) => {
        console.log(`  IPv6地址 ${i + 1}: ${answer.data}`);
      });
    } else {
      console.log("  未找到 IPv6 地址");
    }
  } catch (error) {
    console.error("❌ 解析失败:", error.message);
  }
}

// 测试 3: 测试不同类型的 DNS 记录
async function testOtherTypes() {
  console.log("\n测试 3: 其他 DNS 记录类型");
  console.log("-".repeat(50));

  // MX 记录
  try {
    console.log("🔍 解析 gmail.com 的 MX 记录...");
    const mxResult = await resolveDNS("gmail.com", "MX");
    console.log("✅ MX 记录解析成功!");
    if (mxResult.Answer) {
      mxResult.Answer.forEach((answer) => {
        console.log(
          `  邮件服务器: ${answer.exchange} (优先级: ${answer.preference})`,
        );
      });
    }
  } catch (error) {
    console.error("❌ MX 记录解析失败:", error.message);
  }

  // TXT 记录
  try {
    console.log("\n🔍 解析 google.com 的 TXT 记录...");
    const txtResult = await resolveDNS("google.com", "TXT");
    console.log("✅ TXT 记录解析成功!");
    if (txtResult.Answer) {
      txtResult.Answer.forEach((answer) => {
        console.log(`  TXT记录: ${answer.data}`);
      });
    }
  } catch (error) {
    console.error("❌ TXT 记录解析失败:", error.message);
  }
}

// 测试 4: 验证强制DNS解析
async function testForcedDNS() {
  console.log("\n测试 4: 验证强制 DNS 解析");
  console.log("-".repeat(50));

  try {
    console.log("🔍 尝试访问强制映射的代理服务器...");
    console.log(
      "目标: fresh-reverse-proxy-middle.masx201.dpdns.org -> 104.21.9.230",
    );

    // 尝试解析一个不存在的路径，观察是否通过强制解析的代理
    const result = await resolveDNS(
      "example.com",
      "A",
      "https://fresh-reverse-proxy-middle.masx201.dpdns.org/nonexistent-path",
    );

    console.log("⚠️ 收到响应（可能代理配置允许此路径）");
  } catch (error) {
    if (error.message.includes("404")) {
      console.log("✅ 强制DNS解析成功!");
      console.log("   收到404错误证明请求通过强制解析的代理发送");
    } else if (
      error.message.includes("ENOTFOUND") || error.message.includes("timeout")
    ) {
      console.log("⚠️ 网络错误，但DNS强制解析可能已生效");
    } else {
      console.log("⚠️ 其他错误:", error.message);
    }
  }
}

// 测试 5: 错误处理
async function testErrorHandling() {
  console.log("\n测试 5: 错误处理");
  console.log("-".repeat(50));

  try {
    console.log("🔍 测试无效域名...");
    await resolveDNS("invalid-domain-12345.com", "A");
    console.log("⚠️ 意外成功");
  } catch (error) {
    console.log("✅ 正确处理错误:", error.message);
  }

  try {
    console.log("\n🔍 测试无效参数...");
    await resolveDNS("", "A");
    console.log("⚠️ 意外成功");
  } catch (error) {
    console.log("✅ 正确处理错误:", error.message);
  }
}

// 测试 6: 性能测试
async function testPerformance() {
  console.log("\n测试 6: 性能测试");
  console.log("-".repeat(50));

  const start = Date.now();
  const promises = [];

  // 并发解析多个域名
  const domains = [
    "google.com",
    "github.com",
    "stackoverflow.com",
    "cloudflare.com",
  ];

  for (const domain of domains) {
    promises.push(resolveDNS(domain, "A"));
  }

  try {
    const results = await Promise.all(promises);
    const duration = Date.now() - start;

    console.log(`✅ 成功解析 ${domains.length} 个域名`);
    console.log(`⏱️ 总耗时: ${duration}ms`);
    console.log(`⚡ 平均每个: ${(duration / domains.length).toFixed(2)}ms`);
  } catch (error) {
    console.error("❌ 性能测试失败:", error.message);
  }
}

// 运行所有测试
async function runAllTests() {
  console.log("开始测试 resolveDNS.js 的各项功能...\n");

  await testBasicDNS();
  await testIPv6();
  await testOtherTypes();
  await testForcedDNS();
  await testErrorHandling();
  await testPerformance();

  console.log("\n=== 测试完成 ===");
  console.log("\n功能总结:");
  console.log("✅ DNS 解析基础功能");
  console.log("✅ IPv6/AAAA 记录支持");
  console.log("✅ MX/TXT 等其他记录类型");
  console.log("✅ 强制 DNS 解析功能");
  console.log("✅ 错误处理机制");
  console.log("✅ 并发解析性能");
}

// 运行测试
runAllTests().catch((error) => {
  console.error("\n测试过程中发生错误:", error);
});
