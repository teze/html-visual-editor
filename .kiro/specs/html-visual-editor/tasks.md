# Implementation Plan: HTML 可视化编辑器

## Overview

按「纯函数优先、测试驱动、最后接线」的顺序实现。先把可独立测试的纯逻辑（颜色转换、文件校验、输入校验、注入脚本拼接、修改计数、导出清理）抽取为 `src/` 下的小模块并配套属性测试，再叠加运行于 iframe 内的注入脚本交互逻辑与属性面板，随后接线文件加载 / 预览渲染 / 消息总线，最后把全部模块内联组装为零依赖单文件交付物 `html-editor.html` 并以集成与冒烟测试收尾。

实现约定：

- 开发期把核心逻辑拆为 `src/` 下的多个小模块（仅用于测试与维护），最终交付物 `html-editor.html` 通过把这些模块源码内联到单个 `<script>` 中产出，保持「单文件、零依赖、可 `file://` 直接打开」。
- 属性测试使用 [fast-check](https://github.com/dubzzz/fast-check)，每条属性用单个测试实现，最少运行 100 次迭代（`numRuns >= 100`），不自行实现属性测试框架。
- 每个属性测试在文件内以注释标注其设计属性，格式固定为：
  `// Feature: html-visual-editor, Property {number}: {property_text}`
- 每条 Correctness Property 单独成一个测试文件，避免并行任务写同一文件。

## Tasks

- [x] 1. 搭建测试框架与核心模块骨架
  - [x] 1.1 初始化测试脚手架与模块占位
    - 新建 `package.json`，将 `vitest`、`fast-check`、`jsdom` 加入 `devDependencies`，并配置 `test` 脚本为单次运行（`vitest run`）
    - 新建 Vitest 配置，environment 设为 `jsdom`
    - 在 `src/` 下创建空骨架并导出占位：`color.js`、`file-validation.js`、`input-validation.js`、`inject.js`、`change-counter.js`、`exporter.js`、`injected-script.js`、`property-panel.js`、`file-loader.js`、`preview-frame.js`、`message-bus.js`
    - 创建 `html-editor.html` 页面骨架：顶栏（打开/文件名/导出）、地址栏、预览区（iframe 容器）、属性面板、状态栏
    - _Requirements: 2.2_

- [x] 2. 实现颜色读取与转换
  - [x] 2.1 实现 `rgbToHex` / `hexToRgb` 颜色转换（`src/color.js`）
    - `rgbToHex`：`rgb(r,g,b)` → 6 位小写 `#rrggbb`；`rgba(r,g,b,a)` 当 a<1 时 → 8 位 `#rrggbbaa`（aa = `Math.round(a*255)` 两位十六进制）
    - `hexToRgb`：3 位 `#rgb` 按通道复制扩展为 6 位再解析；6 位 `#rrggbb` 直接解析为 r/g/b 整数三元组
    - 透明特殊值（`rgba(0,0,0,0)` / `transparent`）映射为空串；解析失败返回可识别的失败标记
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

  - [x]* 2.2 编写属性测试：Hex 颜色往返一致性
    - **Property 1: Hex 颜色往返一致性** — 对任意合法 Hex（3 位 `#rgb` 或 6 位 `#rrggbb`），`hexToRgb` 后再 `rgbToHex`，R/G/B 三通道整数应与原 Hex（3 位按通道复制扩展）相等
    - 覆盖通道为 0、255 的极值；生成器含大小写混合验证规范化为小写
    - **Validates: Requirements 6.5**

  - [x]* 2.3 编写属性测试：RGB → Hex 转换正确性
    - **Property 2: RGB 到 Hex 转换正确性** — 对任意 `rgb(r,g,b)`（0..255），输出匹配 `/^#[0-9a-f]{6}$/`，且解析回的每通道等于原始值
    - 覆盖通道为 0、255 的极值
    - **Validates: Requirements 6.2**

  - [x]* 2.4 编写属性测试：RGBA → Hex8 转换正确性
    - **Property 3: RGBA 到 Hex8 转换正确性** — 对任意 `rgba(r,g,b,a)`（a<1），输出 8 位 `#rrggbbaa`，前 6 位与 `rgb(r,g,b)` 一致，末两位等于 `Math.round(a*255)` 的两位十六进制
    - 覆盖通道为 0、255 的极值
    - **Validates: Requirements 6.3**

  - [x]* 2.5 编写单元测试：颜色解析失败、透明与边界
    - 验证非 rgb/rgba 输入返回解析失败标记（对应解析失败提示分支），`rgba(0,0,0,0)`/`transparent` 回填为空串
    - _Requirements: 6.1, 6.4_

- [x] 3. 实现文件校验
  - [x] 3.1 实现 `validateFile` / `pickFirstHtml`（`src/file-validation.js`）
    - `validateFile(name, size)`：扩展名匹配 `/\.html?$/i` 且 `size <= 10485760` 时通过；否则返回拒绝并附错误类别（类型不受支持 / 超出大小限制）
    - `pickFirstHtml(files)`：返回首个合法 `.html`/`.htm` 文件；若存在其余文件则附带「已忽略其余文件」标记
    - _Requirements: 1.3, 1.5, 1.7_

  - [x]* 3.2 编写属性测试：文件类型与大小校验
    - **Property 5: 文件类型与大小校验** — 对任意文件名与大小组合，当且仅当扩展名合法且大小 ≤ 10485760 时返回通过，否则返回对应错误类别
    - 覆盖 size = 10485760 与 10485761 边界
    - **Validates: Requirements 1.3, 1.5**

  - [x]* 3.3 编写属性测试：多文件择一加载
    - **Property 6: 多文件择一加载** — 对任意文件列表，返回首个 `.html`/`.htm` 文件；若除该文件外还有其他文件则标记「已忽略其余文件」
    - **Validates: Requirements 1.7**

- [x] 4. 实现属性面板输入校验逻辑
  - [x] 4.1 实现数值/颜色/地址输入校验（`src/input-validation.js`）
    - 数值校验（含单位拼装）：font-size 1..999、padding 0..9999、border-radius 0..9999、width/height（px 0..99999 / % 0..100）；空值、非数值、越界判为非法
    - 颜色校验：`#` 后接 3 或 6 位十六进制；地址校验：非空且 ≤ 2048 字符
    - 字体粗细枚举 {300,400,500,600,700,900}，文字对齐枚举 {left,center,right}
    - _Requirements: 5.2, 5.7, 5.8, 5.9, 5.13, 5.14, 7.2, 7.3, 7.5, 7.6_

  - [x]* 4.2 编写单元测试：字体粗细与对齐枚举逐值
    - 对 6 个字体粗细值与 3 个对齐值逐一断言通过，非枚举值被拒绝
    - _Requirements: 5.3, 5.6_

- [x] 5. 实现注入脚本拼接
  - [x] 5.1 实现 `buildEditorScript` 与注入拼接（`src/inject.js`）
    - 以 `'(' + __editorFn.toString() + ')()'` 拼接脚本体，`<script>` 标签拆写为 `'<scri'+'pt id="__htmledit__">'` 防止解析器提前闭合
    - 提供注入函数：优先在 `</body>` 前插入注入脚本，无 `</body>` 则追加末尾；保证 `id="__htmledit__"` 节点恰好一个（幂等）
    - _Requirements: 2.3_

  - [x]* 5.2 编写属性测试：注入脚本唯一性
    - **Property 7: 注入脚本唯一性** — 对任意输入 HTML（含已存在同 id 节点的情况），注入产物中 `id="__htmledit__"` 的 `<script>` 恰好出现一次
    - **Validates: Requirements 2.3**

- [x] 6. 检查点 — 确认纯函数测试全部通过
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. 实现修改计数与状态栏
  - [x] 7.1 实现 `ChangeCounter` 与状态文本（`src/change-counter.js`）
    - `reset()` 加载时归零；`increment()` 用于属性变更/单次内联编辑会话/删除，上限 999999
    - 单次编辑会话内多次 `input` 仅计 1（会话去重标记）
    - 计数文本渲染为 `"N 处修改"`；状态指示：count==0 且无错误显示「就绪」，count>0 且无错误显示「已修改」
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x]* 7.2 编写属性测试：修改计数不变量
    - **Property 19: 修改计数不变量** — 对任意由「属性变更/单次内联编辑会话/删除」组成的成功操作序列，最终计数等于成功操作次数（单会话内多次 `input` 仅计 1），且恒为 0..999999 整数
    - **Validates: Requirements 4.4, 5.10, 8.3, 11.2**

  - [x]* 7.3 编写属性测试：状态栏计数文本
    - **Property 20: 状态栏计数文本** — 对任意 0..999999 的整数 N，计数文本渲染为 `"N 处修改"`
    - **Validates: Requirements 11.3**

  - [x]* 7.4 编写单元测试：归零与状态映射
    - 验证加载归零（11.1）、就绪/已修改状态映射（11.4/11.5）
    - _Requirements: 11.1, 11.4, 11.5_

