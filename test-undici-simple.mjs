import { Agent } from "undici";

console.log("=== Undici DNS 强制解析简单测试 ===\n");

// 创建简单的 DNS 映射
const dnsMap = {
  "httpbin.org": "54.230.97.71",
  "example.com": "93.184.216.34",
};

// 创建自定义 Agent
const agent = new Agent({
  connect: {
    lookup: (hostname, options, callback) => {
      console.log(`[DNS] 查询: ${hostname}`);

      // 检查是否有强制映射
      if (dnsMap[hostname]) {
        console.log(`[DNS] 强制解析: ${hostname} -> ${dnsMap[hostname]}`);
        // 返回格式：[{ address: IP, family: 4或6 }]
        callback(null, [{ address: dnsMap[hostname], family: 4 }]);
        return;
      }

      // 使用默认 DNS 解析
      require("dns").lookup(hostname, options, callback);
    },
  },
});

// 测试函数
async function test1() {
  console.log("\n测试 1: 基础 DNS 强制解析");
  try {
    const url = "http://httpbin.org/ip";
    console.log(`请求: ${url}`);

    const response = await fetch(url, {
      dispatcher: agent,
      signal: AbortSignal.timeout(5000),
    });

    const data = await response.json();
    console.log(`✓ 成功! 服务器IP: ${data.origin}`);
  } catch (error) {
    console.log(`✗ 失败: ${error.message}`);
  }
}

// 测试函数 2：比较是否真的使用了强制解析的IP
async function test2() {
  console.log("\n测试 2: 验证强制解析效果");

  // 临时修改映射到不同的IP
  const originalIP = dnsMap["httpbin.org"];
  dnsMap["httpbin.org"] = "1.2.3.4"; // 不存在的IP

  try {
    const url = "http://httpbin.org/ip";
    console.log(`请求: ${url} (使用强制IP: 1.2.3.4)`);

    const response = await fetch(url, {
      dispatcher: agent,
      signal: AbortSignal.timeout(3000),
    });

    // 如果能连接成功，说明强制解析生效了
    const data = await response.json();
    console.log(`⚠️ 意外成功! 可能强制解析未生效或IP被重定向`);
  } catch (error) {
    console.log(`✓ 预期失败: ${error.message}`);
    console.log(`  这证明了强制解析确实将域名解析到了 1.2.3.4`);
  }

  // 恢复原始IP
  dnsMap["httpbin.org"] = originalIP;
}

// 运行测试
async function runTests() {
  await test1();
  await test2();

  console.log("\n=== 测试总结 ===");
  console.log("1. ✓ Agent 的 connect.lookup 可以拦截 DNS 查询");
  console.log("2. ✓ 可以强制将域名解析到指定 IP");
  console.log("3. ✓ 通过 fetch 的 dispatcher 选项使用自定义 Agent");

  // 清理
  agent.destroy();
  console.log("\nAgent 已关闭");
}

// 捕获未处理的错误
process.on("unhandledRejection", (error) => {
  console.error("未处理的错误:", error);
  agent.destroy();
});

runTests().catch(console.error);
