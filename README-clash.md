# Clash 配置使用说明

## 文件说明

- `clash-output-consistenthashing.yaml`: 完整的 Clash
  配置文件（包含代理组和规则）
- `clash-proxies-only.yaml`: 仅包含代理节点的配置文件

## 使用方法

### 方法1: 使用完整配置文件

直接将 `clash-output-consistenthashing.yaml` 导入到 Clash
客户端中，已包含完整的代理组和规则设置。

### 方法2: 使用仅代理文件

1. 将 `clash-proxies-only.yaml` 中的 proxies 部分复制到现有的 Clash 配置中
2. 或者在 Clash 配置中包含此文件：

```yaml
# 在你的主配置文件中
include:
  - "./clash-proxies-only.yaml"
```

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

- 总代理数量: 6600 个
- 包含 IPv4 和 IPv6 地址
- 服务器端口: 443
