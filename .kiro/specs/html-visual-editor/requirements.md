# Requirements Document

## Introduction

HTML 可视化编辑器是一款面向非技术用户的工具。用户可以打开任意本地 HTML 文件，工具会像浏览器一样完整渲染该文件，并允许用户在渲染后的页面上直接进行可视化编辑：悬停高亮元素、单击选中元素、双击文字进行内联编辑、通过右侧属性面板修改元素样式（字体大小、字体粗细、文字颜色、背景颜色、文字对齐、内边距、圆角、宽高），编辑图片 `src` 与链接 `href`，以及删除元素。编辑完成后，用户可以导出一份移除了所有编辑器注入代码的干净 HTML 文件。

本需求文档聚焦 P0（MVP）核心功能。P1 与 P2 功能记录在"未来范围"章节，作为后续迭代的参考，不在本期实现范围内。

技术实现采用 `<iframe srcdoc>` 渲染用户 HTML，通过注入脚本与父页面 `postMessage` 通信完成交互与样式更新。

## Glossary

- **编辑器（Editor）**：本工具的整体应用，承载顶栏、预览区、属性面板与状态栏。
- **文件加载器（File_Loader）**：负责接收并读取用户提供的本地 HTML 文件的组件。
- **预览框架（Preview_Frame）**：使用 `<iframe srcdoc>` 渲染用户 HTML 内容的区域。
- **注入脚本（Injected_Script）**：注入到预览框架内部、负责监听交互事件并与编辑器通过 `postMessage` 通信的脚本，其 `<script>` 标签的 `id` 为 `__htmledit__`。
- **属性面板（Property_Panel）**：编辑器右侧用于展示与修改选中元素属性的面板。
- **导出器（Exporter）**：负责生成并下载干净 HTML 文件的组件。
- **状态栏（Status_Bar）**：编辑器底部显示状态信息与修改计数的区域。
- **选中元素（Selected_Element）**：用户在预览框架中当前单击选中的 DOM 元素。
- **可编辑元素（Editable_Element）**：可以被选中并编辑的 DOM 元素，不包括 `<html>`、`<head>`、`<style>`、`<script>`、`<meta>`、`<link>`、`<title>` 等结构性或非可视元素。
- **修改计数（Change_Count）**：用户自打开文件以来对内容或样式所做修改的累计次数。
- **十六进制颜色值（Hex_Color）**：形如 `#RRGGBB` 或 `#RGB` 的十六进制颜色字符串。

## Requirements

### 需求 1：打开 HTML 文件

**用户故事：** 作为非技术用户，我想要通过点击选择或拖拽放入本地 HTML 文件，以便在编辑器中打开并编辑它。

#### 验收标准

1. WHEN 用户点击"打开文件"控件并选择一个扩展名为 `.html` 或 `.htm` 且大小不超过 10 MB（10,485,760 字节）的文件，THE File_Loader SHALL 读取该文件的文本内容并将其加载到 Preview_Frame 中。
2. WHEN 用户将单个扩展名为 `.html` 或 `.htm` 且大小不超过 10 MB（10,485,760 字节）的文件拖拽放入编辑器区域，THE File_Loader SHALL 读取该文件的文本内容并将其加载到 Preview_Frame 中。
3. IF 用户选择或拖入的文件扩展名不是 `.html` 或 `.htm`，THEN THE File_Loader SHALL 拒绝加载该文件、保持 Preview_Frame 中的现有内容不变，并在 Status_Bar 显示指示文件类型不受支持的错误提示。
4. WHEN 一个 HTML 文件成功加载，THE Editor SHALL 在顶栏显示该文件的完整文件名（含扩展名）。
5. IF 用户选择或拖入的文件大小超过 10 MB（10,485,760 字节），THEN THE File_Loader SHALL 拒绝加载该文件、保持 Preview_Frame 中的现有内容不变，并在 Status_Bar 显示指示文件超出大小限制的错误提示。
6. IF 文件读取过程失败（例如文件无法访问或内容无法读取），THEN THE File_Loader SHALL 中止本次加载、保持 Preview_Frame 中的现有内容不变，并在 Status_Bar 显示指示读取失败的错误提示。
7. IF 用户一次拖入多个文件，THEN THE File_Loader SHALL 仅加载其中第一个扩展名为 `.html` 或 `.htm` 的文件，并在 Status_Bar 显示指示已忽略其余文件的提示。

