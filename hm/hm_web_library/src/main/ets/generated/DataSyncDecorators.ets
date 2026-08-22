// AUTO-GENERATED from proto. DO NOT EDIT.
//
// 鸿蒙端数据同步装饰器系统
//
// 对标 Android KSP 注解方案，使用 ArkTS 类装饰器声明页面所需的数据通道。
// 装饰器在运行时将 className → channels 映射注册到 DecoratorRegistry，
// DataSyncHelper.create() 工厂方法从中读取，实现零手动传参。
//
// 可选增强：hvigor 插件在编译期扫描装饰器，生成静态 DataSyncBindings.ets，
// 提供编译期查表能力（无需运行时注册）。

import { DataSyncChannel } from './DataSyncChannels';

// ============================================================
// 运行时装饰器注册表
// ============================================================

/**
 * 装饰器元数据注册表
 *
 * 存储类装饰器注册的数据通道映射。
 * 导出为 class（非全局变量），符合 ArkTS 严格模式要求。
 */
export class DecoratorRegistry {
  /** className → 所需通道数组 */
  private static registry: Map<string, string[]> = new Map<string, string[]>();

  /**
   * 注册一个类的数据通道
   * @param className 类名（constructor.name 或 struct 名）
   * @param channels 所需数据通道数组
   */
  static register(className: string, channels: string[]): void {
    DecoratorRegistry.registry.set(className, channels);
  }

  /**
   * 查询一个类的数据通道
   * @param className 类名
   * @returns 所需通道数组，未注册时返回空数组
   */
  static getChannels(className: string): string[] {
    return DecoratorRegistry.registry.get(className) ?? [];
  }

  /** 获取所有已注册的类名 */
  static getRegisteredClasses(): string[] {
    return Array.from(DecoratorRegistry.registry.keys());
  }

  /** 清空注册表（测试用） */
  static clear(): void {
    DecoratorRegistry.registry.clear();
  }
}

// ============================================================
// 通用装饰器：@NeedsDataSync([...channels])
// ============================================================

/**
 * 声明组件/页面需要哪些数据同步通道
 *
 * 类装饰器，将 className → channels 映射注册到 DecoratorRegistry。
 * DataSyncHelper.create() 会自动从注册表中读取。
 *
 * @param channels 所需数据通道名数组
 * @returns 类装饰器函数
 */
export function NeedsDataSync(channels: string[]): ClassDecorator {
  return function <T extends Function>(target: T): void {
    DecoratorRegistry.register(target.name, channels);
  };
}

// ============================================================
// 标准通道快捷装饰器（由 proto codegen 自动生成）
// ============================================================

/**
 * 声明需要 - 字段编号从 1 开始连续递增
 * 等价于 @NeedsDataSync([DataSyncChannel.USER_INFO])
 */
export function NeedsUserInfo<T extends Function>(target: T): void {
  const existing: string[] = DecoratorRegistry.getChannels(target.name);
  if (!existing.includes(DataSyncChannel.USER_INFO)) {
    existing.push(DataSyncChannel.USER_INFO);
  }
  DecoratorRegistry.register(target.name, existing);
}

/**
 * 声明需要 LoanInfo 数据通道
 * 等价于 @NeedsDataSync([DataSyncChannel.LOAN_INFO])
 */
export function NeedsLoanInfo<T extends Function>(target: T): void {
  const existing: string[] = DecoratorRegistry.getChannels(target.name);
  if (!existing.includes(DataSyncChannel.LOAN_INFO)) {
    existing.push(DataSyncChannel.LOAN_INFO);
  }
  DecoratorRegistry.register(target.name, existing);
}

/**
 * 声明需要 VipInfo 数据通道
 * 等价于 @NeedsDataSync([DataSyncChannel.VIP_INFO])
 */
export function NeedsVipInfo<T extends Function>(target: T): void {
  const existing: string[] = DecoratorRegistry.getChannels(target.name);
  if (!existing.includes(DataSyncChannel.VIP_INFO)) {
    existing.push(DataSyncChannel.VIP_INFO);
  }
  DecoratorRegistry.register(target.name, existing);
}

/**
 * 声明需要 LeadInfo 数据通道
 * 等价于 @NeedsDataSync([DataSyncChannel.LEAD_INFO])
 */
export function NeedsLeadInfo<T extends Function>(target: T): void {
  const existing: string[] = DecoratorRegistry.getChannels(target.name);
  if (!existing.includes(DataSyncChannel.LEAD_INFO)) {
    existing.push(DataSyncChannel.LEAD_INFO);
  }
  DecoratorRegistry.register(target.name, existing);
}
