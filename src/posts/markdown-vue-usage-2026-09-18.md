---
title: 关于在 Markdown 中嵌入 Vue 组件的说明
date: 2026-09-18
tags: ["Vue", "Markdown", "内容层"]
---

> 这篇文章已经过时，此描述的内容与现有架构不相同

<script setup>
import { ref } from 'vue'
import GovPanel from '@/index/components/common/GovPanel.vue'
import GovButton from '@/index/components/common/GovButton.vue'
import { showAlert } from '@/index/components/common/dialog'

const count = ref(0)
const showTip = ref(true)

function increment() {
    count.value += 1
}

function handleAlert() {
    showAlert('来自文章内的事件')
}
</script>

本站的 `.md` 文件由 `unplugin-vue-markdown` 在构建时编译为 Vue 单文件组件。正文中的 Vue 组件标签会被当作模板的一部分解析，`<script setup>` 中的逻辑对正文完全可见。现将使用方法说明如下。

## 一、基本用法

在 frontmatter 之后、正文之前书写 `<script setup>`，导入所需组件与响应式 API 即可。

```vue
<script setup>
import { ref } from "vue";
import GovButton from "@/index/components/common/GovButton.vue";

const count = ref(0);
</script>

正文中可以像这样使用：
<GovButton variant="primary">按钮</GovButton>
```

组件标签与 Markdown 语法可以混用。以下为实际渲染效果：

<GovPanel title="示例一：响应式计数器">
  <p>当前计数：<b>{{ count }}</b></p>
  <GovButton variant="primary" @click="increment">
    <MyIcon icon="plus"></MyIcon>&nbsp;增加
  </GovButton> <br /><br />
  <GovButton variant="default" @click="count = 0">重置</GovButton>
</GovPanel>

<div class="md-alert md-alert--tip">
  文章内的 <code>ref</code> 是独立的响应式状态，作用域限于当前文章的组件实例，不会与其他文章或站点状态相互影响。
</div>

## 二、条件渲染与列表渲染

Vue 的 `v-if`、`v-for` 等指令在正文中同样有效。

<GovPanel title="示例二：条件渲染">
  <GovButton variant="primary" @click="showTip = !showTip">
    <MyIcon icon="eye"></MyIcon>&nbsp;切换显示
  </GovButton>
  <p v-if="showTip" style="margin-top: 12px;">
    这段文字由 <code>v-if</code> 控制，当前可见。
  </p>
  <p v-else style="margin-top: 12px; color: #999;">
    这段文字由 <code>v-else</code> 控制，当前显示的是它。
  </p>
</GovPanel>

下面的列表由 `v-for` 渲染，数据来自文章内的 `<script setup>`：

<ul>
  <li v-for="i in 3" :key="i">第 {{ i }} 项，共 3 项</li>
</ul>

## 三、嵌入组件

本站提供的政务组件均可在正文中直接使用。

<GovPanel title="示例三：组件组合" tone="red">
  <p>以下按钮均为 <code>GovButton</code> 组件的不同 <code>variant</code>：</p>
  <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 12px;">
    <GovButton variant="primary">主要操作</GovButton>
    <GovButton variant="danger">危险操作</GovButton>
    <GovButton variant="default">次要操作</GovButton>
  </div>
</GovPanel>

<GovPanel title="示例四：图标使用">
  <p>
    <MyIcon icon="download"></MyIcon> 下载
    <MyIcon icon="web"></MyIcon> 官网
    <MyIcon icon="code-tags"></MyIcon> 源码
    <MyIcon icon="file-document-outline"></MyIcon> 文档
  </p>
</GovPanel>

## 四、事件绑定

组件上的 `@click` 等事件可以直接绑定到文章内的函数。

<GovPanel title="示例五：事件处理">
  <GovButton variant="primary" @click="handleAlert">
    点击弹出提示
  </GovButton>
</GovPanel>

实际写法如下：

```vue
<script setup>
function handleAlert() {
  alert("来自文章内的事件");
}
</script>

<GovButton variant="primary" @click="handleAlert">
  点击弹出提示
</GovButton>
```

## 五、注意事项

（一）**组件需要显式导入**。方案 B 下文章是独立的 Vue 组件，组件不会自动注册。必须在 `<script setup>` 中 `import`，不能依赖全局注册。

（二）**自定义组件请显式闭合**。markdown-it 在处理块级 HTML 时，自闭合的自定义组件标签（`<MyIcon ... />`）容易丢失自闭合标志，导致 Vue 编译器报 `Element is missing end tag`。建议所有自定义组件都写成 `<MyIcon ...></MyIcon>`，HTML void 元素（`<br>`、`<img>`）不受影响。

（三）**旧版容器语法不再生效**。本站早期的 `::: tip` / `::: warning` / `::: tabs` 等自定义容器已在迁移中移除，改用原生 HTML 类表达，例如 `<div class="md-alert md-alert--tip">…</div>`。

（四）**构建时编译**。正文中的组件在构建阶段编译为 render function，而非运行时解析。若组件名拼写错误，会在构建时或开发时控制台提示，而不会静默忽略。

（五）**样式作用域**。文章内联写的 `style` 属性作用于当前元素，Markdown 渲染出的标签样式由 `markdown.css` 统一控制。若需要局部样式，建议在文章内使用内联 `style`，或封装为独立组件。

（六）**不要写 `<style>` 块**。本站暂不支持在 Markdown 中书写 `<style>`，会与 SFC 编译流程冲突。需要样式时优先使用已有 CSS 变量或内联样式。

## 六、小结

Markdown 与 Vue 的融合让静态内容具备了组件化的能力。文章不再只是纯文本，而是可以拥有响应式状态、可复用组件与事件交互的完整页面单元。这使得一些原本需要额外页面承载的功能，可以直接在文章内表达。

如需查看本站组件清单，可参阅[《关于本站对照国办发〔2017〕47号文开展设计规范调整的说明》](/articles/site-design-compliance-2017-47)。
