const y = {
  USER_INFO: "userInfo",
  LOAN_INFO: "loanInfo",
  VIP_INFO: "vipInfo"
}, b = [
  {
    name: y.USER_INFO,
    nativeMethod: "syncUserInfo",
    injectTo: "headers",
    headerMap: { uid: "X-Uid", ticket: "X-Ticket" },
    timeout: 1e4
  },
  {
    name: y.LOAN_INFO,
    nativeMethod: "syncLoanInfo",
    injectTo: "body",
    timeout: 1e4
  },
  {
    name: y.VIP_INFO,
    nativeMethod: "syncVipInfo",
    injectTo: "body",
    timeout: 1e4
  }
];
class M {
  constructor(e, t) {
    this.state = { data: null, ready: !1, arrivedAt: null }, this.waiters = [], this.config = e, this.managerConfig = t;
  }
  /** 获取当前数据 */
  getData() {
    return this.state.data;
  }
  /** 数据是否已就绪 */
  isReady() {
    return this.state.ready;
  }
  /**
   * 等待数据到达
   * 如果数据已缓存，立即 resolve
   * 否则加入等待队列，在 pushData 到达或超时后 resolve/reject
   */
  waitForData(e) {
    if (this.state.ready)
      return Promise.resolve(this.state.data);
    const t = e ?? this.config.timeout ?? this.managerConfig.defaultTimeout ?? 1e4;
    return new Promise((r, a) => {
      const i = {
        resolve: r,
        reject: a,
        timer: null
      };
      t > 0 && (i.timer = setTimeout(() => {
        const s = this.waiters.indexOf(i);
        s >= 0 && this.waiters.splice(s, 1), a(new Error(`[DataSync] Channel "${this.config.name}" timed out after ${t}ms`));
      }, t)), this.waiters.push(i), this.debug(`Waiting for data on channel "${this.config.name}" (timeout: ${t}ms, ${this.waiters.length} waiters)`);
    });
  }
  /**
   * 推入数据，唤醒所有等待者
   * 由 Native 通过 JSBridge 调用后触发
   */
  pushData(e) {
    this.state = {
      data: e,
      ready: !0,
      arrivedAt: Date.now()
    }, this.debug(`Data arrived on channel "${this.config.name}", waking up ${this.waiters.length} waiters`);
    const t = this.waiters.splice(0);
    for (const r of t)
      r.timer && clearTimeout(r.timer), r.resolve(e);
  }
  /** 清除数据（用于重新同步场景） */
  clearData() {
    this.state = { data: null, ready: !1, arrivedAt: null }, this.debug(`Data cleared on channel "${this.config.name}"`);
  }
  /** 获取等待者数量 */
  getWaiterCount() {
    return this.waiters.length;
  }
  debug(e) {
    this.managerConfig.debug && console.log(`[DataSync:${this.managerConfig.logTag ?? "MPBridge"}] ${e}`);
  }
}
class B {
  constructor(e = {}) {
    this.channels = /* @__PURE__ */ new Map(), this.config = {
      defaultTimeout: 1e4,
      debug: !1,
      logTag: "MPBridge",
      ...e
    };
    for (const t of b)
      this.registerChannel(t);
  }
  /**
   * 注册数据通道
   * 如果通道已存在，将更新其配置
   */
  registerChannel(e) {
    this.channels.has(e.name) && this.debug(`Channel "${e.name}" already registered, updating config`), this.channels.set(e.name, new M(e, this.config)), this.debug(`Registered channel "${e.name}" (nativeMethod: ${e.nativeMethod}, injectTo: ${e.injectTo ?? "body"})`);
  }
  /** 获取通道配置 */
  getChannelConfig(e) {
    var t;
    return (t = this.channels.get(e)) == null ? void 0 : t.config;
  }
  /** 获取所有已注册的通道配置 */
  getAllChannelConfigs() {
    return Array.from(this.channels.values()).map((e) => e.config);
  }
  /**
   * 推送数据到指定通道
   * 通常由 Native → JSBridge Handler 调用
   */
  pushData(e, t) {
    const r = this.channels.get(e);
    if (!r) {
      console.warn(`[DataSync] Channel "${e}" not registered. Call registerChannel() first.`);
      return;
    }
    r.pushData(t);
  }
  /**
   * 等待指定通道的数据
   * 如果数据已到达，立即返回
   * 否则阻塞直到数据到达或超时
   */
  waitForData(e, t) {
    const r = this.channels.get(e);
    return r ? r.waitForData(t) : Promise.reject(new Error(`[DataSync] Channel "${e}" not registered`));
  }
  /** 获取指定通道的当前数据 */
  getData(e) {
    const t = this.channels.get(e);
    return (t == null ? void 0 : t.getData()) ?? null;
  }
  /** 检查指定通道的数据是否已就绪 */
  isReady(e) {
    const t = this.channels.get(e);
    return (t == null ? void 0 : t.isReady()) ?? !1;
  }
  /** 清除指定通道的数据（用于重新同步） */
  clearData(e) {
    const t = this.channels.get(e);
    t == null || t.clearData();
  }
  /** 清除所有通道数据 */
  clearAllData() {
    this.channels.forEach((e) => e.clearData());
  }
  /**
   * 批量等待多个通道数据
   * 所有通道数据就绪后返回
   */
  async waitForAll(e, t) {
    const r = await Promise.all(
      e.map(async (a) => {
        const i = await this.waitForData(a, t);
        return [a, i];
      })
    );
    return Object.fromEntries(r);
  }
  /** 获取指定通道的等待者数量 */
  getWaiterCount(e) {
    const t = this.channels.get(e);
    return (t == null ? void 0 : t.getWaiterCount()) ?? 0;
  }
  debug(e) {
    this.config.debug && console.log(`[DataSync:${this.config.logTag}] ${e}`);
  }
}
let l = null;
function h(n) {
  return l ? n && Object.assign(l.config, n) : l = new B(n), l;
}
function V() {
  l = null;
}
const T = "platform", $ = ["android", "harmony", "web"];
function A() {
  if (typeof window > "u" || !window.location)
    return null;
  const e = new URLSearchParams(window.location.search).get(T);
  return e && $.includes(e) ? e : null;
}
function D() {
  if (typeof window > "u")
    return "unknown";
  const n = window;
  return n.WebViewJavascriptBridge ? "android" : n.__harmony_bridge && n.dsBridge ? "harmony" : "web";
}
function m() {
  const n = A();
  return n || D();
}
function k() {
  const n = m();
  return n === "android" || n === "harmony";
}
function U() {
  var e;
  const n = typeof window < "u" ? window : null;
  return {
    urlPlatform: A(),
    windowPlatform: D(),
    finalPlatform: m(),
    hasAndroidBridge: !!(n != null && n.WebViewJavascriptBridge),
    hasHarmonyBridge: !!(n != null && n.__harmony_bridge && (n != null && n.dsBridge)),
    url: ((e = n == null ? void 0 : n.location) == null ? void 0 : e.href) ?? null
  };
}
function j() {
  if (typeof window > "u")
    return { platform: "unknown", bridgeType: "none" };
  const n = window;
  return n.WebViewJavascriptBridge ? { platform: "android", bridgeType: "android-jsbridge" } : n.__harmony_bridge && n.dsBridge ? { platform: "harmony", bridgeType: "harmony-dsbridge" } : { platform: "web", bridgeType: "none" };
}
function P(n) {
  const e = window;
  if (e.WebViewJavascriptBridge) {
    n(e.WebViewJavascriptBridge);
    return;
  }
  const t = (r) => {
    n(e.WebViewJavascriptBridge), document.removeEventListener("WebViewJavascriptBridgeReady", t);
  };
  document.addEventListener("WebViewJavascriptBridgeReady", t, !1);
}
class I {
  constructor(e) {
    this.registeredMethods = /* @__PURE__ */ new Set(), this.bridge = e;
  }
  /** 调用 Native Handler */
  callHandler(e, t, r) {
    const a = typeof t == "string" ? t : JSON.stringify(t ?? {});
    this.bridge.callHandler(e, a, r);
  }
  /** 注册 JS Handler */
  registerHandler(e, t) {
    this.bridge.registerHandler(e, t), this.registeredMethods.add(e);
  }
  hasMethod(e) {
    return this.registeredMethods.has(e);
  }
}
class N {
  constructor(e) {
    this.bridge = e;
  }
  call(e, t) {
    return this.bridge.call(e, t);
  }
  callAsync(e, t, r) {
    this.bridge.callAsync(e, t, r);
  }
  register(e, t) {
    this.bridge.register(e, t);
  }
  registerAsyn(e, t) {
    this.bridge.registerAsyn(e, t);
  }
  hasMethod(e) {
    return this.bridge.hasMethod(e);
  }
}
class R {
  constructor() {
    this.androidAdapter = null, this.harmonyAdapter = null, this.jsHandlers = /* @__PURE__ */ new Map(), this.jsAsyncHandlers = /* @__PURE__ */ new Map(), this.ready = !1, this.pendingCalls = [], this.detectResult = j(), this.initBridge();
  }
  initBridge() {
    const { platform: e, bridgeType: t } = this.detectResult, r = typeof window < "u" ? window : null;
    t === "android-jsbridge" && (r != null && r.WebViewJavascriptBridge) ? P((a) => {
      this.androidAdapter = new I(a), this.onReady();
    }) : t === "harmony-dsbridge" && (r != null && r.dsBridge) ? (this.harmonyAdapter = new N(r.dsBridge), this.onReady()) : this.ready = !0;
  }
  onReady() {
    this.ready = !0, this.jsHandlers.forEach((e, t) => {
      this.registerToNative(t, e, !1);
    }), this.jsAsyncHandlers.forEach((e, t) => {
      this.registerToNative(t, e, !0);
    }), H(), this.pendingCalls.forEach((e) => e()), this.pendingCalls = [];
  }
  getPlatform() {
    return m();
  }
  hasNativeBridge() {
    return this.androidAdapter !== null || this.harmonyAdapter !== null;
  }
  /**
   * 同步调用 Native 方法
   * 注意：Android JsBridge 只支持异步回调，同步调用仅鸿蒙端支持
   */
  call(e, t) {
    return this.ready ? this.harmonyAdapter ? this.harmonyAdapter.call(e, t) : this.androidAdapter ? (console.warn("[MPBridge] Android JsBridge does not support synchronous calls. Use callAsync instead."), null) : (console.warn(`[MPBridge] No native bridge. Cannot call "${e}". Platform: ${this.detectResult.platform}`), null) : (console.warn(`[MPBridge] Bridge not ready. Queuing call to "${e}".`), null);
  }
  /**
   * 异步调用 Native 方法（返回 Promise）
   */
  callAsync(e, t) {
    return new Promise((r) => {
      const a = () => {
        if (this.androidAdapter) {
          this.androidAdapter.callHandler(e, t, (i) => {
            try {
              r(JSON.parse(i));
            } catch {
              r(i);
            }
          });
          return;
        }
        if (this.harmonyAdapter) {
          this.harmonyAdapter.callAsync(e, t, (i) => {
            r(i);
          });
          return;
        }
        console.warn(`[MPBridge] No native bridge. Cannot callAsync "${e}".`), r(null);
      };
      this.ready ? a() : this.pendingCalls.push(a);
    });
  }
  /**
   * 注册同步方法供 Native 调用
   */
  register(e, t) {
    if (typeof t == "function")
      this.jsHandlers.set(e, t);
    else {
      const r = t;
      for (const a of Object.keys(r))
        typeof r[a] == "function" && this.jsHandlers.set(`${e}.${a}`, r[a]);
    }
    this.ready && this.registerToNative(e, t, !1);
  }
  /**
   * 注册异步方法供 Native 调用
   */
  registerAsyn(e, t) {
    if (typeof t == "function")
      this.jsAsyncHandlers.set(e, t);
    else {
      const r = t;
      for (const a of Object.keys(r))
        typeof r[a] == "function" && this.jsAsyncHandlers.set(`${e}.${a}`, r[a]);
    }
    this.ready && this.registerToNative(e, t, !0);
  }
  hasMethod(e) {
    return this.jsHandlers.has(e) || this.jsAsyncHandlers.has(e) ? !0 : this.androidAdapter ? this.androidAdapter.hasMethod(e) : this.harmonyAdapter ? this.harmonyAdapter.hasMethod(e) : !1;
  }
  /**
   * 将 handler 注册到原生桥
   */
  registerToNative(e, t, r) {
    this.androidAdapter && typeof t == "function" ? this.androidAdapter.registerHandler(e, (a, i) => {
      let s;
      try {
        s = JSON.parse(a);
      } catch {
        s = a;
      }
      if (r)
        t(s, (o) => {
          i(typeof o == "string" ? o : JSON.stringify(o));
        });
      else {
        const o = t(s);
        i(typeof o == "string" ? o : JSON.stringify(o));
      }
    }) : this.harmonyAdapter && (r ? this.harmonyAdapter.registerAsyn(e, t) : this.harmonyAdapter.register(e, t));
  }
}
let u = null;
function S() {
  return u || (u = new R()), u;
}
function O() {
  u = null, p = !1;
}
let p = !1;
function H() {
  if (p) return;
  const n = S();
  for (const e of b) {
    const t = e.name, r = e.nativeMethod;
    n.register(r, (a) => {
      let i = a;
      if (typeof a == "string")
        try {
          i = JSON.parse(a);
        } catch {
          i = a;
        }
      return h().pushData(t, i), { success: !0, channel: t };
    });
  }
  p = !0;
}
const d = [];
function _(n) {
  d.push(n);
}
function C() {
  return d.pop();
}
function F() {
  return d.length > 0 ? [...d[d.length - 1]] : [];
}
function E(n, e) {
  if (!n || !e) return !1;
  const t = e.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "###GLOBSTAR###").replace(/\*/g, "[^/]*").replace(/###GLOBSTAR###/g, ".*");
  return new RegExp(`^${t}(/.*)?$`).test(n);
}
function W(n, e, t) {
  if (t == null) return;
  if (typeof e.inject == "function") {
    e.inject(n, t);
    return;
  }
  switch (e.injectTo ?? "body") {
    case "headers": {
      n.headers || (n.headers = {});
      const a = e.headerMap;
      if (a && typeof t == "object")
        for (const [i, s] of Object.entries(a))
          t[i] != null && (n.headers[s] = String(t[i]));
      else typeof t == "object" ? Object.assign(n.headers, t) : n.headers[e.name] = String(t);
      break;
    }
    case "params": {
      n.params || (n.params = {}), typeof t == "object" ? Object.assign(n.params, t) : n.params[e.name] = t;
      break;
    }
    case "body":
    default: {
      typeof t == "object" && t !== null ? typeof n.data == "object" && n.data !== null ? Object.assign(n.data, t) : n.data == null ? n.data = { ...t } : n.data = { _original: n.data, ...t } : n.data = t;
      break;
    }
  }
}
function J(n) {
  const e = h(), t = n.enableDecoratorContext !== !1;
  return async function(a) {
    const i = /* @__PURE__ */ new Set();
    if (t) {
      const s = F();
      for (const o of s)
        i.add(o);
    }
    if (n.routes && a.url) {
      for (const [s, o] of Object.entries(n.routes))
        if (E(a.url, s))
          for (const c of o)
            i.add(c);
    }
    for (const s of i) {
      const o = n.channels[s];
      if (o)
        try {
          const c = await e.waitForData(s, o.timeout);
          W(a, o, c);
        } catch (c) {
          console.warn(
            `[DataSync] Failed to get data for channel "${s}":`,
            c == null ? void 0 : c.message
          );
        }
    }
    return a;
  };
}
function q(n, e) {
  const t = J(e);
  return n.interceptors.request.use(t);
}
const w = /* @__PURE__ */ new WeakMap();
function L(n, e, t) {
  let r = w.get(n);
  r || (r = /* @__PURE__ */ new Map(), w.set(n, r));
  const a = r.get(e) || [];
  return a.includes(t) || a.push(t), r.set(e, a), a;
}
function v(n, e) {
  const t = w.get(n);
  return (t == null ? void 0 : t.get(e)) || [];
}
function f(n) {
  return function(e, t, r) {
    L(e, t, n);
    const a = r.value;
    return r.value = async function(...i) {
      const s = h(), o = v(e, t);
      for (const c of o)
        try {
          await s.waitForData(c);
        } catch (g) {
          console.warn(
            `[DataSync] Decorator: channel "${c}" wait failed:`,
            g == null ? void 0 : g.message
          );
        }
      _(o);
      try {
        return await a.apply(this, i);
      } finally {
        C();
      }
    }, Object.defineProperty(r.value, "name", {
      value: a.name,
      writable: !1
    }), r;
  };
}
const G = f("userInfo"), Q = f("loanInfo"), X = f("vipInfo");
function Y(n, e) {
  return v(n, e);
}
function z(n) {
  return h().registerChannel(n), f(n.name);
}
const K = S();
export {
  B as DataSyncManager,
  T as PLATFORM_QUERY_KEY,
  y as STANDARD_CHANNELS,
  b as STANDARD_CHANNEL_CONFIGS,
  K as bridge,
  J as createDataSyncInterceptor,
  z as createWaitDecorator,
  A as detectPlatformFromUrl,
  D as detectPlatformFromWindow,
  S as getBridge,
  h as getDataSyncManager,
  Y as getMethodWaitChannels,
  m as getPlatform,
  U as getPlatformDebugInfo,
  m as getPlatformFromUrl,
  W as injectDataToConfig,
  k as isNativeEnvironment,
  E as matchUrlPattern,
  O as resetBridge,
  V as resetDataSyncManager,
  H as setupDataSyncHandlers,
  q as setupDataSyncInterceptor,
  f as waitDataSync,
  Q as waitLoanInfoSync,
  G as waitUserInfoSync,
  X as waitVipInfoSync
};