- [x] 8. 实现导出器
  - [x] 8.1 实现导出清理与序列化（`src/exporter.js`）
    - 读取 iframe `contentDocument`，移除 `#__htmledit__` 脚本节点
    - 还原带 `data-saved-outline` 标记节点的编辑态样式（清除 `outline`/`outline-offset`/`cursor`）
    - 序列化 `'<!DOCTYPE html>\n' + documentElement.outerHTML`，生成 Blob 并触发 `.html` 下载
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 8.2 实现导出后重注入与无内容处理（`src/exporter.js`）
    - 未加载内容时取消导出、不下载并提示「无可导出内容」
    - 导出后 1 秒内调用 `render` 重新注入脚本，保留全部修改，恢复可编辑状态
    - 导出全流程以 `try/catch` 包裹，异常时经状态栏提示导出出错
    - _Requirements: 10.6, 10.7_

  - [x]* 8.3 编写属性测试：导出产物干净性
    - **Property 21: 导出产物干净性** — 对任意编辑状态的预览 DOM，导出文本不含 `id="__htmledit__"` 脚本，也不含编辑器添加的 `outline`/`outline-offset`/`cursor` 编辑态样式
    - **Validates: Requirements 10.3, 10.4, 10.5**

  - [x]* 8.4 编写属性测试：导出保真与可继续编辑
    - **Property 22: 导出保真与可继续编辑** — 对任意经过若干次编辑的预览 DOM，导出后重注入，剥离编辑器痕迹后内容与导出前一致，且 `#__htmledit__` 恢复存在可继续编辑
    - **Validates: Requirements 10.1, 10.7**

  - [x]* 8.5 编写单元测试：无内容导出与下载文件名
    - 验证未加载内容时取消导出（10.6），并通过 mock 下载触发验证 `.html` 文件名（10.2）
    - _Requirements: 10.2, 10.6_