### 需求 2：页面渲染预览

**用户故事：** 作为用户，我想要看到和浏览器一致的页面渲染结果，以便在真实呈现效果上进行编辑。

#### 验收标准

1. WHEN 一个 `.html` 或 `.htm` 文件被成功读取为文本内容，THE Preview_Frame SHALL 使用 `<iframe srcdoc>` 渲染该 HTML 的全部内容，且渲染结果中的所有原始 `<style>` 规则、内联 `style` 属性与 `<link>` 引用样式均保持不变，使其视觉呈现与浏览器直接打开同一文件的结果一致。
2. THE Preview_Frame SHALL 为 `<iframe>` 设置 `sandbox="allow-scripts allow-same-origin"` 以允许内部脚本执行。
3. WHEN Preview_Frame 的 `<iframe>` 触发 `load` 事件，THE Editor SHALL 在 2 秒内向 Preview_Frame 内部注入且仅注入一个 `id` 为 `__htmledit__` 的 Injected_Script。
4. THE Injected_Script SHALL 仅通过 `postMessage` 与 Editor 双向通信，且不直接访问 Editor 所在父页面的 DOM。
5. IF 加载的 HTML 内容为空或无法被解析为有效的 HTML 文档，THEN THE Preview_Frame SHALL 显示指示渲染失败的错误提示，且不注入 Injected_Script、不进入元素编辑状态。

### 需求 3：悬停高亮与单击选中

**用户故事：** 作为用户，我想要在鼠标悬停时看到元素边框、在单击时选中元素，以便明确知道我正在操作哪个元素。

#### 验收标准

1. WHEN 鼠标指针移动到 Preview_Frame 内某个尚未被标记为 Selected_Element 的 Editable_Element 上，THE Injected_Script SHALL 在 100 毫秒内为该元素显示半透明色 `rgba(0, 212, 170, 0.35)` 的悬停高亮边框。
2. WHEN 鼠标指针移出某个先前显示悬停高亮的 Editable_Element，THE Injected_Script SHALL 在 100 毫秒内移除该元素的悬停高亮边框，并保留该元素作为 Selected_Element 时的选中边框（若存在）。
3. WHEN 用户单击 Preview_Frame 内的某个 Editable_Element，THE Injected_Script SHALL 在 100 毫秒内将该元素标记为 Selected_Element 并显示 `#00d4aa` 实线 2px 的选中边框。
4. WHEN 一个 Editable_Element 被标记为 Selected_Element，THE Injected_Script SHALL 在 100 毫秒内通过 `postMessage` 将该元素的标签信息与当前样式发送给 Editor。
5. WHEN Editor 收到 Selected_Element 的信息，THE Property_Panel SHALL 显示该信息中包含的可编辑样式属性及其当前值。
6. WHEN 用户单击另一个 Editable_Element，THE Injected_Script SHALL 移除前一个 Selected_Element 的选中边框并将新元素标记为 Selected_Element。
7. IF 用户单击 Preview_Frame 内不属于 Editable_Element 的元素或空白区域，THEN THE Injected_Script SHALL 保持当前 Selected_Element 及其选中边框不变，并保持 Property_Panel 当前显示内容不变。

### 需求 4：双击文字内联编辑

**用户故事：** 作为用户，我想要双击文字直接在预览中修改内容，以便快速编辑文案而无需打开面板。

#### 验收标准

1. WHEN 用户双击 Preview_Frame 内的某个文字类 Editable_Element（即直接包含文本内容、且不属于 `<html>`、`<head>`、`<style>`、`<script>`、`<img>` 的元素），THE Injected_Script SHALL 将该元素的 `contentEditable` 属性设置为可编辑状态，并使该元素获得输入焦点。
2. WHILE 一个元素处于 `contentEditable` 可编辑状态，WHEN 该元素触发 `input` 事件，THE Injected_Script SHALL 使该元素在预览中显示的文字与用户当前输入的文字保持一致。
3. WHEN 一个处于 `contentEditable` 可编辑状态的元素的文字内容发生 `input` 变更，THE Injected_Script SHALL 在 200 毫秒内通过 `postMessage` 将变更后的完整文字内容同步给 Editor。
4. WHEN Editor 收到某个元素经内联编辑产生的文字变更同步消息，且该元素在本次编辑会话（从进入可编辑状态到失去焦点退出的区间）内尚未计入修改，THE Editor SHALL 将 Change_Count 增加 1；同一次编辑会话内的后续 `input` 变更 SHALL NOT 重复增加 Change_Count。
5. IF 用户双击的目标元素属于不可编辑元素（如 `<html>`、`<head>`、`<style>`、`<script>` 或不直接包含文本的元素），THEN THE Injected_Script SHALL 不设置该元素的 `contentEditable` 属性，并保持其处于非编辑状态。
6. WHEN 处于 `contentEditable` 可编辑状态的元素失去输入焦点，THE Injected_Script SHALL 将该元素的 `contentEditable` 属性恢复为不可编辑状态。

