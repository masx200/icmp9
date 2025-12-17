# ICMP9.COM 代理服务客户端工具包

![Version](https://img.shields.io/badge/version-2.7-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-Alpine%20%7C%20Debian%20%7C%20Ubuntu-lightgrey.svg)

一个功能完整的 ICMP9.COM 代理服务客户端工具包，提供自动化安装、配置管理和 API
接口等功能。

## 🌟 主要特性

### 🆓 永久免费服务

- **永久免费**：无需付费即可享受服务
- **200GB 流量**：每个用户每月可获得高达 200GB 的代理节点流量配额
- **国内 IPv6 直连**：支持添加中国 IPv6 地址到白名单，实现国内直连使用

### 🌍 全球节点覆盖

- **100+ 地区覆盖**：节点遍布全球，当前有 50 个地区在线可用
- **流媒体解锁**：支持 Netflix、Disney+、HBO 等流媒体服务
- **AI 服务支持**：轻松访问 ChatGPT、Claude 等 AI 服务

### 🛠️ 技术特性

- **VMess 协议**：基于 VMess 协议的安全代理
- **Cloudflare 转发**：通过 Cloudflare 提供稳定连接
- **双模式支持**：TUN 网卡模式和全局代理模式
- **多系统支持**：支持 Alpine Linux、Debian、Ubuntu 等主流发行版

## 📁 项目结构

```
icmp9/
├── 脚本文件
│   ├── icmp9.sh                   # 主要安装脚本
│   ├── 链接生成器.js                # 订阅链接生成器
│   ├── whitelist-auto-manager.js   # 白名单自动管理工具
│   └── generate-xray-config.mjs    # Xray 配置生成器
├── API 相关
│   ├── icmp9-api.js               # API 客户端
│   ├── icmp9-api-example.js       # API 使用示例
│   └── ICMP9-API-README.md        # API 文档
├── 配置文件
│   ├── xray-config-template.json   # Xray 配置模板
│   ├── config.txt                  # 配置文件
│   └── online.json                 # 在线节点信息
├── 工具脚本
│   ├── diagnose-cookie.js          # Cookie 诊断工具
│   ├── test-cookie.js             # Cookie 测试工具
│   ├── ipv6-info.js               # IPv6 信息查询
│   └── sha256.js                  # SHA256 计算工具
└── 文档
    ├── 使用说明.md                 # 详细使用说明
    ├── 脚本详细说明.md             # 脚本技术文档
    ├── README-whitelist-manager.md # 白名单管理器文档
    └── 网络切换工具.md             # 网络切换指南
```

## 🚀 快速开始

### 方法一：一键安装（推荐）

在您的海外 VPS 上执行以下命令：

```bash
bash <(curl -L -s api.icmp9.com/icmp9.sh)
```

安装完成后，使用 `icmp9` 命令进行管理：

```bash
icmp9
```

### 方法二：使用本工具包

1. 克隆本仓库：

```bash
git clone https://gitlab.com/masx200/icmp9.git
cd icmp9
```

2. 安装依赖：

```bash
npm install
```

3. 生成订阅链接：

```bash
npm run generate
```

4. 生成 Xray 配置：

```bash
npm run build
```

## 📋 系统要求

### 硬件要求

- 内存：至少 128MB
- 磁盘：至少 50MB 可用空间
- 网络：稳定的互联网连接

### 软件要求

- **操作系统**：Alpine Linux 3.15+、Debian 10+、Ubuntu 20.04+、CentOS 7+
- **权限**：Root 权限或 sudo 权限
- **网络**：公网 IPv4 地址（用于添加到白名单）

## ⚙️ 配置说明

### 白名单配置

1. 访问 [用户仪表盘](https://icmp9.com/user/dashboard)
2. 进入 **放行管理** → **IPv4 白名单**
3. 添加您的 VPS 公网 IPv4 地址
4. 如需 IPv6 直连，在对应页面添加 IPv6 地址

> ⚠️ **注意**：白名单不支持添加国内 IPv4 地址和 Cloudflare WARP IP

### API Key 获取

1. 登录 [icmp9.com](https://icmp9.com)
2. 在用户中心首页复制 API Key
3. 在配置文件或脚本中使用该 API Key

## 🛠️ NPM 脚本命令

| 命令                             | 说明                 |
| -------------------------------- | -------------------- |
| `npm run start`                  | 启动链接生成器       |
| `npm run generate`               | 生成订阅链接         |
| `npm run build`                  | 生成 Xray 配置       |
| `npm run convert`                | 转换配置格式         |
| `npm run whitelist-auto-manager` | 运行白名单自动管理器 |
| `npm run test:xray`              | 测试 Xray 配置       |
| `npm run test:xray:verbose`      | 详细测试 Xray 配置   |
| `npm run test:all`               | 运行完整测试流程     |

## 📚 API 使用

### 安装和初始化

```javascript
import { Icmp9API } from "./icmp9-api.js";

const api = new Icmp9API();

// 设置 Cookie（如果需要）
api.setCookie("your_cookie_here");
```

### 获取用户信息

```javascript
const userInfo = await api.getUserInfo();
console.log(`用户名: ${userInfo.username}`);
console.log(`API 密钥: ${userInfo.api_key}`);
console.log(`流量配额: ${userInfo.traffic_quota} bytes`);
```

### 白名单管理

```javascript
// 获取白名单配额
const quota = await api.getWhitelistQuota();

// 获取白名单 IP 列表
const ipList = await api.getWhitelistIPs();

// 添加新 IP
await api.addWhitelistIP("192.168.1.1", "我的服务器");

// 删除 IP
await api.deleteWhitelistIP("ip_id_here");
```

## 🔧 代理模式详解

### TUN 网卡模式

- **工作方式**：创建虚拟 TUN 网卡，修改路由表实现代理
- **适用场景**：纯 IPv6 环境，兼容性要求高
- **优点**：兼容性强，支持所有类型的 TCP/UDP 流量
- **缺点**：性能略有损耗

### 全局代理模式

- **工作方式**：使用 iptables NAT 规则劫持 TCP 连接
- **适用场景**：IPv4 环境，性能要求高
- **优点**：性能高，内核层面处理
- **缺点**：可能与防火墙规则冲突

## 🐛 故障排除

### 常见问题

**1. 安装失败**

- 检查系统版本是否支持
- 确认拥有 root 权限
- 检查网络连接和 API 访问
- 确认 IP 已添加到白名单

**2. 服务无法启动**

```bash
# 检查服务状态（Debian/Ubuntu）
journalctl -u icmp9-xray -n 20

# 检查服务状态（Alpine）
cat /var/log/icmp9-xray.log
```

**3. 连接测试失败**

- 确认节点在线状态
- 检查防火墙设置
- 尝试重启服务

### 日志位置

- **Debian/Ubuntu**：`journalctl -u icmp9-*`
- **Alpine Linux**：`/var/log/icmp9-*.log`
- **配置文件**：`/etc/icmp9/`

## 🔒 安全注意事项

- **仅供个人学习**：禁止商业用途
- **合法使用**：禁止用于违法活动
- **流量管理**：合理使用 200GB 免费配额
- **账号安全**：妥善保管 API Key

## 📖 相关文档

- [详细使用说明](./使用说明.md) - 完整的使用教程
- [脚本详细说明](./脚本详细说明.md) - icmp9.sh 技术文档
- [API 文档](./ICMP9-API-README.md) - API 接口说明
- [白名单管理器文档](./README-whitelist-manager.md) - 白名单自动化工具
- [网络切换指南](./网络切换工具.md) - 网络模式切换说明

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目。

## 📄 许可证

本项目采用 [ISC License](./LICENSE) 许可证。

## 🔗 相关链接

- **官方网站**：[https://icmp9.com](https://icmp9.com)
- **用户仪表盘**：[https://icmp9.com/user/dashboard](https://icmp9.com/user/dashboard)
- **GitLab
  仓库**：[https://gitlab.com/masx200/icmp9](https://gitlab.com/masx200/icmp9)
- **问题反馈**：[https://gitlab.com/masx200/icmp9/issues](https://gitlab.com/masx200/icmp9/issues)

---

> **开发者信息**\
> 版本：2.7\
> 许可：MIT License\
> 更新日期：2025-12-17
