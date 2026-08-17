function l() {
  if (typeof window > "u") return "unknown";
  const r = window;
  return r._dsbridge || r.dsBridge ? r.__harmony_bridge ? "harmony" : "android" : "web";
}
function a() {
  if (typeof window > "u") return null;
  const r = window;
  return r.dsBridge && typeof r.dsBridge.call == "function" ? r.dsBridge : null;
}
class o {
  constructor() {
    this.nativeBridge = null, this.platform = "unknown", this.jsHandlers = /* @__PURE__ */ new Map(), this.jsAsyncHandlers = /* @__PURE__ */ new Map(), this.platform = l(), this.nativeBridge = a();
  }
  getPlatform() {
    return this.platform;
  }
  hasNativeBridge() {
    return this.nativeBridge !== null;
  }
  /**
   * 同步调用 Native 方法
   */
  call(i, t) {
    if (!this.nativeBridge)
      return console.warn(`[MPBridge] No native bridge available. Cannot call "${i}". Platform: ${this.platform}`), null;
    try {
      return this.nativeBridge.call(i, t);
    } catch (n) {
      return console.error(`[MPBridge] call "${i}" failed:`, n), null;
    }
  }
  /**
   * 异步调用 Native 方法（Promise 或回调形式）
   */
  callAsync(i, t) {
    return new Promise((n) => {
      if (!this.nativeBridge) {
        console.warn(`[MPBridge] No native bridge available. Cannot callAsync "${i}". Platform: ${this.platform}`), n(null);
        return;
      }
      try {
        this.nativeBridge.call(i, t ?? {}, (e) => {
          n(e);
        });
      } catch (e) {
        console.error(`[MPBridge] callAsync "${i}" failed:`, e), n(null);
      }
    });
  }
  /**
   * 注册同步方法供 Native 调用
   * 支持两种调用方式：
   * - register(method, handler) - 注册单个方法
   * - register(namespace, apiObject) - 注册命名空间
   */
  register(i, t) {
    if (typeof t == "function")
      this.jsHandlers.set(i, t);
    else {
      const n = t;
      for (const e of Object.keys(n))
        typeof n[e] == "function" && this.jsHandlers.set(`${i}.${e}`, n[e]);
    }
    if (this.nativeBridge)
      try {
        this.nativeBridge.register(i, t);
      } catch {
      }
  }
  /**
   * 注册异步方法供 Native 调用
   */
  registerAsyn(i, t) {
    if (typeof t == "function")
      this.jsAsyncHandlers.set(i, t);
    else {
      const n = t;
      for (const e of Object.keys(n))
        typeof n[e] == "function" && this.jsAsyncHandlers.set(`${i}.${e}`, n[e]);
    }
    if (this.nativeBridge)
      try {
        this.nativeBridge.registerAsyn(i, t);
      } catch {
      }
  }
  hasMethod(i) {
    if (this.jsHandlers.has(i) || this.jsAsyncHandlers.has(i))
      return !0;
    if (this.nativeBridge)
      try {
        return this.nativeBridge.hasMethod(i);
      } catch {
        return !1;
      }
    return !1;
  }
}
let s = null;
function f() {
  return s || (s = new o()), s;
}
function u() {
  s = null;
}
const c = f();
export {
  c as bridge,
  f as getBridge,
  u as resetBridge
};
