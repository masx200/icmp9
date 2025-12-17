// icmp9-api-example.js
import { icmp9API } from "./icmp9-api.js";

/**
 * ICMP9 API 使用示例
 */
async function example() {
  try {
    console.log("=== ICMP9 API 使用示例 ===");

    // 检查环境变量是否设置
    if (!process.env.ICMP9_COOKIE) {
      console.log("环境变量 ICMP9_COOKIE 未设置");
      console.log("请设置环境变量后运行，例如：");
      console.log(
        "export ICMP9_COOKIE='server_name_session=xxx; cf_clearance=xxx; connect.sid=xxx'",
      );
      console.log("或者在 Windows 中：");
      console.log(
        "set ICMP9_COOKIE=server_name_session=xxx; cf_clearance=xxx; connect.sid=xxx",
      );
      console.log();
      console.log("或者在代码中手动设置（不推荐，仅用于测试）：");
      console.log("icmp9API.setCookie('your_cookie_here');");
      console.log();

      // 可选：手动设置Cookie进行测试（注释掉下面这行来使用环境变量）
      // icmp9API.setCookie("server_name_session=your_session_here; cf_clearance=your_clearance_here; connect.sid=your_sid_here");

      // 如果没有Cookie，跳过API调用
      return;
    }

    // 方法1: 获取所有数据
    console.log("=== 方法1: 获取所有用户数据 ===");
    const allData = await icmp9API.getAllUserData();

    console.log("\n=== 数据汇总 ===");
    console.log(`用户: ${allData.userInfo.username}`);
    console.log(`API密钥: ${allData.userInfo.api_key}`);
    console.log(
      `剩余流量: ${
        allData.userInfo.traffic_quota - allData.userInfo.traffic_used
      } bytes`,
    );
    console.log(
      `白名单可用: ${allData.whitelistQuota.available}/${allData.whitelistQuota.quota}`,
    );
    console.log(
      `IPv6地址数量: ${
        allData.whitelistIPs.filter((ip) => ip.ip_type === "ipv6").length
      }`,
    );

    console.log("\n=== 方法2: 单独获取IPv6地址列表 ===");
    const ipv6Addresses = await icmp9API.getIPv6Addresses();

    console.log("\n=== 方法3: 单独获取用户信息 ===");
    const userInfo = await icmp9API.getUserInfo();

    console.log("\n=== 方法4: 单独获取白名单配额 ===");
    const quota = await icmp9API.getWhitelistQuota();

    console.log("\n=== 方法5: 单独获取白名单IP列表 ===");
    const ipList = await icmp9API.getWhitelistIPs();
    console.log({
      ipv6Addresses,
      userInfo,
      quota,
      ipList,
    });
  } catch (error) {
    console.error("示例执行失败:", error.message);
  }
}

// 执行示例
if (import.meta.main) {
  console.log("开始执行 ICMP9 API 示例...");
  console.log("请确保在运行前设置正确的 Cookie！");
  console.log();
  example();
}

export { example };
