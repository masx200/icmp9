# IPv6白名单自动管理器

这是一个自动管理ICMP9.COM白名单的Node.js程序，它会每分钟检查当前电脑的IPv6地址并自动添加到白名单中。如果白名单已满，会自动删除最旧的条目。

## 功能特性

- 🔄 **自动定时检查**: 每分钟执行一次白名单检查
- 🌐 **IPv6地址获取**: 使用多个API服务确保获取准确的IPv6地址
- 📊 **智能配额管理**: 自动检查白名单配额，满额时删除最旧条目
- 🛡️ **重复检测**: 避免添加重复的IP地址
- 📝 **详细日志**: 完整的操作日志和统计信息
- 🔁 **重试机制**: 失败时自动重试，提高可靠性
- ⚡ **优雅退出**: 支持Ctrl+C安全停止

## 使用方法

### 1. 设置环境变量

首先需要设置ICMP9的Cookie环境变量：

**Linux/macOS:**

```bash
export ICMP9_COOKIE='your_cookie_here'
```

**Windows (PowerShell):**

```powershell
$env:ICMP9_COOKIE = 'your_cookie_here'
```

**Windows (CMD):**

```cmd
set ICMP9_COOKIE=your_cookie_here
```

### 2. 运行程序

```bash
# 直接运行
node whitelist-auto-manager.js

# 或使用npx
npx whitelist-auto-manager.js
```

### 3. 程序输出示例

```
🚀 启动IPv6白名单自动管理器
   检查间隔: 60 秒
   最大重试次数: 3
   按 Ctrl+C 停止程序
============================================================

🕐 [2025-12-17 16:30:00] 开始执行白名单检查...
🔍 正在获取当前IPv6地址...
🔍 开始获取当前IPv6地址信息...
尝试 ipinfo.io API...
✅ ipinfo.io 获取IPv6成功: 240e:b8e:35cd:a601:546:f26f:d783:a63c
✅ IPv6信息获取完成
✅ 获取到IPv6地址: 240e:b8e:35cd:a601:546:f26f:d783:a63c
   位置: 中国 (CN)
   ASN: 57965 - China Unicom
📊 检查白名单配额...
成功获取白名单配额:
总配额: 10
已使用: 8
可用配额: 2
📋 获取当前白名单...
成功获取白名单IP列表，共 8 个IP:
✅ 当前IPv6地址 240e:b8e:35cd:a601:546:f26f:d783:a63c 不在白名单中，添加到白名单
➕ 添加IPv6地址到白名单: 240e:b8e:35cd:a601:546:f26f:d783:a63c
添加白名单IP: 240e:b8e:35cd:a601:546:f26f:d783:a63c...
添加成功
IP: 240e:b8e:35cd:a601:546:f26f:d783:a63c (ipv6)
ID: 694268a912c61f540962bbb9
备注: 自动添加 - 2025-12-17 16:30:05
✅ 成功添加IPv6地址到白名单

📊 运行统计:
   成功次数: 1
   失败次数: 0
   总检查次数: 1
   成功率: 100.0%
   上次检查: 2025-12-17 16:30:05
----------------------------------------
```

## 配置选项

你可以通过修改 `whitelist-auto-manager.js` 中的配置来调整程序行为：

```javascript
constructor() {
  this.checkInterval = 60 * 1000; // 检查间隔（毫秒）
  this.maxRetries = 3;             // 最大重试次数
  this.retryDelay = 5000;          // 重试延迟（毫秒）
}
```

## 工作流程

1. **获取IPv6地址**: 使用多个API服务获取当前的IPv6地址
2. **检查配额**: 查看白名单的使用情况和可用配额
3. **获取白名单**: 获取当前的白名单IP列表
4. **重复检测**: 检查当前IP是否已在白名单中
5. **空间管理**: 如果白名单已满，删除最旧的条目
6. **添加新IP**: 将当前IPv6地址添加到白名单
7. **记录日志**: 记录操作结果和统计信息

## 错误处理

- **网络错误**: 自动重试机制，最多重试3次
- **API错误**: 记录详细错误信息，继续下次检查
- **IPv6获取失败**: 跳过本次检查，等待下次执行
- **Cookie错误**: 程序启动时检查，未设置则退出

## 停止程序

按 `Ctrl+C` 可以安全停止程序。程序会：

1. 停止定时器
2. 显示最终统计信息
3. 优雅退出

## 故障排除

### 1. 无法获取IPv6地址

- 检查网络连接是否支持IPv6
- 确认防火墙没有阻止IPv6连接
- 某些网络环境可能需要配置IPv6

### 2. Cookie设置问题

- 确保Cookie字符串正确且未过期
- 检查环境变量是否正确设置
- 可以先运行 `icmp9API.getAllUserData()` 测试Cookie是否有效

### 3. 白名单配额问题

- 检查ICMP9账户的白名单配额限制
- 确认账户状态正常且未过期

## 依赖项

- Node.js (支持ES模块)
- 项目依赖: `undici`, `ipify` (已在package.json中定义)
- IPv6InfoFetcher (项目内置)
- Icmp9API (项目内置)

## 安全注意事项

- Cookie包含敏感信息，请妥善保管
- 建议在受信任的环境中运行此程序
- 定期检查程序的运行日志
- 确保白名单中的IP地址都是你信任的网络

## 高级用法

### 作为系统服务运行

**Linux (systemd):**

```ini
[Unit]
Description=ICMP9 Whitelist Auto Manager
After=network.target

[Service]
Type=simple
User=your-username
Environment=ICMP9_COOKIE=your_cookie_here
WorkingDirectory=/path/to/icmp9
ExecStart=/usr/bin/node whitelist-auto-manager.js
Restart=always
RestartSec=60

[Install]
WantedBy=multi-user.target
```

**Windows (使用PM2):**

```bash
# 安装PM2
npm install -g pm2

# 启动程序
pm2 start whitelist-auto-manager.js --name "icmp9-whitelist"

# 设置开机自启
pm2 startup
pm2 save
```
