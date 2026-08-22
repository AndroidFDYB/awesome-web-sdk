import { hapTasks } from '@ohos/hvigor-ohos-plugin';
import { dataSyncBindingsPlugin } from '../hvigor-plugins/data-sync-bindings-plugin';

export default {
  system: hapTasks, /* Built-in plugin of Hvigor. It cannot be modified. */
  plugins: [dataSyncBindingsPlugin()]  /* 数据同步装饰器扫描 → 生成 DataSyncBindings.ets */
}