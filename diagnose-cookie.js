// diagnose-cookie.js
import { fetch } from "undici";

/**
 * 诊断Cookie编码问题
 */
function diagnoseCookie() {
  const cookie = process.env.ICMP9_COOKIE;

  if (!cookie) {
    console.log("❌ 未设置 ICMP9_COOKIE 环境变量");
    return;
  }

  console.log("=== Cookie 诊断 ===");
  console.log("Cookie长度:", cookie.length);

  // 检查每个字符
  let hasHighChars = false;
  const problemIndices = [];

  for (let i = 0; i < cookie.length; i++) {
    const charCode = cookie.charCodeAt(i);
    if (charCode > 255) {
      hasHighChars = true;
      problemIndices.push({
        index: i,
        char: cookie[i],
        code: charCode,
        hex: charCode.toString(16),
        context: cookie.substring(Math.max(0, i-10), i+10)
      });
    }
  }

  if (hasHighChars) {
    console.log("❌ 发现高字节字符 (>255):");
    problemIndices.forEach(item => {
      console.log(`  位置 ${item.index}: "${item.char}" (${item.code}/0x${item.hex})`);
      console.log(`    上下文: ...${item.context}...`);
    });
  } else {
    console.log("✅ 未发现高字节字符");
  }

  // 尝试清理Cookie
  const sanitized = cookie.replace(/[^\x00-\x7F]/g, '');
  console.log("清理后长度:", sanitized.length);
  console.log("长度变化:", cookie.length - sanitized.length);

  return sanitized;
}

/**
 * 测试简单的API调用
 */
async function testSimpleAPICall() {
  try {
    const sanitizedCookie = diagnoseCookie();

    if (!sanitizedCookie) {
      console.log("无法获取有效的Cookie");
      return;
    }

    console.log("\n=== 测试API调用 ===");

    const headers = {
      "accept": "*/*",
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
      "priority": "u=1, i",
      "sec-ch-ua": "\"Google Chrome\";v=\"143\", \"Chromium\";v=\"143\", \"Not A(Brand\";v=\"24\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"Windows\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "Referer": "https://icmp9.com/user/dashboard",
      "cookie": sanitizedCookie
    };

    console.log("发送请求到 /api/user/info...");

    const response = await fetch("https://icmp9.com/api/user/info", {
      headers,
      body: null,
      method: "GET"
    });

    console.log("响应状态:", response.status);
    console.log("响应头:", Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      const result = await response.json();
      console.log("✅ API调用成功!");
      console.log("响应数据:", result);
    } else {
      console.log("❌ API调用失败:", response.status, response.statusText);
      const text = await response.text();
      console.log("响应内容:", text);
    }

  } catch (error) {
    console.error("❌ 请求失败:", error.message);
    console.error("错误详情:", error);
  }
}

// 运行诊断
if (import.meta.main) {
  testSimpleAPICall();
}