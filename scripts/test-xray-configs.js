import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG_DIR = path.join(__dirname, "..");

// Get all .json files starting with "xray-output" in the current directory
function getXrayConfigFiles(configDir) {
  try {
    const files = fs.readdirSync(configDir);
    return files
      .filter(
        (file) =>
          file.startsWith("xray-output") &&
          file.endsWith(".json") &&
          !file.includes("template"),
      )
      .sort(); // Sort alphabetically for consistent order
  } catch (error) {
    console.error("Error reading config directory:", error.message);
    return [];
  }
}

const CONFIG_FILES = getXrayConfigFiles(CONFIG_DIR);

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  blue: "\x1b[34m",
};

function log(message, color = "white") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
}

function validateJSONSyntax(configPath) {
  try {
    const content = fs.readFileSync(configPath, "utf8");
    JSON.parse(content);
    return { valid: true, error: null };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

async function testXrayConfigFile(configPath, xrayPath) {
  try {
    log(`   🧪 测试配置: ${path.basename(configPath)}`, "cyan");

    // First validate JSON syntax
    const jsonValidation = validateJSONSyntax(configPath);
    if (!jsonValidation.valid) {
      log(`   ❌ JSON语法错误: ${jsonValidation.error}`, "red");
      return {
        success: false,
        error: `JSON syntax error: ${jsonValidation.error}`,
      };
    }

    // Use async spawn to avoid ENOBUFS errors
    return new Promise((resolve) => {
      try {
        const xrayProcess = spawn(
          `"${xrayPath}"`,
          ["run", "-test", "-c", `"${configPath}"`],
          {
            detached: true,
            shell: true,
            stdio: ["ignore", "pipe", "pipe"],
            env: process.env,
          },
        );

        let stdout = "";
        let stderr = "";
        let isResolved = false;

        // Set timeout
        const timeout = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            xrayProcess.kill("SIGTERM");
            log("   ⏰ 测试超时", "yellow");
            resolve({
              success: false,
              error: "Test timeout after 30 seconds",
            });
          }
        }, 30000);

        // Collect stdout data in chunks to avoid buffer overflow
        xrayProcess.stdout?.on("data", (data) => {
          stdout += data.toString();
          // Limit output size to prevent memory issues
          if (stdout.length > 50000) {
            stdout = stdout.substring(0, 50000) + "\n... (output truncated)";
          }
        });

        // Collect stderr data in chunks
        xrayProcess.stderr?.on("data", (data) => {
          stderr += data.toString();
          // Limit output size to prevent memory issues
          if (stderr.length > 50000) {
            stderr = stderr.substring(0, 50000) + "\n... (output truncated)";
          }
        });

        // Handle process completion
        xrayProcess.on("exit", (code) => {
          clearTimeout(timeout);

          if (isResolved) return;
          isResolved = true;

          const rawOutput = stdout || stderr;

          if (process.argv.includes("--verbose") && rawOutput) {
            console.log(rawOutput);
          }

          if (code === 0) {
            // Filter out warnings and feature notices
            const result = rawOutput
              .split("\n")
              .filter(
                (line) =>
                  !line.includes("Warning") && !line.includes("This feature"),
              )
              .join("\n")
              .trim();

            log("   ✅ 配置文件测试通过!", "green");
            process.exit(0)
            resolve({ success: true, output: result });
          } else {
            log(`   ❌ 配置文件测试失败!`, "red");
            if (process.argv.includes("--verbose")) {
              log(`   错误详情: ${rawOutput}`, "red");
            }
            resolve({
              success: false,
              output: rawOutput,
              error: `Process exited with code ${code}`,
            });
          }
        });

        // Handle process errors
        xrayProcess.on("error", (error) => {
          clearTimeout(timeout);

          if (!isResolved) {
            isResolved = true;
            log(`   ❌ 配置文件测试失败!`, "red");

            if (process.argv.includes("--verbose")) {
              log(`   错误信息: ${error.message}`, "red");
            }

            resolve({
              success: false,
              output: stderr,
              error: error.message,
            });
          }
        });

        // Unref to allow main process to exit independently
        xrayProcess.unref();
      } catch (error) {
        log(`   ❌ 配置文件测试失败!`, "red");

        if (process.argv.includes("--verbose")) {
          log(`   错误信息: ${error.message}`, "red");
        }

        resolve({
          success: false,
          error: error.message,
        });
      }
    });
  } catch (error) {
    log(`   ❌ 配置文件测试失败!`, "red");

    if (process.argv.includes("--verbose")) {
      log(`   错误信息: ${error.message}`, "red");
    }

    return {
      success: false,
      error: error.message,
    };
  }
}

function findXrayExecutable() {
  const possiblePaths = [
    // Local paths - prioritize local xray executable
    path.join(CONFIG_DIR, "xray"),
    path.join(CONFIG_DIR, "xray.exe"),
    path.join(process.cwd(), "xray"),
    path.join(process.cwd(), "xray.exe"),
    "E:/迅雷下载/v2rayN-windows-64-SelfContained/bin/xray/xray.exe",
    // Windows paths
    "C:/Program Files/xray/xray.exe",
    "C:/xray/xray.exe",

    // Linux/macOS paths
    "/usr/local/bin/xray",
    "/usr/bin/xray",
    "/opt/xray/xray",

    // Home directory paths
    path.join(process.env.HOME || process.env.USERPROFILE || "", "xray"),
    path.join(process.env.HOME || process.env.USERPROFILE || "", "xray.exe"),
  ];

  for (const xrayPath of possiblePaths) {
    if (checkFileExists(xrayPath)) {
      try {
        const stats = fs.statSync(xrayPath);
        if (stats.isFile()) {
          const isWindows = process.platform === "win32";
          if (isWindows || stats.mode & parseInt("111", 8)) {
            return xrayPath;
          }
        }
      } catch (error) {
        continue;
      }
    }
  }

  return null;
}

