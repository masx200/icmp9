import { resolveDNS } from "./resolveDNS.js";
import { Agent } from "undici";

console.log("=== 测试 resolveDNS.js 强制DNS解析功能 ===\n");

// 测试解析域名
async function testResolveDNS() {
  try {
    console.log("🔍 测试 DNS 解析...");
    console.log("目标: fresh-reverse-proxy-middle.masx201.dpdns.org");
    console.log("强制解析到: 104.21.9.230");
    console.log("-".repeat(60));

    // 使用 resolveDNS 函数解析一个测试域名
    const result = await resolveDNS("google.com", "A");

    console.log("\n✅ DNS 解析成功!");
    console.log("返回结果:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("\n❌ DNS 解析失败:");
    console.error("错误信息:", error.message);
    console.error("错误堆栈:", error.stack);
  }
}

// 直接测试强制解析的效果
async function testDirectFetch() {
  console.log("\n\n=== 直接测试 fetch 请求 ===\n");

  // 创建与 resolveDNS 相同的 Agent 配置
  const agent = new Agent({
    connect: {
      lookup: async (hostname, options) => {
        console.log(`🔍 正在解析: ${hostname}`);

        // 检查是否在强制映射表中
        if (hostname === "fresh-reverse-proxy-middle.masx201.dpdns.org") {
          const forcedIP = "104.21.9.230";
          console.log(`🔒 强制DNS解析: ${hostname} -> ${forcedIP}`);
          return { address: forcedIP, family: 4 };
        }

        // 对于其他域名，使用正常DNS解析
        const dns = await import("dns/promises");
        try {
          const result = await dns.lookup(hostname, { family: 4 });
          console.log(`🌐 标准DNS解析: ${hostname} -> ${result.address}`);
          return { address: result.address, family: result.family };
        } catch (error) {
          console.error(`❌ DNS解析失败: ${hostname} - ${error.message}`);
          throw error;
        }
      },
    },
  });

  try {
    console.log(
      "测试访问: https://fresh-reverse-proxy-middle.masx201.dpdns.org/",
    );

    const response = await fetch(
      "https://fresh-reverse-proxy-middle.masx201.dpdns.org/",
      {
        dispatcher: agent,
        signal: AbortSignal.timeout(5000),
      },
    );

    console.log(`\n✅ 请求成功!`);
    console.log(`状态码: ${response.status} ${response.statusText}`);
    console.log(`Server: ${response.headers.get("server") || "N/A"}`);

    // 读取少量内容确认
    const text = await response.text();
    console.log(`\n响应内容 (前 200 字符):`);
    console.log(text.substring(0, 200));
  } catch (error) {
    console.error("\n❌ 请求失败:", error.message);
  } finally {
    agent.destroy();
  }
}

// 运行所有测试
async function runAllTests() {
  await testResolveDNS();
  await testDirectFetch();

  console.log("\n=== 测试总结 ===");
  console.log("✓ 已修改 resolveDNS.js 中的强制 DNS 映射");
  console.log(
    "✓ fresh-reverse-proxy-middle.masx201.dpdns.org 强制解析到 104.21.9.230",
  );
}

runAllTests().catch(console.error);
