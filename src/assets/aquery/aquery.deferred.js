/*!
 * aQuery.deferred.js — Deferred / when
 * 依赖：aquery.core.js、aquery.utils.js；运行时依赖 aquery.dom.js（$a.wait 调用 $a.watch）
 */
(function (window, $a) {
  "use strict";

  $a.Deferred = function (beforeStart) {
    var state = "pending";
    var args = [];
    var handlers = [];
    var promise;

    function settle(newState, values) {
      if (state !== "pending") return;
      state = newState;
      args = values;

      var list = handlers;
      handlers = [];
      $a.each(list, function (i, h) {
        if (h.type === "always" || h.type === state) {
          h.fn.apply(h.ctx || null, args);
        }
      });
    }

    function add(type, fn, ctx) {
      if (typeof fn !== "function") return promise;

      if (state === "pending") {
        handlers.push({ type: type, fn: fn, ctx: ctx });
      } else if (type === "always" || type === state) {
        var copy = args;
        window.setTimeout(function () {
          fn.apply(ctx || null, copy);
        }, 0);
      }
      return promise;
    }

    var deferred = {
      resolve: function () {
        settle("resolved", Array.prototype.slice.call(arguments));
        return deferred;
      },
      reject: function () {
        settle("rejected", Array.prototype.slice.call(arguments));
        return deferred;
      },
      promise: function () {
        return promise;
      }
    };

    promise = {
      done: function (fn) {
        return add("resolved", fn);
      },
      fail: function (fn) {
        return add("rejected", fn);
      },
      always: function (fn) {
        return add("always", fn);
      },
      then: function (onOk, onFail) {
        var d = $a.Deferred();

        add("resolved", function () {
          if (typeof onOk === "function") {
            try {
              var r = onOk.apply(null, arguments);
              if (r && typeof r.then === "function") r.then(d.resolve, d.reject);
              else d.resolve(r);
            } catch (e) {
              d.reject(e);
            }
          } else {
            d.resolve.apply(d, arguments);
          }
        });

        add("rejected", function () {
          if (typeof onFail === "function") {
            try {
              var r = onFail.apply(null, arguments);
              if (r && typeof r.then === "function") r.then(d.resolve, d.reject);
              else d.resolve(r);
            } catch (e) {
              d.reject(e);
            }
          } else {
            d.reject.apply(d, arguments);
          }
        });

        return d.promise();
      },
      promise: function () {
        return promise;
      },
      state: function () {
        return state;
      }
    };

    if (typeof beforeStart === "function") beforeStart(deferred);

    return deferred;
  };

  /* 等所有传入的 thenable 都成功；任一失败则直接失败 */
  $a.when = function () {
    var items = Array.prototype.slice.call(arguments);
    var d = $a.Deferred();
    var remaining = items.length;
    var results = [];

    if (!remaining) {
      d.resolve();
      return d.promise();
    }

    $a.each(items, function (i, item) {
      if (!item || typeof item.then !== "function") {
        results[i] = item;
        if (--remaining === 0) d.resolve.apply(d, results);
        return;
      }

      item.then(
        function () {
          results[i] = arguments.length > 1
            ? Array.prototype.slice.call(arguments)
            : arguments[0];
          if (--remaining === 0) d.resolve.apply(d, results);
        },
        function () {
          d.reject.apply(d, arguments);
        }
      );
    });

    return d.promise();
  };

  /* 返回 Promise 的定时器 */
  $a.sleep = function (ms) {
    var d = $a.Deferred();
    window.setTimeout(function () {
      d.resolve();
    }, ms || 0);
    return d.promise();
  };

  /* 等某个选择器出现；超时 reject("timeout") */
  $a.wait = function (selector, timeout) {
    var d = $a.Deferred();
    var found = $a(selector);
    var watcher, timer;

    if (found.length) {
      d.resolve(found);
      return d.promise();
    }

    watcher = $a.watch(selector, function (el) {
      watcher.stop();
      if (timer) window.clearTimeout(timer);
      d.resolve($a(el));
    });

    if (timeout) {
      timer = window.setTimeout(function () {
        watcher.stop();
        d.reject("timeout");
      }, timeout);
    }

    return d.promise();
  };
})(window, window.$a);
