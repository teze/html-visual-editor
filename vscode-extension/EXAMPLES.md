# 使用示例

本文档提供 HTML 可视化编辑器的实际使用示例。

## 示例 1：编辑简单网页

### 原始 HTML

```html
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <title>我的网页</title>
</head>
<body>
    <h1>欢迎</h1>
    <p>这是一个段落</p>
</body>
</html>
```

### 编辑步骤

1. **打开文件**
   - 右键点击文件 → "用可视化编辑器打开"

2. **修改标题**
   - 点击 "欢迎" 文字
   - 在属性面板修改：
     - 文字内容：`欢迎来到我的网站`
     - 字体大小：`36`
     - 文字颜色：`#00d4aa`

3. **修改段落**
   - 双击段落文字直接编辑
   - 或在属性面板修改样式

4. **保存**
   - 自动保存（2秒后）
   - 或按 `Cmd+S` / `Ctrl+S` 手动保存

### 结果

```html
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <title>我的网页</title>
</head>
<body>
    <h1 style="font-size: 36px; color: #00d4aa;">欢迎来到我的网站</h1>
    <p>这是一个段落</p>
</body>
</html>
```

## 示例 2：创建卡片组件

### 原始 HTML

```html
<!DOCTYPE html>
<html>
<body>
    <div>
        <h2>标题</h2>
        <p>描述文字</p>
    </div>
</body>
</html>
```

### 编辑步骤

1. **选择容器 div**
   - 点击 div 区域

2. **设置容器样式**
   - 背景颜色：`#f5f5f5`
   - 内边距：`20`
   - 圆角：`8`
   - 宽度：`300px`

3. **设置标题样式**
   - 点击 h2
   - 字体大小：`24`
   - 字体粗细：`700`
   - 文字颜色：`#333333`

4. **设置描述样式**
   - 点击 p
   - 字体大小：`14`
   - 文字颜色：`#666666`

### 结果

```html
<!DOCTYPE html>
<html>
<body>
    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; width: 300px;">
        <h2 style="font-size: 24px; font-weight: 700; color: #333333;">标题</h2>
        <p style="font-size: 14px; color: #666666;">描述文字</p>
    </div>
</body>
</html>
```

## 示例 3：编辑图片和链接

### 原始 HTML

```html
<!DOCTYPE html>
<html>
<body>
    <a href="#">
        <img src="placeholder.jpg" alt="图片">
    </a>
    <p>点击图片访问网站</p>
</body>
</html>
```

### 编辑步骤

1. **修改图片地址**
   - 点击图片
   - 在属性面板的"图片地址"输入：
     ```
     https://example.com/image.jpg
     ```
   - 设置宽度：`400px`

2. **修改链接地址**
   - 点击链接（a 标签）
   - 在属性面板的"链接地址"输入：
     ```
     https://example.com
     ```

3. **美化提示文字**
   - 点击段落
   - 文字对齐：居中
   - 文字颜色：`#888888`
   - 字体大小：`12`

### 结果

```html
<!DOCTYPE html>
<html>
<body>
    <a href="https://example.com">
        <img src="https://example.com/image.jpg" alt="图片" style="width: 400px;">
    </a>
    <p style="text-align: center; color: #888888; font-size: 12px;">点击图片访问网站</p>
</body>
</html>
```

## 示例 4：创建按钮

### 原始 HTML

```html
<!DOCTYPE html>
<html>
<body>
    <a href="#">点击这里</a>
</body>
</html>
```

### 编辑步骤

1. **选择链接**
   - 点击 "点击这里"

2. **设置按钮样式**
   - 文字内容：`立即开始`
   - 背景颜色：`#00d4aa`
   - 文字颜色：`#ffffff`
   - 内边距：`12`
   - 圆角：`6`
   - 字体大小：`16`
   - 字体粗细：`600`

3. **设置链接**
   - 链接地址：`https://example.com/start`

### 结果

```html
<!DOCTYPE html>
<html>
<body>
    <a href="https://example.com/start" 
       style="background-color: #00d4aa; color: #ffffff; padding: 12px; border-radius: 6px; font-size: 16px; font-weight: 600;">
        立即开始
    </a>
</body>
</html>
```

## 示例 5：删除元素

### 原始 HTML

```html
<!DOCTYPE html>
<html>
<body>
    <h1>标题</h1>
    <p>保留这个段落</p>
    <p>删除这个段落</p>
    <p>也保留这个</p>
</body>
</html>
```

