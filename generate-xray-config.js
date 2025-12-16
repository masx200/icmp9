const fs = require('fs');
const path = require('path');

import {优选域名} from "./优选域名.js";
// 读取优选域名数据


// 代理配置模板
const proxyTemplate = {
  "protocol": "vmess",
  "settings": {
    "vnext": [
      {
        "address": "",  // 将被替换为域名
        "port": 443,
        "users": [
          {
            "id": "e583ef48-19fe-4bce-b786-af30f43be840",
            "alterId": 0,
            "email": "t@t.tt",
            "security": "auto"
          }
        ]
      }
    ]
  },
  "streamSettings": {
    "network": "ws",
    "security": "tls",
    "tlsSettings": {
      "echConfigList": "gitlab.io+https://223.5.5.5/dns-query",
      "echForceQuery": "full",
      "allowInsecure": false,
      "serverName": "tunnel.icmp9.com",
      "alpn": [
        "h3",
        "h2",
        "http/1.1"
      ]
    },
    "wsSettings": {
      "path": "/cr",
      "host": "tunnel.icmp9.com",
      "headers": {}
    }
  },
  "mux": {
    "enabled": false,
    "concurrency": -1
  }
};

// 生成代理配置的函数
function generateProxyConfig(address, index) {
  const config = JSON.parse(JSON.stringify(proxyTemplate));
  config.tag = `proxy-${index + 1}`;
  config.settings.vnext[0].address = address;
  return config;
}

// 主函数
function generateConfig() {
  try {
    // 读取模板文件
    const templatePath = path.join(__dirname, 'xray-config-template.json');
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const config = JSON.parse(templateContent);

    // 生成新的outbounds数组
    const newOutbounds = [];

    // 为每个优选域名生成代理配置
    优选域名.forEach((domain, index) => {
      const proxyConfig = generateProxyConfig(domain, index);
      newOutbounds.push(proxyConfig);
    });

    // 添加direct和block配置
    newOutbounds.push({
      "tag": "direct",
      "protocol": "freedom"
    });

    newOutbounds.push({
      "tag": "block",
      "protocol": "blackhole"
    });

    // 替换outbounds
    config.outbounds = newOutbounds;

    // 输出新配置文件
    const outputPath = path.join(__dirname, 'xray-output-random.json');
    fs.writeFileSync(outputPath, JSON.stringify(config, null, 2));

    console.log(`配置文件已生成: ${outputPath}`);
    console.log(`共生成了 ${优选域名.length} 个代理配置`);
    console.log(`输出文件包含 ${newOutbounds.length} 个出站配置`);

  } catch (error) {
    console.error('生成配置文件时出错:', error);
  }
}

// 运行生成器
generateConfig();