/**
 * Flutter SDK 构建脚本
 *
 * 编排 Flutter 端 SDK 的构建流程：
 * 1. 运行 proto codegen 生成 Dart 源码（Generated/ 下的通道常量、方法映射、setter 扩展）
 * 2. 执行 flutter analyze（Dart 静态分析）
 *
 * 产物接入方式：
 * - 本地 path 依赖：pubspec.yaml 中 mp_web_library: path: <path>/flutter
 *
 * 注意：
 * - 需要本机安装 Flutter SDK
 * - 不需要 macOS，Windows / Linux / macOS 均可执行
 * - 不纳入 CI，仅本地验证
 */

const { execFileSync, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const FLUTTER_DIR = path.join(ROOT, 'flutter');

// Windows 上 flutter 是 .bat 文件，需要 shell: true
const SHELL_OPTS = process.platform === 'win32' ? { shell: true } : {};

// SDK 源文件清单（codegen 之后校验）
const REQUIRED_FILES = [
  'pubspec.yaml',
  'analysis_options.yaml',
  // Bridge 核心
  'lib/src/bridge/bridge_handler.dart',
  'lib/src/bridge/bridge_models.dart',
  'lib/src/bridge/js_bridge_manager.dart',
  'lib/src/bridge/bridge_utils.dart',
  'lib/src/bridge/data_sync_helper.dart',
  'lib/src/bridge/app_link_handler.dart',
  // Emitter
  'lib/src/emitter/event_router.dart',
  // Config
  'lib/src/config/mp_bridge_config.dart',
  // SDK 顶层
  'lib/src/mp_bridge_sdk.dart',
  'lib/mp_web_library.dart',
  // Assets
  'assets/bridge.js',
  // Generated（由 proto-codegen-flutter.js 生成）
  'lib/generated/data_sync_channels.dart',
  'lib/generated/data_sync_methods.dart',
  'lib/generated/data_sync_setters.dart',
];

/**
 * 从 pubspec.yaml 中读取版本号
 */
function readPubspecVersion() {
  const pubspec = path.join(FLUTTER_DIR, 'pubspec.yaml');
  const content = fs.readFileSync(pubspec, 'utf-8');
  const match = content.match(/^version:\s*(.+)$/m);
  if (!match) {
    console.error('[Build] ERROR: Cannot parse version from pubspec.yaml');
    process.exit(1);
  }
  return match[1].trim();
}

/**
 * 检查 Flutter SDK 是否可用
 */
function checkFlutterAvailable() {
  try {
    execSync('flutter --version', { stdio: 'pipe', ...SHELL_OPTS });
    return true;
  } catch (e) {
    return false;
  }
}

try {
  console.log('[Build] Flutter - Building mp_web_library...');
  console.log(`  FLUTTER_DIR: ${FLUTTER_DIR}`);

  // 1. 运行 proto codegen 生成 Dart 源码
  console.log('[Build] Running proto codegen...');
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'proto-codegen-flutter.js')], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  // 2. 校验源文件完整性
  console.log('[Build] Validating source files...');
  const missing = REQUIRED_FILES.filter(f => !fs.existsSync(path.join(FLUTTER_DIR, f)));
  if (missing.length > 0) {
    console.error('[Build] ERROR: Missing required files:');
    for (const f of missing) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`  ${REQUIRED_FILES.length} source files OK`);

  // 3. 检查 Flutter SDK
  if (!checkFlutterAvailable()) {
    console.warn('[Build] WARNING: Flutter SDK not found. Skipping flutter analyze.');
    console.warn('  Install Flutter SDK to enable static analysis.');
    const version = readPubspecVersion();
    console.log(`[Build] Flutter build completed (codegen only, no analyze). Version: ${version}`);
    return;
  }

  // 4. flutter pub get
  console.log('[Build] Running flutter pub get...');
  execSync('flutter pub get', {
    cwd: FLUTTER_DIR,
    stdio: 'inherit',
    ...SHELL_OPTS,
  });

  // 5. flutter analyze
  console.log('[Build] Running flutter analyze...');
  execSync('flutter analyze', {
    cwd: FLUTTER_DIR,
    stdio: 'inherit',
    ...SHELL_OPTS,
  });

  const version = readPubspecVersion();
  console.log('[Build] Flutter build completed successfully.');
  console.log(`  Version: ${version}`);
} catch (error) {
  console.error('[Build] Flutter build failed:', error.message);
  process.exit(1);
}
