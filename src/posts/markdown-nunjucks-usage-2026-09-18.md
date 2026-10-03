---
title: 关于在 Markdown 中嵌入 Nunjucks 组件的说明
description: 本站 Markdown 文件由 Nunjucks 编译，正文中可直接调用组件 macro、条件渲染与循环。
date: 2026-10-03
tags: ["Nunjucks", "Markdown", "Eleventy"]
---

本站的 `.md` 文件由 Eleventy 的 Nunjucks 引擎在构建时编译。正文中的 Nunjucks 模板语法会被解析执行，组件以 macro 的形式调用。现将使用方法说明如下。

## 一、基本用法

在 frontmatter 之后，正文中直接书写 Nunjucks 语法即可。使用组件前，需要先从组件文件导入对应的 macro：

{% raw %}

```njk
{% from "components/button.njk" import button %}

{{ button({ text: "阅读全文", href: "/posts/hello/", type: "primary" }) }}
```

{% endraw %}

渲染结果是一个带样式的按钮链接。正文中的 Nunjucks 语法与 Markdown 可以混用，不会相互干扰。

## 二、条件渲染

Nunjucks 的 if 标签用于根据 frontmatter 或站点数据决定是否输出某段内容。

{% raw %}

```njk
{% if description %}
<p>本文摘要：{{ description }}</p>
{% endif %}
```

{% endraw %}

实际效果：本页的 `description` 有值，所以下面的摘要会显示出来。

{% if description %}

<p>本文摘要：{{ description }}</p>
{% endif %}

## 三、循环渲染

for 标签用于遍历数组，比如站点导航、文章标签。

{% raw %}

```njk
<ul>
{% for item in site.navigation %}
  <li><a href="{{ item.url }}">{{ item.title }}</a></li>
{% endfor %}
</ul>
```

{% endraw %}

输出为：

<ul>
{% for item in site.navigation %}
  <li><a href="{{ item.url }}">{{ item.title }}</a></li>
{% endfor %}
</ul>

## 四、嵌入组件

本站提供的组件均可在正文中直接调用。先导入，再调用：

{% raw %}

```njk
{% from "components/alert.njk" import alert %}

{{ alert({ type: "info", title: "提示", content: "这是一条信息。" }) }}
```

{% endraw %}

实际渲染效果：

{% from "components/alert.njk" import alert %}

{{ alert({ type: "info", title: "提示", content: "这是一条信息。" }) }}

标签组件同理：

{% raw %}

```njk
{% from "components/tag.njk" import tag %}

{{ tag({ text: "Eleventy", href: "/tags/eleventy/", color: "default" }) }}
```

{% endraw %}

{% from "components/tag.njk" import tag %}

{{ tag({ text: "Eleventy", href: "/tags/eleventy/", color: "default" }) }}

## 五、组件参数

所有组件都以**字典**形式传参，可选的键取决于组件定义。以 `button` 为例：

{% raw %}

```njk
{{ button({
  text: "提交",
  type: "primary",
  size: "lg",
  block: true,
  disabled: false
}) }}
```

{% endraw %}

| 参数       | 类型    | 说明                                           |
| ---------- | ------- | ---------------------------------------------- |
| `text`     | string  | 按钮文字                                       |
| `href`     | string  | 有值时渲染为 `<a>`，否则为 `<button>`          |
| `type`     | string  | `primary` / `secondary` / `success` / `danger` |
| `size`     | string  | `sm` / `md` / `lg`                             |
| `block`    | boolean | 是否占满整行                                   |
| `disabled` | boolean | 是否禁用                                       |

## 六、注意事项

（一）**组件需要显式导入**。Nunjucks 的 macro 不像 Vue 组件那样自动注册，必须在文章里用 `from ... import ...` 后再调用。

（二）**字典里不能嵌套双花括号**。以下写法是错的——字典内部不能再写模板表达式，需要先 set 再引用：

{% raw %}

```njk
{% set href = "/tags/" + (t | tagSlug) + "/" %}
{{ tag({ text: t, href: href }) }}
```

{% endraw %}

（三）**Markdown 里的 shell 语法可能被误解析**。Nunjucks 会把花括号加井号当作注释开始标记，shell 脚本里取字符串长度的那种写法会触发 `expected end of comment` 错误。解决办法是用 `{% raw %}` 包裹那一行，或者改用等价的 shell 命令，例如 `expr length "$str"`。

（四）**构建时编译**。正文中的 Nunjucks 在构建阶段执行，输出纯 HTML。若 macro 名或参数拼写错误，会在构建时报错，而不是静默忽略。

（五）**没有运行时状态**。本站是静态站点，正文里不存在 Vue 那样的响应式状态。需要交互（比如切换显示）时，要借助 jQuery 或原生 JS，且只在现代浏览器中执行，IE7 只保证静态内容的可读性。

（六）**不要写 style 块**。文章内的样式用已有 CSS 类或内联 `style` 属性，不推荐在 Markdown 里写 `<style>`。

## 七、小结

Markdown 与 Nunjucks 的融合让静态内容具备了组件化能力。文章可以引用全局数据、复用 UI 组件、按条件或循环渲染结构化内容，同时保持构建产物是纯静态 HTML，兼容到 IE7。这使得一批需要在多篇文章里重复出现的结构，可以被抽成组件统一维护。
