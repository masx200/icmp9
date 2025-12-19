// dnsResolver.mjs

import { query } from "@masx200/dns-over-https-node";

/**
 * 使用 RFC8484 标准的 DNS-over-HTTPS (DoH) API 解析域名
 * 基于 @masx200/dns-over-https-node 库实现
 * @param {string} domain - 要解析的域名 (例如: 'example.com')
 * @param {string} type - DNS 记录类型 (例如: 'A', 'AAAA', 'MX', 'TXT')
 * @param {string} resolverUrl - DNS 解析服务器地址
 * @returns {Promise<object>} 返回一个 Promise，解析为 DNS 查询的结果
 */
export async function resolveDNS(
  domain,
  type = "AAAA",
  resolverUrl = "https://deno-dns-over-https-server.g18uibxgnb.de5.net",
  dohforcedIP = "104.21.9.230",
) {
  // 1. 参数验证
  if (!domain || typeof domain !== "string") {
    throw new Error("无效的域名参数");
  }

  if (!type || typeof type !== "string") {
    throw new Error("无效的DNS记录类型参数");
  }

  // 2. 从 resolverUrl 中提取 hostname
  const url = new URL(resolverUrl);
  const hostname = url.hostname;

  // 3. 使用 @masx200/dns-over-https-node 进行 DNS 查询
  try {
    console.log(`🔍 正在解析域名: ${domain} (类型: ${type})`);
    console.log(`🌐 使用 DNS 解析器: ${resolverUrl}`);

    // 调用 query 函数进行 DNS 查询，并强制解析服务器域名
    const result = await query({
      name: domain,
      type: type,
      hostname: hostname,
      path: url.pathname || "/dns-query",
      port: url.port || 443,
      method: "POST",
      dohforcedIP: dohforcedIP ??
          hostname === "deno-dns-over-https-server.g18uibxgnb.de5.net"
        ? "104.21.9.230"
        : undefined,
    });

    console.log(`✅ DNS 解析成功: ${domain}`);

    return result;
  } catch (error) {
    // 捕获网络错误、DNS 解析错误或我们手动抛出的错误
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
      if (result.answers && result.answers.length > 0) {
        console.log("\n📋 提取到的 Answer 记录:");
        result.answers.forEach((answer, index) => {
          console.log(
            `  ${index + 1}. 数据: ${answer.data}, TTL: ${answer.ttl}秒`,
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
