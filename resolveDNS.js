import { fetch, Agent, setGlobalDispatcher } from "undici";
import dns from "dns/promises";
import { lookup } from "dns";

/**
 * 强制DNS映射表
 * 特定域名强制解析到指定IP地址
 */
const FORCED_DNS_MAPPING = {
  "fresh-reverse-proxy-middle.masx201.dpdns.org": "104.21.9.230"
};

/**
 * 创建自定义Agent，用于强制DNS解析
 * 简化版本，专注于DNS解析劫持
 * @param {string} hostname - 要连接的主机名
 * @returns {Agent} 自定义Agent实例
 */
function createCustomAgent(hostname) {
  return new Agent({
    connect: {
      // 使用标准的callback风格的lookup函数
      lookup: (hostname, options, callback) => {
        console.log(`🔍 正在解析: ${hostname}`);

        // 检查是否在强制映射表中
        if (FORCED_DNS_MAPPING[hostname]) {
          const forcedIP = FORCED_DNS_MAPPING[hostname];
          console.log(`🔒 强制DNS解析: ${hostname} -> ${forcedIP}`);

          // 根据Node.js dns.LookupOptions的格式返回
          // 可以返回单个地址或地址数组
          if (options && options.all) {
            return callback(null, [{ address: forcedIP, family: 4 }]);
          } else {
            return callback(null, forcedIP, 4);
          }
        }

        // 对于其他域名，使用标准DNS解析
        lookup(hostname, options, callback);
      }
    }
  });
}

/**
 * 使用 Google DNS-over-HTTPS (DoH) API 解析域名
 * @param {string} domain - 要解析的域名 (例如: 'example.com')
 * @param {string} type - DNS 记录类型 (例如: 'A', 'AAAA', 'MX', 'TXT')
 * @param {string} resolverUrl - DNS解析器URL
 * @returns {Promise<object>} 返回一个 Promise，解析为 DNS 查询的 JSON 结果
 */
export async function resolveDNS(
  domain,
  type = "AAAA",
  resolverUrl = "https://fresh-reverse-proxy-middle.masx201.dpdns.org/token/4yF6nSCifSLs8lfkb4t8OWP69kfpgiun/https/dns.google/resolve"
) {
  // 1. 参数验证
  if (!domain || typeof domain !== "string") {
    throw new Error("无效的域名参数");
  }

  if (!type || typeof type !== "string") {
    throw new Error("无效的DNS记录类型参数");
  }

  // 2. 解析resolverUrl中的主机名
  const url = new URL(resolverUrl);
  const resolverHostname = url.hostname;

  // 3. 创建自定义Agent用于强制DNS解析
  const customAgent = createCustomAgent(resolverHostname);

  // 4. 构建请求URL
  url.searchParams.append("name", domain);
  url.searchParams.append("type", type);

  // 5. 发起请求，使用自定义Agent
  try {
    console.log(`🌐 使用强制DNS解析请求: ${url.toString()}`);
    console.log(`🔧 目标DNS解析器: ${resolverHostname}`);
    if (FORCED_DNS_MAPPING[resolverHostname]) {
      console.log(`🎯 强制映射: ${resolverHostname} -> ${FORCED_DNS_MAPPING[resolverHostname]}`);
    }
    
    const response = await fetch(url.toString(), { 
      dispatcher: customAgent,
      // 基本请求选项
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DNS-Resolver/1.0)',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

    // 检查响应是否成功 (HTTP 状态码 200-299)
    if (!response.ok) {
      // 如果服务器返回错误，抛出包含状态码和信息的错误
      throw new Error(
        `DNS API 请求失败: ${response.status} ${response.statusText} ${response.url}`
      );
    }

    // 6. 解析并返回 JSON 数据
    const data = await response.json();
    console.log(`✅ DNS解析成功: ${domain} -> ${JSON.stringify(data).slice(0, 100)}...`);
    return data;
  } catch (error) {
    // 捕获网络错误、fetch 抛出的错误或我们手动抛出的错误
    console.log(`❌ DNS解析失败: ${error.message}`);
    if (error instanceof Error) {
      throw new Error(`DNS 解析过程中发生错误: ${error.message}`);
    }
    throw new Error("DNS 解析时发生未知错误");
  }
}