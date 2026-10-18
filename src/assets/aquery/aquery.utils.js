/*!
 * aQuery.utils.js — 工具函数 + 浏览器判定
 * 依赖：aquery.core.js
 */
(function (window, $a) {
  "use strict";

  var toString = Object.prototype.toString;
  var doc = window.document;

  /* ---------------- 基础 ---------------- */

  /* 原生 trim 优先 */
  $a.trim = function (str) {
    if (str == null) return "";
    str = String(str);
    return str.trim ? str.trim() : str.replace(/^\s+|\s+$/g, "");
  };

  $a.map = function (arr, fn) {
    var out = [], i = 0, n = arr ? arr.length : 0, v;
    for (; i < n; i++) {
      v = fn(arr[i], i);
      if (v != null) out.push(v);
    }
    return out;
  };

  $a.grep = function (arr, fn, invert) {
    var out = [], i = 0, n = arr ? arr.length : 0;
    for (; i < n; i++) {
      if (!fn(arr[i], i) !== !invert) out.push(arr[i]);
    }
    return out;
  };

  /* 原生 indexOf 优先 */
  $a.inArray = function (value, arr, from) {
    var i, n;
    if (!arr) return -1;
    if (arr.indexOf) return arr.indexOf(value, from);
    i = from ? +from : 0;
    n = arr.length || 0;
    if (i < 0) i = Math.max(0, n + i);
    for (; i < n; i++) if (arr[i] === value) return i;
    return -1;
  };

  $a.isArray = Array.isArray || function (obj) {
    return toString.call(obj) === "[object Array]";
  };

  $a.isFunction = function (obj) {
    return typeof obj === "function";
  };

  $a.isWindow = function (obj) {
    return obj != null && obj === obj.window;
  };

  $a.isPlainObject = function (obj) {
    var proto;

    if (!obj || toString.call(obj) !== "[object Object]") return false;
    if (obj.nodeType || $a.isWindow(obj)) return false;

    proto = Object.getPrototypeOf ? Object.getPrototypeOf(obj) : obj.__proto__;
    return proto === null || proto === Object.prototype;
  };

  $a.type = function (obj) {
    if (obj == null) return String(obj);
    return typeof obj === "object" || typeof obj === "function"
      ? toString.call(obj).slice(8, -1).toLowerCase()
      : typeof obj;
  };

  /* 深/浅合并：$a.extend(target, src...) / $a.extend(true, target, src...) */
  $a.extend = function () {
    var args = arguments;
    var target = args[0] || {};
    var i = 1;
    var len = args.length;
    var deep = false;
    var src, copy, name, clone, copyIsArray;

    if (typeof target === "boolean") {
      deep = target;
      target = args[1] || {};
      i = 2;
    }

    if (typeof target !== "object" && typeof target !== "function") target = {};

    for (; i < len; i++) {
      src = args[i];
      if (src == null) continue;

      for (name in src) {
        if (!src.hasOwnProperty(name)) continue;
        copy = src[name];

        if (copy === target) continue;

        copyIsArray = $a.isArray(copy);

        if (deep && copy && ($a.isPlainObject(copy) || copyIsArray)) {
          clone = target[name];
          if (copyIsArray) {
            clone = $a.isArray(clone) ? clone : [];
          } else {
            clone = $a.isPlainObject(clone) ? clone : {};
          }
          target[name] = $a.extend(deep, clone, copy);
        } else if (copy !== undefined) {
          target[name] = copy;
        }
      }
    }

    return target;
  };

  $a.parseJSON = function (str) {
    if (!str || typeof str !== "string") return str == null ? null : str;
    return JSON.parse(str);
  };

  $a.parseXML = function (str) {
    var xml = null, parser;
    if (!str || typeof str !== "string") return null;
    try {
      if (window.DOMParser) {
        parser = new window.DOMParser();
        xml = parser.parseFromString(str, "text/xml");
      } else if (window.ActiveXObject) {
        xml = new window.ActiveXObject("Microsoft.XMLDOM");
        xml.async = false;
        xml.loadXML(str);
      }
    } catch (e) {
      xml = null;
    }
    if (!xml || !xml.documentElement || xml.getElementsByTagName("parsererror").length) {
      return null;
    }
    return xml;
  };

  /* 递归序列化：支持嵌套对象与数组；也接受 [{name, value}] */
  $a.param = function (obj) {
    var out = [];

    function add(key, value) {
      if (value == null) value = "";
      out.push(encodeURIComponent(key) + "=" + encodeURIComponent(value));
    }

    function build(prefix, value) {
      var i, k;

      if (value instanceof Date) {
        add(prefix, value.toISOString ? value.toISOString() : String(value));
        return;
      }

      if ($a.isArray(value)) {
        for (i = 0; i < value.length; i++) build(prefix + "[]", value[i]);
        return;
      }

      if (value && typeof value === "object") {
        for (k in value) {
          if (value.hasOwnProperty(k)) build(prefix ? prefix + "[" + k + "]" : k, value[k]);
        }
        return;
      }

      add(prefix, value);
    }

    if ($a.isArray(obj)) {
      if (obj[0] && typeof obj[0] === "object" && "name" in obj[0]) {
        $a.each(obj, function (i, item) {
          add(item.name, item.value);
        });
      } else {
        for (var i = 0; i < obj.length; i++) build("", obj[i]);
      }
      return out.join("&");
    }

    if (obj && typeof obj === "object") {
      for (var key in obj) {
        if (obj.hasOwnProperty(key)) build(key, obj[key]);
      }
    }

    return out.join("&");
  };

  $a.proxy = function (fn, ctx) {
    var args;
    if (typeof fn === "string") {
      fn = ctx[fn];
    }
    if (typeof fn !== "function") return undefined;
    args = Array.prototype.slice.call(arguments, 2);
    return function () {
      return fn.apply(ctx, args.concat(Array.prototype.slice.call(arguments)));
    };
  };

  $a.noop = function () {};

  /* ---------------- URL ---------------- */

  /* $a.query() 取全部参数；$a.query("page", 1) 取单个并给默认值 */
  $a.query = function (name, fallback) {
    var out = {};
    var search = window.location.search.replace(/^\?/, "");
    var pairs, i, pair, eq, key, value;

    if (search) {
      pairs = search.split("&");
      for (i = 0; i < pairs.length; i++) {
        pair = pairs[i];
        if (!pair) continue;
        eq = pair.indexOf("=");
        key = decodeURIComponent((eq < 0 ? pair : pair.slice(0, eq)).replace(/\+/g, " "));
        value = eq < 0 ? "" : decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, " "));
        out[key] = value;
      }
    }

    if (name === undefined) return out;
    return out.hasOwnProperty(name) ? out[name] : fallback;
  };

  /* 读 / 写 #hash（不带 #） */
  $a.hash = function (value) {
    if (value === undefined) return (window.location.hash || "").replace(/^#/, "");
    window.location.hash = value;
    return $a;
  };

  /* ---------------- 本地存储 ---------------- */

  /* $a.store(key) 读，$a.store(key, v) 写，$a.store(key, null) 删；自动 JSON + try/catch */
  $a.store = function (key, value) {
    var full = "aq:" + key;
    var raw;

    try {
      if (value === undefined) {
        raw = window.localStorage.getItem(full);
        return raw == null ? null : JSON.parse(raw);
      }
      if (value === null) {
        window.localStorage.removeItem(full);
        return null;
      }
      window.localStorage.setItem(full, JSON.stringify(value));
      return value;
    } catch (e) {
      /* 隐私模式 / 配额满：读返回 null，写静默失败 */
      return value === undefined ? null : value;
    }
  };

  /* ---------------- 模板 ---------------- */

  /* $a.tmpl("<b>{{title}}</b>", { title: "hi" })；{{{x}}} 不转义 */
  $a.tmpl = function (str, data) {
    var esc = /[&<>"']/g;
    var map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

    function pick(obj, path) {
      var parts = String(path).split("."), i, cur = obj;
      for (i = 0; i < parts.length; i++) {
        if (cur == null) return undefined;
        cur = cur[parts[i]];
      }
      return cur;
    }

    return String(str).replace(/\{\{\{([\w.$]+)\}\}\}|\{\{([\w.$]+)\}\}/g, function (m, raw, safe) {
      var key = raw || safe;
      var v = pick(data, key);
      if (v == null) return "";
      return raw ? String(v) : String(v).replace(esc, function (ch) { return map[ch]; });
    });
  };

  /* ---------------- 浏览器判定 ---------------- */

  var UA = null;

  function parseUA() {
    var ua = window.navigator.userAgent || "";
    var m;
    var info = {
      ua: ua,
      name: "",
      version: 0,
      ie: 0,
      ios: 0,
      android: 0,
      mobile: /Mobile|Android|iPhone|iPad|iPod/.test(ua)
    };

    /* IE：优先用 documentMode（IE8-11 最准） */
    if (doc.documentMode) {
      info.ie = doc.documentMode;
      info.name = "ie";
      info.version = info.ie;
    } else if ((m = /MSIE\s(\d+)/.exec(ua))) {
      info.ie = +m[1];
      info.name = "ie";
      info.version = info.ie;
    } else if ((m = /Trident\/.*rv:(\d+)/.exec(ua))) {
      info.ie = +m[1];
      info.name = "ie";
      info.version = info.ie;
    } else if ((m = /Edg\/(\d+)/.exec(ua)) || (m = /Edge\/(\d+)/.exec(ua))) {
      info.name = "edge";
      info.version = +m[1];
    } else if ((m = /OPR\/(\d+)/.exec(ua))) {
      info.name = "opera";
      info.version = +m[1];
    } else if ((m = /Firefox\/(\d+)/.exec(ua))) {
      info.name = "firefox";
      info.version = +m[1];
    } else if ((m = /Chrome\/(\d+)/.exec(ua))) {
      info.name = "chrome";
      info.version = +m[1];
    } else if ((m = /Version\/(\d+).*Safari\//.exec(ua))) {
      info.name = "safari";
      info.version = +m[1];
    }

    if ((m = /(?:iPhone|iPad|iPod).*?OS (\d+)_/.exec(ua))) info.ios = +m[1];
    if ((m = /Android\s(\d+)/.exec(ua))) info.android = +m[1];

    return info;
  }

  /* $a.browser() → { name, version, ie, ios, android, mobile, ua }；$a.browser("name") 取单项 */
  $a.browser = function (key) {
    if (!UA) UA = parseUA();
    return key ? UA[key] : UA;
  };

  /* IE 主版本号，非 IE 返回 0 */
  $a.ie = function () {
    return $a.browser("ie") || 0;
  };

  /* ---------------- 特性检测 ---------------- */

  function cssSupport(prop, value) {
    if (prop.indexOf("--") === 0) {
      return !!(window.CSS && window.CSS.supports && window.CSS.supports(prop, value));
    }
    if (window.CSS && window.CSS.supports) {
      try {
        return window.CSS.supports(prop, value);
      } catch (e) {
        return false;
      }
    }
    var style = doc.createElement("div").style;
    style[prop] = value;
    return style[prop] !== "";
  }

  var PROBES = {
    classlist: function () { return !!doc.createElement("div").classList; },
    flex: function () { return cssSupport("display", "flex"); },
    grid: function () { return cssSupport("display", "grid"); },
    sticky: function () { return cssSupport("position", "sticky"); },
    customprops: function () { return cssSupport("--aq", "0"); },
    promise: function () { return typeof window.Promise === "function"; },
    fetch: function () { return typeof window.fetch === "function"; },
    mutationobserver: function () { return typeof window.MutationObserver === "function"; },
    intersectionobserver: function () { return typeof window.IntersectionObserver === "function"; },
    matchmedia: function () { return typeof window.matchMedia === "function"; },
    localstorage: function () { try { return !!window.localStorage; } catch (e) { return false; } },
    passive: function () {
      var ok = false;
      try {
        var opts = Object.defineProperty({}, "passive", {
          get: function () { ok = true; return false; }
        });
        window.addEventListener("aq:probe", $a.noop, opts);
        window.removeEventListener("aq:probe", $a.noop, opts);
      } catch (e) { /* 忽略 */ }
      return ok;
    },
    es6: function () { return typeof window.Promise === "function" && typeof window.Symbol === "function"; }
  };

  /* $a.support("flex") / $a.support("classlist") */
  $a.support = function (name) {
    return PROBES[name] ? !!PROBES[name]() : false;
  };

  /* 支持到的最高 ES 版本（返回年份，ES5 返回 5） */
  $a.es = function () {
    var P = window.Promise;

    if (!(P && window.Symbol && window.Map && window.Set)) return 5;
    if (!(Array.prototype.includes && Array.prototype.find)) return 2015;
    if (!(Object.entries && Object.values && String.prototype.padStart)) return 2016;
    if (!(P.prototype.finally && Object.getOwnPropertyDescriptors)) return 2017;
    if (!(Array.prototype.flat && Object.fromEntries)) return 2018;
    if (!(window.BigInt && String.prototype.matchAll && window.globalThis)) return 2019;
    if (!String.prototype.replaceAll) return 2020;
    if (!(P.any && Array.prototype.at && Object.hasOwn)) return 2021;
    if (!(Array.prototype.findLast && Array.prototype.toSorted)) return 2022;
    if (!(Object.groupBy && window.Map.groupBy)) return 2023;
    return 2024;
  };

  /* ---------------- 版本表达式 ---------------- */

  var TOKEN = /^\s*(>=|<=|==|!=|=|&&|\|\||[><!()]|\d+|[a-z]+)/i;

  function tokenize(expr) {
    var out = [], rest = String(expr), m;
    while (rest.length) {
      m = TOKEN.exec(rest);
      if (!m) {
        rest = rest.slice(1);
        continue;
      }
      out.push(m[1]);
      rest = rest.slice(m[0].length);
    }
    return out;
  }

  function valueOf(name) {
    var b;
    if (name === "es") return $a.es();
    b = $a.browser();
    if (name === "ie") return b.ie || 0;
    if (name === "ios") return b.ios || 0;
    if (name === "android") return b.android || 0;
    if (b.name === name) return b.version || 0;
    return 0;
  }

  function compare(value, op, target) {
    if (op === ">=") return value >= target;
    if (op === "<=") return value <= target;
    if (op === ">") return value > target;
    if (op === "<") return value < target;
    if (op === "!=") return value !== target;
    return value === target;
  }

  function evaluate(tokens) {
    var pos = 0;

    function peek() { return tokens[pos]; }
    function next() { return tokens[pos++]; }

    function parseOr() {
      var v = parseAnd(), r;
      while (peek() === "||") {
        next();
        r = parseAnd();
        v = v || r;
      }
      return v;
    }

    function parseAnd() {
      var v = parseUnary(), r;
      while (peek() === "&&") {
        next();
        r = parseUnary();
        v = v && r;
      }
      return v;
    }

    function parseUnary() {
      if (peek() === "!") {
        next();
        return !parseUnary();
      }
      if (peek() === "(") {
        next();
        var v = parseOr();
        if (peek() === ")") next();
        return v;
      }
      return parseAtom();
    }

    function parseAtom() {
      var name = next(), op, num, val;
      if (!name || !/^[a-z]+$/i.test(name)) return false;

      val = valueOf(name.toLowerCase());
      op = peek();

      if (op && /^(>=|<=|==|!=|=|>|<)$/.test(op)) {
        next();
        num = parseInt(next(), 10);
        if (isNaN(num)) return false;
        return compare(val, op, num);
      }

      return val > 0;
    }

    return parseOr();
  }

  /*
   * $a.check("ie >= 9")
   * $a.check("ie >= 9 && chrome >= 80")
   * $a.check("(chrome >= 100 || firefox >= 90) && !ie")
   * 支持的名称：ie / edge / chrome / firefox / safari / opera / ios / android / es
   */
  $a.check = function (expr) {
    if (!expr) return false;
    try {
      return !!evaluate(tokenize(expr));
    } catch (e) {
      return false;
    }
  };

  $a.now = Date.now || function () {
    return +new Date();
  };
})(window, window.$a);
