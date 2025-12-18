#!/usr/bin/env node

import fs from "fs";
import yaml from "yaml";

/**
 * 解码 VMess 链接
 * @param {string} vmessUrl - vmess:// 开头的链接
 * @returns {object} 解码后的配置对象
 */
function decodeVmess(vmessUrl) {
  if (!vmessUrl.startsWith("vmess://")) {
    throw new Error("Invalid VMess URL format");
  }

  const base64Data = vmessUrl.substring(8); // 移除 "vmess://"
  const jsonStr = Buffer.from(base64Data, "base64").toString("utf8");
  const config = JSON.parse(jsonStr);

  return config;
}

/**
 * 将 VMess 配置转换为 Clash 代理配置
 * @param {object} vmessConfig - VMess 配置对象
 * @returns {object} Clash 代理配置
 */
function vmessToClashProxy(vmessConfig) {
  const proxy = {
    name: vmessConfig.ps || `VMess-${vmessConfig.add}`,
    type: "vmess",
    server: vmessConfig.add,
    port: parseInt(vmessConfig.port),
    uuid: vmessConfig.id,
    alterId: parseInt(vmessConfig.aid || "0"),
    cipher: vmessConfig.scy || "auto",
    udp: true,
    "skip-cert-verify": false,
  };

  // 网络传输配置
  if (vmessConfig.net === "ws") {
    proxy.network = "ws";
    proxy["ws-opts"] = {};

    if (vmessConfig.path) {
      proxy["ws-opts"].path = vmessConfig.path;
    }

    if (vmessConfig.host) {
      proxy["ws-opts"].headers = {
        Host: vmessConfig.host,
      };
    }
  } else if (vmessConfig.net === "grpc") {
    proxy.network = "grpc";
    proxy["grpc-opts"] = {
      "grpc-service-name": vmessConfig.path || "",
    };
  } else if (vmessConfig.net === "h2") {
    proxy.network = "h2";
    proxy["h2-opts"] = {
      host: [vmessConfig.host] || [],
      path: vmessConfig.path || "/",
    };
  }

  // TLS 配置
  if (vmessConfig.tls === "tls") {
    proxy.tls = true;
    if (vmessConfig.sni) {
      proxy.sni = vmessConfig.sni;
    }
  }

  // Reality 配置 (如果存在)
  if (vmessConfig.reality) {
    proxy.reality = true;
    proxy["reality-opts"] = {
      "public-key": vmessConfig.pbk || "",
      "short-id": vmessConfig.sid || "",
    };
  }

  return proxy;
}

/**
 * 主转换函数
 */
