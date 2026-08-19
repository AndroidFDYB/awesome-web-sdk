/**
 * iOS SDK 构建脚本
 *
 * iOS 端 SDK 为纯 Objective-C 源码发布（CocoaPods 源码 pod），无跨平台编译步骤：
 * 1. 运行 proto codegen 生成 Generated/ 下的 ObjC 源码（SSOT：specs/proto/channels.proto）
 * 2. 校验 SDK 源文件完整性
 * 3. 将整个 pod 目录打包为 zip 产物（build/ios_web_library-<version>.zip）
 *
 * 产物接入方式（两种）：
 * - 解压后本地接入：Podfile 中 pod 'ios_web_library', :path => '<解压路径>/ios_web_library'
 * - 推送私有 pod 仓库：pod repo push <repo> ios-web-library.podspec --sources=...
 *
 * 如需编译验证（需 macOS + Xcode + CocoaPods）：
 *   cd ios/ios_web_library && pod lib lint --quick
 */

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const IOS_LIB_DIR = path.join(ROOT, 'ios', 'ios_web_library');
const BUILD_DIR = path.join(IOS_LIB_DIR, 'build');

// SDK 源文件清单（codegen 之后校验，Generated/ 产物包含在内）
const REQUIRED_FILES = [
  'MPWebLibrary.h',
  'ios-web-library.podspec',
  // Bridge
  'Bridge/MPBridgeHandler.h',
  'Bridge/MPBridgeModels.h',
  'Bridge/MPBridgeModels.m',
  'Bridge/MPJSBridgeManager.h',
  'Bridge/MPJSBridgeManager.m',
  'Bridge/MPDsBridgeProxy.h',
  'Bridge/MPDsBridgeProxy.m',
  'Bridge/MPBridgeUtils.h',
  'Bridge/MPBridgeUtils.m',
  'Bridge/MPDataSyncHelper.h',
  'Bridge/MPDataSyncHelper.m',
  // AppLink
  'AppLink/MPAppLinkParams.h',
  'AppLink/MPAppLinkParams.m',
  'AppLink/MPAppLinkParser.h',
  'AppLink/MPAppLinkParser.m',
  'AppLink/MPAppLinkHandler.h',
  'AppLink/MPAppLinkHandler.m',
  // Emitter
  'Emitter/MPEventRouter.h',
  'Emitter/MPEventRouter.m',
  // Components
  'Components/MPBridgeWebViewController.h',
  'Components/MPBridgeWebViewController.m',
  // Generated（由 proto-codegen-ios.js 生成）
  'Generated/MPDataSyncChannels.h',
  'Generated/MPDataSyncChannels.m',
  'Generated/MPDataSyncMethods.h',
  'Generated/MPDataSyncMethods.m',
  'Generated/MPDataSyncHelper+Generated.h',
  'Generated/MPDataSyncHelper+Generated.m',
  // Resources
  'Resources/bridge.js',
];

/**
 * 从 podspec 中读取版本号
 */
function readPodspecVersion() {
  const podspec = path.join(IOS_LIB_DIR, 'ios-web-library.podspec');
  const content = fs.readFileSync(podspec, 'utf-8');
  const match = content.match(/s\.version\s*=\s*['"]([^'"]+)['"]/);
  if (!match) {
    console.error('[Build] ERROR: Cannot parse version from ios-web-library.podspec');
    process.exit(1);
  }
  return match[1];
}

/**
 * 递归拷贝目录（排除 build/ 构建产物目录）
 */
function copyTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === 'build') continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyTree(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * 将目录打包为 zip（目录名作为 zip 内的顶层目录）
 *
 * 依次尝试：
 * 1. tar（Windows 10+/macOS 内置 bsdtar，-a 按扩展名自动选择 zip 格式）
 * 2. PowerShell Compress-Archive（Windows 回退）
 * 3. zip 命令（Linux 回退）
 */
function createZip(folderToZip, outZip) {
  // 1. bsdtar
  try {
    execFileSync('tar', [
      '-a', '-cf', outZip,
      '-C', path.dirname(folderToZip),
      path.basename(folderToZip),
    ], { stdio: 'inherit' });
    return;
  } catch (e) {
    console.warn('[Build] tar unavailable, falling back to PowerShell...');
  }

  // 2. PowerShell Compress-Archive
  try {
    execFileSync('powershell.exe', [
      '-NoProfile', '-Command', 'Compress-Archive',
      '-Path', folderToZip,
      '-DestinationPath', outZip,
      '-Force',
    ], { stdio: 'inherit' });
    return;
  } catch (e) {
    console.warn('[Build] PowerShell unavailable, falling back to zip...');
  }

  // 3. zip 命令
  execFileSync('zip', ['-r', outZip, folderToZip], { stdio: 'inherit' });
}

try {
  console.log('[Build] iOS - Packaging ios_web_library pod...');
  console.log(`  IOS_LIB_DIR: ${IOS_LIB_DIR}`);

  // 1. 先运行 proto codegen 生成 ObjC 源码
  console.log('[Build] Running proto codegen...');
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'proto-codegen-ios.js')], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  // 2. 校验源文件完整性
  console.log('[Build] Validating source files...');
  const missing = REQUIRED_FILES.filter(f => !fs.existsSync(path.join(IOS_LIB_DIR, f)));
  if (missing.length > 0) {
    console.error('[Build] ERROR: Missing required files:');
    for (const f of missing) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`  ${REQUIRED_FILES.length} source files OK`);

  // 3. 打包 zip 产物
  const version = readPodspecVersion();
  const zipName = `ios_web_library-${version}.zip`;
  const outZip = path.join(BUILD_DIR, zipName);

  // 清理并重建构建目录；staging 拷贝时排除 build/ 自身
  fs.rmSync(BUILD_DIR, { recursive: true, force: true });
  const stagingDir = path.join(BUILD_DIR, 'staging');
  copyTree(IOS_LIB_DIR, path.join(stagingDir, 'ios_web_library'));

  console.log(`[Build] Creating ${zipName}...`);
  createZip(path.join(stagingDir, 'ios_web_library'), outZip);

  // 清理 staging
  fs.rmSync(stagingDir, { recursive: true, force: true });

  const size = fs.statSync(outZip).size;
  console.log('[Build] iOS build completed successfully.');
  console.log(`  Artifact: ${outZip} (${(size / 1024).toFixed(1)} KB)`);
} catch (error) {
  console.error('[Build] iOS build failed:', error.message);
  process.exit(1);
}