### 编辑步骤

1. **选择要删除的元素**
   - 点击 "删除这个段落"

2. **删除**
   - 在属性面板底部点击 "🗑️ 删除此元素"
   - 确认删除

### 结果

```html
<!DOCTYPE html>
<html>
<body>
    <h1>标题</h1>
    <p>保留这个段落</p>
    <p>也保留这个</p>
</body>
</html>
```

## 示例 6：批量编辑

### 场景：统一修改多个元素的样式

假设你有多个段落需要统一样式：

```html
<p>段落 1</p>
<p>段落 2</p>
<p>段落 3</p>
```

### 编辑步骤

1. **选择第一个段落**
   - 设置样式（如字体大小 14px，颜色 #666666）

2. **选择第二个段落**
   - 应用相同样式

3. **选择第三个段落**
   - 应用相同样式

> 💡 **提示**：虽然需要逐个编辑，但属性面板会记住上次的设置，方便快速应用。

## 示例 7：响应式设计

### 使用百分比宽度

```html
<div>
    <img src="image.jpg" alt="图片">
</div>
```

### 编辑步骤

1. **选择图片**
2. **设置宽度**
   - 输入：`100%`（会自动识别为百分比）
3. **设置容器**
   - 选择 div
   - 宽度：`80%`

### 结果

```html
<div style="width: 80%;">
    <img src="image.jpg" alt="图片" style="width: 100%;">
</div>
```

## 常用样式组合

### 居中容器

```
宽度：600px
内边距：20px
背景颜色：#ffffff
圆角：8px
```

### 标题样式

```
字体大小：32px
字体粗细：700
文字颜色：#333333
```

### 正文样式

```
字体大小：16px
文字颜色：#666666
行高：1.6（需要手动添加到 style）
```

### 按钮样式

```
背景颜色：#00d4aa
文字颜色：#ffffff
内边距：12px
圆角：6px
字体大小：16px
字体粗细：600
```

### 卡片样式

```
背景颜色：#f5f5f5
内边距：24px
圆角：12px
宽度：300px
```

## 快捷技巧

### 1. 快速编辑文字
- 双击文字直接编辑（无需打开属性面板）

### 2. 颜色选择
- 使用颜色选择器快速选择
- 或直接输入 Hex 颜色值

### 3. 数值调整
- 使用数字输入框的上下箭头微调
- 或直接输入精确数值

### 4. 预览效果
- 编辑后立即在预览区域看到效果
- 无需刷新或重新加载

### 5. 撤销操作
- 使用 VS Code 的撤销功能（`Cmd+Z` / `Ctrl+Z`）
- 或重新加载文件

## 注意事项

### 1. 样式优先级
- 编辑器生成的是内联样式（`style` 属性）
- 内联样式优先级最高，会覆盖外部 CSS

### 2. 不可编辑的元素
- `<html>`, `<head>`, `<script>` 等结构性标签不可编辑
- 点击这些元素不会显示属性面板

### 3. 复杂布局
- 对于复杂的 CSS 布局（如 Flexbox、Grid），建议在代码中编写
- 编辑器主要用于快速调整样式和内容

### 4. 外部样式表
- 编辑器不会修改外部 CSS 文件
- 仅修改 HTML 文件中的内联样式

## 最佳实践

### 1. 先结构后样式
- 先在代码中创建 HTML 结构
- 再用编辑器调整样式和内容

### 2. 使用语义化标签
- 使用 `<h1>`, `<p>`, `<article>` 等语义化标签
- 编辑器会保留标签类型

### 3. 保持简洁
- 避免过度使用内联样式
- 复杂样式建议使用外部 CSS

### 4. 定期保存
- 虽然有自动保存，但重要修改后建议手动保存
- 使用版本控制（Git）管理文件

### 5. 预览测试
- 在不同浏览器中测试效果
- 检查响应式布局

## 获取更多帮助

- 📖 [README.md](README.md) - 功能说明
- 🚀 [QUICKSTART.md](QUICKSTART.md) - 快速上手
- 🔧 [DEVELOPMENT.md](DEVELOPMENT.md) - 开发指南
- 📊 [VERSION_COMPARISON.md](../VERSION_COMPARISON.md) - 版本对比

---

*更多示例持续更新中...*
