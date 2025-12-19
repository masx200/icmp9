#!/usr/bin/env node

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * 获取当前IPv6地址信息
 * 使用多个API服务获取IP地理位置信息
 */
class IPv6InfoFetcher {
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
      isIPv6: true,
    };
  }

  /**
   * 使用 curl 调用 ipinfo.io API 获取IPv6地址
   */
  async fetchFromIPInfo() {
    try {
      console.log("正在从 ipinfo.io 获取IPv6信息...");
      const { stdout } = await execAsync(
        'curl -s https://api.ipinfo.io/lite/me -H "Authorization: Bearer e1d992dda9d73e" -6',
      );

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
      const { stdout } = await execAsync("curl -s https://ifconfig.co/json -6");

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

        console.log(
          `✅ ifconfig.co 获取IPv6成功: ${data.ip} (${data.country})`,
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
   * 使用 curl 调用 api.ip.sb API 获取IPv6地址
   */
  async fetchFromIPSb() {
    try {
      console.log("正在从 api.ip.sb 获取IPv6信息...");
      const { stdout } = await execAsync(
        'curl -s https://api-ipv6.ip.sb/geoip -H "User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.113 Safari/537.36" -6',
      );

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
          source: this.ipinfo.source === "unknown" ? "api.ip.sb" : "combined",
          isIPv6: true, // 明确设置为 true，因为我们已经验证了
        });

        console.log(`✅ api.ip.sb 获取IPv6成功: ${data.ip} (${data.country})`);
        return true;
      } else {
        console.log("❌ api.ip.sb 返回的不是IPv6地址");
        return false;
      }
    } catch (error) {
      console.error("❌ api.ip.sb 获取失败:", error.message);
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
      { name: "api.ip.sb", method: "fetchFromIPSb" },
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
        `   国家: ${this.ipinfo.country} (${this.ipinfo.country_code})`,
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
          `   坐标: ${this.ipinfo.latitude}, ${this.ipinfo.longitude}`,
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
      markdown +=
        `\n- **大洲**: ${this.ipinfo.continent} (${this.ipinfo.continent_code})`;
    }

    if (this.ipinfo.latitude && this.ipinfo.longitude) {
      markdown +=
        `\n- **地理坐标**: ${this.ipinfo.latitude}, ${this.ipinfo.longitude}`;
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
