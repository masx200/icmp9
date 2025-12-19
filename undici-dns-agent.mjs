// undici-dns-agent.mjs

import { Agent } from "undici";
import { resolveDNS } from "./dnsResolver.mjs";
import { lookup } from "dns/promises";
import { lookup as dnsLookup } from "dns";

// 强制DNS映射表
const FORCED_DNS_MAPPING = {
  "deno-dns-over-https-server.g18uibxgnb.de5.net":"104.21.9.230"
  // 可以在这里添加强制映射的域名
};

/**
 * 创建支持强制DNS解析的Undici Agent
 * 使用DNS-over-HTTPS解析域名，然后直接连接到解析的IP地址
 */
export class CustomDNSAgent extends Agent {
  constructor(options = {}) {
    super({
      ...options,
      connect: {
        // 使用标准的callback风格的lookup函数
        lookup: (hostname, options, callback) => {
          console.log(`🔍 Agent正在解析域名: ${hostname}`);

          // 检查是否在强制映射表中
          if (FORCED_DNS_MAPPING[hostname]) {
            const forcedIP = FORCED_DNS_MAPPING[hostname];
            console.log(`🔒 强制DNS解析: ${hostname} -> ${forcedIP}`);

            // 根据Node.js dns.LookupOptions的格式返回
            if (options && options.all) {
              return callback(null, [{ address: forcedIP, family: 4 }]);
            } else {
              return callback(null, forcedIP, 4);
            }
          }

          // 如果host是IP地址，直接返回
          if (
            /^\d+\.\d+\.\d+\.\d+$/.test(hostname) ||
            /^\[([0-9a-fA-F:]+)\]$/.test(hostname)
          ) {
            const ip = hostname.replace(/[\[\]]/g, "");
            if (options && options.all) {
              return callback(null, [
                {
                  address: ip,
                  family: ip.includes(":") ? 6 : 4,
                },
              ]);
            } else {
              return callback(null, ip, ip.includes(":") ? 6 : 4);
            }
          }

          // 异步使用DoH解析域名
          resolveDNS(hostname, "A")
            .then((dnsResult) => {
              if (
                dnsResult &&
                dnsResult.answers &&
                dnsResult.answers.length > 0
              ) {
                // 随机选择一个IP地址
                const randomIndex = Math.floor(
                  Math.random() * dnsResult.answers.length,
                );
                const ip = dnsResult.answers[randomIndex].data;
                console.log(
                  `✅ Agent解析成功: ${hostname} -> ${ip} (选择了第 ${
                    randomIndex + 1
                  } 个，共 ${dnsResult.answers.length} 个)`,
                );

                // 根据Node.js dns.LookupOptions的格式返回
                if (options && options.all) {
                  const addresses = dnsResult.answers.map((answer) => ({
                    address: answer.data,
                    family: 4,
                  }));
                  callback(null, addresses);
                } else {
                  callback(null, ip, 4);
                }
              } else {
                console.log(`❌ Agent解析失败: ${hostname}，使用系统默认DNS`);
                // 回退到系统DNS
                lookup(hostname, options)
                  .then((result) => {
                    if (options && options.all) {
                      callback(null, result);
                    } else {
                      callback(null, result.address, result.family);
                    }
                  })
                  .catch((fallbackError) => callback(fallbackError));
              }
            })
            .catch((error) => {
              console.error(`❌ Agent解析错误: ${error.message}`);
              // 如果DNS解析失败，回退到系统默认DNS
              lookup(hostname, options)
                .then((result) => {
                  if (options && options.all) {
                    callback(null, result);
                  } else {
                    callback(null, result.address, result.family);
                  }
                })
                .catch((fallbackError) => callback(fallbackError));
            });
        },
      },
    });
  }
}

/**
 * 创建带有强制DNS解析的fetch函数
 * @param {string} domain - 要强制解析的域名
 * @param {string} resolvedIP - 解析后的IP地址
 * @returns {Function} 返回一个fetch函数
 */
