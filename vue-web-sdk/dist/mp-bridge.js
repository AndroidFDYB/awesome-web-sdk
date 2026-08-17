const j = "platform", P = ["android", "harmony", "web"];
function D() {
  if (typeof window > "u" || !window.location)
    return null;
  const e = new URLSearchParams(window.location.search).get(j);
  return e && P.includes(e) ? e : null;
}
function M() {
  if (typeof window > "u")
    return "unknown";
  const n = window;
  return n.WebViewJavascriptBridge ? "android" : n.__harmony_bridge && n.dsBridge ? "harmony" : "web";
}
function A() {
  const n = D();
  return n || M();
}
function Y() {
  const n = A();
  return n === "android" || n === "harmony";
}
function K() {
  var e;
  const n = typeof window < "u" ? window : null;
  return {
    urlPlatform: D(),
    windowPlatform: M(),
    finalPlatform: A(),
    hasAndroidBridge: !!(n != null && n.WebViewJavascriptBridge),
    hasHarmonyBridge: !!(n != null && n.__harmony_bridge && (n != null && n.dsBridge)),
    url: ((e = n == null ? void 0 : n.location) == null ? void 0 : e.href) ?? null
  };
}
const Z = {
  UserInfo: "userInfo",
  LoanInfo: "loanInfo",
  VipInfo: "vipInfo"
}, T = [
  {
    name: "userInfo",
    nativeMethod: "syncUserInfo",
    injectTo: "headers",
    headerMap: { uid: "X-Uid", ticket: "X-Ticket" },
    timeout: 1e4
  },
  {
    name: "loanInfo",
    nativeMethod: "syncLoanInfo",
    injectTo: "body",
    timeout: 1e4
  },
  {
    name: "vipInfo",
    nativeMethod: "syncVipInfo",
    injectTo: "body",
    timeout: 1e4
  }
];
class N {
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
    return new Promise((r, i) => {
      const a = {
        resolve: r,
        reject: i,
        timer: null
      };
      t > 0 && (a.timer = setTimeout(() => {
        const s = this.waiters.indexOf(a);
        s >= 0 && this.waiters.splice(s, 1), i(new Error(`[DataSync] Channel "${this.config.name}" timed out after ${t}ms`));
      }, t)), this.waiters.push(a), this.debug(`Waiting for data on channel "${this.config.name}" (timeout: ${t}ms, ${this.waiters.length} waiters)`);
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
class E {
  constructor(e = {}) {
    this.channels = /* @__PURE__ */ new Map(), this.config = {
      defaultTimeout: 1e4,
      debug: !1,
      logTag: "MPBridge",
      ...e
    };
    for (const t of T)
      this.registerChannel(t);
  }
  /**
   * 注册数据通道
   * 如果通道已存在，将更新其配置
   */
  registerChannel(e) {
    this.channels.has(e.name) && this.debug(`Channel "${e.name}" already registered, updating config`), this.channels.set(e.name, new N(e, this.config)), this.debug(`Registered channel "${e.name}" (nativeMethod: ${e.nativeMethod}, injectTo: ${e.injectTo ?? "body"})`);
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
      e.map(async (i) => {
        const a = await this.waitForData(i, t);
        return [i, a];
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
let d = null;
function g(n) {
  return d ? n && Object.assign(d.config, n) : d = new E(n), d;
}
function x() {
  d = null;
}
function v() {
  const n = p();
  for (const e of T) {
    const t = e.name, r = e.nativeMethod;
    n.register(r, (i) => {
      let a = i;
      if (typeof i == "string")
        try {
          a = JSON.parse(i);
        } catch {
          a = i;
        }
      return g().pushData(t, a), { success: !0, channel: t };
    });
  }
}
const ee = {
  /** VIP 会员页面 */
  VIP: "vip",
  /** 借款页面 */
  LOAN: "loan",
  /** 线索页面 */
  LEAD: "lead",
  /** 通用页面 */
  COMMON: "common",
  /** Native 端（前端发给原生，Native 直接消费） */
  HOST: "host"
}, I = "postToNative", C = "postToWeb";
function S(n) {
  if (!n || typeof n != "string") return !1;
  const e = n.split(":");
  return e.length === 4 && e.every((t) => t.length > 0);
}
function te(n) {
  return S(n) ? n.split(":")[0] : null;
}
class H {
  constructor(e = !1) {
    this.handlers = /* @__PURE__ */ new Map(), this.transport = null, this.debug = !1, this.debug = e;
  }
  /**
   * 设置传输函数（由 bridge 在 onReady 时注入）
   *
   * 4级事件 emit 时通过此函数发送到 Native：
   * transport('vip:vipbuy:success:two', data) → bridge.callAsync('postToNative', { event, data })
   */
  setTransport(e) {
    this.transport = e, this.log("Transport function set");
  }
  /**
   * 注册事件监听器
   *
   * 支持4级格式事件（跨 WebView）和普通事件名（本地）。
   * 同一事件同一 handler 不会重复注册（Set 去重）。
   *
   * @param event 事件名（4级格式如 'vip:vipbuy:success:two' 或普通名如 'pageReady'）
   * @param handler 事件处理器
   */
  on(e, t) {
    if (typeof t != "function") {
      console.warn("[MPEmitter] handler must be a function");
      return;
    }
    this.handlers.has(e) || this.handlers.set(e, /* @__PURE__ */ new Set()), this.handlers.get(e).add(t), this.log(`on: "${e}", handler count: ${this.handlers.get(e).size}`);
  }
  /**
   * 移除事件监听器
   *
   * @param event 事件名
   * @param handler 要移除的处理器（必须与 on 注册时是同一引用）
   */
  off(e, t) {
    const r = this.handlers.get(e);
    r && (r.delete(t), r.size === 0 && this.handlers.delete(e), this.log(`off: "${e}", remaining handlers: ${r.size}`));
  }
  /**
   * 发射事件
   *
   * - 四级格式事件（如 'vip:vipbuy:success:two'）：通过 transport 发送给 Native，不本地分发
   *   Native 路由后通过 postToWeb 回传，由 dispatch 统一触发监听器
   * - 非四级格式事件（如 'pageReady'）：直接本地分发
   * - 若 transport 未设置（纯 Web 环境或 bridge 未就绪），4级事件降级为本地分发
   *
   * @param event 事件名
   * @param data 事件数据（可选）
   */
  emit(e, t) {
    S(e) ? this.transport ? (this.log(`emit (cross-webview): "${e}"`), this.transport(e, t)) : (this.log(`emit (cross-webview, no transport → local fallback): "${e}"`), this.dispatch(e, t)) : (this.log(`emit (local): "${e}"`), this.dispatch(e, t));
  }
  /**
   * 本地分发事件（触发所有监听器）
   *
   * 由 postToWeb Handler 调用（Native 转发的事件），也可直接用于本地事件。
   * 复制 handler 列表后遍历，避免迭代中 off 修改导致的问题。
   *
   * @param event 事件名
   * @param data 事件数据（可选）
   */
  dispatch(e, t) {
    const r = this.handlers.get(e);
    if (!r || r.size === 0) {
      this.log(`dispatch: no handlers for "${e}"`);
      return;
    }
    this.log(`dispatch: "${e}", calling ${r.size} handlers`);
    const i = Array.from(r);
    for (const a of i)
      try {
        a(t);
      } catch (s) {
        console.error(`[MPEmitter] Handler error for event "${e}":`, s);
      }
  }
  /**
   * 清除指定事件的所有监听器
   *
   * @param event 事件名
   */
  clearEvent(e) {
    this.handlers.delete(e), this.log(`clearEvent: "${e}"`);
  }
  /**
   * 清除所有监听器和引用（防止内存泄漏）
   *
   * 页面销毁时调用，确保所有 handler 引用被释放。
   */
  clear() {
    this.handlers.clear(), this.transport = null, this.log("All handlers and transport cleared");
  }
  /**
   * 获取指定事件的监听器数量
   */
  getListenerCount(e) {
    var t;
    return ((t = this.handlers.get(e)) == null ? void 0 : t.size) ?? 0;
  }
  /**
   * 获取所有已注册的事件名
   */
  getEvents() {
    return Array.from(this.handlers.keys());
  }
  log(e) {
    this.debug && console.log(`[MPEmitter] ${e}`);
  }
}
let c = null;
function $(n = !1) {
  return c || (c = new H(n)), c;
}
function R() {
  c && c.clear(), c = null;
}
function _() {
  if (typeof window > "u")
    return { platform: "unknown", bridgeType: "none" };
  const n = window;
  return n.WebViewJavascriptBridge ? { platform: "android", bridgeType: "android-jsbridge" } : n.__harmony_bridge && n.dsBridge ? { platform: "harmony", bridgeType: "harmony-dsbridge" } : { platform: "web", bridgeType: "none" };
}
function L(n) {
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
class W {
  constructor(e) {
    this.registeredMethods = /* @__PURE__ */ new Set(), this.bridge = e;
  }
  /** 调用 Native Handler */
  callHandler(e, t, r) {
    const i = typeof t == "string" ? t : JSON.stringify(t ?? {});
    this.bridge.callHandler(e, i, r);
  }
  /** 注册 JS Handler */
  registerHandler(e, t) {
    this.bridge.registerHandler(e, t), this.registeredMethods.add(e);
  }
  hasMethod(e) {
    return this.registeredMethods.has(e);
  }
}
class J {
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
class k {
  constructor() {
    this.androidAdapter = null, this.harmonyAdapter = null, this.jsHandlers = /* @__PURE__ */ new Map(), this.jsAsyncHandlers = /* @__PURE__ */ new Map(), this.ready = !1, this.pendingCalls = [], this.detectResult = _(), this.initBridge();
  }
  initBridge() {
    const { platform: e, bridgeType: t } = this.detectResult, r = typeof window < "u" ? window : null;
    t === "android-jsbridge" && (r != null && r.WebViewJavascriptBridge) ? L((i) => {
      this.androidAdapter = new W(i), this.onReady();
    }) : t === "harmony-dsbridge" && (r != null && r.dsBridge) ? (this.harmonyAdapter = new J(r.dsBridge), this.onReady()) : this.ready = !0;
  }
  onReady() {
    this.ready = !0, this.jsHandlers.forEach((e, t) => {
      this.registerToNative(t, e, !1);
    }), this.jsAsyncHandlers.forEach((e, t) => {
      this.registerToNative(t, e, !0);
    }), u || (v(), u = !0), w || (F(), w = !0), this.pendingCalls.forEach((e) => e()), this.pendingCalls = [];
  }
  getPlatform() {
    return A();
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
      const i = () => {
        if (this.androidAdapter) {
          this.androidAdapter.callHandler(e, t, (a) => {
            try {
              r(JSON.parse(a));
            } catch {
              r(a);
            }
          });
          return;
        }
        if (this.harmonyAdapter) {
          this.harmonyAdapter.callAsync(e, t, (a) => {
            r(a);
          });
          return;
        }
        console.warn(`[MPBridge] No native bridge. Cannot callAsync "${e}".`), r(null);
      };
      this.ready ? i() : this.pendingCalls.push(i);
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
      for (const i of Object.keys(r))
        typeof r[i] == "function" && this.jsHandlers.set(`${e}.${i}`, r[i]);
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
      for (const i of Object.keys(r))
        typeof r[i] == "function" && this.jsAsyncHandlers.set(`${e}.${i}`, r[i]);
    }
    this.ready && this.registerToNative(e, t, !0);
  }
  hasMethod(e) {
    return this.jsHandlers.has(e) || this.jsAsyncHandlers.has(e) ? !0 : this.androidAdapter ? this.androidAdapter.hasMethod(e) : this.harmonyAdapter ? this.harmonyAdapter.hasMethod(e) : !1;
  }
  /**
   * 调用 Native 页面跳转（透传 scheme 字符串）
   * 通过 JSBridge 将 scheme 字符串传递给 Native 端解析并执行跳转
   */
  async jump2Native(e) {
    if (!this.hasNativeBridge())
      return console.warn("[MPBridge/AppLink] No native bridge available. Cannot execute jump2Native."), { code: -2, message: "No native bridge available" };
    const t = await this.callAsync("jump2Native", { scheme: e });
    return t && typeof t == "object" && "code" in t ? t : { code: 0, message: "success" };
  }
  /**
   * 将 handler 注册到原生桥
   */
  registerToNative(e, t, r) {
    this.androidAdapter && typeof t == "function" ? this.androidAdapter.registerHandler(e, (i, a) => {
      let s;
      try {
        s = JSON.parse(i);
      } catch {
        s = i;
      }
      if (r)
        t(s, (o) => {
          a(typeof o == "string" ? o : JSON.stringify(o));
        });
      else {
        const o = t(s);
        a(typeof o == "string" ? o : JSON.stringify(o));
      }
    }) : this.harmonyAdapter && (r ? this.harmonyAdapter.registerAsyn(e, t) : this.harmonyAdapter.register(e, t));
  }
}
let f = null;
function p() {
  return f || (f = new k()), f;
}
function ne() {
  f = null, u = !1, w = !1, R();
}
let w = !1;
function F() {
  const n = p(), e = $();
  e.setTransport((t, r) => {
    n.callAsync(I, { event: t, data: r });
  }), n.register(C, (t) => {
    let r = t;
    if (typeof t == "string")
      try {
        r = JSON.parse(t);
      } catch {
        r = t;
      }
    return r && typeof r == "object" && "event" in r && e.dispatch(r.event, r.data), { success: !0 };
  });
}
let u = !1;
function re() {
  u || (v(), u = !0);
}
const h = [];
function V(n) {
  h.push(n);
}
function O() {
  return h.pop();
}
function U() {
  return h.length > 0 ? [...h[h.length - 1]] : [];
}
function z(n, e) {
  if (!n || !e) return !1;
  const t = e.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "###GLOBSTAR###").replace(/\*/g, "[^/]*").replace(/###GLOBSTAR###/g, ".*");
  return new RegExp(`^${t}(/.*)?$`).test(n);
}
function q(n, e, t) {
  if (t == null) return;
  if (typeof e.inject == "function") {
    e.inject(n, t);
    return;
  }
  switch (e.injectTo ?? "body") {
    case "headers": {
      n.headers || (n.headers = {});
      const i = e.headerMap;
      if (i && typeof t == "object")
        for (const [a, s] of Object.entries(i))
          t[a] != null && (n.headers[s] = String(t[a]));
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
function G(n) {
  const e = g(), t = n.enableDecoratorContext !== !1;
  return async function(i) {
    const a = /* @__PURE__ */ new Set();
    if (t) {
      const s = U();
      for (const o of s)
        a.add(o);
    }
    if (n.routes && i.url) {
      for (const [s, o] of Object.entries(n.routes))
        if (z(i.url, s))
          for (const l of o)
            a.add(l);
    }
    for (const s of a) {
      const o = n.channels[s];
      if (o)
        try {
          const l = await e.waitForData(s, o.timeout);
          q(i, o, l);
        } catch (l) {
          console.warn(
            `[DataSync] Failed to get data for channel "${s}":`,
            l == null ? void 0 : l.message
          );
        }
    }
    return i;
  };
}
function ie(n, e) {
  const t = G(e);
  return n.interceptors.request.use(t);
}
const b = /* @__PURE__ */ new WeakMap();
function Q(n, e, t) {
  let r = b.get(n);
  r || (r = /* @__PURE__ */ new Map(), b.set(n, r));
  const i = r.get(e) || [];
  return i.includes(t) || i.push(t), r.set(e, i), i;
}
function B(n, e) {
  const t = b.get(n);
  return (t == null ? void 0 : t.get(e)) || [];
}
function y(n) {
  return function(e, t, r) {
    Q(e, t, n);
    const i = r.value;
    return r.value = async function(...a) {
      const s = g(), o = B(e, t);
      for (const l of o)
        try {
          await s.waitForData(l);
        } catch (m) {
          console.warn(
            `[DataSync] Decorator: channel "${l}" wait failed:`,
            m == null ? void 0 : m.message
          );
        }
      V(o);
      try {
        return await i.apply(this, a);
      } finally {
        O();
      }
    }, Object.defineProperty(r.value, "name", {
      value: i.name,
      writable: !1
    }), r;
  };
}
function ae(n, e) {
  return B(n, e);
}
function se(n) {
  return g().registerChannel(n), y(n.name);
}
const oe = y("userInfo"), le = y("loanInfo"), ce = y("vipInfo"), X = "jump2Native";
async function de(n) {
  const e = p();
  if (!e.hasNativeBridge())
    return console.warn("[MPBridge/AppLink] No native bridge available. Cannot execute jump2Native."), { code: -2, message: "No native bridge available" };
  const t = { scheme: n }, r = await e.callAsync(X, t);
  return r && typeof r == "object" && "code" in r ? r : { code: 0, message: "success" };
}
const he = $(), ue = p();
export {
  E as DataSyncManager,
  ee as EMITTER_CONTAINER,
  X as JUMP2NATIVE_METHOD,
  H as MPEmitter,
  j as PLATFORM_QUERY_KEY,
  I as POST_TO_NATIVE_METHOD,
  C as POST_TO_WEB_METHOD,
  Z as STANDARD_CHANNELS,
  T as STANDARD_CHANNEL_CONFIGS,
  ue as bridge,
  G as createDataSyncInterceptor,
  se as createWaitDecorator,
  D as detectPlatformFromUrl,
  M as detectPlatformFromWindow,
  he as emitter,
  p as getBridge,
  te as getContainerName,
  g as getDataSyncManager,
  $ as getEmitter,
  ae as getMethodWaitChannels,
  A as getPlatform,
  K as getPlatformDebugInfo,
  A as getPlatformFromUrl,
  q as injectDataToConfig,
  S as isFourLevelEvent,
  Y as isNativeEnvironment,
  de as jump2Native,
  z as matchUrlPattern,
  ne as resetBridge,
  x as resetDataSyncManager,
  R as resetEmitter,
  re as setupDataSyncHandlers,
  ie as setupDataSyncInterceptor,
  F as setupEmitterBridge,
  y as waitDataSync,
  le as waitLoanInfoSync,
  oe as waitUserInfoSync,
  ce as waitVipInfoSync
};
