# aQuery

> 这不是重构jQuery，这是另一个产品，所有是有区别的！！！

站内自用的轻量 DOM / 请求库。ES5 写法，IE9+ 可运行，无依赖，全局变量 `$a`。

> 命名：aQuery = a + Query，`a` 既是 Ay 项目前缀的首字母，也取「一个」之意。
> 当前版本：`0.2.2`

## 文件与加载顺序

```html
<script src="/assets/aquery/aquery.core.js"></script>
<script src="/assets/aquery/aquery.utils.js"></script>
<script src="/assets/aquery/aquery.deferred.js"></script>
<script src="/assets/aquery/aquery.dom.js"></script>
<script src="/assets/aquery/aquery.qrcode.js"></script>
<script src="/assets/aquery/aquery.events.js"></script>
<script src="/assets/aquery/aquery.ajax.js"></script>
```

| 文件                 | 内容                                                                | 依赖                          |
| -------------------- | ------------------------------------------------------------------- | ----------------------------- |
| `aquery.core.js`     | `$a()`、选择器引擎、`ready`、`each`、`merge`、`unique`              | —                             |
| `aquery.utils.js`    | 工具函数 + `query/hash/store/tmpl` + 浏览器判定 + 版本表达式        | core                          |
| `aquery.deferred.js` | `Deferred`、`when`、`sleep`、`wait`                                 | core、utils、dom（wait 用 watch） |
| `aquery.dom.js`      | 遍历、插入/删除、属性/样式、`data`、尺寸位置、表单、`watch`、`copy` | core、utils、deferred（copy 用 Deferred） |
| `aquery.qrcode.js`   | `$a.qrcode()` 本地二维码（版本 1–10，L/M/Q/H，canvas / table）；独立打包为 `aquery.qrcode.min.js` | core、dom                     |
| `aquery.events.js`   | `on/off/…`、快捷事件、命名空间、`media`                             | core、utils                   |
| `aquery.ajax.js`     | `ajax/get/post/getJSON/getScript`、`.load()`、JSONP、XDR            | core、utils、deferred、events |

## 快速上手

```js
$a(function () {
  $a("#menu-open").on("click.nav", function (e) {
    e.preventDefault();
    $a("#drawer").addClass("is-open");
  });

  $a(".post-list > .post-card").filter(":visible").css("opacity", 1);

  $a.getJSON("/api/list", { page: 2 }).done(function (data) {
    $a("#list")
      .empty()
      .append(
        $a.map(data, function (item) {
          return $a("<li>").text(item.title)[0];
        }),
      );
  });
});
```

## API

### 选择器

`$a("#id")`、`$a(".class")`、`$a("div > p")`、`$a("<div>")`（创建节点）、`$a(node)`、`$a(list)`、`$a(fn)`（ready）

伪类可以写在选择器的**任意位置**，也能和组合符一起用：

```js
$a("ul > li:first"); // 第一个 li
$a("tr:even td:eq(1)"); // 偶数行的第 2 个单元格
$a("div.card:has(> img)"); // 含图片的卡片
$a("p:not(:visible)"); // 不可见的段落
$a("li:contains(公告)"); // 文本包含「公告」
$a("li:nth-child(2n+1)"); // 原生 nth-child
$a(":hidden"); // 全站隐藏元素
```

| 伪类                                                       | 说明                                           |
| ---------------------------------------------------------- | ---------------------------------------------- |
| `:first` `:last` `:eq(n)` `:even` `:odd` `:gt(n)` `:lt(n)` | 位置类，作用在当前候选集上                     |
| `:visible` `:hidden`                                       | 依据 `offsetWidth/offsetHeight/getClientRects` |
| `:contains(text)`                                          | 文本包含，支持引号                             |
| `:has(selector)`                                           | 含匹配后代；支持 `:has(> img)`                 |
| `:not(selector)`                                           | 原生支持；内部含自定义伪类时由引擎接管         |
| `:nth-child()` 等原生伪类                                  | 交给 `matches()` / `querySelectorAll`          |

> 不含自定义伪类时走 `querySelectorAll` 快路径；含自定义伪类时按组合符分段求值，位置伪类只影响所在那一段。

