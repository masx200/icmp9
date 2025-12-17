#!/usr/bin/env node

// whitelist-auto-manager.js
import { icmp9API } from "./icmp9-api.js";
import IPv6InfoFetcher from "./ipv6-info.js";

/**
 * IPv6白名单自动管理器
 * 每分钟检查当前IPv6地址并自动添加到白名单
 * 如果白名单已满，删除最旧的条目
 */
class WhitelistAutoManager {
  constructor() {
    this.currentIPv6 = null;
    this.isRunning = false;
    this.intervalId = null;
    this.checkInterval = 60 * 1000; // 1分钟（毫秒）
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5秒
    this.lastCheckTime = null;
    this.successCount = 0;
    this.errorCount = 0;
    this.ipv6Fetcher = new IPv6InfoFetcher();
  }

  /**
   * 获取当前IPv6地址
   * @returns {Promise<string|null>} IPv6地址或null
   */
  async getCurrentIPv6() {
    try {
      console.log("🔍 正在获取当前IPv6地址...");

      // 使用IPv6InfoFetcher获取地址
      const ipInfo = await this.ipv6Fetcher.fetchIPInfo();

      if (ipInfo && ipInfo.ip && ipInfo.ip !== "unknown" && ipInfo.isIPv6) {
        this.currentIPv6 = ipInfo.ip;
        console.log(`✅ 获取到IPv6地址: ${this.currentIPv6}`);
        console.log(
          `   位置: ${ipInfo.country || "未知"} (${
            ipInfo.country_code || "未知"
          })`,
        );
        console.log(
          `   ASN: ${ipInfo.asn || "未知"} - ${
            ipInfo.as_name || ipInfo.org || "未知"
          }`,
        );
        return this.currentIPv6;
      } else {
        console.log("❌ 未能获取到有效的IPv6地址");
        return null;
      }
    } catch (error) {
      console.error("❌ 获取IPv6地址失败:", error.message);
      return null;
    }
  }

  /**
   * 检查IP是否已在白名单中
   * @param {string} ip - 要检查的IP地址
   * @param {Array} whitelist - 白名单数组
   * @returns {boolean} 是否存在
   */
  isIPInWhitelist(ip, whitelist) {
    return whitelist.some((item) => item.ipv4 === ip);
  }

  /**
   * 获取最旧的白名单条目
   * @param {Array} whitelist - 白名单数组
   * @returns {Object|null} 最旧的条目
   */
  getOldestWhitelistEntry(whitelist) {
    if (whitelist.length === 0) return null;

    return whitelist.reduce((oldest, current) => {
      const oldestTime = new Date(oldest.created_at);
      const currentTime = new Date(current.created_at);
      return currentTime < oldestTime ? current : oldest;
    });
  }

  /**
   * 执行一次白名单检查和管理
   * @returns {Promise<boolean>} 是否成功
   */
  async performWhitelistManagement() {
    try {
      this.lastCheckTime = new Date();
      console.log(
        `\n🕐 [${this.lastCheckTime.toLocaleString()}] 开始执行白名单检查...`,
      );

      // 1. 获取当前IPv6地址
      const currentIPv6 = await this.getCurrentIPv6();
      if (!currentIPv6) {
        console.log("⚠️  跳过本次检查（无法获取IPv6地址）");
        this.errorCount++;
        return false;
      }

      // 2. 获取白名单配额信息
      console.log("📊 检查白名单配额...");
      const quota = await icmp9API.getWhitelistQuota();
      console.log(
        `   总配额: ${quota.quota}, 已使用: ${quota.used}, 可用: ${quota.available}`,
      );

      // 3. 获取当前白名单
      console.log("📋 获取当前白名单...");
      const whitelist = await icmp9API.getWhitelistIPs();

      // 4. 检查当前IP是否已在白名单中
      if (this.isIPInWhitelist(currentIPv6, whitelist)) {
        console.log(`✅ 当前IPv6地址 ${currentIPv6} 已在白名单中，无需操作`);
        this.successCount++;
        return true;
      }

      // 5. 检查是否有可用配额
      if (quota.available <= 0) {
        console.log("⚠️  白名单已满，需要删除最旧的条目...");

        const oldestEntry = this.getOldestWhitelistEntry(whitelist);
        if (oldestEntry) {
          console.log(
            `   删除最旧条目: ${oldestEntry.ipv4} (创建于: ${oldestEntry.created_at})`,
          );
          await icmp9API.deleteWhitelistIP(oldestEntry._id);
          console.log("✅ 成功删除最旧的白名单条目");
        } else {
          console.log("❌ 无法找到最旧的条目，跳过添加");
          this.errorCount++;
          return false;
        }
      }

      // 6. 添加新的IPv6地址到白名单
      const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
      const remark = `自动添加 - ${timestamp}`;

      console.log(`➕ 添加IPv6地址到白名单: ${currentIPv6}`);
      await icmp9API.addWhitelistIP(currentIPv6, remark);

      console.log("✅ 成功添加IPv6地址到白名单");
      this.successCount++;
      return true;
    } catch (error) {
      console.error("❌ 白名单管理失败:", error.message);
      this.errorCount++;
      return false;
    }
  }