function analyzeConfigFeatures(configPath) {
  try {
    const content = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(content);

    const features = {
      hasOutbounds: !!(config.outbounds && config.outbounds.length > 0),
      hasRouting: !!config.routing,
      hasDirectOutbound: false,
      hasBlockOutbound: false,
      hasVmessOutbound: false,
      outboundCount: config.outbounds ? config.outbounds.length : 0,
      vmessCount: 0,
    };

    // Check for specific outbound types
    if (config.outbounds) {
      features.hasDirectOutbound = config.outbounds.some(
        (outbound) => outbound.tag === "direct" || outbound.protocol === "freedom",
      );
      features.hasBlockOutbound = config.outbounds.some(
        (outbound) => outbound.tag === "block" || outbound.protocol === "blackhole",
      );
      features.hasVmessOutbound = config.outbounds.some(
        (outbound) => outbound.protocol === "vmess",
      );

      // Count vmess outbounds
      features.vmessCount = config.outbounds.filter(
        (outbound) => outbound.protocol === "vmess"
      ).length;
    }

    return { valid: true, features };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

async function main() {
  log("🔄 开始测试 Xray 配置文件...", "cyan");

  // Find xray executable
  const xrayPath = findXrayExecutable();

  if (!xrayPath) {
    log("❌ 未找到 Xray 可执行文件!", "red");
    log("请确保以下路径之一存在:", "yellow");
    log("- ./xray 或 ./xray.exe", "white");
    log("- /usr/local/bin/xray (Linux/macOS)", "white");
    log("或者在 GitHub Actions 中会自动下载 Xray", "yellow");
    process.exit(1);
  }

  log(`✅ 使用 Xray: ${xrayPath}`, "green");

  if (CONFIG_FILES.length === 0) {
    log("⚠️ 未找到任何 Xray 配置文件", "yellow");
    log("请先运行以下命令生成配置文件:", "yellow");
    log("- node generate-xray-config.mjs", "white");
    log("- node 链接生成器.js", "white");
    process.exit(0);
  }

  // Test each configuration file
  let successCount = 0;
  const totalCount = CONFIG_FILES.length;
  const results = [];

  for (const configFile of CONFIG_FILES) {
    const configPath = path.join(CONFIG_DIR, configFile);

    log(`\n📋 测试文件: ${configFile}`, "yellow");

    if (!checkFileExists(configPath)) {
      log(`   ⚠️ 配置文件不存在: ${configPath}`, "yellow");
      continue;
    }

    // Basic Xray configuration test
    const xrayTestResult = await testXrayConfigFile(configPath, xrayPath);

    // Analyze configuration features
    const featureAnalysis = analyzeConfigFeatures(configPath);

    const result = {
      file: configFile,
      xrayTest: xrayTestResult,
      features: featureAnalysis,
    };

    results.push(result);

    // Display feature analysis
    if (featureAnalysis.valid && process.argv.includes("--verbose")) {
      const features = featureAnalysis.features;
      log(`   📊 配置分析:`, "blue");
      log(`      - 总出站数量: ${features.outboundCount}`, "white");
      log(`      - VMess 代理数量: ${features.vmessCount}`, "white");
      log(
        `      - Direct 出站: ${features.hasDirectOutbound ? "✅" : "❌"}`,
        features.hasDirectOutbound ? "green" : "red",
      );
      log(
        `      - Block 出站: ${features.hasBlockOutbound ? "✅" : "❌"}`,
        features.hasBlockOutbound ? "green" : "red",
      );
      log(
        `      - VMess 出站: ${features.hasVmessOutbound ? "✅" : "❌"}`,
        features.hasVmessOutbound ? "green" : "red",
      );
    }

    if (result.xrayTest.success) {
      successCount++;
    }

    if (process.argv.includes("--verbose") && result.xrayTest.output) {
      log(`   详细输出:`, "white");
      console.log(result.xrayTest.output);
    }
  }

  // Summary
  log(
    `\n📊 测试结果: ${successCount}/${totalCount} 个配置文件通过测试`,
    "cyan",
  );

  // Detailed summary
  log(`\n📋 详细结果:`, "yellow");
  for (const result of results) {
    const status = result.xrayTest.success ? "✅" : "❌";
    log(
      `   ${status} ${result.file}`,
      result.xrayTest.success ? "green" : "red",
    );

    if (process.argv.includes("--verbose") && !result.xrayTest.success) {
      log(`      错误: ${result.xrayTest.error}`, "red");
    }
  }

  if (successCount === totalCount) {
    log("\n🎉 所有配置文件测试通过!", "green");
    process.exit(0);
  } else {
    log("\n❌ 部分配置文件测试失败!", "red");
    process.exit(1);
  }
}

// Handle command line arguments
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
用法: node test-xray-configs.js [选项]

选项:
  --verbose, -v      显示详细输出
  --help, -h         显示帮助信息

示例:
  node test-xray-configs.js
  node test-xray-configs.js --verbose
`);
  process.exit(0);
}

if (import.meta.main) {
  // Run main function
  main();
}