### 集合

`each(fn)`、`toArray()`、`get(i)`、`eq(i)`、`first()`、`last()`、`size()`

### 遍历

`find(sel)`、`filter(sel)`、`not(sel)`、`is(sel)`、`closest(sel)`、`parent()`、`children()`、`siblings()`、`next()`、`prev()`

### 插入 / 删除

`append(x)`、`prepend(x)`、`before(x)`、`after(x)`、`remove()`、`detach()`、`empty()`、`replaceWith(x)`

- `remove()`：摘除并清掉自身及**全部后代**的事件与 `data`
- `detach()`：只摘除，**保留**事件与 `data`，之后可以原样插回去

### 内容 / 属性 / 数据

`html()` / `html(v)`、`text()` / `text(v)`、`val()` / `val(v)`、
`attr(name[, v])`、`removeAttr(name)`、`prop(name[, v])`、
`data(key[, v])`、`removeData([key])`

- `attr(name, fn)` / `val(fn)` / `val(array)`：函数收到 `(index, oldValue)`；数组用于多选 `select` 与 `checkbox`
- `html(v)` 设置后会**执行其中的 `<script>`**（外部 `src` 与内联都支持）
- `$a("<tr>")` / `$a("<li>")` / `$a("<option>")` 会自动补上 `<table>/<ul>/<select>` 包裹，不会丢节点
- `data()` 存在元素上的 `__aData` 缓存里，`remove()` 时一并清理

### 样式 / 类名

`css(name[, v])`、`addClass(name)`、`removeClass(name)`、`toggleClass(name[, state])`、`hasClass(name)`

### 事件

`on(types[, selector][, data], fn)`、`off([types][, selector][, fn])`、`bind` / `unbind`、`delegate(selector, types, fn)`、`undelegate(selector, types[, fn])`、`one(types[, selector][, data], fn)`、`trigger(type[, data])`

- 命名空间：`on("click.nav")`、`off(".nav")`
- 传 `selector` 即为委托
- `trigger()` **会向上冒泡**，沿途的委托与命名空间都生效
- 回调返回 `false` 等于 `preventDefault()` + `stopPropagation()`
- 事件对象：`preventDefault()`、`stopPropagation()`、`stopImmediatePropagation()`，以及 `target`、`currentTarget`、`delegateTarget`、`data`、`namespace`

快捷事件：`click`、`dblclick`、`mousedown`、`mouseup`、`mousemove`、`mouseover`、`mouseout`、`mouseenter`、`mouseleave`、`keydown`、`keyup`、`keypress`、`submit`、`change`、`focus`、`blur`、`select`、`scroll`、`hover(in, out)`

```js
$a("#btn").click(handler); // 传函数即绑定
$a("#btn").click(); // 不传即调用原生方法
```

### 尺寸 / 位置 / 滚动

`width([v])`、`height([v])`、`innerWidth()`、`innerHeight()`、`outerWidth([withMargin])`、`outerHeight([withMargin])`、
`offset()` / `offset({ top, left })` / `offset(top, left)`、`position()`、`scrollTop([v])`、`scrollLeft([v])`

```js
$a("#box").offset(); // { top, left }
$a("#box").offset({ top: 100, left: 40 });
$a("#box").offset(100, 40);
```

### 表单

`serializeArray()` → `[{name, value}]`；`serialize()` → `"a=1&b=2"`

### 二维码

`$a.qrcode(target, text[, options])` → `canvas` / `table` 元素（失败返回 `null`）

| 选项 | 默认 | 说明 |
| --- | --- | --- |
| `size` | `200` | 显示边长（px） |
| `level` | `"M"` | 纠错等级 `L` / `M` / `Q` / `H` |
| `margin` | `4` | 静区宽度（模块数） |
| `render` | `"auto"` | `auto` 优先 canvas，`table` 强制表格 |
| `color` / `background` | `#000` / `#fff` | 前景 / 背景色 |

