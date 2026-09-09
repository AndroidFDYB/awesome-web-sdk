/**
 * Android AAR 构建脚本
 *
 * 跨平台执行 Gradle wrapper，构建 and_web_library 模块的 Release AAR，
 * 随后调用 post-build.js 将产物收集到统一的 output/android/ 目录。
 *
 * 平台差异处理：
 * - Windows：执行 gradlew.bat，且 MUST 带 shell:true。
 *   Node.js 自 18.20.2 / 20.12.2 起（CVE-2024-27980 修复），
 *   spawn/execFile 执行 .bat / .cmd 不带 shell 选项会直接抛 EINVAL。
 * - Linux / macOS（含 CI runner）：执行 ./gradlew，需要文件具备可执行位。
 *   仓库历史中该文件曾以 100644 模式入库（Windows 侧开发未记录 exec bit），
 *   故此处补一次 chmod 兜底，避免 Permission denied。
 *
 * 之所以独立成脚本：根 package.json 的 build:android 原先内联调用 gradlew.bat，
 * 属 Windows 专有入口，在 Linux CI 环境无法执行，违反 build 能力域
 * "构建脚本 MUST 使用跨平台 Node.js 语法" 的约束。
 */

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const ANDROID_DIR = path.join(ROOT, 'android');

const IS_WINDOWS = process.platform === 'win32';

// 使用相对命令名 + cwd，避免 shell 模式下绝对路径含空格被截断
const GRADLEW_CMD = IS_WINDOWS ? 'gradlew.bat' : './gradlew';
const GRADLEW_PATH = path.join(ANDROID_DIR, IS_WINDOWS ? 'gradlew.bat' : 'gradlew');
const GRADLE_ARGS = [':and_web_library:assembleRelease'];

console.log('[Build] Android - Building and_web_library AAR...');
console.log(`  ANDROID_DIR: ${ANDROID_DIR}`);
console.log(`  PLATFORM:    ${process.platform}`);
console.log(`  WRAPPER:     ${GRADLEW_CMD}`);

// 验证 wrapper 是否存在
if (!fs.existsSync(GRADLEW_PATH)) {
  console.error(`[Build] ERROR: Gradle wrapper not found: ${GRADLEW_PATH}`);
  process.exit(1);
}

// 非 Windows 环境确保可执行位（git 索引模式为 100644 时兜底）
if (!IS_WINDOWS) {
  try {
    fs.chmodSync(GRADLEW_PATH, 0o755);
    console.log('  Ensured executable bit on gradlew.');
  } catch (error) {
    console.error(`[Build] WARN: chmod failed for gradlew: ${error.message}`);
  }
}

try {
  console.log(`  Running: ${GRADLEW_CMD} ${GRADLE_ARGS.join(' ')}`);
  execFileSync(GRADLEW_CMD, GRADLE_ARGS, {
    cwd: ANDROID_DIR,
    stdio: 'inherit',
    shell: IS_WINDOWS,
  });

  // 收集 AAR 产物到统一产物目录
  console.log('[Build] Collecting AAR to output/android ...');
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'post-build.js'), 'android'], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  console.log('[Build] Android build completed successfully.');
} catch (error) {
  console.error('[Build] Android build failed:', error.message);
  console.error('  Please ensure:');
  console.error('  1. JDK 21 is available (see android/gradle/gradle-daemon-jvm.properties)');
  console.error('  2. Android SDK is reachable via ANDROID_HOME or android/local.properties');
  console.error(`  3. Gradle wrapper exists at: ${GRADLEW_PATH}`);
  process.exit(1);
}
