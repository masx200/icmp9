# ICMP9 链接生成器和 Xray 配置生成器文档

## 概述

本项目包含两个主要脚本，用于生成 vmess 链接和 Xray 客户端配置文件：

1. **链接生成器.js** - 生成 vmess 分享链接
2. **generate-xray-config.mjs** - 生成 Xray 客户端配置文件

## 链接生成器.js

### 功能

链接生成器用于创建 vmess 协议的分享链接，支持 IPv6 和 IPv4 两种模式。

### 主要特性

- 根据 `online.json` 中的国家代码生成链接
- 支持从 `优选域名.js` 导入域名列表
- 自动生成 vmess 配置并编码为分享链接
- 支持去重处理，避免重复链接
- 分别生成 IPv6 和 IPv4 链接文件

### 使用方法

```bash
node 链接生成器.js
```

### 输出文件

- `分享链接.txt` - 包含所有 IPv6 vmess 链接
- `分享链接-ipv4.txt` - 包含所有 IPv4 vmess 链接

### 配置参数

生成的 vmess 配置包含以下参数：

- **协议版本**: v2
- **端口**: 443
- **UUID**: `e583ef48-19fe-4bce-b786-af30f43be840`
- **Alter ID**: 0
- **安全**: auto
- **传输**: WebSocket (ws)
- **TLS**: 启用
- **ALPN**: h3,h2,http/1.1
- **SNI**: tunnel.icmp9.com
- **Host**: tunnel.icmp9.com

## generate-xray-config.mjs

### 功能

Xray 配置生成器基于 vmess 链接生成器的逻辑，创建完整的 Xray 客户端配置文件。

### 主要特性

- 使用与链接生成器相同的域名和国家代码逻辑
- 生成结构化的 Xray 配置文件
- 支持 ECH (Encrypted Client Hello) 配置
- 自动添加 direct 和 block 出站规则
- 生成唯一的代理标签使用 SHA256 哈希
- 验证生成的配置数量与分享链接数量一致性

### 使用方法

```bash
node generate-xray-config.mjs
```

### 输出文件

- `xray-output-random.json` - IPv6 配置文件
- `xray-output-random-ipv4.json` - IPv4 配置文件

### 配置结构

生成的配置文件包含：

#### 代理出站配置

- **协议**: vmess
- **地址**: 动态填充域名
- **端口**: 443
- **用户配置**:
  - UUID: `e583ef48-19fe-4bce-b786-af30f43be840`
  - Alter ID: 0
  - 安全: auto

#### 流传输设置

- **网络**: WebSocket
- **安全**: TLS
- **ECH 配置**:
  - ECH 配置列表: gitlab.io+https://223.5.5.5/dns-query
  - 强制查询: full
  - 不允许不安全连接
  - 服务器名称: tunnel.icmp9.com
  - ALPN: h3, h2, http/1.1

#### WebSocket 设置

- **路径**: 动态路径 `/{国家代码}`
- **主机**: tunnel.icmp9.com

#### 额外出站规则

1. **direct**: 直接连接
2. **block**: 阻断连接

## 依赖文件

### online.json

包含国家代码信息的 JSON 文件，格式：

```json
{
  "countries": [
    {
      "name": "国家名称",
      "code": "国家代码"
    }
  ]
}
```

### 优选域名.js

提供优选域名列表的模块，导出：

- `优选域名` - IPv6 域名列表
- `优选域名ipv4` - IPv4 域名列表

### xray-config-template.json

Xray 配置的基础模板文件。

## 注意事项

1. **UUID 硬编码**: 两个脚本都使用固定的 UUID，实际使用时应考虑配置化
2. **安全性**: 脚本生成的配置用于测试目的，生产环境需要额外的安全考虑
3. **文件路径**: 所有文件读取操作都相对于脚本所在目录
4. **ECH 支持**: Xray 配置支持 ECH，需要服务端相应支持

## 错误处理

脚本包含基本的错误处理机制：

- 文件读取失败的 try-catch 包装
- 配置数量一致性验证
- 详细的日志输出

## 扩展性

代码设计考虑了扩展性：

- 支持动态添加新的域名和国家代码
- 模块化的配置生成逻辑
- 清晰的函数分离便于维护