```js
$a.qrcode("#share-code", "https://undz.cn/posts/hello/", {
  size: 200,
  level: "M",
  margin: 2,
});

// 只要矩阵
var qr = $a.qrcode.matrix("https://undz.cn/", "L"); // { size, version, mask, modules }
```

实现要点：纯前端 byte 模式编码，自带 Reed-Solomon 纠错、8 种掩码按惩罚分选优；不发起任何网络请求。

### Ajax

`$a.ajax(opts)`、`$a.get(url, data, cb)`、`$a.post(url, data, cb)`、`$a.getJSON(url, data, cb)`、`$a.getScript(url, cb)`、`.load(url[, data][, cb])`

`ajax` 选项：

| 选项                                    | 说明                                             |
| --------------------------------------- | ------------------------------------------------ |
| `url` `type` `data` `async`             | 基础请求参数                                     |
| `dataType`                              | `text`、`html`、`json`、`xml`、`script`、`jsonp` |
| `dataFilter(data, type)`                | 拿到原始文本后、转换前的钩子                     |
| `converters`                            | `{ "text json": fn, … }`，可覆盖默认转换器       |
| `jsonp` / `jsonpCallback`               | 回调参数名 / 自定义回调名（字符串或函数）        |
| `timeout` `cache` `headers` `xhrFields` | 超时、缓存、请求头、XHR 字段；`timeout` 对 XHR / XDR / JSONP / script 都生效 |
| `beforeSend(xhr, opts)`                 | 发送前钩子，返回 `false` 终止请求                                |
| `context` `global`                      | 回调 this、是否触发全局事件                                      |
| `success` `error` `complete`            | 回调式写法；`data` 支持 `FormData`（自动跳过 Content-Type）      |

`$a.ajaxSetup(opts)` 深度合并进默认设置。

```js
$a.ajaxSetup({ timeout: 8000 });
$a.ajaxSetup({
  converters: {
    "text csv": function (t) {
      return t.split("\n");
    },
  },
});

$a.ajax({
  url: "/api/list",
  dataType: "json",
  dataFilter: function (text) {
    return text.replace(/^\uFEFF/, "");
  },
});
```

返回 `$a.Deferred()`；`.load()` 的回调在成功/失败时都会调用：

```js
$a("#box").load("/partial.html", function (html, status, xhr) {
  if (status !== "success") console.warn("加载失败", status);
});
```

全局事件（挂在 `document` 上）：`ajaxStart`、`ajaxSend`、`ajaxSuccess`、`ajaxError`、`ajaxComplete`、`ajaxStop`

### 工具

`each(obj, fn)`、`map(arr, fn)`、`grep(arr, fn[, invert])`、`extend([deep,] target, src…)`、`merge(a, b)`、`trim(str)`、`inArray(item, arr[, from])`、
`isArray`、`isFunction`、`isPlainObject`、`isWindow`、`type`、`parseJSON`、`parseXML`、`param`、`proxy(fn, ctx)`、`noop`、`now`

`param` 支持嵌套与数组（`a[b]=1`、`list[]=x`），也接受 `serializeArray()` 的 `[{name, value}]`：

```js
$a.param({ user: { name: "a", tags: ["x", "y"] } }); // user[name]=a&user[tags][]=x&user[tags][]=y
```

### 异步

`$a.Deferred(fn)` → `{ done, fail, always, then, promise, state }`；`$a.when(p1, p2, …)`

## aQuery 独有

库自带、别处没有的小原语，按所属模块分布：