### 需求 5：属性面板样式编辑

**用户故事：** 作为用户，我想要在右侧属性面板中修改选中元素的样式属性，以便在不接触代码的情况下调整外观。

#### 验收标准

1. WHEN 用户在 Property_Panel 中修改 Selected_Element 的文字内容，THE Editor SHALL 通过 `postMessage` 指令更新该元素的文字内容，并在 500 毫秒内将修改反映在 Preview_Frame 中。
2. WHEN 用户在 Property_Panel 中输入 1 至 999（含）范围内的 px 整数值作为字体大小，THE Editor SHALL 更新 Selected_Element 的 `font-size` 样式，并在 500 毫秒内将修改反映在 Preview_Frame 中。
3. WHEN 用户在 Property_Panel 中从下拉选项 300、400、500、600、700、900 中选择字体粗细，THE Editor SHALL 更新 Selected_Element 的 `font-weight` 样式，并在 500 毫秒内将修改反映在 Preview_Frame 中。
4. WHEN 用户在 Property_Panel 中通过颜色选择器或 Hex_Color 输入框设置合法的文字颜色（`#` 后接 3 或 6 位十六进制字符），THE Editor SHALL 更新 Selected_Element 的 `color` 样式，并在 500 毫秒内将修改反映在 Preview_Frame 中。
5. WHEN 用户在 Property_Panel 中通过颜色选择器或 Hex_Color 输入框设置合法的背景颜色（`#` 后接 3 或 6 位十六进制字符），THE Editor SHALL 更新 Selected_Element 的 `background-color` 样式，并在 500 毫秒内将修改反映在 Preview_Frame 中。
6. WHEN 用户在 Property_Panel 中点击左对齐、居中对齐或右对齐按钮，THE Editor SHALL 更新 Selected_Element 的 `text-align` 样式，并在 500 毫秒内将修改反映在 Preview_Frame 中。
7. WHEN 用户在 Property_Panel 中输入 0 至 9999（含）范围内的 px 整数值作为内边距，THE Editor SHALL 更新 Selected_Element 的 `padding` 样式，并在 500 毫秒内将修改反映在 Preview_Frame 中。
8. WHEN 用户在 Property_Panel 中输入 0 至 9999（含）范围内的 px 整数值作为圆角，THE Editor SHALL 更新 Selected_Element 的 `border-radius` 样式，并在 500 毫秒内将修改反映在 Preview_Frame 中。
9. WHEN 用户在 Property_Panel 中输入宽度或高度（px 单位时取值 0 至 99999，% 单位时取值 0 至 100），THE Editor SHALL 更新 Selected_Element 的 `width` 或 `height` 样式，并在 500 毫秒内将修改反映在 Preview_Frame 中。
10. WHEN 用户通过 Property_Panel 完成一次成功并已反映到 Preview_Frame 的样式属性修改，THE Editor SHALL 将 Change_Count 增加 1。
11. WHEN 用户在颜色选择器中改变颜色，THE Property_Panel SHALL 将对应的 Hex_Color 输入框更新为相同的 6 位十六进制颜色值。
12. WHEN 用户在 Hex_Color 输入框中输入合法的颜色值（`#` 后接 3 或 6 位十六进制字符），THE Property_Panel SHALL 将对应的颜色选择器更新为相同的颜色值。
13. IF 用户在字体大小、内边距、圆角或宽高输入框中输入空值、非数值或超出对应取值范围的值，THEN THE Editor SHALL 保持 Selected_Element 的对应样式不变、不增加 Change_Count，并在 Property_Panel 中显示指示输入无效的提示。
14. IF 用户在 Hex_Color 输入框中输入不符合 `#` 后接 3 或 6 位十六进制字符格式的值，THEN THE Editor SHALL 保持 Selected_Element 的对应颜色样式不变、不增加 Change_Count，并在 Property_Panel 中显示指示颜色值无效的提示。

