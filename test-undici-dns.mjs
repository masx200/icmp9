import { Agent } from "undici";
import dns from "dns/promises";

console.log("=== Undici DNS 强制解析测试 ===\n");

// 方法一：使用 Agent 的 connect 选项
console.log("方法一：使用 Agent 的 connect 选项");
console.log("-".repeat(50));

// 创建自定义 Agent，实现 DNS 强制解析
const agent = new Agent({
  connect: {
    lookup: async (hostname, options) => {
      console.log(`[DNS查询] 尝试解析域名: ${hostname}`);

      // 自定义 DNS 映射
      const customMappings = {
        "httpbin.org": "54.230.97.71", // 强制解析到特定IP
        "example.com": "93.184.216.34",
        "google.com": "142.250.191.14",
      };

      if (customMappings[hostname]) {
        console.log(`[DNS强制] ${hostname} -> ${customMappings[hostname]}`);
        return [{ address: customMappings[hostname], family: 4 }];
      }

      // 默认解析
      try {
        const result = await dns.lookup(hostname, options);
        console.log(`[DNS默认] ${hostname} -> ${result.address}`);
        return [result];
      } catch (error) {
        console.log(`[DNS错误] 无法解析 ${hostname}: ${error.message}`);
        throw error;
      }
    },
  },
});

// 测试函数
async function testDnsResolution() {
  const testUrls = [
    "https://httpbin.org/ip",
    "https://example.com",
    "https://google.com",
  ];

  for (const url of testUrls) {
    try {
      console.log(`\n[测试] 请求: ${url}`);
      console.log(`[时间] ${new Date().toISOString()}`);

      const response = await fetch(url, {
        dispatcher: agent,
        signal: AbortSignal.timeout(10000), // 10秒超时
      });

      if (url.includes("httpbin.org/ip")) {
        // 对于 httpbin.org/ip，显示返回的IP
        const data = await response.json();
        console.log(`[结果] 服务器返回的IP: ${data.origin}`);
      } else {
        console.log(
          `[结果] 响应状态: ${response.status} ${response.statusText}`,
        );
        console.log(
          `[信息] 响应大小: ${response.headers.get("content-length")} bytes`,
        );
      }
    } catch (error) {
      console.error(`[错误] 请求失败: ${error.message}`);
    }
  }
}

// 方法二：更高级的 DNS 拦截器示例
console.log("\n\n方法二：高级 DNS 拦截器示例");
console.log("-".repeat(50));

class DnsInterceptorAgent extends Agent {
  constructor(options = {}) {
    super({
      ...options,
      connect: {
        ...options.connect,
        lookup: async (hostname, opts) => {
          // 日志记录
          console.log(`[拦截器] DNS查询: ${hostname}`);

          // 可以在这里添加更复杂的逻辑：
          // 1. 轮询多个IP
          // 2. 基于延迟选择最优IP
          // 3. 实现故障转移
          // 4. 缓存DNS结果

          // 模拟负载均衡：随机选择IP
          if (hostname === "httpbin.org") {
            const ips = [
              "54.230.97.71",
              "54.230.97.98",
              "54.230.97.125",
            ];
            const selectedIp = ips[Math.floor(Math.random() * ips.length)];
            console.log(`[负载均衡] ${hostname} -> ${selectedIp} (随机选择)`);
            return [{ address: selectedIp, family: 4 }];
          }

          // 默认行为
          return dns.lookup(hostname, opts);
        },
      },
    });
  }
}

// 创建拦截器 Agent
const interceptorAgent = new DnsInterceptorAgent();

// 测试拦截器
async function testInterceptor() {
  console.log("\n[拦截器测试] 测试负载均衡效果");

  for (let i = 0; i < 3; i++) {
    try {
      console.log(`\n第 ${i + 1} 次请求:`);
      const response = await fetch("https://httpbin.org/ip", {
        dispatcher: interceptorAgent,
        signal: AbortSignal.timeout(10000),
      });

      const data = await response.json();
      console.log(`服务器IP: ${data.origin}`);
    } catch (error) {
      console.error(`请求失败: ${error.message}`);
    }

    // 短暂延迟
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

// 方法三：使用环境变量或配置文件
console.log("\n\n方法三：使用配置驱动的 DNS 映射");
console.log("-".repeat(50));

// DNS 配置
const dnsConfig = {
  mappings: {
    "api.github.com": "140.82.112.5",
    "github.com": "140.82.121.4",
  },
  // 是否启用DNS缓存
  enableCache: true,
  cache: new Map(),
  // 默认DNS服务器
  defaultServers: ["8.8.8.8", "1.1.1.1"],
};

// 创建带配置的 Agent
function createConfigurableAgent(config) {
  return new Agent({
    connect: {
      lookup: async (hostname, options) => {
        // 检查缓存
        const cacheKey = `${hostname}:${options.family || 4}`;
        if (config.enableCache && config.cache.has(cacheKey)) {
          const cached = config.cache.get(cacheKey);
          if (Date.now() - cached.timestamp < 300000) { // 5分钟缓存
            console.log(`[缓存命中] ${hostname} -> ${cached.address}`);
            return [cached.result];
          }
        }

        // 使用映射配置
        if (config.mappings[hostname]) {
          const result = {
            address: config.mappings[hostname],
            family: options.family || 4,
          };

          // 更新缓存
          if (config.enableCache) {
            config.cache.set(cacheKey, {
              result,
              timestamp: Date.now(),
            });
          }

          console.log(`[配置映射] ${hostname} -> ${config.mappings[hostname]}`);
          return [result];
        }

        // 默认解析
        const result = await dns.lookup(hostname, options);
        console.log(`[系统DNS] ${hostname} -> ${result.address}`);
        return [result];
      },
    },
  });
}

// 测试配置驱动的方法
async function testConfigurableAgent() {
  const configurableAgent = createConfigurableAgent(dnsConfig);

  try {
    console.log("\n测试 GitHub API (使用配置映射):");
    const response = await fetch("https://api.github.com/users/github", {
      dispatcher: configurableAgent,
      headers: {
        "User-Agent": "undici-dns-test",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      const data = await response.json();
      console.log(
        `[成功] GitHub用户: ${data.login}, 关注者: ${data.followers}`,
      );
    } else {
      console.log(`[响应] 状态码: ${response.status}`);
    }
  } catch (error) {
    console.error(`[错误] ${error.message}`);
  }
}

// 运行所有测试
async function runAllTests() {
  try {
    await testDnsResolution();
    await testInterceptor();
    await testConfigurableAgent();

    console.log("\n\n=== 测试完成 ===");
    console.log("总结:");
    console.log("1. Agent.connect.lookup 可以拦截所有DNS查询");
    console.log("2. 可以实现域名强制解析到指定IP");
    console.log("3. 支持负载均衡和故障转移");
    console.log("4. 可以添加DNS缓存提高性能");
    console.log("5. 适用于需要绕过系统DNS的场景");
  } catch (error) {
    console.error("测试执行失败:", error);
  } finally {
    // 关闭 Agent
    agent.destroy();
    interceptorAgent.destroy();
    process.exit(0);
  }
}

// 运行测试
runAllTests();
