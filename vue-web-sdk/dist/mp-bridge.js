function l() {
  if (typeof window > "u")
    return { platform: "unknown", bridgeType: "none" };
  const s = window;
  return s.WebViewJavascriptBridge ? { platform: "android", bridgeType: "android-jsbridge" } : s.__harmony_bridge && s.dsBridge ? { platform: "harmony", bridgeType: "harmony-dsbridge" } : { platform: "web", bridgeType: "none" };
}
function h(s) {
  const e = window;
  if (e.WebViewJavascriptBridge) {
    s(e.WebViewJavascriptBridge);
    return;
  }
  const r = (t) => {
    s(e.WebViewJavascriptBridge), document.removeEventListener("WebViewJavascriptBridgeReady", r);
  };
  document.addEventListener("WebViewJavascriptBridgeReady", r, !1);
}
class g {
  constructor(e) {
    this.registeredMethods = /* @__PURE__ */ new Set(), this.bridge = e;
  }
  /** 调用 Native Handler */
  callHandler(e, r, t) {
    const i = typeof r == "string" ? r : JSON.stringify(r ?? {});
    this.bridge.callHandler(e, i, t);
  }
  /** 注册 JS Handler */
  registerHandler(e, r) {
    this.bridge.registerHandler(e, r), this.registeredMethods.add(e);
  }
  hasMethod(e) {
    return this.registeredMethods.has(e);
  }
}
class f {
  constructor(e) {
    this.bridge = e;
  }
  call(e, r) {
    return this.bridge.call(e, r);
  }
  callAsync(e, r, t) {
    this.bridge.callAsync(e, r, t);
  }
  register(e, r) {
    this.bridge.register(e, r);
  }
  registerAsyn(e, r) {
    this.bridge.registerAsyn(e, r);
  }
  hasMethod(e) {
    return this.bridge.hasMethod(e);
  }
}
class c {
  constructor() {
    this.androidAdapter = null, this.harmonyAdapter = null, this.jsHandlers = /* @__PURE__ */ new Map(), this.jsAsyncHandlers = /* @__PURE__ */ new Map(), this.ready = !1, this.pendingCalls = [], this.detectResult = l(), this.initBridge();
  }
  initBridge() {
    const { platform: e, bridgeType: r } = this.detectResult, t = typeof window < "u" ? window : null;
    r === "android-jsbridge" && (t != null && t.WebViewJavascriptBridge) ? h((i) => {
      this.androidAdapter = new g(i), this.onReady();
    }) : r === "harmony-dsbridge" && (t != null && t.dsBridge) ? (this.harmonyAdapter = new f(t.dsBridge), this.onReady()) : this.ready = !0;
  }
  onReady() {
    this.ready = !0, this.jsHandlers.forEach((e, r) => {
      this.registerToNative(r, e, !1);
    }), this.jsAsyncHandlers.forEach((e, r) => {
      this.registerToNative(r, e, !0);
    }), this.pendingCalls.forEach((e) => e()), this.pendingCalls = [];
  }
  getPlatform() {
    return this.detectResult.platform;
  }
  hasNativeBridge() {
    return this.androidAdapter !== null || this.harmonyAdapter !== null;
  }
  /**
   * 同步调用 Native 方法
   * 注意：Android JsBridge 只支持异步回调，同步调用仅鸿蒙端支持
   */
  call(e, r) {
    return this.ready ? this.harmonyAdapter ? this.harmonyAdapter.call(e, r) : this.androidAdapter ? (console.warn("[MPBridge] Android JsBridge does not support synchronous calls. Use callAsync instead."), null) : (console.warn(`[MPBridge] No native bridge. Cannot call "${e}". Platform: ${this.detectResult.platform}`), null) : (console.warn(`[MPBridge] Bridge not ready. Queuing call to "${e}".`), null);
  }
  /**
   * 异步调用 Native 方法（返回 Promise）
   */
  callAsync(e, r) {
    return new Promise((t) => {
      const i = () => {
        if (this.androidAdapter) {
          this.androidAdapter.callHandler(e, r, (d) => {
            try {
              t(JSON.parse(d));
            } catch {
              t(d);
            }
          });
          return;
        }
        if (this.harmonyAdapter) {
          this.harmonyAdapter.callAsync(e, r, (d) => {
            t(d);
          });
          return;
        }
        console.warn(`[MPBridge] No native bridge. Cannot callAsync "${e}".`), t(null);
      };
      this.ready ? i() : this.pendingCalls.push(i);
    });
  }
  /**
   * 注册同步方法供 Native 调用
   */
  register(e, r) {
    if (typeof r == "function")
      this.jsHandlers.set(e, r);
    else {
      const t = r;
      for (const i of Object.keys(t))
        typeof t[i] == "function" && this.jsHandlers.set(`${e}.${i}`, t[i]);
    }
    this.ready && this.registerToNative(e, r, !1);
  }
  /**
   * 注册异步方法供 Native 调用
   */
  registerAsyn(e, r) {
    if (typeof r == "function")
      this.jsAsyncHandlers.set(e, r);
    else {
      const t = r;
      for (const i of Object.keys(t))
        typeof t[i] == "function" && this.jsAsyncHandlers.set(`${e}.${i}`, t[i]);
    }
    this.ready && this.registerToNative(e, r, !0);
  }
  hasMethod(e) {
    return this.jsHandlers.has(e) || this.jsAsyncHandlers.has(e) ? !0 : this.androidAdapter ? this.androidAdapter.hasMethod(e) : this.harmonyAdapter ? this.harmonyAdapter.hasMethod(e) : !1;
  }
  /**
   * 将 handler 注册到原生桥
   */
  registerToNative(e, r, t) {
    this.androidAdapter && typeof r == "function" ? this.androidAdapter.registerHandler(e, (i, d) => {
      let a;
      try {
        a = JSON.parse(i);
      } catch {
        a = i;
      }
      if (t)
        r(a, (n) => {
          d(typeof n == "string" ? n : JSON.stringify(n));
        });
      else {
        const n = r(a);
        d(typeof n == "string" ? n : JSON.stringify(n));
      }
    }) : this.harmonyAdapter && (t ? this.harmonyAdapter.registerAsyn(e, r) : this.harmonyAdapter.register(e, r));
  }
}
let o = null;
function y() {
  return o || (o = new c()), o;
}
function u() {
  o = null;
}
const p = y();
export {
  p as bridge,
  y as getBridge,
  u as resetBridge
};
