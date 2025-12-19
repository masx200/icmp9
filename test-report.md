# resolveDNS.js 测试报告

## 测试时间

2025-12-19

## 测试概述

对 `resolveDNS.js` 模块进行了全面的功能测试，验证了其 DNS 解析能力和强制 DNS
映射功能。

## 测试结果

### ✅ 1. 基础 DNS 解析

- **状态**: 通过
- **测试内容**: 解析 google.com 的 A 记录
- **结果**: 成功返回 IP 地址 `142.250.129.138`
- **说明**: DNS 解析基础功能正常工作

### ✅ 2. IPv6 解析

- **状态**: 通过
- **测试内容**: 解析 google.com 的 AAAA 记录
- **结果**: 成功返回多个 IPv6 地址
  - `2a00:1450:4009:c13::66`
  - `2a00:1450:4009:c13::64`
  - `2a00:1450:4009:c13::71`
  - `2a00:1450:4009:c13::65`
- **说明**: IPv6 记录解析功能正常

### ✅ 3. 其他 DNS 记录类型

- **状态**: 通过
- **测试内容**:
  - MX 记录 (gmail.com)
  - TXT 记录 (google.com)
- **结果**:
  - MX 记录: 成功获取多个邮件服务器记录
  - TXT 记录: 成功获取 SPF、验证等多种 TXT 记录
- **说明**: 支持多种 DNS 记录类型

### ✅ 4. 强制 DNS 解析

- **状态**: 通过
- **测试内容**: 验证 `fresh-reverse-proxy-middle.masx201.dpdns.org` 强制解析到
  `104.21.9.230`
- **结果**: 每次请求都正确通过强制解析的 IP
- **关键日志**:
  ```
  [DNS] 正在解析: fresh-reverse-proxy-middle.masx201.dpdns.org
  [DNS] 强制DNS解析: fresh-reverse-proxy-middle.masx201.dpdns.org -> 104.21.9.230
  ```
- **说明**: 强制 DNS 映射功能完全正常

### ✅ 5. 错误处理

- **状态**: 部分通过
- **测试内容**:
  - 无效域名处理
  - 无效参数处理
- **结果**:
  - ✅ 无效参数处理正确
  - ⚠️ 无效域名返回了 DNS 状态码 3（NXDOMAIN），这是正确的行为
- **说明**: 基本的错误处理机制工作正常

### ✅ 6. 性能测试

- **状态**: 通过
- **测试内容**: 并发解析 4 个域名
- **结果**:
  - 总耗时: 801ms
  - 平均每个: 200.25ms
- **说明**: 性能表现良好，支持并发请求

## 关键功能验证

### DNS 强制映射配置

```javascript
const FORCED_DNS_MAPPING = {
  "fresh-reverse-proxy-middle.masx201.dpdns.org": "104.21.9.230",
};
```

### Callback 风格实现

```javascript
lookup: ((hostname, options, callback) => {
  if (FORCED_DNS_MAPPING[hostname]) {
    const forcedIP = FORCED_DNS_MAPPING[hostname];
    // 正确的 callback 调用
    callback(null, forcedIP, 4);
  } else {
    // 使用系统 DNS
    lookup(hostname, options, callback);
  }
});
```

## 总结

### 优点

1. ✅ **DNS 解析功能完整**: 支持 A、AAAA、MX、TXT 等多种记录类型
2. ✅ **强制 DNS 映射工作正常**: 成功将指定域名解析到目标 IP
3. ✅ **性能表现良好**: 平均响应时间约 200ms
4. ✅ **支持并发请求**: 可以同时处理多个 DNS 查询
5. ✅ **错误处理机制**: 基本的错误处理已经实现

### 改进建议

1. 可以添加更多的错误类型处理（网络超时、证书错误等）
2. 可以考虑添加 DNS 缓存机制以提高性能
3. 可以扩展支持更多 DNS 记录类型（CAA、NS 等）

### 结论

`resolveDNS.js` 模块功能完整，DNS 强制解析特性工作正常，可以投入使用。通过
undici Agent 的 `connect.lookup` 成功实现了 DNS
劫持功能，将指定域名强制解析到目标 IP 地址。
