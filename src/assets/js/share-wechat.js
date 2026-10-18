/* 分享到微信：用 aQuery 本地生成二维码（不请求任何外部服务） */
(function () {
  "use strict";

  if (!window.$a) return;

  var ALLOWED = [
    "undz.cn",
    "yzhyzxy.cn",
    "gov.cn",
    "edu.cn",
    "io.hb.cn",
    "zyy.undz.cn",
  ];

  function allowed(host) {
    host = String(host || "").toLowerCase();

    for (var i = 0; i < ALLOWED.length; i++) {
      var d = ALLOWED[i];
      if (host === d || host.slice(-(d.length + 1)) === "." + d) return true;
    }

    return false;
  }

  $a(function () {
    var url = $a.query("url", "");
    var $box = $a("#wxshare-code");

    if (!/^https?:\/\//i.test(url)) {
      $a(".wxshare").remove();
      return;
    }

    var host = "";
    try {
      var a = document.createElement("a");
      a.href = url;
      host = a.hostname;
    } catch (e) {
      $box.html('<p class="wxshare__err">链接格式不正确。</p>');
      return;
    }

    if (!allowed(host)) {
      $a(".wxshare").remove();
      return;
    }

    /* IE 的 canvas 缩放/打印发虚，分享页对 IE 强制用表格 */
    var el = $a.qrcode($box, url, {
      size: 200,
      level: "M",
      margin: 2,
      render: $a.ie() ? "table" : "auto",
    });

    /* 生成失败（内容过长等）：给一个复制链接的兜底 */
    if (!el) {
      var $btn = $a('<button type="button" class="btn btn--text">复制链接</button>');

      $btn.on("click", function () {
        $a.copy(url).done(function () {
          $btn.text("已复制");
        });
      });

      $box.append($btn);
    }
  });
})();
