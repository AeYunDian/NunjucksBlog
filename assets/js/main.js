/* global jQuery */
(function ($) {
  "use strict";

  if (typeof window === "undefined") return;

  var $body = $("body");
  var $drawer = $("#drawer");
  var $scrim = $("#drawer-scrim");
  var $open = $("#menu-open");
  var $close = $("#menu-close");
  var lastFocus = null;

  /* 键盘用户保留焦点框，鼠标点击不显示（IE10 没有 :focus-visible） */
  $body.on("keydown", function (e) {
    if (e.key === "Tab" || e.keyCode === 9) {
      $("html").addClass("keyboard-focus");
    }
  });
  $body.on("mousedown", function () {
    $("html").removeClass("keyboard-focus");
  });

  function focusables() {
    return $drawer
      .find('a[href], button:not([disabled])')
      .filter(":visible");
  }

  function openDrawer() {
    lastFocus = document.activeElement;
    $drawer.addClass("is-open").attr("aria-hidden", "false");
    $scrim.addClass("is-open");
    $body.addClass("is-locked");
    $open.attr("aria-expanded", "true");
    var $first = $drawer.find("#menu-close");
    if ($first.length) $first.trigger("focus");
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

  $(document).on("keydown", function (e) {
    if (!$drawer.hasClass("is-open")) return;

    if (e.key === "Escape" || e.keyCode === 27) {
      closeDrawer();
      return;
    }

    if (e.key === "Tab" || e.keyCode === 9) {
      var $items = focusables();
      if (!$items.length) return;
      var first = $items[0];
      var last = $items[$items.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  /* 打印 */
  $('[data-action="print"]').on("click", function () {
    window.print();
  });

  /* 复制地址（RSS 页） */
  $('[data-action="copy"]').on("click", function () {
    var $btn = $(this);
    var text = $btn.attr("data-copy") || "";
    var done = function () {
      var label = $btn.text();
      $btn.text("已复制");
      window.setTimeout(function () {
        $btn.text(label);
      }, 1500);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () {});
      return;
    }

    var $tmp = $("<textarea>").val(text).appendTo("body").select();
    try {
      document.execCommand("copy");
      done();
    } catch (e) {
      /* 忽略 */
    }
    $tmp.remove();
  });

  /* 回到顶部：滚动超过 600px 才出现 */
  var $top = $("#to-top");
  if ($top.length) {
    var onScroll = function () {
      if (window.pageYOffset > 600) {
        $top.addClass("is-visible");
      } else {
        $top.removeClass("is-visible");
      }
    };
    $(window).on("scroll", onScroll);
    onScroll();

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
      var duration = 320;

      var step = function (ts) {
        if (from === null) from = ts;
        var p = Math.min(1, (ts - from) / duration);
        var eased = 1 - Math.pow(1 - p, 3);
        window.scrollTo(0, Math.round(start * (1 - eased)));
        if (p < 1) window.requestAnimationFrame(step);
      };

      window.requestAnimationFrame(step);
    });
  }
})(window.jQuery);
