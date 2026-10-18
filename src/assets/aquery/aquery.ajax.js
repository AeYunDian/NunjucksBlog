/*!
 * aQuery.ajax.js — Ajax / JSONP / 脚本加载
 * 依赖：aquery.core.js、aquery.utils.js、aquery.deferred.js、aquery.events.js
 */
(function (window, document, $a) {
  "use strict";

  var fn = $a.fn;

  var defaults = {
    url: "",
    type: "GET",
    data: null,
    dataType: "text", /* text | html | json | xml | script | jsonp */
    contentType: "application/x-www-form-urlencoded; charset=UTF-8",
    processData: true,
    async: true,
    cache: true,
    timeout: 0,
    headers: null,
    xhrFields: null,
    context: null,
    global: true,
    jsonp: "callback",
    jsonpCallback: null,
    beforeSend: null,
    dataFilter: null,
    converters: {
      "text json": function (text) {
        return $a.parseJSON(text);
      },
      "text xml": function (text) {
        return $a.parseXML(text);
      },
      "text html": function (text) {
        return text;
      },
      "text text": function (text) {
        return text;
      }
    }
  };

  $a.ajaxSettings = defaults;

  /* 深度合并默认设置 */
  $a.ajaxSetup = function (options) {
    return $a.extend(true, defaults, options || {});
  };

  function convert(data, from, to, opts) {
    var key = from + " " + to;
    var fnConv = opts.converters && opts.converters[key];
    return fnConv ? fnConv(data) : data;
  }

  /* dataFilter + converters */
  function shape(data, opts) {
    var type = opts.dataType || "text";
    if (opts.dataFilter) data = opts.dataFilter(data, type);
    return convert(data, "text", type, opts);
  }

  var jsonpSeq = 0;
  var activeCount = 0;

  function isFormData(data) {
    return !!window.FormData && data instanceof window.FormData;
  }

  function isCrossDomain(url) {
    var a = document.createElement("a");
    a.href = url;
    return a.protocol + "//" + a.host !== window.location.protocol + "//" + window.location.host;
  }

  function addQuery(url, query) {
    if (!query) return url;
    return url + (url.indexOf("?") > -1 ? "&" : "?") + query;
  }

  function queryOf(opts) {
    if (opts.data == null) return "";
    if (isFormData(opts.data)) return "";
    if (typeof opts.data === "string") return opts.data;
    return opts.processData === false ? "" : $a.param(opts.data);
  }

  function head() {
    return document.head || document.getElementsByTagName("head")[0];
  }

  function withGlobal(opts, hook) {
    if (opts.global !== false) hook();
  }

  /* ---------------- JSONP ---------------- */

  function jsonp(opts, deferred) {
    var custom = opts.jsonpCallback;
    var name = typeof custom === "function"
      ? custom()
      : (custom || ("a_jsonp_" + (++jsonpSeq) + "_" + $a.now()));
    var url = addQuery(opts.url, queryOf(opts));
    var param = opts.jsonp || "callback";
    var script = document.createElement("script");
    var done = false;
    var timer = null;

    url = addQuery(url, param + "=" + encodeURIComponent(name));

    function finish(ok, data, reason) {
      if (done) return;
      done = true;
      if (timer) window.clearTimeout(timer);

      if (!custom) {
        try {
          delete window[name];
        } catch (e) {
          window[name] = undefined;
        }
      }
      if (script.parentNode) script.parentNode.removeChild(script);

      if (ok) {
        var result;
        try {
          result = opts.dataFilter ? opts.dataFilter(data, opts.dataType) : data;
        } catch (err) {
          deferred.reject(script, "parsererror", err);
          return;
        }
        deferred.resolve(result, "success", script);
      } else {
        deferred.reject(script, reason || "error");
      }
    }

    window[name] = function (data) {
      finish(true, data);
    };

    script.onload = script.onerror = function () {
      finish(false);
    };

    if (opts.timeout > 0) {
      timer = window.setTimeout(function () {
        finish(false, null, "timeout");
      }, opts.timeout);
    }

    script.src = url;
    head().appendChild(script);

    return script;
  }

  /* ---------------- 脚本 ---------------- */

  function script(opts, deferred) {
    var s = document.createElement("script");
    var done = false;
    var timer = null;

    function finish(ok, reason) {
      if (done) return;
      done = true;
      if (timer) window.clearTimeout(timer);
      if (s.parentNode) s.parentNode.removeChild(s);
      if (ok) deferred.resolve(undefined, "success", s);
      else deferred.reject(s, reason || "error");
    }

    s.onload = function () {
      finish(true);
    };
    s.onerror = function () {
      finish(false);
    };

    if (opts.timeout > 0) {
      timer = window.setTimeout(function () {
        finish(false, "timeout");
      }, opts.timeout);
    }

    s.src = addQuery(opts.url, queryOf(opts));
    s.async = true;
    head().appendChild(s);

    return s;
  }

  /* ---------------- XMLHttpRequest ---------------- */

  function xhr(opts, deferred) {
    var type = String(opts.type).toUpperCase();
    var query = queryOf(opts);
    var url = opts.url;
    var body = null;
    var timer = null;
    var finished = false;
    var x = new window.XMLHttpRequest();

    if (type === "GET" || type === "HEAD") {
      url = addQuery(url, query);
      if (opts.cache === false) url = addQuery(url, "_=" + $a.now());
    } else {
      /* FormData 直接交给浏览器，保留 boundary */
      body = isFormData(opts.data) ? opts.data : query;
    }

    function complete() {
      if (finished) return;
      finished = true;
      if (timer) window.clearTimeout(timer);

      var status = x.status === 1223 ? 204 : x.status;
      var text = "";

      try {
        text = x.responseText;
      } catch (e) {
        text = "";
      }

      if ((status >= 200 && status < 300) || status === 304 || status === 0) {
        var result;
        try {
          result = shape(text, opts);
        } catch (err) {
          deferred.reject(x, "parsererror", err);
          return;
        }
        deferred.resolve(result, "success", x);
      } else {
        deferred.reject(x, "error", text);
      }
    }

    try {
      x.open(type, url, opts.async !== false);

      /* FormData 时不要覆盖浏览器生成的 multipart boundary */
      if (body !== null && opts.contentType && !isFormData(opts.data)) {
        x.setRequestHeader("Content-Type", opts.contentType);
      }
      if (opts.headers) {
        for (var k in opts.headers) {
          if (opts.headers.hasOwnProperty(k)) x.setRequestHeader(k, opts.headers[k]);
        }
      }
      if (opts.xhrFields) {
        for (var f in opts.xhrFields) {
          if (opts.xhrFields.hasOwnProperty(f)) x[f] = opts.xhrFields[f];
        }
      }

      if (opts.beforeSend && opts.beforeSend(x, opts) === false) {
        finished = true;
        deferred.reject(x, "abort");
        return x;
      }
    } catch (e) {
      deferred.reject(x, "error", e);
      return x;
    }

    var hasLoad = "onload" in x;

    if (hasLoad) {
      x.onload = complete;
      x.onerror = function () {
        if (finished) return;
        finished = true;
        if (timer) window.clearTimeout(timer);
        deferred.reject(x, "error", "network");
      };
    } else {
      /* IE9 只有 readyState */
      x.onreadystatechange = function () {
        if (x.readyState === 4) complete();
      };
    }

    if (opts.async !== false && opts.timeout > 0) {
      if (hasLoad && "timeout" in x) {
        x.timeout = opts.timeout;
        x.ontimeout = function () {
          if (finished) return;
          finished = true;
          try {
            x.abort();
          } catch (e) {
            /* 忽略 */
          }
          deferred.reject(x, "timeout");
        };
      } else {
        timer = window.setTimeout(function () {
          if (finished) return;
          finished = true;
          try {
            x.abort();
          } catch (e) {
            /* 忽略 */
          }
          deferred.reject(x, "timeout");
        }, opts.timeout);
      }
    }

    x.send(body);

    /* 同步请求在部分浏览器不触发 load，补一次兜底 */
    if (opts.async === false && !finished) complete();

    return x;
  }

  /* ---------------- XDomainRequest（IE9 跨域） ---------------- */

  function xdr(opts, deferred) {
    var type = String(opts.type).toUpperCase();
    var query = queryOf(opts);
    var url = type === "GET" ? addQuery(opts.url, query) : opts.url;
    var body = type === "GET" ? null : query;
    var x = new window.XDomainRequest();

    x.onload = function () {
      var result;

      try {
        result = shape(x.responseText, opts);
      } catch (e) {
        deferred.reject(x, "parsererror", e);
        return;
      }

      deferred.resolve(result, "success", x);
    };

    x.onerror = function () {
      var text = "";
      try {
        text = x.responseText || "";
      } catch (e) {
        /* XDR 出错时读 responseText 可能抛 */
      }
      deferred.reject(x, "error", text);
    };

    x.open(type, url);

    /* XDR 必须显式设置 timeout 才会触发 ontimeout */
    if (opts.timeout > 0) {
      x.timeout = opts.timeout;
      x.ontimeout = function () {
        deferred.reject(x, "timeout");
      };
    }

    if (opts.beforeSend && opts.beforeSend(x, opts) === false) {
      deferred.reject(x, "abort");
      return x;
    }

    /* IE9 要求异步 send，否则请求会丢 */
    window.setTimeout(function () {
      try {
        x.send(body);
      } catch (e) {
        deferred.reject(x, "error", e);
      }
    }, 0);

    return x;
  }

  /* ---------------- $a.ajax ---------------- */

  $a.ajax = function (options) {
    var opts = $a.extend(true, {}, defaults, options || {});
    var d = $a.Deferred();
    var ctx = opts.context || opts;
    var successFns = opts.success;
    var errorFns = opts.error;
    var completeFns = opts.complete;

    opts.type = String(opts.type || "GET").toUpperCase();
    opts.url = opts.url || window.location.href;

    d.done(function (data, status, x) {
      withGlobal(opts, function () {
        $a(document).trigger("ajaxSuccess", [x, opts, data]);
      });
      if (successFns) successFns.call(ctx, data, status, x);
    });

    d.fail(function (x, status, err) {
      withGlobal(opts, function () {
        $a(document).trigger("ajaxError", [x, opts, err]);
      });
      if (errorFns) errorFns.call(ctx, x, status, err);
    });

    d.always(function (x) {
      withGlobal(opts, function () {
        activeCount = activeCount > 0 ? activeCount - 1 : 0;
        $a(document).trigger("ajaxComplete", [x, opts]);
        if (activeCount === 0) $a(document).trigger("ajaxStop");
      });
      if (completeFns) completeFns.call(ctx, x, "complete");
    });

    withGlobal(opts, function () {
      if (activeCount === 0) $a(document).trigger("ajaxStart");
      activeCount++;
      $a(document).trigger("ajaxSend", [null, opts]);
    });

    var req = null;

    if (opts.dataType === "jsonp") {
      if (opts.beforeSend && opts.beforeSend(null, opts) === false) {
        d.reject(null, "abort");
        return d.promise();
      }
      req = jsonp(opts, d);
    } else if (opts.dataType === "script") {
      if (opts.beforeSend && opts.beforeSend(null, opts) === false) {
        d.reject(null, "abort");
        return d.promise();
      }
      req = script(opts, d);
    } else if (isCrossDomain(opts.url) && window.XDomainRequest) {
      req = xdr(opts, d);
    } else {
      req = xhr(opts, d);
    }

    var promise = d.promise();

    /* 暴露底层句柄，便于 abort：$a.ajax(...).xhr.abort() */
    promise.xhr = req;

    return promise;
  };

  /* ---------------- 快捷方法 ---------------- */

  $a.get = function (url, data, cb, type) {
    if (typeof data === "function") {
      cb = data;
      data = null;
    }
    return $a.ajax({ url: url, type: "GET", data: data, dataType: type || "text", success: cb });
  };

  $a.post = function (url, data, cb, type) {
    if (typeof data === "function") {
      cb = data;
      data = null;
    }
    return $a.ajax({ url: url, type: "POST", data: data, dataType: type || "text", success: cb });
  };

  $a.getJSON = function (url, data, cb) {
    if (typeof data === "function") {
      cb = data;
      data = null;
    }
    return $a.ajax({ url: url, type: "GET", data: data, dataType: "json", success: cb });
  };

  $a.getScript = function (url, cb) {
    var p = $a.ajax({ url: url, dataType: "script" });
    if (cb) p.done(cb);
    return p;
  };

  /* .load(url[, data][, cb])：成功 (html, "success", xhr)，失败 (text, "error", xhr) */
  fn.load = function (url, data, cb) {
    if (typeof data === "function") {
      cb = data;
      data = null;
    }

    var self = this;
    var p = $a.ajax({
      url: url,
      type: data ? "POST" : "GET",
      data: data,
      dataType: "html"
    });

    p.done(function (html, status, xhr) {
      self.empty().append(html);
      if (cb) cb.call(self, html, status, xhr);
    });

    p.fail(function (xhr, status) {
      if (cb) cb.call(self, xhr && xhr.responseText ? xhr.responseText : "", status, xhr);
    });

    /* 私有：把最近一次请求挂出来，方便需要 abort 的调用方取用 */
    self._request = p;

    return this;
  };

  /* 私有：在途请求数、JSONP 序号，便于调试与测试 */
  $a._active = function () {
    return activeCount;
  };
  $a._jsonpSeq = function () {
    return jsonpSeq;
  };
})(window, document, window.$a);