- [x] 9. 实现注入脚本交互逻辑（运行于 iframe，jsdom 下测试）
  - [x] 9.1 实现可编辑判定与 `getInfo`（`src/injected-script.js`）
    - 定义 SKIP 集合（HTML/HEAD/META/LINK/TITLE/STYLE/SCRIPT 等），实现 `isEditable` / `isTextEditable`
    - `getInfo(el)` 返回完整 SelectedElementInfo（`tag`/`innerText`/`color`/`backgroundColor`/`fontSize`/`fontWeight`/`width`/`height`/`src`/`href`/`path`），颜色经 `rgbToHex` 转换为 Hex 或空串，`fontSize` 取整
    - _Requirements: 3.4, 9.1, 9.2_

  - [x]* 9.2 编写属性测试：getInfo 结构完整性
    - **Property 8: getInfo 结构完整性** — 对任意可编辑元素，`getInfo` 含全部约定字段，`color`/`backgroundColor` 为合法 Hex 或空串，`fontSize` 为整数
    - **Validates: Requirements 3.4**

  - [x] 9.3 实现悬停高亮与单击选中（`src/injected-script.js`）
    - `onMouseOver`/`onMouseOut`：非 SKIP 且非选中元素加/还原 `outline:2px solid rgba(0,212,170,0.35)`；移出时若为选中元素保留 `#00d4aa` 边框
    - `onClick`：单击可编辑元素 `preventDefault`+`stopPropagation`，移除旧选中边框、设 `outline:2px solid #00d4aa; outline-offset:1px`，发送 `selected` 消息；单击 SKIP/空白不改状态、不发消息
    - _Requirements: 3.1, 3.2, 3.3, 3.6, 9.1, 9.2, 9.3, 9.4_

  - [x]* 9.4 编写属性测试：悬停高亮进出还原
    - **Property 10: 悬停高亮进出还原** — 对任意可编辑元素，`mouseover` 后 `mouseout` 应还原 `outline`；若同时是选中元素则保留 `#00d4aa` 实线 2px 选中边框
    - **Validates: Requirements 3.1, 3.2**

  - [x]* 9.5 编写属性测试：单击选中唯一性
    - **Property 11: 单击选中唯一性** — 对任意可编辑元素的连续单击序列，任一时刻带 `#00d4aa` 选中边框的元素至多一个，且恒为最近一次单击的可编辑元素
    - **Validates: Requirements 3.3, 3.6**

  - [x]* 9.6 编写属性测试：不可交互目标的稳定性
    - **Property 12: 不可交互目标的稳定性** — 对任意已有选中元素的状态，单击 SKIP 元素或空白后，选中元素及边框、面板显示均不变，且不发送 `selected` 消息
    - **Validates: Requirements 3.7, 9.1, 9.2, 9.3, 9.4**

  - [x] 9.7 实现双击内联编辑（`src/injected-script.js`）
    - `onDblClick`：文字类可编辑元素设 `contentEditable='true'` 并 `focus()`；img/结构性元素不响应
    - `onInput`：200ms 内发送 `textInput` 携带完整文字；`onBlur`：恢复 `contentEditable='false'`
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6_

  - [x]* 9.8 编写属性测试：内联编辑文字同步保真
    - **Property 13: 内联编辑文字同步保真** — 对任意文字类可编辑元素与任意输入文字，`input` 后 `textInput` 携带的文字等于元素当前完整文字
    - **Validates: Requirements 4.3**

  - [x]* 9.9 编写属性测试：双击编辑态进出往返
    - **Property 14: 双击编辑态进出往返** — 文字类元素双击后 `contentEditable` 为 `'true'`、blur 后恢复 `'false'`；SKIP/非文字元素双击后不被设为 `'true'`
    - **Validates: Requirements 4.1, 4.5, 4.6**

  - [x] 9.10 实现 message 更新与删除处理（`src/injected-script.js`）
    - `onMessage`：校验 `event.data.type` 后处理 `update`，按 `prop` 修改 `element.style[prop]` / 文字 / `src` / `href`；`delete` 移除元素子树并回发 `deleted`；每次成功更新回发 `changed`
    - 删除后清除选中状态，使后续 update 不作用于已删除节点
    - _Requirements: 5.1, 8.1, 8.4_

  - [x]* 9.11 编写属性测试：删除移除子树并清除选中
    - **Property 18: 删除移除子树并清除选中** — 对任意元素树与被选中元素，删除后该元素及全部后代不在 DOM 中，且不存在选中元素
    - **Validates: Requirements 8.1, 8.4**

  - [x]* 9.12 编写属性测试：合法数值样式输入被应用
    - **Property 15: 合法数值样式输入被应用** — 对任意合法范围内的数值输入（font-size 1..999；padding/border-radius 0..9999；width/height px 0..99999、% 0..100），update 处理应将该值（含单位）写入选中元素对应样式
    - 覆盖各范围上下界
    - **Validates: Requirements 5.2, 5.7, 5.8, 5.9**

  - [x]* 9.13 编写属性测试：地址属性应用保真
    - **Property 17: 地址属性应用保真** — 对任意非空且长度 ≤ 2048 的字符串，`src`/`href` 更新应写入 `<img>`/`<a>` 且写入值等于输入
    - **Validates: Requirements 7.2, 7.5**

