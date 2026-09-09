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
 * 校验文件是否为真正的 zip 归档（魔数 PK\x03\x04）
 *
 * 用于识破"命令执行成功但产出格式错误"的情况——例如 Linux 上的 GNU tar
 * 并不支持写出 zip 格式，`tar -a -cf x.zip` 可能静默产出未压缩的 tar 归档。
 */
function isZipArchive(file) {
  if (!fs.existsSync(file)) return false;
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(4);
    const bytesRead = fs.readSync(fd, buf, 0, 4, 0);
    return bytesRead === 4
      && buf[0] === 0x50 && buf[1] === 0x4b   // 'P' 'K'
      && buf[2] === 0x03 && buf[3] === 0x04;
  } catch (e) {
    return false;
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * 将目录打包为 zip（目录名作为 zip 内的顶层目录）
 *
 * 候选工具按平台排序，每次尝试后校验产物魔数，不合格则删除并继续回退：
 * - Linux：`zip` 命令优先（GNU tar 不能写出 zip 格式）
 * - Windows / macOS：bsdtar 优先（`-a` 按后缀写出 zip），PowerShell 次之
 *
 * 所有候选统一使用 cwd + 目录名的方式打包，保证 zip 内顶层目录为 ios_web_library，
 * 而非调用方的绝对路径层级。
 */
function createZip(folderToZip, outZip) {
  const parentDir = path.dirname(folderToZip);
  const baseName = path.basename(folderToZip);
  const isLinux = process.platform === 'linux';
  const shellExe = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';

  const candidates = [
    {
      name: 'tar -a',
      preferred: !isLinux,
      run: () => execFileSync('tar', [
        '-a', '-cf', outZip,
        '-C', parentDir,
        baseName,
      ], { stdio: 'inherit' }),
    },
    {
      name: `${shellExe} Compress-Archive`,
      preferred: false,
      run: () => execFileSync(shellExe, [
        '-NoProfile', '-Command',
        `Compress-Archive -Path \"${folderToZip}\" -DestinationPath \"${outZip}\" -Force`,
      ], { stdio: 'inherit' }),
    },
    {
      name: 'zip -r',
      preferred: isLinux,
      run: () => execFileSync('zip', ['-r', '-q', outZip, baseName], {
        cwd: parentDir,
        stdio: 'inherit',
      }),
    },
  ];

  // 平台首选工具排到最前（sort 为稳定排序，同级保持声明顺序）
  candidates.sort((a, b) => Number(b.preferred) - Number(a.preferred));

  for (const candidate of candidates) {
    fs.rmSync(outZip, { force: true });
    try {
      console.log(`  Trying packer: ${candidate.name}`);
      candidate.run();
    } catch (e) {
      console.warn(`  ${candidate.name} unavailable: ${e.message}`);
      continue;
    }
    if (isZipArchive(outZip)) {
      console.log(`  Packed with ${candidate.name}.`);
      return;
    }
    console.warn(`  ${candidate.name} did not produce a valid zip (magic number check failed), falling back...`);
    fs.rmSync(outZip, { force: true });
  }

  console.error('[Build] ERROR: All zip packing strategies failed to produce a valid zip archive.');
  process.exit(1);
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