async function convertVmessToClash() {
  try {
    const inputFile = "分享链接.txt";
    const outputFile = "clash-output-consistenthashing.yaml";

    // 检查输入文件是否存在
    if (!fs.existsSync(inputFile)) {
      console.error(`❌ 错误: 找不到输入文件 ${inputFile}`);
      process.exit(1);
    }

    console.log("📖 读取 VMess 链接文件...");
    const content = fs.readFileSync(inputFile, "utf8");
    const lines = content
      .split("\n")
      .filter((line) => line.trim().startsWith("vmess://"));

    if (lines.length === 0) {
      console.log("⚠️  没有找到有效的 VMess 链接");
      return;
    }

    console.log(`🔄 发现 ${lines.length} 个 VMess 链接，开始转换...`);

    const proxies = [];
    const errors = [];
    const processedNames = new Set();

    for (let i = 0; i < lines.length; i++) {
      try {
        const vmessUrl = lines[i].trim();
        if (!vmessUrl) continue;

        const vmessConfig = decodeVmess(vmessUrl);
        const clashProxy = vmessToClashProxy(vmessConfig);

        // 去重处理 - 检查是否已存在相同名称的代理
        let uniqueName = clashProxy.name;
        let counter = 1;
        while (processedNames.has(uniqueName)) {
          uniqueName = `${clashProxy.name}-${counter}`;
          counter++;
        }
        clashProxy.name = uniqueName;
        processedNames.add(uniqueName);

        proxies.push(clashProxy);

        if ((i + 1) % 100 === 0) {
          console.log(`  已处理 ${i + 1}/${lines.length} 个链接...`);
        }
      } catch (error) {
        errors.push({
          line: i + 1,
          url: lines[i].substring(0, 50) + "...",
          error: error.message,
        });
      }
    }

    console.log(`✅ 成功转换 ${proxies.length} 个代理配置`);

    // 创建 Clash 配置
    const clashConfig = {
      port: 7890,
      "socks-port": 7891,
      "mixed-port": 7892,
      "allow-lan": false,
      mode: "rule",
      "log-level": "info",
      "unified-delay": true,
      "global-client-fingerprint": "chrome",
      dns: {
        enable: true,
        listen: "0.0.0.0:53",
      },
      proxies: proxies,
      "proxy-groups": [
        {
          name: "🔀 负载均衡",
          // 'type': 'select',
          interval: 86400,
          type: "load-balance",
          strategy: "consistent-hashing",
          url: "http://www.gstatic.com/generate_204",
          proxies: [
            /* '♻️ 自动选择', '🔯 故障转移', */ ...proxies.map((p) => p.name),
          ],
        },
        // {
        //     'name': '♻️ 自动选择',
        //     'type': 'url-test',
        //     'url': 'http://www.gstatic.com/generate_204',
        //     'interval': 300,
        //     'proxies': proxies.map(p => p.name)
        // },
        // {
        //     'name': '🔯 故障转移',
        //     'type': 'fallback',
        //     'url': 'http://www.gstatic.com/generate_204',
        //     'interval': 300,
        //     'proxies': proxies.map(p => p.name)
        // },
        {
          name: "🌍 国外媒体",
          type: "select",
          proxies: ["🔀 负载均衡" /* '♻️ 自动选择' */],
        },
        {
          name: "🌏 国内媒体",
          type: "select",
          proxies: [/* '🔀 负载均衡', '♻️ 自动选择' */ "DIRECT"],
        },
        {
          name: "📲 电报信息",
          type: "select",
          proxies: ["🔀 负载均衡"],
        },
        {
          name: "🚫 广告拦截",
          type: "select",
          proxies: ["REJECT"],
        },
        {
          name: "🐟 漏网之鱼",
          type: "select",
          proxies: ["🔀 负载均衡"],
        },
      ],
      rules: [
        // 'DOMAIN-KEYWORD,geosite-cn-redirect,DIRECT',
        "DOMAIN-SUFFIX,local,DIRECT",
        "DOMAIN-KEYWORD,github,🔀 负载均衡",
        "RULE-SET,applications,DIRECT",
        "RULE-SET,private,DIRECT",
        "RULE-SET,reject,🚫 广告拦截",
        "RULE-SET,icloud,DIRECT",
        "RULE-SET,apple,DIRECT",
        "RULE-SET,google,🔀 负载均衡",
        // 'RULE-SET,netflix,🌍 国外媒体',
        "RULE-SET,telegram,📲 电报信息",
        "RULE-SET,gfw,🔀 负载均衡",
        "RULE-SET,GreatFirewall,🔀 负载均衡",
        "RULE-SET,proxy,🔀 负载均衡",
        "GEOIP,CN,DIRECT",
        "GEOIP,HK,🔀 负载均衡",
        "GEOIP,TW,🔀 负载均衡",
        "GEOIP,SG,🔀 负载均衡",
        "GEOIP,JP,🔀 负载均衡",
        "GEOIP,US,🔀 负载均衡",
        "FINAL,🐟 漏网之鱼",
      ],
      "rule-providers": {
        reject: {
          type: "http",
          behavior: "domain",
          url:
            "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/reject.txt",
        },
        icloud: {
          type: "http",
          behavior: "domain",
          url:
            "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/icloud.txt",
        },
        apple: {
          type: "http",
          behavior: "domain",
          url:
            "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/apple.txt",
        },
        google: {
          type: "http",
          behavior: "domain",
          url:
            "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/google.txt",
        },
        proxy: {
          type: "http",
          behavior: "domain",
          url:
            "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/proxy.txt",
        },
        direct: {
          type: "http",
          behavior: "domain",
          url:
            "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/direct.txt",
        },
        private: {
          type: "http",
          behavior: "domain",
          url:
            "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/private.txt",
        },
        // 'netflix': {
        //     'type': 'http',
        //     'behavior': 'domain',
        //     'url': 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/netflix.txt'
        // },
        telegram: {
          type: "http",
          behavior: "domain",
          url:
            "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/telegram.txt",
        },
        gfw: {
          type: "http",
          behavior: "domain",
          url:
            "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/gfw.txt",
        },
        GreatFirewall: {
          type: "http",
          behavior: "domain",
          url:
            "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/gfw.txt",
        },
        applications: {
          type: "http",
          behavior: "classical",
          url:
            "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/applications.txt",
        },
      },
    };

    // 输出 YAML 文件
    const yamlStr = yaml.stringify(clashConfig, {
      indent: 2,
      lineWidth: 0,
      minContentWidth: 0,
      nullTo: "null",
    });

    fs.writeFileSync(outputFile, yamlStr, "utf8");

    console.log(`✅ Clash 配置文件已生成: ${outputFile}`);
    console.log(`📊 配置包含 ${proxies.length} 个代理节点`);
    console.log(
      `📁 文件大小: ${
        (fs.statSync(outputFile).size / 1024 / 1024).toFixed(
          2,
        )
      } MB`,
    );

    // 如果有错误，显示错误信息
    if (errors.length > 0) {
      console.log(`\n⚠️  跳过了 ${errors.length} 个无效链接:`);
      errors.slice(0, 10).forEach((error) => {
        console.log(`  第${error.line}行: ${error.error}`);
      });
      if (errors.length > 10) {
        console.log(`  ... 还有 ${errors.length - 10} 个错误`);
      }
    }
  } catch (error) {
    console.error("❌ 转换过程中发生错误:", error.message);
    process.exit(1);
  }
}

// 运行转换
console.log("🚀 VMess 到 Clash 配置转换器");
console.log("=" * 40);
convertVmessToClash();
