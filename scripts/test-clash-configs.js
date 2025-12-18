#!/usr/bin/env node

import fs from "fs";
import path from "path";
import yaml from "js-yaml";

const configFiles = [
  "clash-output-consistenthashing.yaml",
  // "clash-config-template.yaml",
];

console.log("🧪 开始验证 Clash 配置文件...");

let successCount = 0;
let totalCount = 0;
const failedFiles = [];

for (const configFile of configFiles) {
  if (!fs.existsSync(configFile)) {
    console.log(`⚠️  文件不存在: ${configFile}`);
    continue;
  }

  totalCount++;
  console.log(`\n📋 验证文件: ${configFile}`);

  try {
    const fileContent = fs.readFileSync(configFile, "utf8");
    const config = yaml.load(fileContent);

    // 基本结构验证
    const requiredFields = ["port", "mode", "log-level"];
    const missingFields = requiredFields.filter((field) => !(field in config));

    if (missingFields.length > 0) {
      console.log(`   ❌ 缺少必需字段: ${missingFields.join(", ")}`);
      failedFiles.push(configFile);
      continue;
    }

    // 验证端口
    if (
      config.port &&
      (typeof config.port !== "number" || config.port < 1 ||
        config.port > 65535)
    ) {
      console.log(`   ❌ 无效的端口号: ${config.port}`);
      failedFiles.push(configFile);
      continue;
    }

    // 验证模式
    if (config.mode && !["rule", "global", "direct"].includes(config.mode)) {
      console.log(`   ❌ 无效的模式: ${config.mode}`);
      failedFiles.push(configFile);
      continue;
    }

    // 验证日志级别
    if (
      config["log-level"] &&
      !["silent", "error", "warning", "info", "debug"].includes(
        config["log-level"],
      )
    ) {
      console.log(`   ❌ 无效的日志级别: ${config["log-level"]}`);
      failedFiles.push(configFile);
      continue;
    }

    console.log(`   ✅ YAML 语法正确`);
    console.log(`   ✅ 基本结构验证通过`);
    console.log(`   ✅ 配置文件验证通过`);
    successCount++;
  } catch (error) {
    console.log(`   ❌ YAML 语法错误: ${error.message}`);
    failedFiles.push(configFile);
  }
}

console.log(`\n📊 验证结果: ${successCount}/${totalCount} 个配置文件通过验证`);

if (failedFiles.length > 0) {
  console.log("\n❌ 验证失败的文件:");
  failedFiles.forEach((file) => console.log(`   - ${file}`));
  process.exit(1);
} else {
  console.log("\n🎉 所有配置文件验证通过!");
  console.log("✅ Clash 配置验证完成");
}
