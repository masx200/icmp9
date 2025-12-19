#!/usr/bin/env node

import { Agent, fetch } from "undici";
import dns from "dns";

/**
 * 强制DNS映射表
 */
const FORCED_DNS_MAPPING = {
  "httpbin.org": "54.230.97.86", // httpbin.org的一个IP
  "example.com": "93.184.216.34", // example.com的IP
};

/**
 * 创建自定义Agent
 */
function createCustomAgent() {
  return new Agent({
    connect: {
      lookup: (hostname, options, callback) => {
        if (FORCED_DNS_MAPPING[hostname]) {
          const forcedIP = FORCED_DNS_MAPPING[hostname];
          console.log(`🔒 强制DNS解析: ${hostname} -> ${forcedIP}`);
          callback(null, forcedIP, 4);
          return;
        }

        console.log(`🌐 标准DNS解析: ${hostname}`);
        dns.lookup(hostname, options, callback);
      },
    },
  });
}

async function testDNSForce() {
  console.log("🧪 简单强制DNS解析测试...\n");

  const customAgent = createCustomAgent();

  // 测试1: 访问强制解析的域名
  console.log("📋 测试1: 使用强制DNS访问 httpbin.org");
  try {
    const response = await fetch("https://httpbin.org/ip", {
      dispatcher: customAgent,
    });
    const data = await response.json();
    console.log("✅ 成功:", data);
  } catch (error) {
    console.log("❌ 失败:", error.message);
  }

  console.log("\n" + "=".repeat(50) + "\n");

  // 测试2: 访问普通域名
  console.log("📋 测试2: 标准DNS访问 example.com");
  try {
    const response = await fetch("https://example.com", {
      dispatcher: customAgent,
    });
    const text = await response.text();
    console.log("✅ 成功获取页面内容长度:", text.length);
  } catch (error) {
    console.log("❌ 失败:", error.message);
  }
}

if (import.meta.main) {
  testDNSForce();
}
