import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { 优选域名 } from "./优选域名.js";
import sha256 from "./sha256.js";
const uuid = "e583ef48-19fe-4bce-b786-af30f43be840";
// 获取当前文件的目录路径（ES模块中需要这样获取）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 读取online.json获取国家代码
const onlineData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "online.json"), "utf8"),
);
const countries = onlineData.countries;

// 代理配置模板
const proxyTemplate = {
  tag: "proxy-1",
  protocol: "vmess",
  settings: {
    vnext: [
      {
        address: "", // 将被替换为域名
        port: 443,
        users: [
          {
            id: uuid,
            alterId: 0,
            email: "t@t.tt",
            security: "auto",
          },
        ],
      },
    ],
  },
  streamSettings: {
    network: "ws",
    security: "tls",
    tlsSettings: {
      echConfigList: "gitlab.io+https://223.5.5.5/dns-query",
      echForceQuery: "full",
      allowInsecure: false,
      serverName: "tunnel.icmp9.com",
      alpn: ["h3", "h2", "http/1.1"],
    },
    wsSettings: {
      path: "/cr", // 将被替换为国家代码
      host: "tunnel.icmp9.com",
      headers: { host: "tunnel.icmp9.com" },
    },
  },
  mux: {
    enabled: false,
    concurrency: -1,
  },
};

// 生成代理配置的函数 - 按照链接生成器的逻辑
function generateProxyConfig(host, code /* ,index */) {
  const config = JSON.parse(JSON.stringify(proxyTemplate));
  config.tag = `proxy-` /*+*/ /* index.toString()  */ +
    sha256(`${code}-${host}`).slice(0, 35);
  config.settings.vnext[0].address = host;
  config.streamSettings.wsSettings.path = `/${code}`;
  return config;
}

// 主函数
async function generateConfig() {
  // let index=1
  // let count = 0;
  try {
    console.log(`成功读取 ${优选域名.length} 个优选域名`);
    console.log(`读取到 ${countries.length} 个国家代码`);

    // 读取模板文件
    const templatePath = path.join(__dirname, "xray-config-template.json");
    const templateContent = fs.readFileSync(templatePath, "utf8");
    const config = JSON.parse(templateContent);

    // 生成新的outbounds数组 - 按照链接生成器的逻辑
    const urlarray = [];
    const newOutbounds = [];
    // loop:
    for (const item of countries) {
      const code = item.code;
      for (const host of 优选域名) {
        const configKey = `proxy-${code}-${host}`;

        // 去重逻辑：使用Set来避免重复
        if (!urlarray.includes(configKey)) {
          urlarray.push(configKey);
          const proxyConfig = generateProxyConfig(host, code /* ,index */);
          newOutbounds.push(proxyConfig);
          // index++;
        }
        // count++;
        // if (count > 3000) {
        //   break loop;
        // }
      }
    }

    // 添加direct和block配置
    newOutbounds.push({
      tag: "direct",
      protocol: "freedom",
    });

    newOutbounds.push({
      tag: "block",
      protocol: "blackhole",
    });

    // 替换outbounds
    config.outbounds = newOutbounds;

    // 输出新配置文件
    const outputPath = path.join(__dirname, "xray-output-random.json");
    await fs.promises.writeFile(outputPath, JSON.stringify(config, null, 2));

    console.log(`配置文件已生成: ${outputPath}`);
    console.log(`国家数量: ${countries.length}`);
    console.log(`优选域名数量: ${优选域名.length}`);
    console.log(`去重后生成的代理配置数量: ${newOutbounds.length - 2}`); // 减去direct和block
    console.log(`输出文件包含 ${newOutbounds.length} 个出站配置`);

    // 验证数量是否与分享链接.txt一致
    try {
      const linkContent = await fs.promises.readFile(
        path.join(__dirname, "分享链接.txt"),
        "utf8",
      );
      const linkCount = linkContent.trim().split("\n").length;
      console.log(`分享链接.txt中的链接数量: ${linkCount}`);
      console.log(
        `数量是否一致: ${
          newOutbounds.length - 2 === linkCount ? "✓ 是" : "✗ 否"
        }`,
      );
    } catch (err) {
      console.log("无法读取分享链接.txt进行验证");
    }
  } catch (error) {
    console.error("生成配置文件时出错:", error);
  }
}

// 运行生成器
generateConfig();
