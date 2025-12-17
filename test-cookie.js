// test-cookie.js
import { icmp9API } from "./icmp9-api.js";

/**
 * 测试Cookie清理功能
 */
function testCookieSanitization() {
  console.log("=== Cookie 清理测试 ===");

  // 测试包含问题字符的Cookie
  const problematicCookie = process.env.ICMP9_COOKIE;

  console.log("原始Cookie长度:", problematicCookie.length);

  // 手动测试清理函数
  const sanitized = icmp9API.sanitizeCookie(problematicCookie);
  console.log("清理后Cookie长度:", sanitized.length);

  // 设置Cookie进行测试
  icmp9API.setCookie(problematicCookie);

  // 获取请求头测试
  const headers = icmp9API.getHeaders();
  console.log("请求头Cookie长度:", headers.cookie ? headers.cookie.length : 0);

  console.log("测试完成");
}

/**
 * 测试API调用
 */
async function testAPICall() {
  try {
    console.log("\n=== API 调用测试 ===");

    // 使用环境变量中的Cookie
    if (process.env.ICMP9_COOKIE) {
      console.log("使用环境变量中的Cookie");
      const userInfo = await icmp9API.getUserInfo();
      console.log("✅ API 调用成功!");
      console.log("用户信息:", userInfo.username);
    } else {
      console.log("❌ 未设置 ICMP9_COOKIE 环境变量");
    }
  } catch (error) {
    console.error("❌ API 调用失败:", error.message);
  }
}

// 运行测试
if (import.meta.main) {
  testCookieSanitization();
  testAPICall();
}

export { testAPICall, testCookieSanitization };
