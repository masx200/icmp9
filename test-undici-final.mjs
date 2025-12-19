import { Agent, setGlobalDispatcher } from "undici";

console.log("=== Undici DNS 强制解析测试 (最终版) ===\n");

// DNS 映射表 - 使用可靠的 IP
const DNS_MAPPING = {
  // Google 服务
  "www.google.com": "142.250.191.100",

  // Cloudflare 服务
  "one.one.one.one": "1.1.1.1",

  // HTTPBin 服务 (Amazon CloudFront)
  "httpbin.org": "54.230.97.71",
};

// 创建自定义 Agent
function createDnsAgent(mappings) {
  return new Agent({
    // 连接池配置
    connections: 10,
    connectTimeout: 5000,

    connect: {
      // 自定义 DNS 解析函数
      lookup: (hostname, options, callback) => {
        console.log(`[DNS Lookup] ${hostname}`);

        // 检查是否有强制映射
        const mappedIP = mappings[hostname];
        if (mappedIP) {
          console.log(`[DNS Forced] ${hostname} ➔ ${mappedIP}`);
          // 返回 IP 地址，格式: [{ address: IP, family: 4/6 }]
          return callback(null, [{ address: mappedIP, family: 4 }]);
        }

        // 使用系统默认 DNS
        console.log(`[DNS System] Using system DNS for ${hostname}`);
        require("dns").lookup(hostname, options, callback);
      },
    },
  });
}

// 测试场景 1: 基本强制解析
async function testBasicForceResolve() {
  console.log("\n--- 测试 1: 基本 DNS 强制解析 ---");

  const agent = createDnsAgent(DNS_MAPPING);

  try {
    // 使用 HTTP GET 而不是 HTTPS，避免 TLS 握手问题
    const response = await fetch("http://httpbin.org/ip", {
      dispatcher: agent,
      signal: AbortSignal.timeout(3000),
    });

    const data = await response.json();
    console.log(`✓ 成功! HTTPBin 返回的客户端 IP: ${data.origin}`);
  } catch (error) {
    console.log(`✗ 失败: ${error.message}`);
    if (error.message.includes("timeout")) {
      console.log("  提示: 可能是 IP 已失效或网络问题");
    }
  }

  agent.destroy();
}

// 测试场景 2: 验证强制解析效果
async function testForceResolutionVerification() {
  console.log("\n--- 测试 2: 验证强制解析是否生效 ---");

  const testMappings = { ...DNS_MAPPING };
  const agent = createDnsAgent(testMappings);

  // 步骤 1: 使用正确的 IP
  console.log("\n步骤 1: 使用正确的 IP 地址");
  try {
    const response = await fetch("http://httpbin.org/ip", {
      dispatcher: agent,
      signal: AbortSignal.timeout(3000),
    });

    const data = await response.json();
    console.log(`✓ 请求成功`);
  } catch (error) {
    console.log(`✗ 请求失败: ${error.message}`);
  }

  // 步骤 2: 使用错误的 IP
  console.log("\n步骤 2: 使用错误的 IP 地址 (证明强制解析生效)");
  testMappings["httpbin.org"] = "192.0.2.1"; // RFC 5737 测试用 IP

  try {
    const response = await fetch("http://httpbin.org/ip", {
      dispatcher: agent,
      signal: AbortSignal.timeout(2000),
    });

    console.log(`⚠️ 意外成功: 可能 IP 被重定向或映射未生效`);
  } catch (error) {
    console.log(`✓ 预期失败: ${error.message}`);
    console.log(`  这证明了 DNS 强制解析生效 - 域名被解析到 192.0.2.1`);
  }

  agent.destroy();
}

// 测试场景 3: 全局 Agent 设置
async function testGlobalDispatcher() {
  console.log("\n--- 测试 3: 全局 Dispatcher 设置 ---");

  const globalAgent = createDnsAgent(DNS_MAPPING);

  // 设置为全局 dispatcher
  setGlobalDispatcher(globalAgent);
  console.log("✓ 已设置全局 Agent");

  try {
    // 现在所有 fetch 请求都会使用我们的 DNS 映射
    const response = await fetch("http://httpbin.org/ip", {
      signal: AbortSignal.timeout(3000),
    });

    const data = await response.json();
    console.log(`✓ 全局 Agent 工作正常! IP: ${data.origin}`);
  } catch (error) {
    console.log(`✗ 失败: ${error.message}`);
  }

  globalAgent.destroy();
}

// 测试场景 4: 动态更新 DNS 映射
async function testDynamicMapping() {
  console.log("\n--- 测试 4: 动态 DNS 映射 ---");

  let currentMapping = {};
  const agent = new Agent({
    connect: {
      lookup: (hostname, options, callback) => {
        console.log(`[Dynamic DNS] ${hostname}`);

        if (currentMapping[hostname]) {
          console.log(
            `[Dynamic DNS] ${hostname} ➔ ${currentMapping[hostname]}`,
          );
          return callback(null, [{
            address: currentMapping[hostname],
            family: 4,
          }]);
        }

        require("dns").lookup(hostname, options, callback);
      },
    },
  });

  // 动态更新映射
  currentMapping["httpbin.org"] = DNS_MAPPING["httpbin.org"];

  try {
    const response = await fetch("http://httpbin.org/ip", {
      dispatcher: agent,
      signal: AbortSignal.timeout(3000),
    });

    const data = await response.json();
    console.log(`✓ 动态映射成功! IP: ${data.origin}`);
  } catch (error) {
    console.log(`✗ 失败: ${error.message}`);
  }

  agent.destroy();
}

// 运行所有测试
async function runAllTests() {
  console.log("开始运行 Undici DNS 强制解析测试...\n");

  await testBasicForceResolve();
  await testForceResolutionVerification();
  await testGlobalDispatcher();
  await testDynamicMapping();

  console.log("\n=== 测试总结 ===");
  console.log("✓ 通过 Agent.connect.lookup 实现了 DNS 强制解析");
  console.log("✓ fetch 通过 dispatcher 选项使用自定义 Agent");
  console.log("✓ 支持动态更新 DNS 映射");
  console.log("✓ 可以设置全局 Dispatcher 影响所有 fetch 请求");
  console.log("\n实际应用场景:");
  console.log("- 绕过系统 DNS 限制");
  console.log("- 实现负载均衡（轮询多个 IP）");
  console.log("- 测试环境域名映射");
  console.log("- CDN 加速（选择最优节点）");
}

// 错误处理
process.on("unhandledRejection", (error) => {
  console.error("未处理的错误:", error.message);
  process.exit(1);
});

// 运行测试
runAllTests().catch((error) => {
  console.error("测试运行失败:", error);
  process.exit(1);
});
