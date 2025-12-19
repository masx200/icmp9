# DNS Resolver 模块文档

## 概述

`dnsResolver.mjs` 是一个基于 Google DNS-over-HTTPS (DoH) API 的域名解析模块，支持多种 DNS 记录类型的查询。该模块使用 `undici` 库进行 HTTP 请求，提供现代化的异步 DNS 解析功能。

## 功能特性

- 🌐 **DNS-over-HTTPS 支持**: 使用 Google DNS DoH API 进行安全查询
- 🔧 **多记录类型**: 支持 A、AAAA、MX、TXT 等多种 DNS 记录类型
- 🛡️ **错误处理**: 完善的参数验证和错误处理机制
- 📦 **ES6 模块**: 支持现代 ES6 模块导入/导出
- 🚀 **高性能**: 使用 `undici` 库提供优化的 HTTP 请求性能

## 安装依赖

```bash
npm install undici
# 或
pnpm add undici
```

## API 文档

### `resolveDNS(domain, type, resolverUrl)`

解析指定域名的 DNS 记录。

#### 参数

- **`domain`** (string, 必需): 要解析的域名，例如 `'example.com'`
- **`type`** (string, 可选): DNS 记录类型，默认为 `'AAAA'`
  - 支持的类型: `'A'`, `'AAAA'`, `'MX'`, `'TXT'`, `'CNAME'`, `'NS'` 等
- **`resolverUrl`** (string, 可选): 自定义 DNS 解析器 URL，默认使用 Google DNS DoH API

#### 返回值

返回一个 `Promise<object>`，解析为包含 DNS 查询结果的 JSON 对象。

#### 异常

- **参数错误**: 当域名或记录类型参数无效时抛出错误
- **网络错误**: 当网络请求失败时抛出错误
- **API 错误**: 当 DNS API 返回非 2xx 状态码时抛出错误

## 使用示例

### 基本用法

```javascript
import { resolveDNS } from './dnsResolver.mjs';

// 解析域名的 AAAA 记录 (IPv6)
try {
  const result = await resolveDNS('example.com', 'AAAA');
  console.log('解析结果:', result);
} catch (error) {
  console.error('解析失败:', error.message);
}
```

### 解析不同类型的记录

```javascript
import { resolveDNS } from './dnsResolver.mjs';

// 解析 A 记录 (IPv4)
const aRecord = await resolveDNS('google.com', 'A');

// 解析 MX 记录 (邮件交换)
const mxRecord = await resolveDNS('gmail.com', 'MX');

// 解析 TXT 记录
const txtRecord = await resolveDNS('_dmarc.example.com', 'TXT');
```

### 处理解析结果

```javascript
import { resolveDNS } from './dnsResolver.mjs';

async function analyzeDomain(domain) {
  try {
    const result = await resolveDNS(domain, 'A');
    
    if (result.Answer && result.Answer.length > 0) {
      console.log(`📋 ${domain} 的解析结果:`);
      result.Answer.forEach((answer, index) => {
        console.log(`  ${index + 1}. IP: ${answer.data}, TTL: ${answer.TTL}秒`);
      });
    } else {
      console.log(`⚠️ 未找到 ${domain} 的 A 记录`);
    }
  } catch (error) {
    console.error(`❌ 解析 ${domain} 失败:`, error.message);
  }
}

analyzeDomain('github.com');
```

### 使用自定义解析器

```javascript
import { resolveDNS } from './dnsResolver.mjs';

const customResolver = 'https://cloudflare-dns.com/dns-query';

try {
  const result = await resolveDNS('example.com', 'A', customResolver);
  console.log('使用 Cloudflare DNS 解析结果:', result);
} catch (error) {
  console.error('解析失败:', error.message);
}
```

## 响应格式

DNS 查询返回的 JSON 对象通常包含以下字段：

```json
{
  "Status": 0,
  "TC": false,
  "RD": true,
  "RA": true,
  "AD": false,
  "CD": false,
  "Question": [
    {
      "name": "example.com.",
      "type": 1
    }
  ],
  "Answer": [
    {
      "name": "example.com.",
      "type": 1,
      "TTL": 300,
      "data": "93.184.216.34"
    }
  ],
  "Comment": "Response from 8.8.8.8."
}
```

### 字段说明

- **Status**: DNS 响应状态码 (0 表示成功)
- **TC**: 截断标志
- **RD**: 期望递归标志
- **RA**: 递归可用标志
- **AD**: 认证数据标志
- **CD**: 检查禁用标志
- **Question**: 查询问题数组
- **Answer**: 响应答案数组
- **Comment**: 响应注释信息

## 命令行使用

可以直接运行该文件进行测试：

```bash
node dnsResolver.mjs
```

这将执行文件中的示例代码，解析预设的域名并显示结果。

## 错误处理

### 常见错误类型

1. **参数验证错误**
   ```
   无效的域名参数
   无效的DNS记录类型参数
   ```

2. **网络请求错误**
   ```
   DNS API 请求失败: 404 Not Found
   DNS 解析过程中发生错误: fetch failed
   ```

3. **未知错误**
   ```
   DNS 解析时发生未知错误
   ```

### 错误处理最佳实践

```javascript
import { resolveDNS } from './dnsResolver.mjs';

async function robustDNSQuery(domain, type = 'A') {
  try {
    const result = await resolveDNS(domain, type);
    
    if (result.Status !== 0) {
      throw new Error(`DNS 查询返回错误状态: ${result.Status}`);
    }
    
    if (!result.Answer || result.Answer.length === 0) {
      throw new Error('未找到匹配的 DNS 记录');
    }
    
    return result;
  } catch (error) {
    console.error(`DNS 查询失败 (${domain}, ${type}):`, error.message);
    throw error; // 重新抛出以便上层处理
  }
}
```

## 性能考虑

- 使用 `undici` 库提供更好的性能和内存效率
- 支持 HTTP/2 和 HTTP/3
- 内置连接池和请求复用
- 建议在高频调用时实现适当的缓存机制

## 安全注意事项

- 默认使用代理地址来增强网络访问能力
- 建议在生产环境中使用 HTTPS 来确保查询安全性
- 考虑实现请求频率限制以避免被 DNS 服务提供商限制

## 许可证

该模块遵循项目的整体许可证。