- [x] 10. 实现属性面板
  - [x] 10.1 实现回填与控件可见性（`src/property-panel.js`）
    - `fillForm(info)` 按字段回填全部控件；`clearForm()` 元素删除后清空
    - 控件可见性：`<img>` 显示并预填 `src` 输入框、隐藏文字区；`<a>` 显示并预填 `href` 输入框；其他文字元素显示文字内容区
    - _Requirements: 3.5, 7.1, 7.4, 8.2_

  - [x]* 10.2 编写属性测试：属性面板回填一致性
    - **Property 9: 属性面板回填一致性** — 对任意 SelectedElementInfo，`fillForm` 后各控件显示值与 info 对应字段一致（颜色控件显示对应 Hex，数值控件显示对应数值，img/a 专属控件按标签条件显示并预填）
    - **Validates: Requirements 3.5, 7.1, 7.4**

  - [x] 10.3 实现颜色控件双向联动（`src/property-panel.js`）
    - `onColorPick`：选择器变更 → Hex 输入框更新为 6 位 Hex；`onColorType`：Hex 输入框合法输入 → 选择器同步
    - _Requirements: 5.11, 5.12_

  - [x]* 10.4 编写属性测试：颜色控件双向联动往返
    - **Property 4: 颜色控件双向联动往返** — 对任意合法 Hex，输入框 → 选择器（`onColorType`）再 → 输入框（`onColorPick`），两控件最终颜色一致（输入框为规范化 6 位小写 Hex）
    - **Validates: Requirements 5.11, 5.12**

  - [x] 10.5 实现各属性 apply 入口、校验与错误提示（`src/property-panel.js`）
    - 接入 `src/input-validation.js`，实现 `applyText`/`applyFontSize`/`applyFontWeight`/`applyColor`/`applyBackground`/`applyTextAlign`/`applyPadding`/`applyRadius`/`applyWidth`/`applyHeight`/`applySrc`/`applyHref`
    - 合法输入经 `send` 发送 `update` 指令；非法输入保持原值、不计数、调用 `showFieldError` 提示
    - 删除控件：有选中元素时发送 `delete` 指令；无选中时不改 DOM、不计数并提示无可删除元素
    - _Requirements: 5.1, 5.3, 5.4, 5.5, 5.6, 5.10, 5.13, 5.14, 7.2, 7.3, 7.5, 7.6, 8.1, 8.5_

  - [x]* 10.6 编写属性测试：非法输入被拒绝且无副作用
    - **Property 16: 非法输入被拒绝且无副作用** — 对任意非法输入（数值空/非数值/越界、不符合 `#`+3/6 位十六进制的颜色、清空的 `src`/`href`），保持选中元素相关样式或属性不变、不增计数并显示对应无效提示
    - **Validates: Requirements 5.13, 5.14, 6.4, 7.3, 7.6**

