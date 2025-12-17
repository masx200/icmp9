// get-ipv6.ipshudi.js
import {fetch}from"undici"

async function getIPv6Address() {
  try {
    console.log("正在获取IPv6地址...");

    // 使用ipshudi.com的API获取IPv6地址
    const response = await fetch("https://6.ipshudi.com/", {
      "headers": {
        "accept": "application/json, text/javascript, */*; q=0.01",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
        "sec-ch-ua": "\"Google Chrome\";v=\"143\", \"Chromium\";v=\"143\", \"Not A(Brand\";v=\"24\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "Referer": "https://www.ipshudi.com/"
      },
      "body": null,
      "method": "GET"
    });

    const result = await response.json();

    if (result.status && result.code === 0) {
      console.log("成功获取IPv6地址:");
      console.log(result.data);
      return result.data;
    } else {
      throw new Error(result.msg || "获取IPv6地址失败");
    }
  } catch (error) {
    console.error("获取IPv6地址时出错:", error.message);
    return null;
  }
}
if (import.meta.main) {
  // 执行函数
  getIPv6Address();
}