  /**
   * 启动定时任务
   */
  start() {
    if (this.isRunning) {
      console.log("⚠️  定时任务已在运行中");
      return;
    }

    console.log("🚀 启动IPv6白名单自动管理器");
    console.log(`   检查间隔: ${this.checkInterval / 1000} 秒`);
    console.log(`   最大重试次数: ${this.maxRetries}`);
    console.log("   按 Ctrl+C 停止程序");
    console.log("=".repeat(60));

    this.isRunning = true;

    // 立即执行一次
    this.runWithRetry();

    // 设置定时器
    this.intervalId = setInterval(() => {
      this.runWithRetry();
    }, this.checkInterval);
  }

  /**
   * 带重试的执行
   */
  async runWithRetry() {
    let retryCount = 0;

    while (retryCount < this.maxRetries) {
      const success = await this.performWhitelistManagement();

      if (success) {
        break; // 成功则跳出重试循环
      }

      retryCount++;
      if (retryCount < this.maxRetries) {
        console.log(
          `🔄 第 ${retryCount} 次重试 (${this.retryDelay / 1000} 秒后)...`,
        );
        await this.sleep(this.retryDelay);
      }
    }

    if (retryCount >= this.maxRetries) {
      console.error(`❌ 达到最大重试次数 ${this.maxRetries}，本次检查失败`);
    }

    // 显示统计信息
    this.showStats();
  }

  /**
   * 停止定时任务
   */
  stop() {
    if (!this.isRunning) {
      console.log("⚠️  定时任务未在运行");
      return;
    }

    console.log("\n🛑 正在停止IPv6白名单自动管理器...");

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    console.log("✅ 定时任务已停止");
    this.showStats();
  }

  /**
   * 显示统计信息
   */
  showStats() {
    console.log("\n📊 运行统计:");
    console.log(`   成功次数: ${this.successCount}`);
    console.log(`   失败次数: ${this.errorCount}`);
    console.log(`   总检查次数: ${this.successCount + this.errorCount}`);
    if (this.successCount + this.errorCount > 0) {
      const successRate =
        ((this.successCount / (this.successCount + this.errorCount)) * 100)
          .toFixed(1);
      console.log(`   成功率: ${successRate}%`);
    }
    if (this.lastCheckTime) {
      console.log(`   上次检查: ${this.lastCheckTime.toLocaleString()}`);
    }
    console.log("-".repeat(40));
  }

  /**
   * 休眠函数
   * @param {number} ms - 毫秒
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 主程序
async function main() {
  // 检查环境变量
  if (!process.env.ICMP9_COOKIE) {
    console.error("❌ 错误: 未设置 ICMP9_COOKIE 环境变量");
    console.error("请设置环境变量后再运行此程序:");
    console.error("   export ICMP9_COOKIE='your_cookie_here'");
    console.error("   或在 Windows 上: set ICMP9_COOKIE=your_cookie_here");
    process.exit(1);
  }

  const manager = new WhitelistAutoManager();

  // 处理程序退出信号
  process.on("SIGINT", () => {
    console.log("\n\n📡 收到退出信号 (Ctrl+C)");
    manager.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("\n\n📡 收到终止信号");
    manager.stop();
    process.exit(0);
  });

  // 处理未捕获的异常
  process.on("uncaughtException", (error) => {
    console.error("\n❌ 未捕获的异常:", error.message);
    console.error(error.stack);
    manager.stop();
    process.exit(1);
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("\n❌ 未处理的Promise拒绝:", reason);
    console.error("Promise:", promise);
  });

  // 启动定时任务
  manager.start();
}

// 如果直接运行此文件，则执行主程序
if (import.meta.main) {
  main().catch((error) => {
    console.error("❌ 程序启动失败:", error.message);
    console.error(error.stack);
    process.exit(1);
  });
}

export default WhitelistAutoManager;