### 需求 6：颜色值读取与转换

**用户故事：** 作为用户，我想要属性面板的颜色控件准确显示选中元素的当前颜色，以便在已有颜色基础上进行调整。

#### 验收标准

1. WHEN Editor 读取 Selected_Element 的文字颜色或背景颜色样式，THE Editor SHALL 使用 `getComputedStyle` 获取该元素的计算后颜色值。
2. WHEN 计算后的颜色值为 `rgb(r, g, b)` 格式（r、g、b 均为 0 至 255 的整数），THE Editor SHALL 将其转换为 6 位小写 `#rrggbb` 格式的 Hex_Color 以回填到 Property_Panel 的颜色控件。
3. WHEN 计算后的颜色值为 `rgba(r, g, b, a)` 格式且 a 小于 1，THE Editor SHALL 将其转换为 8 位 `#rrggbbaa` 格式，其中 aa 为将 0 至 1 的 alpha 值映射到 0 至 255 整数后的十六进制表示。
4. IF 计算后的颜色值无法被解析为有效的 `rgb()` 或 `rgba()` 颜色，THEN THE Editor SHALL 保持 Property_Panel 颜色控件当前显示不变、不改变元素样式，并显示指示颜色解析失败的提示。
5. FOR ALL 合法的 Hex_Color 值（3 位 `#rgb` 或 6 位 `#rrggbb`），先转换为 `rgb()` 再转换回 Hex_Color SHALL 得到 R、G、B 三个通道整数值相等的颜色（往返一致性），其中 3 位简写按通道复制扩展（例如 `#abc` 等价于 `#aabbcc`）。

### 需求 7：图片与链接专属属性编辑

**用户故事：** 作为用户，我想要在选中图片或链接时编辑其地址，以便替换图片或修改跳转目标。

#### 验收标准

1. WHEN Selected_Element 是 `<img>` 元素，THE Property_Panel SHALL 额外显示一个最多接受 2048 个字符的 `src` 输入框，并以该元素当前的 `src` 属性值预填充该输入框。
2. WHEN 用户在 `src` 输入框中输入非空新值，THE Editor SHALL 在 300 毫秒内更新该 `<img>` 元素的 `src` 属性，并将该修改反映在 Preview_Frame 中。
3. IF 用户将 `src` 输入框的内容清空为空值，THEN THE Editor SHALL 保留该 `<img>` 元素原有的 `src` 属性值不变，并在 Property_Panel 中显示提示地址不能为空的错误指示。
4. WHEN Selected_Element 是 `<a>` 元素，THE Property_Panel SHALL 额外显示一个最多接受 2048 个字符的 `href` 输入框，并以该元素当前的 `href` 属性值预填充该输入框。
5. WHEN 用户在 `href` 输入框中输入非空新值，THE Editor SHALL 在 300 毫秒内更新该 `<a>` 元素的 `href` 属性，并将该修改反映在 Preview_Frame 中。
6. IF 用户将 `href` 输入框的内容清空为空值，THEN THE Editor SHALL 保留该 `<a>` 元素原有的 `href` 属性值不变，并在 Property_Panel 中显示提示地址不能为空的错误指示。

### 需求 8：删除元素

**用户故事：** 作为用户，我想要删除选中的元素，以便移除页面中不需要的内容。

#### 验收标准

1. WHEN 用户在 Property_Panel 中点击"删除元素"控件，THE Editor SHALL 通过 `postMessage` 指令将 Selected_Element 及其全部后代元素从 Preview_Frame 的 DOM 中移除，且无需二次确认。
2. WHEN Selected_Element 被删除，THE Property_Panel SHALL 清空该元素的全部属性显示。
3. WHEN Selected_Element 被删除，THE Editor SHALL 将 Change_Count 增加 1。
4. WHEN Selected_Element 被删除，THE Editor SHALL 清除当前选中状态，使 Preview_Frame 中不再显示该元素的选中高亮，且后续属性修改不再作用于已删除的元素。
5. IF 用户点击"删除元素"控件时不存在 Selected_Element，THEN THE Editor SHALL 不修改 Preview_Frame 的 DOM、不改变 Change_Count，并向用户给出提示指示当前没有可删除的选中元素。

### 需求 9：不可编辑元素的处理

**用户故事：** 作为用户，我想要工具忽略对结构性元素的点击，以便我只编辑页面中可见的内容元素。

