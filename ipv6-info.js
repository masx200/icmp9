#!/usr/bin/env node

import { exec } from "child_process";
import { promisify } from "util";
import { fetch } from "undici";

const execAsync = promisify(exec);

/**
 * 使用 Google DNS-over-HTTPS (DoH) API 解析域名
 * @param {string} domain - 要解析的域名 (例如: 'example.com')
 * @param {string} type - DNS 记录类型 (例如: 'A', 'AAAA', 'MX', 'TXT')
 * @returns {Promise<object>} 返回一个 Promise，解析为 DNS 查询的 JSON 结果
 */
async function resolveDNS(
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
        `DNS API 请求失败: ${response.status} ${response.statusText} ${response.url}`
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
/**
 * 获取当前IPv6地址信息
 * 使用多个API服务获取IP地理位置信息
 */
class IPv6InfoFetcher {
  /**
   * 解析域名的IPv6地址
   * @param {string} domain - 要解析的域名
   * @param {string} type - DNS记录类型，默认为AAAA
   * @param {string} resolverUrl - DNS解析器URL
   * @returns {Promise<Array<string>>} 返回IPv6地址数组
   */
  async lookupipv6(domain, type = "AAAA", resolverUrl = "https://fresh-reverse-proxy-middle.masx201.dpdns.org/token/4yF6nSCifSLs8lfkb4t8OWP69kfpgiun/https/dns.google/resolve") {
    try {
      const result = await resolveDNS(domain, type, resolverUrl);
      if (result.Answer && result.Answer.length > 0) {
        return result.Answer.map(answer => answer.data);
      }
      return [];
    } catch (error) {
      console.error(`解析域名 ${domain} 的IPv6地址失败:`, error.message);
      return [];
    }
  }

  /**
   * 获取域名的IPv6地址用于--connect-to参数
   * @param {string} domain - 要解析的域名
   * @returns {Promise<string>} 返回格式化的IPv6地址，用于--connect-to参数
   */
  async getIPv6ForConnectTo(domain) {
    try {
      console.log(`🔍 正在解析域名 ${domain} 的IPv6地址...`);
      const ipv6Addresses = await this.lookupipv6(domain);
      
      if (ipv6Addresses.length > 0) {
        const ipv6 = ipv6Addresses[0]; // 使用第一个IPv6地址
        console.log(`✅ 成功解析到 ${domain} 的IPv6地址: ${ipv6}`);
        console.log(`📍 可用IPv6地址列表: [${ipv6Addresses.join(', ')}]`);
        return `[${ipv6}]`;
      } else {
        console.log(`❌ 未能解析到 ${domain} 的IPv6地址`);
        return null;
      }
    } catch (error) {
      console.error(`❌ 解析 ${domain} 的IPv6地址时出错:`, error.message);
      return null;
    }
  }
  constructor() {
    this.ipinfo = {
      ip: null,
      asn: null,
      as_name: null,
      as_domain: null,
      country_code: null,
      country: null,
      continent_code: null,
      continent: null,
      latitude: null,
      longitude: null,
      time_zone: null,
      org: null,
      user_agent: null,
      source: "unknown",
      sources: [],
      isIPv6: true,
    };
  }

  /**
   * 使用 curl 调用 ipinfo.io API 获取IPv6地址
   */
  async fetchFromIPInfo() {
    try {
      console.log("正在从 ipinfo.io 获取IPv6信息...");
      
      // 获取ipinfo.io的IPv6地址用于--connect-to
      const ipInfoIPv6 = await this.getIPv6ForConnectTo("api.ipinfo.io");
      const connectToOption = ipInfoIPv6 ? `--connect-to api.ipinfo.io:443:${ipInfoIPv6}:443` : '-6';
      
      const curlCommand = `curl -s https://api.ipinfo.io/lite/me -H "Authorization: Bearer e1d992dda9d73e" ${connectToOption}`;
      console.log(`🔧 执行curl命令: ${curlCommand}`);
      
      const { stdout } = await execAsync(curlCommand);

      const data = JSON.parse(stdout);

      // 验证是否为IPv6地址
      if (data.ip && this.isIPv6(data.ip)) {
        this.ipinfo = Object.assign({}, data, {
          ...this.ipinfo,
          ip: data.ip,
          asn: data.asn,
          as_name: data.as_name,
          as_domain: data.as_domain,
          country_code: data.country_code,
          country: data.country,
          continent_code: data.continent_code,
          continent: data.continent,
          source: "ipinfo.io",
          isIPv6: true, // 明确设置为 true，因为我们已经验证了
        });
        this.ipinfo.sources.push("ipinfo.io");
        console.log(`✅ ipinfo.io 获取IPv6成功: ${data.ip} (${data.country})`);
        return true;
      } else {
        console.log("❌ ipinfo.io 返回的不是IPv6地址");
        return false;
      }
    } catch (error) {
      console.error("❌ ipinfo.io 获取失败:", error.message);
      return false;
    }
  }

  /**
   * 使用 curl 调用 ifconfig.co API 获取IPv6地址
   */
  async fetchFromIfConfig() {
    try {
      console.log("正在从 ifconfig.co 获取IPv6信息...");
      
      // 获取ifconfig.co的IPv6地址用于--connect-to
      const ifConfigIPv6 = await this.getIPv6ForConnectTo("ifconfig.co");
      const connectToOption = ifConfigIPv6 ? `--connect-to ifconfig.co:443:${ifConfigIPv6}:443` : '-6';
      
      const curlCommand = `curl -s https://ifconfig.co/json ${connectToOption}`;
      console.log(`🔧 执行curl命令: ${curlCommand}`);
      
      const { stdout } = await execAsync(curlCommand);

      const data = JSON.parse(stdout);

      // 验证是否为IPv6地址
      if (data.ip && this.isIPv6(data.ip)) {
        this.ipinfo = Object.assign({}, data, {
          ...this.ipinfo,
          ip: data.ip,
          country: data.country,
          country_code: data.country_iso,
          latitude: data.latitude,
          longitude: data.longitude,
          time_zone: data.time_zone,
          asn: data.asn,
          as_name: data.asn_org,
          user_agent: data.user_agent,
          source: this.ipinfo.source === "unknown" ? "ifconfig.co" : "combined",
          isIPv6: true, // 明确设置为 true，因为我们已经验证了
        });
        this.ipinfo.sources.push("ifconfig.co");
        console.log(
          `✅ ifconfig.co 获取IPv6成功: ${data.ip} (${data.country})`
        );
        return true;
      } else {
        console.log("❌ ifconfig.co 返回的不是IPv6地址");
        return false;
      }
    } catch (error) {
      console.error("❌ ifconfig.co 获取失败:", error.message);
      return false;
    }
  }

  /**
   * 使用 curl 调用 api-ipv6.ip.sb API 获取IPv6地址
   */
  async fetchFromIPSb() {
    try {
      console.log("正在从 api-ipv6.ip.sb 获取IPv6信息...");
      
      // 获取api-ipv6.ip.sb的IPv6地址用于--connect-to
      const apiSbIPv6 = await this.getIPv6ForConnectTo("api-ipv6.ip.sb");
      const connectToOption = apiSbIPv6 ? `--connect-to api-ipv6.ip.sb:443:${apiSbIPv6}:443` : '-6';
      
      const curlCommand = `curl -s "https://api-ipv6.ip.sb/geoip" -H "User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.113 Safari/537.36" ${connectToOption}`;
      console.log(`🔧 执行curl命令: ${curlCommand}`);
      
      const { stdout } = await execAsync(curlCommand);

      const data = JSON.parse(stdout);

      // 验证是否为IPv6地址
      if (data.ip && this.isIPv6(data.ip)) {
        this.ipinfo = Object.assign({}, data, {
          ...this.ipinfo,
          ip: data.ip,
          country: data.country,
          country_code: data.country_code,
          region: data.region,
          region_code: data.region_code,
          city: data.city,
          latitude: data.latitude,
          longitude: data.longitude,
          time_zone: data.timezone,
          asn: data.asn,
          as_name: data.asn_organization || data.isp,
          org: data.organization,
          continent_code: data.continent_code,
          source:
            this.ipinfo.source === "unknown" ? "api-ipv6.ip.sb" : "combined",
          isIPv6: true, // 明确设置为 true，因为我们已经验证了
        });
        this.ipinfo.sources.push("api-ipv6.ip.sb");
        console.log(
          `✅ api-ipv6.ip.sb 获取IPv6成功: ${data.ip} (${data.country})`
        );
        return true;
      } else {
        console.log("❌ api-ipv6.ip.sb 返回的不是IPv6地址");
        return false;
      }
    } catch (error) {
      console.error("❌ api-ipv6.ip.sb 获取失败:", error.message);
      return false;
    }
  }

  /**
   * 使用 curl 调用 ipv6.ipleak.net API 获取IPv6地址
   */
  async fetchFromIPLeak() {
    try {
      console.log("正在从 ipv6.ipleak.net 获取IPv6信息...");
      
      // 获取ipv6.ipleak.net的IPv6地址用于--connect-to
      const ipLeakIPv6 = await this.getIPv6ForConnectTo("ipv6.ipleak.net");
      const connectToOption = ipLeakIPv6 ? `--connect-to ipv6.ipleak.net:443:${ipLeakIPv6}:443` : '-6';
      
      const curlCommand = `curl -s "https://ipv6.ipleak.net/?mode=json" -H "User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.113 Safari/537.36" ${connectToOption}`;
      console.log(`🔧 执行curl命令: ${curlCommand}`);
      
      const { stdout } = await execAsync(curlCommand);

      const data = JSON.parse(stdout);

      // 验证是否为IPv6地址
      if (data.ip && this.isIPv6(data.ip)) {
        this.ipinfo = Object.assign({}, data, {
          ...this.ipinfo,
          ip: data.ip,
          asn: data.as_number?.toString(),
          as_name: data.isp_name,
          country: data.country_name,
          country_code: data.country_code,
          region: data.region_name,
          region_code: data.region_code,
          city: data.city_name,
          latitude: data.latitude,
          longitude: data.longitude,
          time_zone: data.time_zone,
          continent: data.continent_name,
          continent_code: data.continent_code,
          postal_code: data.postal_code,
          accuracy_radius: data.accuracy_radius,
          source:
            this.ipinfo.source === "unknown" ? "ipv6.ipleak.net" : "combined",
          isIPv6: true, // 明确设置为 true，因为我们已经验证了
        });
        this.ipinfo.sources.push("ipv6.ipleak.net");
        console.log(
          `✅ ipv6.ipleak.net 获取IPv6成功: ${data.ip} (${data.country_name})`
        );
        return true;
      } else {
        console.log("❌ ipv6.ipleak.net 返回的不是IPv6地址");
        return false;
      }
    } catch (error) {
      console.error("❌ ipv6.ipleak.net 获取失败:", error.message);
      return false;
    }
  }

  /**
   * 使用 curl 调用 6.ipshudi.com API 获取IPv6地址
   */
  async fetchFromIPshudi() {
    try {
      console.log("正在从 6.ipshudi.com 获取IPv6信息...");
      
      // 获取6.ipshudi.com的IPv6地址用于--connect-to
      const ipshudiIPv6 = await this.getIPv6ForConnectTo("6.ipshudi.com");
      const connectToOption = ipshudiIPv6 ? `--connect-to 6.ipshudi.com:443:${ipshudiIPv6}:443` : '-6';
      
      const curlCommand = `curl -s "https://6.ipshudi.com/" ` +
          '-H "accept: application/json, text/javascript, */*; q=0.01" ' +
          '-H "accept-language: zh-CN,zh;q=0.9,en;q=0.8" ' +
          '-H "sec-ch-ua: \\"Google Chrome\\";v=\\"143\\", \\"Chromium\\";v=\\"143\\", \\"Not A(Brand\\";v=\\"24\\"" ' +
          '-H "sec-ch-ua-mobile: ?0" ' +
          '-H "sec-ch-ua-platform: \\"Windows\\"" ' +
          '-H "sec-fetch-dest: empty" ' +
          '-H "sec-fetch-mode: cors" ' +
          '-H "sec-fetch-site: same-site" ' +
          `-H "Referer: https://www.ipshudi.com/" ${connectToOption}`;
      console.log(`🔧 执行curl命令: ${curlCommand}`);
      
      const { stdout } = await execAsync(curlCommand);

      const data = JSON.parse(stdout);

      // 验证响应状态和IPv6地址
      if (
        data.status &&
        data.code === 0 &&
        data.data &&
        this.isIPv6(data.data)
      ) {
        this.ipinfo = Object.assign({}, data, this.ipinfo, {
          ip: data.data,
          source:
            this.ipinfo.source === "unknown" ? "6.ipshudi.com" : "combined",
          isIPv6: true,
        });
        this.ipinfo.sources.push("6.ipshudi.com");
        console.log(`✅ 6.ipshudi.com 获取IPv6成功: ${data.data}`);
        return true;
      } else {
        console.log("❌ 6.ipshudi.com 返回的数据无效");
        if (data.msg) {
          console.log(`   错误信息: ${data.msg}`);
        }
        return false;
      }
    } catch (error) {
      console.error("❌ 6.ipshudi.com 获取失败:", error.message);
      return false;
    }
  }

  /**
   * 使用 curl 调用 api6.ipify.org API 获取IPv6地址
   */
  async fetchFromIPify() {
    try {
      console.log("正在从 api6.ipify.org 获取IPv6信息...");
      
      // 获取api6.ipify.org的IPv6地址用于--connect-to
      const ipifyIPv6 = await this.getIPv6ForConnectTo("api6.ipify.org");
      const connectToOption = ipifyIPv6 ? `--connect-to api6.ipify.org:443:${ipifyIPv6}:443` : '-6';
      
      const curlCommand = `curl -s "https://api6.ipify.org/?format=json" -H "User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.113 Safari/537.36" ${connectToOption}`;
      console.log(`🔧 执行curl命令: ${curlCommand}`);
      
      const { stdout } = await execAsync(curlCommand);

      const data = JSON.parse(stdout);

      // 验证是否为IPv6地址
      if (data.ip && this.isIPv6(data.ip)) {
        this.ipinfo = Object.assign({}, data, {
          ...this.ipinfo,
          ip: data.ip,
          source:
            this.ipinfo.source === "unknown" ? "api6.ipify.org" : "combined",
          isIPv6: true, // 明确设置为 true，因为我们已经验证了
        });
        this.ipinfo.sources.push("api6.ipify.org");
        console.log(`✅ api6.ipify.org 获取IPv6成功: ${data.ip}`);
        return true;
      } else {
        console.log("❌ api6.ipify.org 返回的不是IPv6地址");
        return false;
      }
    } catch (error) {
      console.error("❌ api6.ipify.org 获取失败:", error.message);
      return false;
    }
  }

  /**
   * 检查是否为IPv6地址
   */
  isIPv6(ip) {
    // IPv6地址包含冒号
    return ip && ip.includes(":");
  }

  /**
   * 获取IPv6信息的主要方法
   * 依次尝试不同的API服务
   */
  async fetchIPInfo() {
    console.log("🔍 开始获取当前IPv6地址信息...");

    let success = false;

    // 按顺序尝试各个API
    const apis = [
      { name: "ipinfo.io", method: "fetchFromIPInfo" },
      { name: "6.ipshudi.com", method: "fetchFromIPshudi" },
      { name: "api-ipv6.ip.sb", method: "fetchFromIPSb" },
      { name: "ipv6.ipleak.net", method: "fetchFromIPLeak" },
      { name: "api6.ipify.org", method: "fetchFromIPify" },
      { name: "ifconfig.co", method: "fetchFromIfConfig" },
    ];

    for (let i = 0; i < apis.length; i++) {
      const api = apis[i];
      console.log(`尝试 ${api.name} API...`);
      const apiSuccess = await this[api.method]();

      if (apiSuccess && !success) {
        success = true;
      }

      // 如果成功了但不是第一个API，标记为combined
      if (apiSuccess && i > 0 && this.ipinfo.source !== "combined") {
        this.ipinfo.source = "combined";
      }
    }

    if (success) {
      console.log("✅ IPv6信息获取完成");
      console.log(`   IPv6地址: ${this.ipinfo.ip}`);
      console.log(
        `   国家: ${this.ipinfo.country} (${this.ipinfo.country_code})`
      );
      if (this.ipinfo.region) {
        console.log(`   地区: ${this.ipinfo.region}`);
      }
      if (this.ipinfo.city) {
        console.log(`   城市: ${this.ipinfo.city}`);
      }
      console.log(`   ASN: ${this.ipinfo.asn}`);
      console.log(`   组织: ${this.ipinfo.as_name || this.ipinfo.org}`);
      if (this.ipinfo.latitude && this.ipinfo.longitude) {
        console.log(
          `   坐标: ${this.ipinfo.latitude}, ${this.ipinfo.longitude}`
        );
      }
      if (this.ipinfo.time_zone) {
        console.log(`   时区: ${this.ipinfo.time_zone}`);
      }
      console.log(`   数据源: ${this.ipinfo.source}`);
    } else {
      console.error("❌ 所有IPv6信息获取都失败了");
      console.log("💡 可能原因:");
      console.log("   1. 您的网络可能不支持IPv6");
      console.log("   2. 所有API服务可能暂时不可用");
      console.log("   3. 您的防火墙可能阻止了IPv6连接");

      // 设置默认值，确保程序能继续运行
      this.ipinfo = {
        ip: "unknown",
        country: "unknown",
        country_code: "unknown",
        asn: "unknown",
        as_name: "unknown",
        source: "failed",
        error: "所有IPv6信息API都失败了，可能不支持IPv6连接",
        isIPv6: false,
      };
    }

    return this.ipinfo;
  }

  /**
   * 将IPv6信息格式化为Markdown字符串
   */
  formatAsMarkdown() {
    const timestamp = new Date().toLocaleString("zh-CN");

    let markdown = `## 🌐 当前测试环境信息 (IPv6)

- **获取时间**: ${timestamp}
- **IPv6地址**: ${this.ipinfo.ip}
- **国家/地区**: ${this.ipinfo.country} (${this.ipinfo.country_code})
- **ASN**: ${this.ipinfo.asn}
- **网络组织**: ${this.ipinfo.as_name || this.ipinfo.org || "N/A"}
- **网络域名**: ${this.ipinfo.as_domain || "N/A"}`;

    if (this.ipinfo.continent) {
      markdown += `\n- **大洲**: ${this.ipinfo.continent} (${this.ipinfo.continent_code})`;
    }

    if (this.ipinfo.latitude && this.ipinfo.longitude) {
      markdown += `\n- **地理坐标**: ${this.ipinfo.latitude}, ${this.ipinfo.longitude}`;
    }

    if (this.ipinfo.time_zone) {
      markdown += `\n- **时区**: ${this.ipinfo.time_zone}`;
    }

    markdown += `\n- **数据源**: ${this.ipinfo.source}`;

    if (this.ipinfo.error) {
      markdown += `\n- ⚠️ **错误**: ${this.ipinfo.error}`;
    }

    markdown += `\n\n---\n\n`;

    return markdown;
  }

  /**
   * 将IPv6信息格式化为JSON对象
   */
  formatAsJSON() {
    return {
      timestamp: new Date().toISOString(),
      ip_info: this.ipinfo,
    };
  }
}

// 如果直接运行此脚本，则获取并显示IPv6信息
if (import.meta.main) {
  const fetcher = new IPv6InfoFetcher();
  fetcher.fetchIPInfo().then((ipInfo) => {
    console.log("\n" + "=".repeat(50));
    console.log("IPv6地址信息摘要");
    console.log("=".repeat(50));
    console.log(JSON.stringify(ipInfo, null, 2));
  });
}

export default IPv6InfoFetcher;
