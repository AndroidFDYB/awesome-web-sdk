import { IMPBridge } from './types';
/**
 * 获取 MPBridge 单例
 */
export declare function getBridge(): IMPBridge;
/**
 * 重置实例（用于测试或环境变化时）
 */
export declare function resetBridge(): void;