- [x] 11. 文件加载、预览渲染与消息总线接线
  - [x] 11.1 实现 File_Loader DOM 接线（`src/file-loader.js`）
    - `openFile`（input change）与 `handleDrop`（drop）接入 `validateFile`/`pickFirstHtml`，`loadFile` 用 `FileReader` 读取文本
    - 校验/读取失败时保持预览现有内容并经状态栏提示（含 `FileReader.onerror` 读取失败、多文件已忽略提示）；加载成功在顶栏显示完整文件名
    - _Requirements: 1.1, 1.2, 1.4, 1.6, 1.7_

  - [x] 11.2 实现 Preview_Frame 渲染接线（`src/preview-frame.js`）
    - `render(rawHtml)`：拼接注入脚本写入 `iframe.srcdoc`，固定 `sandbox="allow-scripts allow-same-origin"`
    - `load` 后等待注入脚本 `ready`（2 秒内）；空内容或无法解析为有效文档时显示渲染失败提示、不注入脚本、不进入编辑态
    - _Requirements: 2.1, 2.5_

  - [x] 11.3 实现 MessageBus 收发与分发（`src/message-bus.js`）
    - 上行 `onMessage`：校验 `event.data.type`，分发 `ready`/`selected`/`textInput`/`changed`/`deleted` 到属性面板、状态栏、修改计数；未知类型静默忽略
    - 下行 `send`：经 `iframe.contentWindow.postMessage(msg,'*')` 下发 `update`/`delete` 指令
    - _Requirements: 2.4, 3.5, 4.4, 5.10, 8.3_

  - [x]* 11.4 编写集成测试：渲染保真
    - 渲染含 `<style>`/`<link>`/内联样式的样例 HTML，断言注入后这些样式节点数量与原始一致、用户内容结构未被破坏
    - _Requirements: 2.1_

  - [x]* 11.5 编写集成测试：端到端流程
    - 加载样例 → 选中 → 改样式 → 导出 → 重注入，断言关键状态串联正确（修改反映、计数递增、导出干净、重注入可继续编辑）
    - _Requirements: 10.1, 10.7_

