// dnsResolver.mjs

import { fetch } from "undici";

/**
 * 使用 Google DNS-over-HTTPS (DoH) API 解析域名
 * @param {string} domain - 要解析的域名 (例如: 'example.com')
 * @param {string} type - DNS 记录类型 (例如: 'A', 'AAAA', 'MX', 'TXT')
 * @returns {Promise<object>} 返回一个 Promise，解析为 DNS 查询的 JSON 结果
 */
export async function resolveDNS(
  domain,
  type = "AAAA",
  resolverUrl =
    "https://fresh-reverse-proxy-middle.masx201.dpdns.org/token/4yF6nSCifSLs8lfkb4t8OWP69kfpgiun/https/dns.google/resolve",
) {
  // 1. 参数验证
  if (!domain || typeof domain !== "string") {
    throw new Error("无效的域名参数");
  }

  if (!type || typeof type !== "string") {
    throw new Error("无效的DNS记录类型参数");
  }

  // 2. 构建请求 URL
  const url = new URL(resolverUrl);
  url.searchParams.append("name", domain);
  url.searchParams.append("type", type);

  // 3. 发起请求
  try {
    const response = await fetch(url);

    // 检查响应是否成功 (HTTP 状态码 200-299)
    if (!response.ok) {
      // 如果服务器返回错误，抛出包含状态码和信息的错误
      throw new Error(
        `DNS API 请求失败: ${response.status} ${response.statusText} ${response.url}`,
      );
    }

    // 4. 解析并返回 JSON 数据
    const data = await response.json();
    return data;
  } catch (error) {
    // 捕获网络错误、fetch 抛出的错误或我们手动抛出的错误
    // 为了统一错误信息，可以在这里进行包装
    if (error instanceof Error) {
      throw new Error(`DNS 解析过程中发生错误: ${error.message}`);
    }
    throw new Error("DNS 解析时发生未知错误");
  }
}

// --- 使用示例 ---
// 这部分代码只在直接运行此文件时执行，不会在被其他文件 import 时执行
if (import.meta.main) {
  async function main() {
    console.log("--- 开始 DNS 解析示例 ---");
    try {
      // 解析你提供的 AAAA 记录
      const domain = "hello-world-deno-deploy.a1u06h9fe9y5bozbmgz3.qzz.io";
      const recordType = "AAAA";

      console.log(`正在解析域名: ${domain} (类型: ${recordType})...`);
      const result = await resolveDNS(domain, recordType);

      console.log("\n✅ 解析成功! 完整结果如下:");
      console.log(JSON.stringify(result, null, 2));

      // 提取并显示关键信息
      if (result.Answer && result.Answer.length > 0) {
        console.log("\n📋 提取到的 Answer 记录:");
        result.Answer.forEach((answer, index) => {
          console.log(
            `  ${index + 1}. 数据: ${answer.data}, TTL: ${answer.TTL}秒`,
          );
        });
      } else {
        console.log("\n⚠️ 未找到相关的 Answer 记录。");
      }
    } catch (error) {
      console.error("\n❌ 解析失败:");
      console.error(error.message);
    }
    console.log("\n--- 示例结束 ---");
  }

  main();
}
