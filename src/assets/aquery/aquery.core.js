/*!
 * aQuery.core.js — 选择器引擎 + 核心构造器
 * 兼容：IE9+（ES5，无依赖）；需最先加载
 * 全局：$a
 */
(function (window, document) {
  "use strict";

  var VERSION = "0.2.2";
  var rtrim = /^\s+|\s+$/g;
  var uid = 0;

  /* ---------------- 构造器 ---------------- */

  function A(selector, context) {
    return new A.fn.init(selector, context);
  }

  A.fn = A.prototype = {
    a: VERSION,
    length: 0,
    constructor: A,

    init: function (selector, context) {
      if (!selector) return this;

      /* DOM 节点 / window / document */
      if (selector.nodeType || selector === window) {
        this[0] = selector;
        this.length = 1;
        this._uid = ++uid;
        return this;
      }

      /* $a(fn) → ready */
      if (typeof selector === "function") {
        A.ready(selector);
        return this;
      }

      if (typeof selector === "string") {
        selector = selector.replace(rtrim, "");

        /* HTML 片段 → 新节点 */
        if (selector.charAt(0) === "<" && selector.length > 2) {
          this._selector = selector;
          this._uid = ++uid;
          return A.merge(this, A.parseHTML(selector));
        }

        /* 选择器 */
        if (context) {
          context = context.nodeType ? context : A(context)[0];
        }

        this._selector = selector;
        this._context = context || document;
        this._uid = ++uid;

        return A.merge(this, A.select(selector, context || document));
      }

      /* 数组 / NodeList / 集合对象 */
      if (A.isArrayLike(selector)) {
        this._uid = ++uid;
        return A.merge(this, A.toArray(selector));
      }

      return this;
    },

    /* ---------------- 基础方法 ---------------- */

    each: function (fn) {
      A.each(this, fn);
      return this;
    },

    toArray: function () {
      return A.toArray(this);
    },

    get: function (i) {
      return i === undefined ? this.toArray() : this[i < 0 ? this.length + i : i];
    },

    eq: function (i) {
      i = +i;
      return A(i < 0 ? this.toArray().slice(i) : this.toArray().slice(i, i + 1));
    },

    first: function () {
      return this.eq(0);
    },

    last: function () {
      return this.eq(-1);
    },

    size: function () {
      return this.length;
    }
  };

  /* ---------------- 内部工具 ---------------- */

  A.isArrayLike = function (obj) {
    if (!obj || typeof obj !== "object" || obj.nodeType || obj === window) return false;
    return typeof obj.length === "number";
  };

  /* 原生 indexOf 优先 */
  A.indexOf = function (arr, item, from) {
    var i = from ? +from : 0, n = arr ? arr.length : 0;
    if (arr && arr.indexOf) return arr.indexOf(item, from);
    if (i < 0) i = Math.max(0, n + i);
    for (; i < n; i++) if (arr[i] === item) return i;
    return -1;
  };

  A.toArray = function (obj) {
    var out = [], i = 0, n = obj ? obj.length : 0;
    if (!obj) return out;

    if (typeof obj.length === "number" && !obj.nodeType && obj !== window) {
      try {
        return Array.prototype.slice.call(obj);
      } catch (e) {
        /* 老环境对宿主对象调用 slice 会抛，退回循环 */
      }
    }

    for (; i < n; i++) out.push(obj[i]);
    return out;
  };

  A.merge = function (first, second) {
    var len = second ? second.length : 0, i = 0, j = first.length;
    for (; i < len; i++) first[j++] = second[i];
    first.length = j;
    return first;
  };

  A.each = function (obj, fn) {
    var i = 0, len, key;
    if (!obj) return obj;
    len = obj.length;
    if (typeof len === "number") {
      for (; i < len; i++) {
        if (fn.call(obj[i], i, obj[i]) === false) break;
      }
    } else {
      for (key in obj) {
        if (obj.hasOwnProperty(key) && fn.call(obj[key], key, obj[key]) === false) break;
      }
    }
    return obj;
  };

  /* 去重（保持文档顺序） */
  A.unique = function (nodes) {
    var out = [], i;
    for (i = 0; i < nodes.length; i++) {
      if (A.indexOf(out, nodes[i]) < 0) out.push(nodes[i]);
    }
    return out;
  };

  /* 按文档顺序排序 */
  A.sort = function (nodes) {
    if (nodes.length < 2) return nodes;
    try {
      nodes.sort(function (a, b) {
        if (a === b) return 0;
        return a.compareDocumentPosition(b) & 4 ? -1 : 1;
      });
    } catch (e) {
      /* 忽略 */
    }
    return nodes;
  };

  /* IE9 的 matches 带前缀 */
  A.matches = function (el, selector) {
    var fn = el.matches || el.msMatchesSelector || el.webkitMatchesSelector || el.mozMatchesSelector;
    if (!fn) return false;
    try {
      return fn.call(el, selector);
    } catch (e) {
      return false;
    }
  };

  A.isVisible = function (el) {
    return !!(el.offsetWidth || el.offsetHeight || (el.getClientRects && el.getClientRects().length));
  };

  /* 支持自定义伪类的 matches（filter/not/is/closest/委托都用它） */
  A.matchesAny = function (el, selector) {
    if (typeof selector !== "string") return false;
    if (!hasCustom(selector)) return A.matches(el, selector);
    return A.indexOf(A.select(selector, el.ownerDocument || document), el) > -1;
  };

  /* ==================================================================
   * 选择器引擎
   *
   * 设计：
   *   1. 不含自定义伪类时直接交给 querySelectorAll（最快）；
   *   2. 含自定义伪类时，按「组合符」切成若干段，逐段从左到右求值；
   *   3. 位置伪类（:first/:eq/…）作用在**该段候选集**上；
   *   4. 原生伪类（:not/:nth-child/…）仍交给 matches() 处理。
   * ================================================================== */

  var CUSTOM = {
    first: 1, last: 1, eq: 1, even: 1, odd: 1, gt: 1, lt: 1,
    visible: 1, hidden: 1, contains: 1, has: 1
  };
  var POSITIONAL = { first: 1, last: 1, eq: 1, even: 1, odd: 1, gt: 1, lt: 1 };
  var CUSTOM_RE = /:(first|last|eq|even|odd|gt|lt|visible|hidden|contains|has)\b/i;

  function hasCustom(selector) {
    return CUSTOM_RE.test(selector);
  }

  /* 按顶层字符切分（忽略括号、方括号、引号内部） */
  function splitTop(str, sep) {
    var out = [], buf = "", depth = 0, quote = null, i, ch;

    for (i = 0; i < str.length; i++) {
      ch = str.charAt(i);

      if (quote) {
        buf += ch;
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        buf += ch;
        continue;
      }
      if (ch === "(" || ch === "[") {
        depth++;
        buf += ch;
        continue;
      }
      if (ch === ")" || ch === "]") {
        depth--;
        buf += ch;
        continue;
      }
      if (depth === 0 && ch === sep) {
        out.push(buf);
        buf = "";
        continue;
      }
      buf += ch;
    }

    out.push(buf);
    return out;
  }

  /* 把一段选择器解析成 [{comb, compound}] */
  function parseGroup(sel) {
    var steps = [], buf = "", depth = 0, quote = null, pending = null, i, ch;

    function push() {
      var text = buf.replace(rtrim, "");
      if (text) {
        steps.push({ comb: pending, compound: parseCompound(text) });
        pending = null;
      }
      buf = "";
    }

    for (i = 0; i < sel.length; i++) {
      ch = sel.charAt(i);

      if (quote) {
        buf += ch;
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        buf += ch;
        continue;
      }
      if (ch === "(" || ch === "[") {
        depth++;
        buf += ch;
        continue;
      }
      if (ch === ")" || ch === "]") {
        depth--;
        buf += ch;
        continue;
      }

      if (depth === 0) {
        if (ch === ">" || ch === "+" || ch === "~") {
          if (buf.replace(rtrim, "")) push();
          pending = ch;
          continue;
        }
        if (/\s/.test(ch)) {
          if (buf.replace(rtrim, "")) {
            push();
            pending = " ";
          }
          continue;
        }
      }

      buf += ch;
    }

    if (buf.replace(rtrim, "")) push();
    return steps;
  }

  var rCompound = /^([a-zA-Z][\w-]*|\*)|#([\w-]+)|\.([\w-]+)|\[([^\]]+)\]|:([\w-]+)(?:\(([^)]*)\))?/;

  function parseCompound(text) {
    var parts = { tag: "", id: "", classes: [], attrs: [], pseudos: [] };
    var rest = text, m;

    while (rest.length) {
      m = rCompound.exec(rest);
      if (!m) {
        rest = rest.slice(1);
        continue;
      }
      if (m[1]) parts.tag = m[1];
      else if (m[2]) parts.id = m[2];
      else if (m[3]) parts.classes.push(m[3]);
      else if (m[4]) parts.attrs.push(m[4]);
      else if (m[5]) parts.pseudos.push({ name: m[5].toLowerCase(), arg: m[6] == null ? null : m[6] });

      rest = rest.slice(m[0].length);
    }

    return parts;
  }

  /* :not(...) 内部含自定义伪类时要自己处理，否则交给浏览器 */
  function isNativePseudo(p) {
    if (CUSTOM[p.name]) return false;
    if (p.name === "not" && p.arg && hasCustom(p.arg)) return false;
    return true;
  }

  function nativeSelector(parts) {
    var out = parts.tag || "";
    var i;

    if (parts.id) out += "#" + parts.id;

    for (i = 0; i < parts.classes.length; i++) out += "." + parts.classes[i];
    for (i = 0; i < parts.attrs.length; i++) out += "[" + parts.attrs[i] + "]";

    for (i = 0; i < parts.pseudos.length; i++) {
      var p = parts.pseudos[i];
      if (!isNativePseudo(p)) continue;
      out += ":" + p.name + (p.arg == null ? "" : "(" + p.arg + ")");
    }

    return out || "*";
  }

  function unquote(str) {
    str = String(str == null ? "" : str);
    if ((str.charAt(0) === '"' && str.charAt(str.length - 1) === '"') ||
        (str.charAt(0) === "'" && str.charAt(str.length - 1) === "'")) {
      return str.slice(1, -1);
    }
    return str;
  }

  /* 非位置类自定义伪类 */
  function customMatch(el, parts) {
    var i, p, arg;

    for (i = 0; i < parts.pseudos.length; i++) {
      p = parts.pseudos[i];
      arg = p.arg;

      if (POSITIONAL[p.name] || isNativePseudo(p)) continue;

      if (p.name === "visible") {
        if (!A.isVisible(el)) return false;
      } else if (p.name === "hidden") {
        if (A.isVisible(el)) return false;
      } else if (p.name === "contains") {
        if (String(el.textContent || el.innerText || "").indexOf(unquote(arg)) < 0) return false;
      } else if (p.name === "has") {
        if (!A.select(arg, el).length) return false;
      } else if (p.name === "not") {
        if (A.matchesAny(el, unquote(arg))) return false;
      }
    }

    return true;
  }

  /* 位置伪类作用在候选集上 */
  function applyPositional(nodes, parts) {
    var i, p, n;

    for (i = 0; i < parts.pseudos.length; i++) {
      p = parts.pseudos[i];
      if (!POSITIONAL[p.name]) continue;

      if (p.name === "first") nodes = nodes.slice(0, 1);
      else if (p.name === "last") nodes = nodes.slice(-1);
      else if (p.name === "eq") {
        n = parseInt(p.arg, 10) || 0;
        nodes = nodes.slice(n, n + 1);
      } else if (p.name === "even") {
        nodes = nodes.filter(function (el, idx) { return idx % 2 === 0; });
      } else if (p.name === "odd") {
        nodes = nodes.filter(function (el, idx) { return idx % 2 === 1; });
      } else if (p.name === "gt") {
        n = parseInt(p.arg, 10) || 0;
        nodes = nodes.slice(n + 1);
      } else if (p.name === "lt") {
        n = parseInt(p.arg, 10) || 0;
        nodes = nodes.slice(0, n < 0 ? nodes.length + n : n);
      }
    }

    return nodes;
  }

  function qsa(selector, context) {
    var out = [], list, i;
    try {
      list = context.querySelectorAll(selector);
    } catch (e) {
      return out;
    }
    for (i = 0; i < list.length; i++) out.push(list[i]);
    return out;
  }

  function elementChildren(el) {
    var out = [], nodes = el.childNodes, i;
    for (i = 0; i < nodes.length; i++) {
      if (nodes[i].nodeType === 1) out.push(nodes[i]);
    }
    return out;
  }

  function nextElement(el) {
    var n = el.nextSibling;
    while (n && n.nodeType !== 1) n = n.nextSibling;
    return n;
  }

  function followingSiblings(el) {
    var out = [], n = nextElement(el);
    while (n) {
      out.push(n);
      n = nextElement(n);
    }
    return out;
  }

  /* 按组合符展开候选 */
  function expand(set, comb, parts) {
    var out = [], i, j, el, list, tag;

    tag = parts.tag && parts.tag !== "*" ? parts.tag : "*";

    for (i = 0; i < set.length; i++) {
      el = set[i];
      if (!el || el.nodeType !== 1) continue;

      if (!comb || comb === " ") {
        list = qsa(tag, el);
        for (j = 0; j < list.length; j++) out.push(list[j]);
      } else if (comb === ">") {
        list = elementChildren(el);
        for (j = 0; j < list.length; j++) out.push(list[j]);
      } else if (comb === "+") {
        list = nextElement(el);
        if (list) out.push(list);
      } else if (comb === "~") {
        list = followingSiblings(el);
        for (j = 0; j < list.length; j++) out.push(list[j]);
      }
    }

    return out;
  }

  function filterCompound(nodes, parts) {
    var out = [], i, el, nativeSel = nativeSelector(parts);

    for (i = 0; i < nodes.length; i++) {
      el = nodes[i];
      if (!el || el.nodeType !== 1) continue;
      if (!A.matches(el, nativeSel)) continue;
      if (!customMatch(el, parts)) continue;
      out.push(el);
    }

    A.unique(out);
    A.sort(out);

    return applyPositional(out, parts);
  }

  function evalGroup(group, context) {
    var steps = parseGroup(group);
    var cur = [context];
    var i, cand;

    if (!steps.length) return [];

    for (i = 0; i < steps.length; i++) {
      cand = expand(cur, steps[i].comb, steps[i].compound);
      cur = filterCompound(cand, steps[i].compound);
      if (!cur.length) return [];
    }

    /* 上下文自身不算在结果里（除非显式 :has 之类内部使用） */
    cur = A.unique(cur);
    for (i = 0; i < cur.length; i++) {
      if (cur[i] === context) {
        cur.splice(i, 1);
        break;
      }
    }

    return cur;
  }

  A.select = function (selector, context) {
    context = context || document;

    /* 快路径 */
    if (!hasCustom(selector)) {
      return A.unique(qsa(selector, context));
    }

    var groups = splitTop(selector, ",");
    var out = [], i;

    for (i = 0; i < groups.length; i++) {
      if (groups[i].replace(rtrim, "")) {
        out = out.concat(evalGroup(groups[i], context));
      }
    }

    return A.unique(A.sort(out));
  };

  /* ---------------- HTML 片段（含表格/列表包裹修正） ---------------- */

  var WRAPS = {
    tr: ["<table><tbody>", "</tbody></table>", "tbody"],
    td: ["<table><tbody><tr>", "</tr></tbody></table>", "tr"],
    th: ["<table><tbody><tr>", "</tr></tbody></table>", "tr"],
    thead: ["<table>", "</table>", "table"],
    tbody: ["<table>", "</table>", "table"],
    tfoot: ["<table>", "</table>", "table"],
    caption: ["<table>", "</table>", "table"],
    colgroup: ["<table>", "</table>", "table"],
    col: ["<table><colgroup>", "</colgroup></table>", "colgroup"],
    option: ["<select>", "</select>", "select"],
    optgroup: ["<select>", "</select>", "select"],
    li: ["<ul>", "</ul>", "ul"],
    dt: ["<dl>", "</dl>", "dl"],
    dd: ["<dl>", "</dl>", "dl"]
  };

  A.parseHTML = function (html) {
    var m = /^<([a-z][\w-]*)/i.exec(html);
    var tag = m ? m[1].toLowerCase() : "";
    var wrap = WRAPS[tag];
    var div = document.createElement("div");
    var nodes = [], child, host;

    if (wrap) {
      div.innerHTML = wrap[0] + html + wrap[1];
      host = div.getElementsByTagName(wrap[2])[0];
      if (!host) return nodes;
      child = host.firstChild;
    } else {
      div.innerHTML = html;
      child = div.firstChild;
    }

    while (child) {
      nodes.push(child);
      child = child.nextSibling;
    }

    return nodes;
  };

  /* ---------------- ready ---------------- */

  var readyList = [];
  var ready = false;

  function fireReady() {
    if (ready) return;
    ready = true;
    while (readyList.length) readyList.shift()();
  }

  A.ready = function (fn) {
    if (typeof fn !== "function") return;
    if (ready) {
      window.setTimeout(fn, 0);
      return;
    }
    readyList.push(fn);
  };

  if (document.readyState === "complete" || document.readyState === "interactive") {
    window.setTimeout(fireReady, 0);
  } else {
    document.addEventListener("DOMContentLoaded", fireReady, false);
    window.addEventListener("load", fireReady, false);
  }

  /* ---------------- 导出 ---------------- */

  A.version = VERSION;

  /* 私有属性：以下划线开头，不保证稳定，也不写进文档 */
  A._version = VERSION;
  A._uid = function () {
    return ++uid;
  };
  A._internal = {
    indexOf: A.indexOf,
    toArray: A.toArray,
    merge: A.merge,
    unique: A.unique,
    sort: A.sort,
    matches: A.matches,
    isVisible: A.isVisible,
    select: A.select,
    parseHTML: A.parseHTML,
    splitTop: splitTop,
    parseGroup: parseGroup
  };

  A.fn.init.prototype = A.fn;
  window.$a = A;
})(window, document);