#### 验收标准

1. WHILE 鼠标指针位于 `<html>`、`<head>`、`<style>`、`<script>`、`<meta>`、`<link>` 或 `<title>` 不可编辑元素上，THE Injected_Script SHALL 不显示悬停高亮边框且不显示选中边框。
2. IF 用户单击 `<html>`、`<head>`、`<style>`、`<script>`、`<meta>`、`<link>` 或 `<title>` 不可编辑元素，THEN THE Injected_Script SHALL 不将该元素标记为 Selected_Element。
3. IF 用户单击不可编辑元素且当前已存在一个 Selected_Element，THEN THE Injected_Script SHALL 保持原 Selected_Element 的选中状态不变，并保持 Property_Panel 当前显示的属性不变。
4. IF 用户单击不可编辑元素，THEN THE Injected_Script SHALL 不通过 `postMessage` 向 Editor 发送任何元素选中信息。

### 需求 10：导出干净 HTML

**用户故事：** 作为用户，我想要导出一份不含编辑器代码的干净 HTML 文件，以便交付或继续使用编辑成果。

#### 验收标准

1. WHEN 用户点击"导出"控件且 Preview_Frame 已加载 HTML 内容，THE Exporter SHALL 生成与当前 Preview_Frame DOM 状态（包含全部编辑成果）一致的 HTML 文本。
2. WHEN Exporter 生成导出文本，THE Exporter SHALL 触发一个扩展名为 `.html` 的文件下载。
3. WHEN Exporter 生成导出内容，THE Exporter SHALL 移除 `id` 为 `__htmledit__` 的 Injected_Script 标签。
4. WHEN Exporter 生成导出内容，THE Exporter SHALL 清除所有由编辑器添加的 `outline` 与 `cursor` 编辑态样式。
5. THE 导出后的 HTML SHALL 不包含任何编辑器注入的脚本或编辑态样式。
6. IF 用户点击"导出"控件时 Preview_Frame 未加载任何 HTML 内容，THEN THE Exporter SHALL 取消导出、不触发文件下载，并显示指示无可导出内容的错误提示。
7. WHEN 导出操作完成，THE Editor SHALL 在 1 秒内重新加载 Injected_Script，并保留导出前的全部修改，使页面处于可继续编辑的状态。

### 需求 11：修改计数与状态展示

**用户故事：** 作为用户，我想要看到我已经做了多少处修改，以便了解编辑进度。

#### 验收标准

1. WHEN 一个 HTML 文件成功加载，THE Status_Bar SHALL 将 Change_Count 重置为 0 并将其显示为"0 处修改"。
2. WHEN 用户成功完成一次属性变更、一次文字内容编辑或一次删除元素操作，THE Editor SHALL 将 Change_Count 增加 1，且 Change_Count 取值范围为 0 至 999999 的整数。
3. WHEN Change_Count 的数值发生变化，THE Status_Bar SHALL 在 200 毫秒内将显示文本更新为"N 处修改"，其中 N 为当前 Change_Count 的整数值。
4. WHILE 编辑器已加载文件、未处于错误状态且 Change_Count 等于 0，THE Status_Bar SHALL 显示"就绪"状态指示。
5. WHILE 编辑器已加载文件、未处于错误状态且 Change_Count 大于 0，THE Status_Bar SHALL 显示"已修改"状态指示。

## 未来范围（非本期实现）

以下功能来自产品需求文档的 P1 与 P2 优先级，记录于此作为后续迭代参考，不在本期 MVP 实现范围内。

### P1 · 重要功能（第二期）

- **撤销 / 重做**：通过 Ctrl+Z / Ctrl+Y 支持所有属性变更的撤销与重做。
- **元素树面板**：左侧显示 DOM 树，支持点击定位元素。
- **添加元素**：插入文字块、图片、按钮、分割线等新元素。
- **拖拽移动**：通过拖拽改变元素在页面中的位置。
- **响应式预览**：在桌面 / 平板 / 手机宽度之间切换预览。
- **字体选择器**：对接 Google Fonts 选择字体。

### P2 · 进阶功能（长期规划）

- **多文件管理**：以多标签页方式同时打开多个 HTML 文件。
- **云端保存**：登录后将文件保存到云端。
- **分享预览链接**：生成临时的在线预览链接。
- **AI 辅助**：以自然语言描述修改意图，由 AI 自动执行修改。
- **版本历史**：记录每次保存的历史快照。
