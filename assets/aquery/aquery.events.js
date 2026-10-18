/*!
 * aQuery.events.js — 事件绑定 / 委托 / 命名空间 / 快捷事件
 * 依赖：aquery.core.js、aquery.utils.js
 */
(function (window, document, $a) {
  "use strict";

  var fn = $a.fn;
  var EXPANDO = "__aEvents";

  function storeOf(el) {
    if (!el[EXPANDO]) el[EXPANDO] = {};
    return el[EXPANDO];
  }

  function parseTypes(types) {
    var out = [];
    $a.each(String(types).split(/\s+/), function (i, t) {
      if (!t) return;
      var parts = t.split(".");
      var ns = parts.length > 1 ? parts.slice(1).sort().join(".") : "";
      if (parts[0]) out.push({ type: parts[0], ns: ns });
      else if (ns) out.push({ type: null, ns: ns });
    });
    return out;
  }

  /* 命名空间匹配：绑定 a.b，用 .a 或 .b 都能解绑 */
  function nsMatch(bound, ns) {
    if (!ns) return true;
    if (!bound) return false;
    return ("." + bound + ".").indexOf("." + ns + ".") > -1;
  }

  /* ---------------- 事件对象 ---------------- */

  function AEvent(src) {
    src = src || window.event;
    this.originalEvent = src;
    this.type = src.type;
    this.target = src.target || src.srcElement;
    this.currentTarget = src.currentTarget;
    this.relatedTarget = src.relatedTarget || src.fromElement || src.toElement;
    this.keyCode = src.keyCode;
    this.which = src.which || src.keyCode || src.charCode;
    this.button = src.button;
    this.clientX = src.clientX;
    this.clientY = src.clientY;
    this.pageX = src.pageX;
    this.pageY = src.pageY;
    this.data = null;
    this.namespace = "";
    this.delegateTarget = null;
    this.handleObj = null;
    this.isDefaultPrevented = false;
    this.isPropagationStopped = false;
    this.isImmediatePropagationStopped = false;
  }

  AEvent.prototype = {
    constructor: AEvent,

    preventDefault: function () {
      this.isDefaultPrevented = true;
      var e = this.originalEvent;
      if (e.preventDefault) e.preventDefault();
      else e.returnValue = false;
    },

    stopPropagation: function () {
      this.isPropagationStopped = true;
      var e = this.originalEvent;
      if (e.stopPropagation) e.stopPropagation();
      else e.cancelBubble = true;
    },

    stopImmediatePropagation: function () {
      this.isPropagationStopped = true;
      this.isImmediatePropagationStopped = true;
      var e = this.originalEvent;
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      else e.cancelBubble = true;
    }
  };

  $a.Event = function (src) {
    return new AEvent(src);
  };

  /* ---------------- 派发 ---------------- */

  function dispatch(native) {
    var el = this;
    var ev = $a.Event(native);
    var list = (storeOf(el)[ev.type] || []).slice();
    var i, h, ctx, node;

    for (i = 0; i < list.length; i++) {
      h = list[i];
      ctx = el;

      /* 委托：从 target 往上找最近的匹配元素 */
      if (h.selector) {
        /* IE 下 target 可能是文本节点，先上溯到元素 */
        node = ev.target;
        while (node && node.nodeType !== 1) node = node.parentNode;

        ctx = null;
        while (node && node !== el && node.nodeType === 1) {
          if ($a.matchesAny(node, h.selector, el)) {
            ctx = node;
            break;
          }
          node = node.parentNode;
        }
        if (!ctx) continue;
        ev.delegateTarget = el;
      }

      ev.currentTarget = ctx;
      ev.data = h.data;
      ev.namespace = h.ns;
      ev.handleObj = h;

      if (h.fn.call(ctx, ev) === false) {
        ev.preventDefault();
        ev.stopPropagation();
      }

      if (ev.isImmediatePropagationStopped) break;
    }
  }

  /* ---------------- 绑定 / 解绑 ---------------- */

  fn.on = function (types, selector, dataArg, handler) {
    if (typeof selector === "function") {
      handler = selector;
      selector = null;
      dataArg = null;
    } else if (selector && typeof selector === "object") {
      /* on(types, data, fn)：selector 位置传的是 data，原 handler 不能丢 */
      if (handler === undefined && typeof dataArg === "function") handler = dataArg;
      dataArg = selector;
      selector = null;
    }
    if (handler === undefined && typeof dataArg === "function") {
      handler = dataArg;
      dataArg = null;
    }
    if (typeof handler !== "function") return this;

    var events = parseTypes(types);

    return this.each(function () {
      var el = this;
      var store = storeOf(el);

      $a.each(events, function (i, e) {
        if (!e.type) return; /* 纯命名空间只用于 off，不参与绑定 */
        var list = store[e.type] || (store[e.type] = []);
        list.push({ type: e.type, ns: e.ns, selector: selector, data: dataArg, fn: handler });

        if (list.length === 1) el.addEventListener(e.type, dispatch, false);
      });
    });
  };

  fn.off = function (types, selector, handler) {
    var events, keys;

    if (!arguments.length) {
      return this.each(function () {
        var el = this, store = storeOf(el), k;
        for (k in store) {
          if (store.hasOwnProperty(k)) el.removeEventListener(k, dispatch, false);
        }
        el[EXPANDO] = {};
      });
    }

    if (typeof selector === "function") {
      handler = selector;
      selector = null;
    }

    events = types ? parseTypes(types) : null;

    return this.each(function () {
      var el = this;
      var store = storeOf(el);

      /* 优先 Object.keys */
      if (Object.keys) {
        keys = Object.keys(store);
      } else {
        keys = [];
        for (var k in store) if (store.hasOwnProperty(k)) keys.push(k);
      }

      $a.each(keys, function (i, type) {
        var list = store[type] || [];
        var keep = [];

        $a.each(list, function (j, h) {
          if (events) {
            var hit = false;
            $a.each(events, function (n, e) {
              if ((e.type === null || e.type === type) && nsMatch(h.ns, e.ns)) hit = true;
            });
            if (!hit) {
              keep.push(h);
              return;
            }
          }
          if (selector && h.selector !== selector) {
            keep.push(h);
            return;
          }
          if (handler && h.fn !== handler) {
            keep.push(h);
            return;
          }
        });

        if (keep.length) {
          store[type] = keep;
        } else {
          el.removeEventListener(type, dispatch, false);
          delete store[type];
        }
      });
    });
  };

  fn.bind = fn.on;
  fn.unbind = fn.off;

  fn.delegate = function (selector, types, handler) {
    return this.on(types, selector, handler);
  };

  fn.undelegate = function (selector, types, handler) {
    return this.off(types, selector, handler);
  };

  fn.one = function (types, selector, dataArg, handler) {
    if (typeof selector === "function") {
      handler = selector;
      selector = null;
      dataArg = null;
    } else if (selector && typeof selector === "object") {
      if (handler === undefined && typeof dataArg === "function") handler = dataArg;
      dataArg = selector;
      selector = null;
    }
    if (handler === undefined && typeof dataArg === "function") {
      handler = dataArg;
      dataArg = null;
    }

    var self = this;
    var wrapped = function (ev) {
      self.off(types, selector, wrapped);
      handler.call(this, ev);
    };

    return this.on(types, selector, dataArg, wrapped);
  };

  /* ---------------- 触发 ---------------- */

  /* 从触发点向上冒泡派发 */
  function bubbleFrom(el, name, ns, dataArg) {
    var ev = $a.Event({ type: name, target: el });
    var node = el;
    var list, store, i, h, ctx, cur;

    ev.data = dataArg;
    ev.namespace = ns;

    while (node && (node.nodeType === 1 || node.nodeType === 9)) {
      /* 只读已有事件表，避免在祖先上创建空对象 */
      store = node[EXPANDO];
      list = store && store[name] ? store[name].slice() : [];

      for (i = 0; i < list.length; i++) {
        h = list[i];
        ctx = node;

        if (h.selector) {
          ctx = null;
          cur = el;
          while (cur && cur.nodeType !== 1) cur = cur.parentNode;
          while (cur && cur !== node && cur.nodeType === 1) {
            if ($a.matchesAny(cur, h.selector, node)) {
              ctx = cur;
              break;
            }
            cur = cur.parentNode;
          }
          if (!ctx) continue;
          ev.delegateTarget = node;
        } else {
          ev.delegateTarget = null;
        }

        if (!nsMatch(h.ns, ns)) continue;

        ev.currentTarget = ctx;
        ev.data = h.data !== undefined ? h.data : dataArg;

        if (h.fn.call(ctx, ev) === false) {
          ev.preventDefault();
          ev.stopPropagation();
        }

        if (ev.isImmediatePropagationStopped) return;
      }

      if (ev.isPropagationStopped) break;
      node = node.parentNode;
    }
  }

  fn.trigger = function (type, dataArg) {
    var parts = String(type).split(".");
    var name = parts[0];
    var ns = parts.length > 1 ? parts.slice(1).sort().join(".") : "";

    return this.each(function () {
      bubbleFrom(this, name, ns, dataArg);
    });
  };

  /* ---------------- 快捷事件 ---------------- */

  $a.each(
    ("click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave " +
      "keydown keyup keypress submit change focus blur select scroll").split(" "),
    function (i, name) {
      fn[name] = function (handler) {
        if (typeof handler === "function") return this.on(name, handler);
        if (this[0] && this[0].nodeType === 1 && typeof this[0][name] === "function") {
          this[0][name]();
        }
        return this;
      };
    }
  );

  fn.hover = function (onEnter, onLeave) {
    return this.on("mouseenter", onEnter).on("mouseleave", onLeave);
  };

  /* ==================== 媒体查询 ==================== */

  /* $a.media("(min-width: 905px)", fn) → { stop() }；fn 立即收到当前状态 */
  $a.media = function (query, fn) {
    var mql, handler;

    if (!window.matchMedia) {
      fn(false);
      return { stop: function () {} };
    }

    mql = window.matchMedia(query);
    handler = function (e) {
      fn(e.matches);
    };

    fn(mql.matches);

    if (mql.addEventListener) mql.addEventListener("change", handler);
    else if (mql.addListener) mql.addListener(handler);

    return {
      stop: function () {
        if (mql.removeEventListener) mql.removeEventListener("change", handler);
        else if (mql.removeListener) mql.removeListener(handler);
      }
    };
  };

  /* 私有：清掉元素（含后代）上的事件与 data（remove() 调用） */
  function cleanOne(el) {
    var store = el[EXPANDO], k;

    if (store) {
      for (k in store) {
        if (store.hasOwnProperty(k)) el.removeEventListener(k, dispatch, false);
      }
    }

    el[EXPANDO] = null;
    if ("__aData" in el) el.__aData = null;
  }

  $a._cleanData = function (el) {
    if (!el) return;

    /* 先清自身，再递归清后代，避免脱离 DOM 的子树残留事件表 */
    cleanOne(el);

    if (el.getElementsByTagName) {
      var nodes = el.getElementsByTagName("*");
      for (var i = 0; i < nodes.length; i++) cleanOne(nodes[i]);
    }
  };

  /* 私有：事件表挂在元素上的属性名，以及当前监听总数（调试用） */
  $a._eventKey = EXPANDO;
  $a._eventCount = 0;
})(window, document, window.$a);
