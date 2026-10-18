/*!
 * aQuery.dom.js — 遍历、DOM 操作、属性/样式、尺寸位置、表单序列化
 * 依赖：aquery.core.js、aquery.utils.js、aquery.deferred.js（$a.copy 用到 $a.Deferred）
 */
(function (window, document, $a) {
  "use strict";

  var fn = $a.fn;
  var CUSTOM_SEL = /:(first|last|eq|even|odd|gt|lt|visible|hidden|contains|has)\b/i;

  function make(nodes) {
    return $a(nodes);
  }

  /* 私有：记录来源集合，便于回溯/调试 */
  function pushStack(prev, nodes) {
    var ret = make(nodes);
    ret._prev = prev;
    return ret;
  }

  /* 字符串 → 节点；节点 / 集合 / 数组 → 数组 */
  function toNodes(x) {
    if (x == null) return [];
    if (typeof x === "string") return $a.parseHTML(x);
    if (x.nodeType) return [x];
    if (typeof x.length === "number" && !x.nodeType) return $a.toArray(x);
    return [x];
  }

  function camel(name) {
    return String(name).replace(/-([a-z])/g, function (m, c) {
      return c.toUpperCase();
    });
  }

  function dash(name) {
    return String(name).replace(/[A-Z]/g, function (m) {
      return "-" + m.toLowerCase();
    });
  }

  function computed(el) {
    return window.getComputedStyle ? window.getComputedStyle(el, null) : el.currentStyle;
  }

  function px(v) {
    return typeof v === "number" ? v + "px" : v;
  }

  /* ==================== 遍历 ==================== */

  fn.find = function (selector) {
    var out = [];
    this.each(function () {
      out = out.concat($a.select(selector, this));
    });
    return pushStack(this, $a.unique(out));
  };

  fn.filter = function (selector) {
    var out = [];
    var test = typeof selector === "function"
      ? function (el, i) { return selector.call(el, i, el); }
      : function (el) { return $a.matchesAny(el, selector); };

    this.each(function (i) {
      if (test(this, i)) out.push(this);
    });
    return pushStack(this, out);
  };

  fn.not = function (selector) {
    var out = [];
    var test = typeof selector === "function"
      ? function (el, i) { return selector.call(el, i, el); }
      : function (el) { return $a.matchesAny(el, selector); };

    this.each(function (i) {
      if (!test(this, i)) out.push(this);
    });
    return pushStack(this, out);
  };

  fn.is = function (selector) {
    var hit = false;
    this.each(function () {
      if ($a.matchesAny(this, selector)) {
        hit = true;
        return false;
      }
    });
    return hit;
  };

  fn.closest = function (selector) {
    var out = [];
    this.each(function () {
      var el = this, hit;

      if (el.closest && !CUSTOM_SEL.test(selector)) {
        hit = el.closest(selector);
        if (hit) out.push(hit);
        return;
      }

      while (el && el.nodeType === 1) {
        if ($a.matchesAny(el, selector)) {
          out.push(el);
          break;
        }
        el = el.parentNode;
      }
    });
    return pushStack(this, $a.unique(out));
  };

  fn.parent = function (selector) {
    var out = [];
    this.each(function () {
      var p = this.parentNode;
      if (p && p.nodeType === 1) out.push(p);
    });
    out = $a.unique(out);
    return pushStack(this, selector ? make(out).filter(selector) : out);
  };

  fn.children = function (selector) {
    var out = [];
    this.each(function () {
      var nodes = this.childNodes;
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].nodeType === 1) out.push(nodes[i]);
      }
    });
    return pushStack(this, selector ? make(out).filter(selector) : out);
  };

  fn.siblings = function (selector) {
    var out = [];
    this.each(function () {
      var self = this;
      var nodes = self.parentNode ? self.parentNode.childNodes : [];
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].nodeType === 1 && nodes[i] !== self) out.push(nodes[i]);
      }
    });
    out = $a.unique(out);
    return pushStack(this, selector ? make(out).filter(selector) : out);
  };

  fn.next = function (selector) {
    var out = [];
    this.each(function () {
      var el = this.nextSibling;
      while (el && el.nodeType !== 1) el = el.nextSibling;
      if (el) out.push(el);
    });
    return pushStack(this, selector ? make(out).filter(selector) : out);
  };

  fn.prev = function (selector) {
    var out = [];
    this.each(function () {
      var el = this.previousSibling;
      while (el && el.nodeType !== 1) el = el.previousSibling;
      if (el) out.push(el);
    });
    return pushStack(this, selector ? make(out).filter(selector) : out);
  };

  /* ==================== 插入 / 删除 ==================== */

  function insert(targets, content, mode) {
    var nodes = toNodes(content);
    var total = targets.length;

    if (!nodes.length) return targets;

    targets.each(function (idx) {
      var el = this, i, node;

      for (i = 0; i < nodes.length; i++) {
        /* 多个目标时，前面的目标用克隆，避免节点被搬走 */
        node = total > 1 && idx < total - 1 ? nodes[i].cloneNode(true) : nodes[i];

        /* 有 DOM4 的 append/prepend/before/after 就优先用 */
        if (mode === "append") {
          if (el.append) el.append(node);
          else el.appendChild(node);
        } else if (mode === "prepend") {
          if (el.prepend) el.prepend(node);
          else el.insertBefore(node, el.firstChild);
        } else if (mode === "before") {
          if (!el.parentNode) continue;
          if (el.before) el.before(node);
          else el.parentNode.insertBefore(node, el);
        } else if (mode === "after") {
          if (!el.parentNode) continue;
          if (el.after) el.after(node);
          else el.parentNode.insertBefore(node, el.nextSibling);
        }
      }
    });

    return targets;
  }

  fn.append = function (content) {
    return insert(this, content, "append");
  };

  fn.prepend = function (content) {
    return insert(this, content, "prepend");
  };

  fn.before = function (content) {
    return insert(this, content, "before");
  };

  fn.after = function (content) {
    return insert(this, content, "after");
  };

  fn.remove = function () {
    return this.each(function () {
      /* remove 会清掉事件与 data */
      if ($a._cleanData) $a._cleanData(this);
      if (this.parentNode) this.parentNode.removeChild(this);
    });
  };

  /* 只摘下来，保留事件与 data，方便之后插回去 */
  fn.detach = function () {
    return this.each(function () {
      if (this.parentNode) this.parentNode.removeChild(this);
    });
  };

  fn.empty = function () {
    return this.each(function () {
      if (this.textContent !== undefined) {
        this.textContent = "";
      } else {
        while (this.firstChild) this.removeChild(this.firstChild);
      }
    });
  };

  fn.replaceWith = function (content) {
    var nodes = toNodes(content);

    this.each(function () {
      var el = this, parent = el.parentNode, i;
      if (!parent) return;

      if (el.replaceWith && nodes.length === 1) {
        el.replaceWith(nodes[0]);
        return;
      }

      for (i = 0; i < nodes.length; i++) {
        parent.insertBefore(i === nodes.length - 1 ? nodes[i] : nodes[i].cloneNode(true), el);
      }
      parent.removeChild(el);
    });

    return this;
  };

  /* ==================== 内容 / 属性 ==================== */

  /* 把内联 <script> 换成真正会执行的脚本节点 */
  function runScripts(container) {
    var scripts = container.getElementsByTagName("script");
    var i, s, copy;

    for (i = 0; i < scripts.length; i++) {
      s = scripts[i];

      if (s.type && !/^(text|application)\/(javascript|ecmascript)$/i.test(s.type)) continue;

      copy = document.createElement("script");
      if (s.src) copy.src = s.src;
      else copy.text = s.text || s.textContent || "";

      if (s.parentNode) s.parentNode.replaceChild(copy, s);
    }
  }

  fn.html = function (value) {
    if (value === undefined) return this[0] ? this[0].innerHTML : undefined;
    return this.each(function () {
      this.innerHTML = value;
      runScripts(this);
    });
  };

  fn.text = function (value) {
    if (value === undefined) {
      return this[0] ? (this[0].textContent != null ? this[0].textContent : this[0].innerText) : undefined;
    }
    return this.each(function () {
      this.textContent = value;
    });
  };

  fn.val = function (value) {
    var el = this[0];

    /* 读取 */
    if (value === undefined) {
      if (!el) return undefined;
      if (el.nodeName === "SELECT" && el.multiple) {
        return $a.map(el.options, function (opt) {
          return opt.selected ? opt.value : null;
        });
      }
      return el.value;
    }

    var values = $a.isArray(value) ? $a.map(value, function (v) { return String(v); }) : null;

    return this.each(function (i) {
      var node = this;

      /* 函数值：(index, oldValue) => newValue；多选 select 的 oldValue 是数组 */
      if (typeof value === "function") {
        var old = node.nodeName === "SELECT" && node.multiple
          ? $a(node).val()
          : node.value;
        $a(node).val(value.call(node, i, old));
        return;
      }

      if (node.nodeName === "SELECT") {
        var opts = node.options;
        for (var j = 0; j < opts.length; j++) {
          opts[j].selected = values
            ? $a.inArray(opts[j].value, values) > -1
            : opts[j].value === String(value);
        }
        return;
      }

      if (values && (node.type === "checkbox" || node.type === "radio")) {
        node.checked = $a.inArray(node.value, values) > -1;
        return;
      }

      node.value = value;
    });
  };

  fn.attr = function (name, value) {
    if (typeof name === "object" && name) {
      for (var key in name) {
        if (name.hasOwnProperty(key)) this.attr(key, name[key]);
      }
      return this;
    }

    if (value === undefined) return this[0] ? this[0].getAttribute(name) : undefined;

    /* 函数值：(index, oldValue) => newValue，每个元素单独求值 */
    if (typeof value === "function") {
      return this.each(function (i) {
        this.setAttribute(name, value.call(this, i, this.getAttribute(name)));
      });
    }

    return this.each(function () {
      this.setAttribute(name, value);
    });
  };

  fn.removeAttr = function (name) {
    return this.each(function () {
      this.removeAttribute(name);
    });
  };

  fn.prop = function (name, value) {
    if (value === undefined) return this[0] ? this[0][name] : undefined;
    return this.each(function () {
      this[name] = value;
    });
  };

  /* ==================== data 缓存 ==================== */

  var DATA_KEY = "__aData";

  function dataOf(el) {
    if (!el[DATA_KEY]) el[DATA_KEY] = {};
    return el[DATA_KEY];
  }

  fn.data = function (key, value) {
    var k;

    if (key === undefined) {
      return this[0] ? dataOf(this[0]) : {};
    }

    if (key && typeof key === "object") {
      for (k in key) {
        if (key.hasOwnProperty(k)) this.data(k, key[k]);
      }
      return this;
    }

    if (value === undefined) {
      return this[0] ? dataOf(this[0])[key] : undefined;
    }

    return this.each(function () {
      dataOf(this)[key] = value;
    });
  };

  fn.removeData = function (key) {
    return this.each(function () {
      var store = this[DATA_KEY];
      if (!store) return;
      if (key === undefined) this[DATA_KEY] = {};
      else delete store[key];
    });
  };

  /* ==================== 样式 / 类名 ==================== */

  var UNITLESS = /^(opacity|zIndex|fontWeight|lineHeight|zoom|order|flex|flexGrow|flexShrink)$/;

  fn.css = function (name, value) {
    if (typeof name === "object" && name) {
      for (var key in name) {
        if (name.hasOwnProperty(key)) this.css(key, name[key]);
      }
      return this;
    }

    if (value === undefined) {
      var el = this[0];
      if (!el) return undefined;
      var s = computed(el);
      return s ? (s.getPropertyValue ? s.getPropertyValue(dash(name)) : s[camel(name)]) : undefined;
    }

    return this.each(function () {
      this.style[camel(name)] = UNITLESS.test(camel(name)) ? value : px(value);
    });
  };

  /* 优先 classList，环境没有就退回操作 className 字符串 */
  function tokens(el) {
    var raw = el.className ? String(el.className) : "";
    return raw.replace(/^\s+|\s+$/g, "") ? raw.split(/\s+/) : [];
  }

  function hasClass(el, name) {
    if (el.classList) return el.classList.contains(name);
    return $a.inArray(name, tokens(el)) > -1;
  }

  function addClass(el, name) {
    if (el.classList) {
      el.classList.add(name);
      return;
    }
    var list = tokens(el);
    if ($a.inArray(name, list) < 0) list.push(name);
    el.className = list.join(" ");
  }

  function removeClass(el, name) {
    if (el.classList) {
      el.classList.remove(name);
      return;
    }
    var list = tokens(el), out = [], i;
    for (i = 0; i < list.length; i++) {
      if (list[i] !== name) out.push(list[i]);
    }
    el.className = out.join(" ");
  }

  fn.hasClass = function (name) {
    return this[0] ? hasClass(this[0], name) : false;
  };

  fn.addClass = function (name) {
    var names = String(name).split(/\s+/);
    return this.each(function () {
      var el = this, i;
      for (i = 0; i < names.length; i++) {
        if (names[i]) addClass(el, names[i]);
      }
    });
  };

  fn.removeClass = function (name) {
    if (name == null) {
      return this.each(function () {
        this.className = "";
      });
    }

    var names = String(name).split(/\s+/);
    return this.each(function () {
      var el = this, i;
      for (i = 0; i < names.length; i++) {
        if (names[i]) removeClass(el, names[i]);
      }
    });
  };

  fn.toggleClass = function (name, state) {
    var names = String(name).split(/\s+/);
    return this.each(function () {
      var el = this, i, on;
      for (i = 0; i < names.length; i++) {
        if (!names[i]) continue;
        on = state === undefined ? !hasClass(el, names[i]) : !!state;
        if (on) addClass(el, names[i]);
        else removeClass(el, names[i]);
      }
    });
  };

  /* ==================== 尺寸 / 位置 / 滚动 ==================== */

  function boxExtra(el, prop) {
    var s = computed(el);
    var v = s ? parseFloat(s[prop]) : NaN;
    return isNaN(v) ? 0 : v;
  }

  /* padding + border 之和（border-box 换算用） */
  function padBorder(cs, prop) {
    if (prop === "width") {
      return (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) +
        (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
    }
    return (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0) +
      (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
  }

  /* 内容盒尺寸：border-box 下要把 padding / border 扣掉 */
  function contentSize(el, prop) {
    var cs = computed(el);
    var v = cs ? parseFloat(cs[prop]) : NaN;

    if (isNaN(v)) return 0;
    if (cs.boxSizing === "border-box") v -= padBorder(cs, prop);

    return v;
  }

  function size(prop) {
    return function (value) {
      if (value === undefined) {
        var el = this[0];
        if (!el) return undefined;
        if (el === window) {
          return prop === "width" ? window.innerWidth : window.innerHeight;
        }
        if (el.nodeType === 9) {
          return prop === "width" ? document.documentElement.clientWidth : document.documentElement.clientHeight;
        }
        return contentSize(el, prop);
      }
      return this.each(function () {
        var v = value;
        var cs = computed(this);

        /* border-box 下 style.width 是 border-box 宽，按内容宽换算后再写 */
        if (cs && cs.boxSizing === "border-box" &&
            (typeof v === "number" || /^\d+(\.\d+)?$/.test(String(v)))) {
          v = parseFloat(v) + padBorder(cs, prop);
        }

        this.style[prop] = px(v);
      });
    };
  }

  fn.width = size("width");
  fn.height = size("height");

  fn.innerWidth = function () {
    var el = this[0];
    if (!el) return undefined;
    if (el === window || el.nodeType === 9) return fn.width.call(this);
    return contentSize(el, "width") + boxExtra(el, "paddingLeft") + boxExtra(el, "paddingRight");
  };

  fn.innerHeight = function () {
    var el = this[0];
    if (!el) return undefined;
    if (el === window || el.nodeType === 9) return fn.height.call(this);
    return contentSize(el, "height") + boxExtra(el, "paddingTop") + boxExtra(el, "paddingBottom");
  };

  fn.outerWidth = function (withMargin) {
    var el = this[0];
    if (!el) return undefined;
    if (el === window || el.nodeType === 9) return fn.width.call(this);
    var v = contentSize(el, "width") + boxExtra(el, "paddingLeft") + boxExtra(el, "paddingRight") +
      boxExtra(el, "borderLeftWidth") + boxExtra(el, "borderRightWidth");
    if (withMargin) v += boxExtra(el, "marginLeft") + boxExtra(el, "marginRight");
    return v;
  };

  fn.outerHeight = function (withMargin) {
    var el = this[0];
    if (!el) return undefined;
    if (el === window || el.nodeType === 9) return fn.height.call(this);
    var v = contentSize(el, "height") + boxExtra(el, "paddingTop") + boxExtra(el, "paddingBottom") +
      boxExtra(el, "borderTopWidth") + boxExtra(el, "borderBottomWidth");
    if (withMargin) v += boxExtra(el, "marginTop") + boxExtra(el, "marginBottom");
    return v;
  };

  fn.offset = function (optionsOrTop, maybeLeft) {
    /* 读取 */
    if (optionsOrTop === undefined) {
      var el = this[0];
      if (!el || !el.getBoundingClientRect) return null;

      var rect = el.getBoundingClientRect();
      var doc = el.ownerDocument || document;
      var win = doc.defaultView || doc.parentWindow;
      var docEl = doc.documentElement;
      var body = doc.body;

      return {
        top: rect.top + (win.pageYOffset || docEl.scrollTop || body.scrollTop || 0) - (docEl.clientTop || 0),
        left: rect.left + (win.pageXOffset || docEl.scrollLeft || body.scrollLeft || 0) - (docEl.clientLeft || 0)
      };
    }

    /* 设置：.offset({ top, left }) 或 .offset(top, left) */
    var top, left;
    if (optionsOrTop && typeof optionsOrTop === "object") {
      top = optionsOrTop.top;
      left = optionsOrTop.left;
    } else {
      top = optionsOrTop;
      left = maybeLeft;
    }

    return this.each(function () {
      var node = this;
      var cur = $a(node).offset();
      if (!cur) return;

      var cs = computed(node);
      var pos = cs.position;
      var curTop = parseFloat(cs.top);
      var curLeft = parseFloat(cs.left);

      if (pos === "static") node.style.position = "relative";

      if (top != null) node.style.top = (isNaN(curTop) ? 0 : curTop) + (top - cur.top) + "px";
      if (left != null) node.style.left = (isNaN(curLeft) ? 0 : curLeft) + (left - cur.left) + "px";
    });
  };

  fn.position = function () {
    var el = this[0];
    if (!el || !el.getBoundingClientRect) return null;

    var rect = el.getBoundingClientRect();
    var parent = el.offsetParent;

    /* 隐藏元素 / fixed 元素没有 offsetParent：按 0 处理 */
    if (!parent) return { top: 0, left: 0 };

    var cs = computed(el);
    var ps = computed(parent);
    var borderTop = parseFloat(ps.borderTopWidth) || 0;
    var borderLeft = parseFloat(ps.borderLeftWidth) || 0;
    var parentRect = parent.getBoundingClientRect();

    /* 相对 offsetParent 的 padding 边，并扣掉自身 margin */
    return {
      top: rect.top - parentRect.top - borderTop - (parseFloat(cs.marginTop) || 0),
      left: rect.left - parentRect.left - borderLeft - (parseFloat(cs.marginLeft) || 0)
    };
  };

  fn.scrollTop = function (value) {
    if (value === undefined) {
      var el = this[0];
      if (!el) return undefined;
      if (el === window || el.nodeType === 9) {
        return window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      }
      return el.scrollTop;
    }
    return this.each(function () {
      if (this === window || this.nodeType === 9) window.scrollTo(window.pageXOffset, value);
      else this.scrollTop = value;
    });
  };

  fn.scrollLeft = function (value) {
    if (value === undefined) {
      var el = this[0];
      if (!el) return undefined;
      if (el === window || el.nodeType === 9) {
        return window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0;
      }
      return el.scrollLeft;
    }
    return this.each(function () {
      if (this === window || this.nodeType === 9) window.scrollTo(value, window.pageYOffset);
      else this.scrollLeft = value;
    });
  };

  /* ==================== 表单序列化 ==================== */

  fn.serializeArray = function () {
    var out = [];

    this.each(function () {
      var els = this.elements ? this.elements : [this], i, j;

      for (i = 0; i < els.length; i++) {
        var el = els[i];
        var name = el.name;
        var type = (el.type || "").toLowerCase();

        if (!name || el.disabled) continue;
        if (/^(submit|button|image|reset|file)$/.test(type)) continue;
        if ((type === "checkbox" || type === "radio") && !el.checked) continue;

        if (el.nodeName === "SELECT") {
          for (j = 0; j < el.options.length; j++) {
            var opt = el.options[j];
            if (opt.selected && !opt.disabled) out.push({ name: name, value: opt.value });
          }
          continue;
        }

        out.push({ name: name, value: el.value });
      }
    });

    return out;
  };

  fn.serialize = function () {
    return $a.param(this.serializeArray());
  };

  /* ==================== 元素监听 / 剪贴板 ==================== */

  /*
   * $a.watch(selector, fn[, root])
   * 命中元素都会回调（已有的异步回调一次，之后新插入的也会），返回 { stop() }
   */
  $a.watch = function (selector, fn, root) {
    root = root || document;

    var stopped = false;
    var observer = null;
    var timer = null;
    var seen = [];

    function check() {
      if (stopped) return;
      var nodes = $a(selector, root), i;
      for (i = 0; i < nodes.length; i++) {
        if ($a.inArray(nodes[i], seen) < 0) {
          seen.push(nodes[i]);
          fn(nodes[i]);
        }
      }
    }

    /* 异步首查，避免回调先于返回值执行 */
    window.setTimeout(check, 0);

    if (window.MutationObserver) {
      observer = new window.MutationObserver(check);
      observer.observe(root === document ? document.documentElement : root, {
        childList: true,
        subtree: true
      });
    } else {
      timer = window.setInterval(check, 400);
    }

    return {
      stop: function () {
        stopped = true;
        if (observer) observer.disconnect();
        if (timer) window.clearInterval(timer);
      }
    };
  };

  /* $a.copy(text) → Promise；clipboard → clipboardData → execCommand 三级兜底 */
  $a.copy = function (text) {
    var d = $a.Deferred();
    var ta;

    text = String(text == null ? "" : text);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { d.resolve(text); },
        function () { d.reject("denied"); }
      );
      return d.promise();
    }

    if (window.clipboardData) {
      try {
        window.clipboardData.setData("Text", text);
        d.resolve(text);
      } catch (e) {
        d.reject(e);
      }
      return d.promise();
    }

    ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();

    try {
      d.resolve(document.execCommand("copy") ? text : null);
    } catch (e) {
      d.reject(e);
    }

    try {
      document.body.removeChild(ta);
    } catch (e) {
      /* 忽略：节点可能已被其他逻辑移走 */
    }
    return d.promise();
  };

  /* 私有：把集合还原成原始节点列表的快照 */
  fn._snapshot = function () {
    return this.toArray();
  };
})(window, document, window.$a);