export function createFetchWithForcedDNS(domain, resolvedIP) {
  const agent = new Agent({
    connect: (options, callback) => {
      // 如果目标域名匹配我们要强制解析的域名
      if (options.hostname === domain) {
        console.log(`🔧 强制DNS解析: ${domain} -> ${resolvedIP}`);
        const modifiedOptions = {
          ...options,
          hostname: resolvedIP,
          servername: domain, // 保持SNI
        };
        return Agent.prototype.connect.call(agent, modifiedOptions, callback);
      }
      return Agent.prototype.connect.call(agent, options, callback);
    },
  });

  return async (url, options = {}) => {
    return fetch(url, {
      ...options,
      dispatcher: agent,
    });
  };
}

/**
 * 通用HTTP客户端，支持强制DNS解析和自动DNS解析
 */
export class HTTPClient {
  constructor() {
    this.defaultAgent = new CustomDNSAgent();
  }

  /**
   * 执行HTTP GET请求
   * @param {string} url - 请求的URL
   * @param {Object} options - 请求选项
   * @param {string} options.forcedDomain - 要强制解析的域名
   * @param {string} options.forcedIP - 强制解析的IP地址
   * @param {Object} options.headers - 请求头
   * @returns {Promise<Response>} 返回响应对象
   */
  async get(url, options = {}) {
    const { forcedDomain, forcedIP, headers = {}, ...fetchOptions } = options;

    let fetchOptionsWithDispatcher = {
      ...fetchOptions,
      headers,
    };

    // 如果指定了强制DNS解析
    if (forcedDomain && forcedIP) {
      console.log(`🔧 使用强制DNS解析: ${forcedDomain} -> ${forcedIP}`);

      // 创建强制DNS映射
      const forcedMapping = {
        [forcedDomain]: forcedIP,
      };

      // 创建自定义agent，支持强制DNS解析
      const agent = new Agent({
        connect: {
          lookup: (hostname, options, callback) => {
            if (forcedMapping[hostname]) {
              const mappedIP = forcedMapping[hostname];
              console.log(`🔒 强制解析: ${hostname} -> ${mappedIP}`);
              // 直接返回强制解析的IP地址
              if (options && options.all) {
                const family = mappedIP.includes(":") ? 6 : 4;
                return callback(null, [{ address: mappedIP, family }]);
              } else {
                const family = mappedIP.includes(":") ? 6 : 4;
                return callback(null, mappedIP, family);
              }
            }
            // 对于其他域名，回退到系统DNS
            dnsLookup(hostname, options, callback);
          },
        },
      });
      fetchOptionsWithDispatcher.dispatcher = agent;
    } else {
      // 使用默认的DNS agent
      fetchOptionsWithDispatcher.dispatcher = this.defaultAgent;
    }

    try {
      console.log(`📡 发起HTTP请求: ${url}`);
      const response = await fetch(url, fetchOptionsWithDispatcher);

      if (!response.ok) {
        throw new Error(
          `HTTP错误! 状态: ${response.status} ${response.statusText}`,
        );
      }

      return response;
    } catch (error) {
      console.error(`❌ HTTP请求失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取JSON响应
   * @param {string} url - 请求的URL
   * @param {Object} options - 请求选项
   * @returns {Promise<Object>} 返回JSON对象
   */
  async getJSON(url, options = {}) {
    const response = await this.get(url, options);
    console.log(response);
    if (response.status !== 200) {
      throw new Error(
        `HTTP错误! 状态: ${response.status} ${response.statusText} ${response.url}`,
      );
    }
    return await response.json();
  }

  /**
   * 获取文本响应
   * @param {string} url - 请求的URL
   * @param {Object} options - 请求选项
   * @returns {Promise<string>} 返回文本内容
   */
  async getText(url, options = {}) {
    const response = await this.get(url, options);
    return await response.text();
  }
}

// 导出默认实例
export const httpClient = new HTTPClient();

// 导出便捷函数
export async function fetchWithDNS(url, options = {}) {
  return httpClient.get(url, options);
}

export async function fetchJSONWithDNS(url, options = {}) {
  return httpClient.getJSON(url, options);
}
