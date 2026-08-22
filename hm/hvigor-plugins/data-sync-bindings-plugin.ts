/**
 * hvigor 插件：数据同步绑定生成器
 *
 * 在鸿蒙端 entry 模块编译前，扫描所有 .ets 文件中使用
 * @NeedsDataSync / @NeedsUserInfo / @NeedsLoanInfo / @NeedsVipInfo 装饰器的页面，
 * 自动生成 DataSyncBindings.ets（静态绑定注册表）。
 *
 * 对标 Android KSP 的编译期注解处理（DataSyncSymbolProcessor），
 * 实现鸿蒙端的"装饰器 → 编译期绑定"机制。
 *
 * 注册方式（entry/hvigorfile.ts）：
 * ```typescript
 * import { hapTasks } from '@ohos/hvigor-ohos-plugin';
 * import { dataSyncBindingsPlugin } from '../hvigor-plugins/data-sync-bindings-plugin';
 *
 * export default {
 *   system: hapTasks,
 *   plugins: [dataSyncBindingsPlugin()]
 * }
 * ```
 *
 * 工作原理：
 * 1. 在 hvigor 构建开始前（preBuild 阶段）触发
 * 2. 通过 child_process 调用 node scripts/scan-decorators-harmony.js
 * 3. 扫描 entry 模块的 .ets 文件，解析装饰器
 * 4. 生成 DataSyncBindings.ets 到 hm_web_library/generated/ 目录
 * 5. ArkTS 编译器在后续阶段编译此文件，实现编译期绑定
 */

import { execSync } from 'child_process';
import * as path from 'path';

/**
 * 创建数据同步绑定 hvigor 插件
 *
 * @param options 插件配置
 * @param options.projectRoot 项目根目录（默认为 hm/ 目录的父目录）
 * @returns hvigor 插件对象
 */
export function dataSyncBindingsPlugin(options?: {
  projectRoot?: string;
}): Record<string, unknown> {
  const projectRoot = options?.projectRoot ?? path.resolve(__dirname, '..');

  return {
    pluginName: 'data-sync-bindings-plugin',
    apply(pluginContext: Record<string, any>): void {
      // 注册 preBuild 阶段钩子
      // 在 ArkTS 编译前执行装饰器扫描，确保 DataSyncBindings.ets 就绪
      if (typeof pluginContext.registerTask === 'function') {
        pluginContext.registerTask({
        name: 'scanDecorators',
        run: () => {
          const scriptPath = path.join(projectRoot, 'scripts', 'scan-decorators-harmony.js');
          console.log('[hvigor/data-sync-bindings] Running decorator scan...');
          try {
            execSync(`node "${scriptPath}"`, {
              cwd: projectRoot,
              stdio: 'inherit',
            });
            console.log('[hvigor/data-sync-bindings] DataSyncBindings.ets generated successfully.');
          } catch (error) {
            console.error('[hvigor/data-sync-bindings] Failed to generate DataSyncBindings.ets:', error);
            throw error;
          }
        },
        // 依赖关系：在 ArkTS 编译之前执行
        dependencies: [],
      });
      }
    },
  };
}
