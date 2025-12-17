// get-ipv6.js
import ipify from "ipify";

async function getIPv6Address() {
  try {
    console.log("正在获取IPv6地址...");

    // 使用ipify获取IPv6地址
    const ipv6Address = await ipify({ useIPv6: true });

    console.log("成功获取IPv6地址:");
    console.log(ipv6Address);

    return ipv6Address;
  } catch (error) {
    console.error("获取IPv6地址时出错:", error.message);

    // 如果IPv6获取失败，尝试获取IPv4地址作为备选
    try {
      console.log("尝试获取IPv4地址作为备选...");
      const ipv4Address = await ipify({ useIPv6: false });
      console.log("成功获取IPv4地址:");
      console.log(ipv4Address);
      return ipv4Address;
    } catch (ipv4Error) {
      console.error("获取IPv4地址也失败了:", ipv4Error.message);
      return null;
    }
  }
}
if (import.meta.main) {
  // 执行函数
  getIPv6Address();
}
