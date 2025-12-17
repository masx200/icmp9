// icmp9-api.js
import { fetch } from "undici";

/**
 * ICMP9.COM API 客户端
 * 提供用户信息、白名单配额和IP列表查询功能
 */
class Icmp9API {
  constructor() {
    this.baseURL = "https://icmp9.com";
    this.headers = {
      "accept": "*/*",
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
      "priority": "u=1, i",
      "sec-ch-ua":
        '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "Referer": "https://icmp9.com/user/dashboard",
    };
  }

  /**
   * 获取Cookie，优先从环境变量获取
   * @returns {string} Cookie字符串
   */
  getCookie() {
    // 优先使用环境变量
    const envCookie = process.env.ICMP9_COOKIE;
    if (envCookie) {
      return envCookie;
    }

    // 如果没有环境变量，返回空字符串
    return "";
  }

  /**
   * 设置认证Cookie（可选方法，用于覆盖环境变量）
   * @param {string} cookie - 完整的cookie字符串
   */
  setCookie(cookie) {
    this.cookie = cookie;
  }

  /**
   * 获取请求头
   * @returns {Object} 包含认证信息的请求头
   */
  getHeaders() {
    const headers = { ...this.headers };

    // 优先使用手动设置的cookie，然后是环境变量
    const cookie = this.cookie || this.getCookie();
    if (cookie) {
      // 确保Cookie字符串只包含有效字符，移除可能导致编码问题的字符
      const sanitizedCookie = this.sanitizeCookie(cookie);
      headers.cookie = sanitizedCookie;
    } else {
      console.warn("警告: 未设置 ICMP9_COOKIE 环境变量，API调用可能会失败");
    }

    return headers;
  }

  /**
   * 清理Cookie字符串，移除可能导致编码问题的字符
   * @param {string} cookie - 原始Cookie字符串
   * @returns {string} 清理后的Cookie字符串
   */
  sanitizeCookie(cookie) {
    // 检测并报告问题字符
    const problemChars = [];
    for (let i = 0; i < cookie.length; i++) {
      const charCode = cookie.charCodeAt(i);
      if (charCode > 255) {
        problemChars.push({
          index: i,
          char: cookie[i],
          code: charCode,
          hex: "0x" + charCode.toString(16),
        });
      }
    }

    if (problemChars.length > 0) {
      console.warn("检测到Cookie中包含可能导致编码问题的字符:");
      console.warn("问题字符详情:", problemChars);
      console.warn("将自动清理这些字符");
    }

    // 移除或替换可能导致编码问题的字符
    // 保留标准的Cookie字符：字母、数字、常见符号
    const sanitized = cookie
      .replace(/[^\x00-\x7F]/g, "") // 移除非ASCII字符
      .replace(/[\uFFFD\uFEFF]/g, "") // 移除BOM和替换字符
      .trim();

    if (sanitized.length !== cookie.length) {
      console.warn(`Cookie长度从 ${cookie.length} 清理为 ${sanitized.length}`);
    }

    return sanitized;
  }

