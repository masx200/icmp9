# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

ICMP9 是一个网络代理配置生成工具，专为 ICMP9.COM 代理服务设计。该项目生成 VMess 链接和 Xray 配置文件，支持 IPv6 和 IPv4 两种网络模式。

## 核心架构

### 双模式生成架构
- **IPv6 模式**: 使用 `优选域名` 数组生成配置
- **IPv4 模式**: 使用 `优选域名ipv4` 数组生成配置
- 两种模式使用相同的生成逻辑，只是域名列表不同

### 数据驱动设计
- `online.json`: 包含 50+ 国家的代码和名称信息
- `优选域名.js`: 导出 IPv6 和 IPv4 两套优选域名列表
- `xray-config-template.json`: Xray 配置的基础模板
- `config.txt`: 基础连接参数（host、port、tls 等）

### 生成器模式
- `链接生成器.js`: 主入口文件，生成 vmess:// 分享链接
- `generate-xray-config.mjs`: 生成完整的 Xray 客户端配置文件
- `sha256.js`: 用于生成配置的唯一标识符

## 常用命令

### 开发命令
```bash
# 生成 VMess 链接（IPv6 和 IPv4）
npm run generate
# 或
npm run start

# 生成 Xray 配置文件
npm run build
# 或
npm run convert
```

### 格式化
```bash
# 使用 Deno 格式化所有代码
npm run format
```

### 测试命令
```bash
# 测试 Xray 配置文件有效性
npm run test:xray

# 详细测试模式（显示详细输出）
npm run test:xray:verbose

# 完整测试流程（构建 + 生成 + 测试）
npm run test:all

# 完整详细测试流程
npm run test:all:verbose
```

## 输出文件

### VMess 链接文件
- `分享链接.txt`: IPv6 模式的 vmess:// 链接
- `分享链接-ipv4.txt`: IPv4 模式的 vmess:// 链接

### Xray 配置文件
- `xray-output-random.json`: IPv6 模式的 Xray 配置
- `xray-output-random-ipv4.json`: IPv4 模式的 Xray 配置

## 关键常量

- **UUID**: `e583ef48-19fe-4bce-b786-af30f43be840` - 所有代理配置的统一 ID
- **Host**: `tunnel.icmp9.com` - 代理服务器地址
- **Port**: `443` - 标准 HTTPS 端口
- **Path Pattern**: `/{country_code}` - WebSocket 路径模式

## 配置验证机制

### 自动化测试
- GitHub Actions 工作流会自动验证生成的配置文件
- 下载 Xray 核心并进行配置验证
- 确保 VMess 链接数量与 Xray 配置中的代理数量一致

### 去重机制
- 使用 `Set` 对象确保生成的链接唯一性
- 使用 SHA256 哈希验证配置文件的一致性

## 开发注意事项

1. **ES Module 项目**: 所有文件使用 ES6 模块语法 (`import/export`)
2. **代码格式化**: 使用 Deno 进行代码格式化，提交前请运行 `npm run format`
3. **双模式一致性**: 修改生成逻辑时需确保 IPv6 和 IPv4 两种模式都能正常工作
4. **配置验证**: 每次修改后应运行 `npm run test:all` 确保配置文件有效

## 项目结构

```
icmp9/
├── 主要脚本
│   ├── 链接生成器.js          # VMess 链接生成器（主入口）
│   ├── generate-xray-config.mjs # Xray 配置生成器
│   ├── 优选域名.js            # 域名列表模块
│   └── sha256.js              # SHA256 哈希工具
├── 配置文件
│   ├── online.json           # 国家信息数据
│   ├── xray-config-template.json # Xray 配置模板
│   └── config.txt           # 基础连接参数
├── 测试
│   └── scripts/test-xray-configs.js # 配置验证脚本
└── 输出文件（自动生成）
    ├── 分享链接*.txt         # VMess 分享链接
    └── xray-output-*.json    # Xray 配置文件
```

## CI/CD 流程

项目使用 GitHub Actions 进行自动化测试：
1. 生成配置文件
2. 代码格式化检查
3. 下载并测试 Xray 核心
4. 验证配置文件有效性
5. 检查链接与配置数量一致性