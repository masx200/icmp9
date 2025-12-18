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

  return proxy;
}

/**
 * 主转换函数 - 仅生成代理配置
 */
async function convertVmessToProxiesOnly() {
  try {
    const inputFile = "分享链接.txt";
    const outputFile = "clash-proxies-only.yaml";

    // 检查输入文件是否存在
    if (!fs.existsSync(inputFile)) {
      console.error(`❌ 错误: 找不到输入文件 ${inputFile}`);
      process.exit(1);
    }

    console.log("📖 读取 VMess 链接文件...");
    const content = fs.readFileSync(inputFile, "utf8");
    const lines = content.split("\n").filter((line) =>
      line.trim().startsWith("vmess://")
    );

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

    // 创建仅包含代理的简单配置
    const simpleConfig = {
      proxies: proxies,
    };

    // 输出 YAML 文件
    const yamlStr = yaml.stringify(simpleConfig, {
      indent: 2,
      lineWidth: 0,
      minContentWidth: 0,
    });

    fs.writeFileSync(outputFile, yamlStr, "utf8");

    console.log(`✅ Clash 代理配置文件已生成: ${outputFile}`);
    console.log(`📊 配置包含 ${proxies.length} 个代理节点`);
    console.log(
      `📁 文件大小: ${(fs.statSync(outputFile).size / 1024).toFixed(2)} KB`,
    );

    // 如果有错误，显示错误信息
    if (errors.length > 0) {
      console.log(`\n⚠️  跳过了 ${errors.length} 个无效链接:`);
      errors.slice(0, 5).forEach((error) => {
        console.log(`  第${error.line}行: ${error.error}`);
      });
      if (errors.length > 5) {
        console.log(`  ... 还有 ${errors.length - 5} 个错误`);
      }
    }

    // 同时生成使用说明
    const usage = `
# Clash 配置使用说明

## 文件说明
- \`clash-output-consistenthashing.yaml\`: 完整的 Clash 配置文件（包含代理组和规则）
- \`clash-proxies-only.yaml\`: 仅包含代理节点的配置文件

## 使用方法

### 方法1: 使用完整配置文件
直接将 \`clash-output-consistenthashing.yaml\` 导入到 Clash 客户端中，已包含完整的代理组和规则设置。

### 方法2: 使用仅代理文件
1. 将 \`clash-proxies-only.yaml\` 中的 proxies 部分复制到现有的 Clash 配置中
2. 或者在 Clash 配置中包含此文件：
\`\`\`yaml
# 在你的主配置文件中
include:
  - './clash-proxies-only.yaml'
\`\`\`

## 代理配置格式
所有代理都使用以下标准配置：
- UUID: e583ef48-19fe-4bce-b786-af30f43be840
- 加密方式: auto
- 传输协议: WebSocket (ws)
- TLS: 启用
- UDP: 启用
- 路径: /af
- SNI: tunnel.icmp9.com

## 配置统计
- 总代理数量: ${proxies.length} 个
- 包含 IPv4 和 IPv6 地址
- 服务器端口: 443
`;

    fs.writeFileSync("README-clash.md", usage.trim(), "utf8");
    console.log(`📖 使用说明已生成: README-clash.md`);
  } catch (error) {
    console.error("❌ 转换过程中发生错误:", error.message);
    throw error;
    process.exit(1);
  }
}

// 运行转换
console.log("🚀 VMess 到 Clash 代理转换器 (简化版)");
console.log("=" * 40);
convertVmessToProxiesOnly();
