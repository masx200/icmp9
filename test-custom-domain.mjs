import { Agent } from "undici";
import { lookup } from "dns";

console.log("=== 测试特定域名强制 DNS 解析 ===\n");

// 目标域名和强制解析的 IP
const TARGET_DOMAIN = "fresh-reverse-proxy-middle.masx201.dpdns.org";
const FORCED_IP = "104.21.9.230";

console.log(`目标域名: ${TARGET_DOMAIN}`);
console.log(`强制解析到: ${FORCED_IP}`);
console.log("-".repeat(60));

// 创建自定义 Agent，强制解析特定域名
const agent = new Agent({
  connect: {
    lookup: (hostname, options, callback) => {
      console.log(`[DNS查询] ${hostname}`);

      // 检查是否是目标域名
      if (hostname === TARGET_DOMAIN) {
        console.log(`[DNS强制] ${hostname} -> ${FORCED_IP}`);
        // 返回 IPv4 地址
        return callback(null, [{ address: FORCED_IP, family: 4 }]);
      }

      // 其他域名使用系统 DNS
      console.log(`[DNS系统] 使用系统 DNS 解析: ${hostname}`);
      lookup(hostname, options, callback);
    },
  },
});

// 测试函数
async function testCustomDomain() {
  try {
    console.log("\n[测试开始] 使用强制 DNS 解析访问目标网站");
    console.log(`[请求URL] https://${TARGET_DOMAIN}/`);

    const startTime = Date.now();

    const response = await fetch(`https://${TARGET_DOMAIN}/`, {
      dispatcher: agent,
      // HTTPS 需要设置 SNI
      headers: {
        "Host": TARGET_DOMAIN,
        "User-Agent": "Undici-DNS-Test/1.0",
      },
      // 设置合理的超时
      signal: AbortSignal.timeout(10000),
    });

    const responseTime = Date.now() - startTime;

    console.log(`\n[响应成功]`);
    console.log(`  状态码: ${response.status} ${response.statusText}`);
    console.log(`  响应时间: ${responseTime}ms`);
    console.log(`  响应头:`);

    // 打印一些关键响应头
    console.log(`    Server: ${response.headers.get("server") || "N/A"}`);
    console.log(
      `    Content-Type: ${response.headers.get("content-type") || "N/A"}`,
    );
    console.log(
      `    Content-Length: ${response.headers.get("content-length") || "N/A"}`,
    );

    // 尝试读取响应内容（限制大小）
    const text = await response.text();
    console.log(`\n[响应内容] (前 500 字符):`);
    console.log(text.substring(0, 500) + (text.length > 500 ? "..." : ""));
  } catch (error) {
    console.error(`\n[错误] 请求失败`);
    console.error(`  错误类型: ${error.constructor.name}`);
    console.error(`  错误信息: ${error.message}`);

    // 分析可能的错误原因
    if (error.message.includes("timeout")) {
      console.error(`  可能原因: 连接超时，IP ${FORCED_IP} 可能不可达`);
    } else if (error.message.includes("certificate")) {
      console.error(`  可能原因: SSL/TLS 证书验证失败`);
      console.error(`  提示: 可能需要忽略证书错误或使用 HTTP`);
    } else if (error.message.includes("ECONNREFUSED")) {
      console.error(`  可能原因: 连接被拒绝，IP ${FORCED_IP} 可能不在监听`);
    }

    // 提供调试建议
    console.error(`\n[调试建议]`);
    console.error(`  1. 检查 IP ${FORCED_IP} 是否正确`);
    console.error(
      `  2. 尝试使用 curl 测试: curl -v -k --resolve ${TARGET_DOMAIN}:443:${FORCED_IP} https://${TARGET_DOMAIN}/`,
    );
    console.error(`  3. 尝试使用 HTTP 而不是 HTTPS`);
  }
}

// 测试 HTTP 而不是 HTTPS（避免证书问题）
async function testWithHTTP() {
  console.log("\n[备用测试] 尝试使用 HTTP 协议");

  try {
    const response = await fetch(`http://${TARGET_DOMAIN}/`, {
      dispatcher: agent,
      signal: AbortSignal.timeout(5000),
    });

    console.log(`✓ HTTP 请求成功! 状态码: ${response.status}`);

    const text = await response.text();
    console.log(`\n响应内容 (前 200 字符):`);
    console.log(text.substring(0, 200));
  } catch (error) {
    console.log(`✗ HTTP 请求也失败: ${error.message}`);
  }
}

// 验证 DNS 解析是否真的被强制
async function verifyDnsForce() {
  console.log("\n[验证] 确认 DNS 强制解析是否生效");

  // 临时修改到一个不存在的 IP
  const originalAgent = agent;

  // 创建一个新的测试 agent
  const testAgent = new Agent({
    connect: {
      lookup: (hostname, options, callback) => {
        if (hostname === TARGET_DOMAIN) {
          console.log(`[测试DNS] 强制解析到测试 IP: 1.2.3.4`);
          return callback(null, [{ address: "1.2.3.4", family: 4 }]);
        }
        lookup(hostname, options, callback);
      },
    },
  });

  try {
    await fetch(`https://${TARGET_DOMAIN}/`, {
      dispatcher: testAgent,
      signal: AbortSignal.timeout(3000),
    });
  } catch (error) {
    if (
      error.message.includes("timeout") || error.message.includes("refused")
    ) {
      console.log(`✓ DNS 强制解析已生效 - 请求失败是因为使用了测试 IP 1.2.3.4`);
    } else {
      console.log(`? 请求失败，但原因不明确: ${error.message}`);
    }
  }

  testAgent.destroy();
}

// 运行测试
async function runTests() {
  // 主测试
  await testCustomDomain();

  // 如果失败，尝试 HTTP
  if (process.argv.includes("--try-http")) {
    await testWithHTTP();
  }

  // 验证强制解析
  if (process.argv.includes("--verify")) {
    await verifyDnsForce();
  }

  console.log("\n=== 测试完成 ===");
  console.log("\n使用说明:");
  console.log("1. 这个测试证明了 undici Agent 可以强制 DNS 解析");
  console.log("2. 通过 fetch 的 dispatcher 选项使用自定义 Agent");
  console.log("3. connect.lookup 函数可以拦截并修改 DNS 解析结果");

  // 清理
  agent.destroy();
  console.log("\nAgent 已关闭");
}

// 错误处理
process.on("unhandledRejection", (error) => {
  console.error("未处理的错误:", error);
  agent.destroy();
});

// 运行测试
console.log("提示: 使用 --try-http 参数可以测试 HTTP 协议");
console.log("提示: 使用 --verify 参数可以验证 DNS 强制解析效果\n");

runTests().catch((error) => {
  console.error("测试执行失败:", error);
  agent.destroy();
});