- [x] 12. 组装单文件交付物并冒烟收尾
  - [x] 12.1 将核心模块内联组装为 `html-editor.html`
    - 把 `src/` 各模块源码内联到 `html-editor.html` 的单个 `<script>` 中，产出零依赖、可 `file://` 直接打开的单文件
    - 接通顶栏「打开文件 / 导出」、地址栏、属性面板、状态栏与各模块
    - _Requirements: 2.2_

  - [x]* 12.2 编写冒烟测试：一次性配置检查
    - 断言 iframe `sandbox` 属性等于 `allow-scripts allow-same-origin`（2.2）；通过静态检查确认颜色读取使用 `getComputedStyle`（6.1）、注入脚本不直接访问父页面 DOM（2.4）
    - _Requirements: 2.2, 2.4, 6.1_

- [x] 13. 最终检查点 — 确认全部测试通过
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- 标记 `*` 的子任务为可选（属性测试、单元测试、集成测试、冒烟测试），可为快速 MVP 跳过；核心实现子任务不标记 `*`。
- 每个任务都引用了具体的需求条款以保证可追溯性；每条属性测试明确引用设计文档中的对应 Property 编号及其校验的需求条款。
- 属性测试统一使用 fast-check（`numRuns >= 100`），每个测试文件含注释标注 `// Feature: html-visual-editor, Property {number}: {property_text}`。
- 开发期模块化便于测试，最终交付物为内联组装后的单文件 `html-editor.html`（零依赖）。
- 检查点用于增量验证；属性测试覆盖通用正确性属性，单元测试覆盖具体示例、固定枚举与错误分支，集成/冒烟测试覆盖渲染保真与一次性配置类验收标准。

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "4.1", "5.1", "7.1", "8.1", "9.1", "10.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "3.2", "3.3", "4.2", "5.2", "7.2", "7.3", "7.4", "9.2", "9.3", "10.2", "10.3", "11.1", "11.2"] },
    { "id": 3, "tasks": ["8.2", "9.4", "9.5", "9.6", "9.7", "10.4", "10.5"] },
    { "id": 4, "tasks": ["8.3", "8.4", "8.5", "9.8", "9.9", "9.10", "10.6", "11.3"] },
    { "id": 5, "tasks": ["9.11", "9.12", "9.13", "11.4", "11.5", "12.1"] },
    { "id": 6, "tasks": ["12.2"] }
  ]
}
```
