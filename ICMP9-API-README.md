# ICMP9.COM API 客户端

这是一个用于访问 ICMP9.COM API 的 JavaScript
客户端，支持获取用户信息、白名单配额和IP地址列表。

## 功能特性

- ✅ 获取用户基本信息（用户名、API密钥、流量等）
- ✅ 获取白名单配额信息
- ✅ 获取白名单IP地址列表
- ✅ 专门提取IPv6地址列表
- ✅ 环境变量支持，保护敏感信息
- ✅ 完整的错误处理和日志输出

## 环境要求

- Node.js 18+
- 支持 ES Modules

## 安装和配置

### 1. 环境变量设置

复制示例文件并配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入您的 Cookie：

```env
ICMP9_COOKIE=server_name_session=your_session_here; cf_clearance=your_clearance_here; connect.sid=your_sid_here
```

### 2. 获取Cookie的方法

1. 登录 [https://icmp9.com](https://icmp9.com)
2. 打开浏览器开发者工具 (F12)
3. 切换到 **Network** 标签
4. 刷新页面或点击相关功能
5. 找到对 `icmp9.com` 的请求
6. 在请求头中找到 `Cookie` 字段，复制完整的值

### 3. 设置环境变量

#### Linux/macOS:

```bash
export ICMP9_COOKIE="server_name_session=xxx; cf_clearance=xxx; connect.sid=xxx"
```

#### Windows:

```cmd
set ICMP9_COOKIE=server_name_session=xxx; cf_clearance=xxx; connect.sid=xxx
```

或在 PowerShell 中：

```powershell
$env:ICMP9_COOKIE="server_name_session=xxx; cf_clearance=xxx; connect.sid=xxx"
```

## 使用方法

### 基本用法

```javascript
import { icmp9API } from "./icmp9-api.js";

// 直接使用环境变量中的Cookie
const userData = await icmp9API.getAllUserData();
```

### 获取特定信息

```javascript
import { icmp9API } from "./icmp9-api.js";

// 获取用户信息
const userInfo = await icmp9API.getUserInfo();

// 获取白名单配额
const quota = await icmp9API.getWhitelistQuota();

// 获取IP列表
const ipList = await icmp9API.getWhitelistIPs();

// 只获取IPv6地址
const ipv6Addresses = await icmp9API.getIPv6Addresses();
```

### 手动设置Cookie（可选）

```javascript
import { icmp9API } from "./icmp9-api.js";

// 手动设置Cookie（覆盖环境变量）
icmp9API.setCookie("your_cookie_here");

const data = await icmp9API.getAllUserData();
```

## API 方法

### `getUserInfo()`

获取用户基本信息

**返回数据：**

- `id`: 用户ID
- `username`: 用户名
- `email`: 邮箱
- `api_key`: API密钥
- `traffic_quota`: 流量配额（bytes）
- `traffic_used`: 已用流量（bytes）
- `is_verified`: 是否已验证
- `is_active`: 是否激活
- `last_login_at`: 最后登录时间

### `getWhitelistQuota()`

获取白名单配额信息

**返回数据：**

- `quota`: 总配额
- `used`: 已使用数量
- `available`: 可用配额

### `getWhitelistIPs()`

获取白名单IP地址列表

**返回数据：**

- `_id`: 记录ID
- `ipv4`: IP地址（字段名可能包含IPv6）
- `ip_type`: IP类型（ipv6/ipv4）
- `remark`: 备注
- `created_at`: 创建时间

### `getIPv6Addresses()`

专门获取IPv6地址数组

**返回数据：**

- IPv6地址字符串数组

## 运行示例

```bash
# 设置环境变量后运行
export ICMP9_COOKIE="your_cookie_here"
node icmp9-api-example.js
```

## 错误处理

客户端包含完整的错误处理机制：

- 网络请求失败
- API响应错误
- JSON解析错误
- Cookie未设置警告

## 安全注意事项

1. **Cookie安全**：
   - 使用环境变量存储Cookie
   - 不要在代码中硬编码Cookie
   - 定期更新Cookie
   - 使用`.gitignore`确保敏感信息不被提交

2. **使用建议**：
   - 仅在受信任的环境中使用
   - 定期检查API调用日志
   - 避免在日志中输出完整的Cookie

## 文件结构

```
icmp9/
├── icmp9-api.js          # 主要API客户端
├── icmp9-api-example.js  # 使用示例
├── .env.example          # 环境变量示例
└── ICMP9-API-README.md   # 本文档
```

## 故障排除

### Cookie无效

- 确认Cookie格式正确
- 检查Cookie是否过期
- 重新登录获取新的Cookie

### 网络请求失败

- 检查网络连接
- 确认防火墙设置
- 验证ICMP9.COM服务状态

### 环境变量问题

- 确认环境变量名称正确 (`ICMP9_COOKIE`)
- 检查变量值是否完整
- 验证环境变量是否正确加载

## 许可证

本项目遵循原项目的许可证。