| API                              | 所属     | 说明                                                                                                                                       |
| -------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `$a.query([name, fallback])`     | utils    | 读 URL 查询参数；不带参数返回对象                                                                                                          |
| `$a.hash([value])`               | utils    | 读 / 写 `#hash`（不含 `#`）                                                                                                                |
| `$a.store(key[, value])`         | utils    | `localStorage` 的 JSON 包装：读 / 写 / 传 `null` 删除                                                                                      |
| `$a.tmpl(str, data)`             | utils    | 极简插值：`{{key}}` 转义、`{{{key}}}` 原样，支持 `a.b` 路径                                                                                |
| `$a.browser([key])`              | utils    | 浏览器信息 `{ name, version, ie, ios, android, mobile, ua }`                                                                               |
| `$a.ie()`                        | utils    | IE 主版本号，非 IE 为 `0`                                                                                                                  |
| `$a.support(name)`               | utils    | 特性探测：`classlist/flex/grid/sticky/customprops/promise/fetch/mutationobserver/intersectionobserver/matchmedia/localstorage/passive/es6` |
| `$a.es()`                        | utils    | 支持到的最高 ES 版本（`5`、`2015` … `2024`）                                                                                               |
| `$a.check(expr)`                 | utils    | 版本表达式求值                                                                                                                             |
| `$a.sleep(ms)`                   | deferred | 返回 Promise 的定时器                                                                                                                      |
| `$a.wait(selector[, timeout])`   | deferred | 等元素出现，返回 Promise；超时 `reject("timeout")`                                                                                         |
| `$a.watch(selector, fn[, root])` | dom      | 监听命中元素（已有 + 后插入），返回 `{ stop() }`                                                                                           |
| `$a.copy(text)`                  | dom      | 复制文本，返回 Promise（clipboard → clipboardData → execCommand）                                                                          |
| `$a.media(query, fn)`            | events   | 媒体查询变化回调，返回 `{ stop() }`                                                                                                        |

版本表达式：

```js
$a.browser(); // { name: "chrome", version: 120, ie: 0, ios: 0, android: 0, mobile: false, ua: "…" }
$a.ie(); // 9 / 10 / 11；非 IE 为 0
$a.es(); // 5 / 2015 / 2016 … 2024
$a.support("grid"); // true / false

$a.check("ie >= 9"); // IE10 上为 true
$a.check("(chrome >= 100 || firefox >= 90) && !ie"); // 组合表达式
```

## 内部属性（下划线，非稳定）

以下划线开头，属于内部实现，随时可能改动，不在稳定 API 之列：

| 位置 | 名称             | 说明                                                                                                 |
| ---- | ---------------- | ---------------------------------------------------------------------------------------------------- |
| `$a` | `_version`       | 版本号副本                                                                                           |
| `$a` | `_uid()`         | 生成自增集合 id                                                                                      |
| `$a` | `_internal`      | 内部工具（indexOf/toArray/merge/unique/sort/matches/isVisible/select/parseHTML/splitTop/parseGroup） |
| `$a` | `_eventKey`      | 事件表挂在元素上的属性名                                                                             |
| `$a` | `_eventCount`    | 预留的监听计数                                                                                       |
| `$a` | `_cleanData(el)` | 清理元素事件与 data                                                                                  |
| `$a` | `_active()`      | 当前在途请求数                                                                                       |
| `$a` | `_jsonpSeq()`    | 已发出的 JSONP 序号                                                                                  |
| 集合 | `_uid`           | 该集合的唯一 id                                                                                      |
| 集合 | `_selector`      | 生成该集合的选择器                                                                                   |
| 集合 | `_context`       | 生成该集合时的上下文                                                                                 |
| 集合 | `_prev`          | 上一步的集合（遍历类方法会产生）                                                                     |
| 集合 | `_snapshot()`    | 当前节点数组的快照                                                                                   |
| 集合 | `_request`       | `.load()` 最近一次请求的 promise；`_request.xhr` 可取到底层 xhr / script 节点 |

## 构建

```bash
npm run build:aquery
```

把 `core / utils / deferred / dom / events / ajax` 按顺序合并、压缩成 `src/assets/aquery/aquery.min.js`；
二维码单独产出 `src/assets/aquery/aquery.qrcode.min.js`（插件式，不混进主包，按需加载）。

terser 可用时走 terser（ES5 输出），不可用时退回到「去注释 + 去空行」的保守压缩；`--map` 会同时给两个文件产出 `.map`。

```html
<script src="/assets/aquery/aquery.min.js"></script>
<!-- 需要二维码时再加 -->
<script src="/assets/aquery/aquery.qrcode.min.js"></script>
```

## 兼容策略（防御性编程）

运行时能力检测：有原生就用原生，没有才退回手写实现。

