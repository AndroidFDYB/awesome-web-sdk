/**
 * 鸿蒙 HAR 构建脚本
 *
 * 使用鸿蒙 SDK 的 hvigor 构建工具编译 hm_web_library 模块
 * 跨平台兼容（Node.js 脚本）
 */

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const HM_DIR = path.join(ROOT, 'hm');

// 鸿蒙 SDK 路径
const HOS_SDK = process.env.HOS_SDK_HOME || 'D:\\software\\DevEco Studio\\sdk\\default';

// hvigor 构建工具路径（鸿蒙工程的 hvigorw）
const isWindows = process.platform === 'win32';
const hvigorCmd = isWindows ? 'hvigorw.bat' : './hvigorw';

console.log('[Build] HarmonyOS - Building hm_web_library HAR...');
console.log(`  HM_DIR: ${HM_DIR}`);
console.log(`  HOS_SDK: ${HOS_SDK}`);

try {
  // 执行鸿蒙构建
  // 使用 hvigor 的 assembleHar 任务构建 HAR 库
  const args = [
    '--mode', 'module',
    '-p', 'module=hm_web_library@default',
    'assembleHar',
    '--no-daemon'
  ];

  console.log(`  Running: ${hvigorCmd} ${args.join(' ')}`);
  execFileSync(hvigorCmd, args, {
    cwd: HM_DIR,
    stdio: 'inherit',
    env: {
      ...process.env,
      HOS_SDK_HOME: HOS_SDK,
    },
  });

  console.log('[Build] HarmonyOS build completed successfully.');
} catch (error) {
  console.error('[Build] HarmonyOS build failed:', error.message);
  console.error('  Please ensure:');
  console.error('  1. DevEco Studio SDK is installed at:', HOS_SDK);
  console.error('  2. hvigorw is available in the hm/ directory');
  console.error('  3. Set HOS_SDK_HOME environment variable if SDK is in a different location');
  process.exit(1);
}
