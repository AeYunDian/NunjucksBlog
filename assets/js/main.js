/* 站点交互：全部基于 aQuery（全局 $a），无其他依赖 */
(function () {
  "use strict";

  if (!window.$a) return;

  var root = document.documentElement;

  /* 有 JS 就去掉 no-js；.only-js 由 CSS 控制显隐 */
  $a(root).removeClass("no-js");

  $a(function () {
    /* ---------------- 键盘焦点 ---------------- */
    $a(document)
      .on("keydown", function (e) {
        if (e.keyCode === 9) $a(root).addClass("keyboard-focus");
      })
      .on("mousedown", function () {
        $a(root).removeClass("keyboard-focus");
      });

    /* ---------------- 抽屉 ---------------- */
    var $drawer = $a("#drawer");
    var $scrim = $a("#drawer-scrim");
    var $open = $a("#menu-open");
    var $close = $a("#menu-close");
    var $body = $a("body");
    var lastFocus = null;

    function focusables() {
      return $drawer.find('a[href], button:not([disabled])').filter(function () {
        return !!(this.offsetWidth || this.offsetHeight);
      });
    }

    function openDrawer() {
      lastFocus = document.activeElement;
      $drawer.addClass("is-open").attr("aria-hidden", "false");
      $scrim.addClass("is-open");
      $body.addClass("is-locked");
      $open.attr("aria-expanded", "true");
      $close.focus();
    }

    function closeDrawer() {
      $drawer.removeClass("is-open").attr("aria-hidden", "true");
      $scrim.removeClass("is-open");
      $body.removeClass("is-locked");
      $open.attr("aria-expanded", "false");
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    $open.on("click", openDrawer);
    $close.on("click", closeDrawer);
    $scrim.on("click", closeDrawer);

    $a(document).on("keydown", function (e) {
      if (!$drawer.hasClass("is-open")) return;

      if (e.keyCode === 27) {
        closeDrawer();
        return;
      }
      if (e.keyCode !== 9) return;

      var items = focusables();
      if (!items.length) return;

      var first = items[0];
      var last = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    /* ---------------- 打印 ---------------- */
    $a('[data-action="print"]').on("click", function () {
      window.print();
    });

    /* ---------------- 复制 ---------------- */
    $a('[data-action="copy"]').on("click", function () {
      var $btn = $a(this);
      var text = $btn.attr("data-copy") || "";
      var label = $btn.text();

      $a.copy(text).done(function () {
        $btn.text("✓");
        window.setTimeout(function () {
          $btn.text(label);
        }, 1500);
      });
    });

    /* ---------------- 重新授权 ---------------- */
    $a('[data-action="reset-consent"]').on("click", function () {
      try {
        localStorage.removeItem("gov_cookie_consent");
      } catch (e) {
        /* 忽略 */
      }
      window.location.reload();
    });

    /* ---------------- 顶栏滚动阴影 ---------------- */
    var $bar = $a(".app-bar");
    var barTick = false;

    function syncBar() {
      $bar.toggleClass("is-scrolled", window.pageYOffset > 4);
    }

    $a(window).on("scroll", function () {
      if (barTick) return;
      barTick = true;
      window.requestAnimationFrame(function () {
        barTick = false;
        syncBar();
      });
    });

    syncBar();

    /* ---------------- 回到顶部 ---------------- */
    var $top = $a("#to-top");

    function syncTop() {
      $top.toggleClass("is-visible", window.pageYOffset > 600);
    }

    $a(window).on("scroll", syncTop);
    syncTop();

    $top.on("click", function () {
      var reduce =
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (reduce || !window.requestAnimationFrame) {
        window.scrollTo(0, 0);
        return;
      }

      var start = window.pageYOffset;
      var from = null;

      var step = function (ts) {
        if (from === null) from = ts;
        var p = Math.min(1, (ts - from) / 320);
        var eased = 1 - Math.pow(1 - p, 3);
        window.scrollTo(0, Math.round(start * (1 - eased)));
        if (p < 1) window.requestAnimationFrame(step);
      };

      window.requestAnimationFrame(step);
    });

    /* ---------------- Roboto（非阻塞） ---------------- */
    var fontLink = document.createElement("link");
    fontLink.rel = "stylesheet";
    fontLink.href = "https://cdn.undz.cn/css2?family=Roboto:wght@400;500;700&display=swap";
    $a(document.head || document.documentElement).append(fontLink);
  });
})();