  /**
   * 发送API请求
   * @param {string} endpoint - API端点
   * @returns {Promise<Object>} API响应数据
   */
  async request(endpoint) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        headers: this.getHeaders(),
        body: null,
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API请求失败 (${endpoint}):`, error.message);
      throw error;
    }
  }

  /**
   * 获取用户信息
   * @returns {Promise<Object>} 用户信息数据
   */
  async getUserInfo() {
    console.log("获取用户信息...");
    const result = await this.request("/api/user/info");

    if (result.success) {
      console.log("成功获取用户信息:");
      console.log(`用户名: ${result.data.username}`);
      console.log(`API密钥: ${result.data.api_key}`);
      console.log(`流量配额: ${result.data.traffic_quota} bytes`);
      console.log(`已用流量: ${result.data.traffic_used} bytes`);
      console.log(`账户状态: ${result.data.is_active ? "激活" : "未激活"}`);
      return result.data;
    } else {
      throw new Error("获取用户信息失败");
    }
  }

  /**
   * 获取白名单配额信息
   * @returns {Promise<Object>} 白名单配额数据
   */
  async getWhitelistQuota() {
    console.log("获取白名单配额信息...");
    const result = await this.request("/api/user/whitelist/quota");

    if (result.success) {
      console.log("成功获取白名单配额:");
      console.log(`总配额: ${result.data.quota}`);
      console.log(`已使用: ${result.data.used}`);
      console.log(`可用配额: ${result.data.available}`);
      return result.data;
    } else {
      throw new Error("获取白名单配额失败");
    }
  }

  /**
   * 获取白名单IP列表
   * @returns {Promise<Array>} 白名单IP列表
   */
  async getWhitelistIPs() {
    console.log("获取白名单IP列表...");
    const result = await this.request("/api/user/whitelist");

    if (result.success) {
      console.log(`成功获取白名单IP列表，共 ${result.data.length} 个IP:`);
      result.data.forEach((ip, index) => {
        console.log(
          `${index + 1}. ${ip.ipv4} (${ip.ip_type}) - ${ip.remark || "无备注"}`,
        );
      });
      return result.data;
    } else {
      throw new Error("获取白名单IP列表失败");
    }
  }
/**
   * 添加白名单IP
   * @param {string} ip - IP地址（IPv4或IPv6）
   * @param {string} remark - 备注信息（可选）
   * @returns {Promise<Object>} 添加结果
   */
  async addWhitelistIP(ip, remark = "") {
    console.log(`添加白名单IP: ${ip}...`);

    try {
      const response = await fetch(`${this.baseURL}/api/user/whitelist`, {
        headers: {
          ...this.getHeaders(),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ipv4: ip,
          remark: remark,
        }),
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        console.log("添加成功");
        console.log(`IP: ${result.data.ipv4} (${result.data.ip_type})`);
        console.log(`ID: ${result.data._id}`);
        if (result.data.remark) {
          console.log(`备注: ${result.data.remark}`);
        }
        return result;
      } else {
        throw new Error(result.message || "添加失败");
      }
    } catch (error) {
      console.error(`添加白名单IP失败 (${ip}):`, error.message);
      throw error;
    }
  }

  /**
   * 删除白名单IP
   * @param {string} ipId - IP地址的ID
   * @returns {Promise<Object>} 删除结果
   */
  async deleteWhitelistIP(ipId) {
    console.log(`删除白名单IP (ID: ${ipId})...`);

    try {
      const response = await fetch(`${this.baseURL}/api/user/whitelist/${ipId}`, {
        headers: this.getHeaders(),
        body: null,
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        console.log("删除成功");
        return result;
      } else {
        throw new Error(result.message || "删除失败");
      }
    } catch (error) {
      console.error(`删除白名单IP失败 (${ipId}):`, error.message);
      throw error;
    }
  }
  /**
   * 获取所有用户相关信息
   * @returns {Promise<Object>} 包含用户信息、配额和IP列表的完整数据
   */
  async getAllUserData() {
    console.log("=== ICMP9.COM API 数据获取 ===");

    try {
      const [userInfo, whitelistQuota, whitelistIPs] = await Promise.all([
        this.getUserInfo(),
        this.getWhitelistQuota(),
        this.getWhitelistIPs(),
      ]);

      return {
        userInfo,
        whitelistQuota,
        whitelistIPs,
      };
    } catch (error) {
      console.error("获取用户数据失败:", error.message);
      throw error;
    }
  }

  /**
   * 提取IPv6地址列表
   * @returns {Promise<Array<string>>} IPv6地址数组
   */
  async getIPv6Addresses() {
    const whitelistData = await this.getWhitelistIPs();
    const ipv6Addresses = whitelistData
      .filter((ip) => ip.ip_type === "ipv6")
      .map((ip) => ip.ipv4);

    console.log(`提取到 ${ipv6Addresses.length} 个IPv6地址:`);
    ipv6Addresses.forEach((ip, index) => {
      console.log(`${index + 1}. ${ip}`);
    });

    return ipv6Addresses;
  }
}

// 创建默认实例
const icmp9API = new Icmp9API();

// 导出类和实例
export { Icmp9API, icmp9API };

// 如果直接运行此文件，执行示例
if (import.meta.main) {
  // 示例用法（需要设置Cookie）
  console.log("ICMP9 API 客户端已创建");
  console.log("请设置 Cookie 后使用：");
  console.log("icmp9API.setCookie('your_cookie_here');");
  console.log("然后调用：");
  console.log("await icmp9API.getAllUserData();");
}