| 能力        | 优先使用                                  | 兜底                             |
| ----------- | ----------------------------------------- | -------------------------------- |
| 类名        | `classList.add/remove/contains`           | `className` 字符串拆分           |
| 选择器匹配  | `el.matches` / `msMatchesSelector`        | 前缀探测（IE9）                  |
| 就近匹配    | `el.closest`                              | `parentNode` 逐级 + matches      |
| 插入/替换   | `append/prepend/before/after/replaceWith` | `insertBefore` / `appendChild`   |
| 清空        | `textContent = ""`                        | 逐个 `removeChild`               |
| 类数组转换  | `Array.prototype.slice`                   | 逐项 `push`                      |
| 查找 / 去重 | `Array#indexOf`                           | 手写循环                         |
| 去空格      | `String#trim`                             | 正则                             |
| 枚举        | `Object.keys`                             | `for in` + `hasOwnProperty`      |
| 请求事件    | `onload / onerror / timeout`              | `readyState` + 手动 `setTimeout` |
| 跨域（IE9） | `XMLHttpRequest`                          | `XDomainRequest`                 |
| 传输层      | 始终 `XMLHttpRequest`                     | —                                |

原则：增强不改变 API 行为，只让新浏览器更快、老浏览器仍可运行。

## 行为约定

这些是 aQuery 自己的约定，可能和别处的习惯不同：

| 约定               | 说明                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ajax 全局事件顺序  | 先 `ajaxSuccess` / `ajaxError`（global），再 `success` / `error`（local）；`ajaxComplete` 在两者之后                                                   |
| `trigger()` 的边界 | 只派发已注册的处理器并向上冒泡；**不会**触发原生 `addEventListener` 注册的监听器，也不模拟浏览器默认行为                                               |
| `then()` 的形状    | 只有 `then(onOk, onFail)`；没有 `catch` / `finally`，失败分支用 `then(null, fn)` 或 `.fail()`                                                          |
| `watch()` 的频率   | 不节流：有 `MutationObserver` 就用，没有就 400ms 轮询；高频 DOM 变更时自行控制回调成本                                                                 |
| 选择器转义         | 支持引号与括号，但**不支持反斜杠转义**（`\.` 之类按字面处理）                                                                                          |
| `data()` 存储位置  | 存在元素的 `__aData` 属性上，不读写 `data-*` 特性                                                                                                      |
| `css()` 单位       | 数字自动补 `px`；`opacity`、`zIndex`、`fontWeight`、`lineHeight`、`zoom`、`order`、`flex`、`flexGrow`、`flexShrink` 不加单位（`z-index` 与 `zIndex` 写法都认） |
| `position()` 基准  | 相对 `offsetParent` 的 **padding 边**，已扣除父级 border 与自身 margin；没有 `offsetParent` 时返回 `{top:0,left:0}` |
| `beforeSend` 覆盖  | XHR / XDR 收到底层请求对象；JSONP / script 收到 `null`；返回 `false` 都会中止请求 |
| `width(v)` 语义    | 按**内容宽**设置；`border-box` 元素会自动加上 padding + border 再写入 `style` |

## 已知取舍

1. **没有动画**：过渡交给 CSS。
2. **`trigger()` 只跑处理器**：会冒泡，但不模拟浏览器默认行为（`a.click()` 之类由调用方自己决定）。
3. **`html()` 的脚本执行**：内联脚本通过替换 `<script>` 节点执行，不保证 `document.write` 这类老行为。
4. **`data()` 只存在元素上**：元素被 `remove()` 后数据销毁；`detach()` 保留。
5. **含自定义伪类的复杂查询有成本**：`:has()` / `:not(:visible)` 这类要逐元素求值，元素多时避免在大集合上反复调用。
6. **`width()/height()` 返回内容盒**：`border-box` 下会自动扣掉 padding 与 border，`inner*` / `outer*` 以此为基础叠加。
7. **IE9 跨域**：走 `XDomainRequest`，不支持自定义请求头与 Cookie，但有 `timeout`；需要请求头时用 JSONP 或同源代理。
8. **IE9 没有 `classList`**：自动退回 `className` 字符串操作。
