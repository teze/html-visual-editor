# Cursor 浏览器功能实现计划

## 🎯 目标：打造专业级 HTML 可视化编辑器

对标 Cursor 浏览器，实现以下核心功能：

1. **元素树面板（Components）** - 完整的 DOM 结构树
2. **专业属性面板** - Design、Position、Layout、Dimensions 等分组
3. **强大的布局编辑** - Flexbox/Grid 可视化编辑
4. **实时同步** - 修改立即反映在预览中

## 📐 界面布局设计

```
┌─────────────────────────────────────────────────────────────────┐
│  顶栏：文件名 | 设备切换 | 撤销/重做 | 保存 | 导出              │
├──────────┬──────────────────────────────────┬───────────────────┤
│          │                                  │                   │
│  元素树  │         实时预览                 │   属性面板        │
│  面板    │         (iframe)                 │                   │
│          │                                  │   ┌─────────────┐ │
│  ├─body  │   ┌──────────────────────┐      │   │ Design      │ │
│  │ ├─nav │   │                      │      │   ├─────────────┤ │
│  │ ├─main│   │   可点击选中元素     │      │   │ Position    │ │
│  │ └─foot│   │   悬停高亮           │      │   ├─────────────┤ │
│          │   │   拖拽调整           │      │   │ Layout      │ │
│  [搜索]  │   │                      │      │   ├─────────────┤ │
│  [过滤]  │   └──────────────────────┘      │   │ Dimensions  │ │
│          │                                  │   ├─────────────┤ │
│  200px   │         自适应                   │   │ Padding     │ │
│          │                                  │   ├─────────────┤ │
│          │                                  │   │ Margin      │ │
│          │                                  │   ├─────────────┤ │
│          │                                  │   │ Appearance  │ │
│          │                                  │   ├─────────────┤ │
│          │                                  │   │ Text        │ │
│          │                                  │   └─────────────┘ │
│          │                                  │      280px        │
└──────────┴──────────────────────────────────┴───────────────────┘
```

## 🏗️ 实现阶段

### 阶段 1：核心界面重构（第 1 周）

#### 1.1 三栏布局
- ✅ 左侧：元素树面板（200px，可调整）
- ✅ 中间：预览区域（自适应）
- ✅ 右侧：属性面板（280px，可调整）
- ✅ 面板可折叠/展开
- ✅ 拖拽调整面板宽度

#### 1.2 元素树面板（Components Tree）

**功能需求：**
```javascript
// 元素树结构
{
  tag: 'body',
  id: 'body-1',
  classes: [],
  children: [
    {
      tag: 'header',
      id: 'header-1',
      classes: ['site-header'],
      children: [...]
    },
    {
      tag: 'main',
      id: 'main-1',
      classes: ['content'],
      children: [...]
    }
  ]
}
```

**交互功能：**
- ✅ 显示完整的 DOM 树结构
- ✅ 展开/折叠节点
- ✅ 点击节点选中元素
- ✅ 选中节点高亮显示
- ✅ 拖拽节点重新排序
- ✅ 右键菜单：
  - 复制元素
  - 删除元素
  - 包裹元素（Wrap）
  - 复制为 HTML
  - 在预览中定位

**视觉设计：**
```css
.tree-node {
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
}

.tree-node:hover {
  background: rgba(255, 255, 255, 0.05);
}

.tree-node.selected {
  background: #00d4aa;
  color: #000;
}

.tree-node-tag {
  color: #00d4aa;
  font-weight: 600;
}

.tree-node-id {
  color: #ffa500;
}

.tree-node-class {
  color: #87ceeb;
}
```

#### 1.3 专业属性面板

**分组结构：**

##### 1. Design（设计）
```
┌─ Design ────────────────────┐
│ Background                  │
│ ┌─────────┐ #ffffff        │
│ │  Color  │ [            ] │
│ └─────────┘                │
│                             │
│ Border                      │
│ Width: [1]px  Style: [solid]│
│ Color: #000000              │
│ Radius: [0]px               │
│                             │
│ Shadow                      │
│ X: [0] Y: [0] Blur: [0]    │
│ Color: rgba(0,0,0,0.1)     │
└─────────────────────────────┘
```

##### 2. Position（定位）
```
┌─ Position ──────────────────┐
│ Type: [static ▼]            │
│   ○ static                  │
│   ○ relative                │
│   ○ absolute                │
│   ○ fixed                   │
│   ○ sticky                  │
│                             │
│ Coordinates                 │
│ Top:    [   ]  Right: [   ]│
│ Bottom: [   ]  Left:  [   ]│
│                             │
│ Z-Index: [auto]             │
└─────────────────────────────┘
```

##### 3. Layout（布局）
```
┌─ Layout ────────────────────┐
│ Display: [block ▼]          │
│   ○ block                   │
│   ○ inline                  │
│   ○ inline-block            │
│   ○ flex                    │
│   ○ grid                    │
│   ○ none                    │
│                             │
│ ┌─ Flexbox ────────────────┐│
│ │ Direction: [row ▼]       ││
│ │ Justify:   [start ▼]     ││
│ │ Align:     [stretch ▼]   ││
│ │ Wrap:      [nowrap ▼]    ││
│ │ Gap:       [0]px         ││
│ └──────────────────────────┘│
│                             │
│ ┌─ Grid ───────────────────┐│
│ │ Columns: [1]             ││
│ │ Rows:    [auto]          ││
│ │ Gap:     [0]px           ││
│ └──────────────────────────┘│
└─────────────────────────────┘
```

##### 4. Dimensions（尺寸）
```
┌─ Dimensions ────────────────┐
│ Width                       │
│ [200]px  ○ px ○ % ○ auto   │
│ Min: [   ]  Max: [   ]      │
│                             │
│ Height                      │
│ [100]px  ○ px ○ % ○ auto   │
│ Min: [   ]  Max: [   ]      │
│                             │
│ Aspect Ratio                │
│ [   ] : [   ]  or [auto]    │
└─────────────────────────────┘
```

##### 5. Padding（内边距）
```
┌─ Padding ───────────────────┐
│ ┌─────────────────────────┐ │
│ │         [8]px           │ │
│ │    ┌─────────────┐      │ │
│ │[8] │             │ [8]  │ │
│ │    │   Content   │      │ │
│ │    └─────────────┘      │ │
│ │         [8]px           │ │
│ └─────────────────────────┘ │
│                             │
│ 🔗 Link All Sides           │
│ Top:    [8]px               │
│ Right:  [8]px               │
│ Bottom: [8]px               │
│ Left:   [8]px               │
└─────────────────────────────┘
```

##### 6. Margin（外边距）
```
┌─ Margin ────────────────────┐
│ ┌─────────────────────────┐ │
│ │         [0]px           │ │
│ │    ┌─────────────┐      │ │
│ │[0] │   Element   │ [0]  │ │
│ │    └─────────────┘      │ │
│ │         [0]px           │ │
│ └─────────────────────────┘ │
│                             │
│ 🔗 Link All Sides           │
│ Top:    [0]px               │
│ Right:  [0]px               │
│ Bottom: [0]px               │
│ Left:   [0]px               │
│                             │
│ ☐ Auto Horizontal Center    │
└─────────────────────────────┘
```

##### 7. Appearance（外观）
```
┌─ Appearance ────────────────┐
│ Opacity: [100]%             │
│ ┌─────────────────────────┐ │
│ │ ████████████████░░░░░░░ │ │
│ └─────────────────────────┘ │
│                             │
│ Cursor: [default ▼]         │
│                             │
│ Overflow                    │
│ X: [visible ▼]              │
│ Y: [visible ▼]              │
│                             │
│ Visibility: [visible ▼]     │
│                             │
│ Transform                   │
│ Rotate:  [0]deg             │
│ Scale X: [1]                │
│ Scale Y: [1]                │
│ Skew X:  [0]deg             │
│ Skew Y:  [0]deg             │
└─────────────────────────────┘
```

##### 8. Text（文本）
```
┌─ Text ──────────────────────┐
│ Font Family                 │
│ [System Font ▼]             │
│                             │
│ Size & Weight               │
│ [16]px  [400 ▼]             │
│                             │
│ Color                       │
│ ┌─────────┐ #000000        │
│ │  Color  │ [            ] │
│ └─────────┘                │
│                             │
│ Alignment                   │
│ [◀] [▬] [▶] [≡]            │
│                             │
│ Line Height: [1.5]          │
│ Letter Spacing: [0]px       │
│ Word Spacing: [0]px         │
│                             │
│ Decoration                  │
│ ☐ Underline                 │
│ ☐ Line-through              │
│ ☐ Overline                  │
│                             │
│ Transform                   │
│ ○ none                      │
│ ○ uppercase                 │
│ ○ lowercase                 │
│ ○ capitalize                │
└─────────────────────────────┘
```

### 阶段 2：Flexbox/Grid 可视化编辑（第 2 周）

#### 2.1 Flexbox 可视化编辑器

**交互式布局编辑：**
```
┌─ Flexbox Layout ────────────────────────────┐
│                                             │
│  Direction: [→] [←] [↓] [↑]                │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  ┌────┐  ┌────┐  ┌────┐  ┌────┐   │   │
│  │  │ 1  │  │ 2  │  │ 3  │  │ 4  │   │   │
│  │  └────┘  └────┘  └────┘  └────┘   │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Justify Content:                           │
│  [◀──] [─▬─] [──▶] [◀─▬─▶] [◀▬▬▶]        │
│  start  center  end   space-between  space-around │
│                                             │
│  Align Items:                               │
│  [▲] [─] [▼] [⫴]                           │
│  start center end stretch                   │
│                                             │
│  Gap: [8]px                                 │
│  Wrap: ☐ wrap                               │
└─────────────────────────────────────────────┘
```

**实现功能：**
- ✅ 可视化显示 Flexbox 布局
- ✅ 拖拽调整子元素顺序
- ✅ 点击按钮切换对齐方式
- ✅ 实时预览布局效果
- ✅ 显示辅助线和间距

#### 2.2 Grid 可视化编辑器

**交互式网格编辑：**
```
┌─ Grid Layout ───────────────────────────────┐
│                                             │
│  Columns: [3]  Rows: [2]                    │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  ┌────┬────┬────┐                   │   │
│  │  │ 1  │ 2  │ 3  │                   │   │
│  │  ├────┼────┼────┤                   │   │
│  │  │ 4  │ 5  │ 6  │                   │   │
│  │  └────┴────┴────┘                   │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Column Template:                           │
│  [1fr] [1fr] [1fr] [+]                     │
│                                             │
│  Row Template:                              │
│  [auto] [auto] [+]                         │
│                                             │
│  Gap:                                       │
│  Column: [8]px  Row: [8]px                 │
│                                             │
│  ☐ Auto Flow: row                           │
└─────────────────────────────────────────────┘
```

**实现功能：**
- ✅ 可视化显示 Grid 网格
- ✅ 拖拽调整网格大小
- ✅ 添加/删除行列
- ✅ 调整单元格跨度
- ✅ 显示网格线和编号

### 阶段 3：实时同步与交互（第 3 周）

#### 3.1 双向同步机制

**预览 → 属性面板：**
```javascript
// 点击预览中的元素
previewElement.addEventListener('click', (e) => {
  const element = e.target;
  
  // 1. 在元素树中高亮
  highlightInTree(element);
  
  // 2. 更新属性面板
  updatePropertyPanel(element);
  
  // 3. 显示选中框
  showSelectionBox(element);
});
```

**属性面板 → 预览：**
```javascript
// 修改属性
propertyInput.addEventListener('input', (e) => {
  const property = e.target.dataset.property;
  const value = e.target.value;
  
  // 1. 更新预览中的元素
  selectedElement.style[property] = value;
  
  // 2. 更新元素树显示
  updateTreeNode(selectedElement);
  
  // 3. 触发变更事件
  emitChange({ property, value });
});
```

**元素树 → 预览：**
```javascript
// 点击树节点
treeNode.addEventListener('click', (e) => {
  const elementId = e.target.dataset.elementId;
  const element = findElementById(elementId);
  
  // 1. 在预览中高亮
  highlightInPreview(element);
  
  // 2. 滚动到可见区域
  scrollIntoView(element);
  
  // 3. 更新属性面板
  updatePropertyPanel(element);
});
```

#### 3.2 实时预览增强

**功能：**
- ✅ 悬停高亮（显示元素边界）
- ✅ 选中框（显示尺寸和间距）
- ✅ 辅助线（对齐参考线）
- ✅ 尺寸标注（显示宽高）
- ✅ 间距标注（显示 margin/padding）

**视觉效果：**
```
┌─────────────────────────────────┐
│  ┌─ 200px ─┐                    │
│  │         │ 8px                │
│  │  ┌───────────────┐           │
│  │  │               │           │
│ 100px   Content     │           │
│  │  │               │           │
│  │  └───────────────┘           │
│  │         │                    │
│  └─────────┘                    │
└─────────────────────────────────┘
```

### 阶段 4：高级功能（第 4 周）

#### 4.1 样式管理

**CSS 类管理：**
```
┌─ Classes ───────────────────────┐
│ Applied Classes:                │
│ ┌─────────────────────────────┐ │
│ │ ✓ btn                       │ │
│ │ ✓ btn-primary               │ │
│ │ ✓ rounded                   │ │
│ └─────────────────────────────┘ │
│                                 │
│ Available Classes:              │
│ [Search classes...]             │
│ ┌─────────────────────────────┐ │
│ │ ☐ btn-secondary             │ │
│ │ ☐ btn-large                 │ │
│ │ ☐ card                      │ │
│ └─────────────────────────────┘ │
│                                 │
│ [+ Add New Class]               │
└─────────────────────────────────┘
```

#### 4.2 伪类编辑

**状态编辑器：**
```
┌─ States ────────────────────────┐
│ Current State: [normal ▼]       │
│   ○ normal                      │
│   ○ :hover                      │
│   ○ :active                     │
│   ○ :focus                      │
│   ○ :disabled                   │
│                                 │
│ :hover Styles                   │
│ Background: #00eebb             │
│ Transform: scale(1.05)          │
│                                 │
│ [+ Add State]                   │
└─────────────────────────────────┘
```

#### 4.3 动画编辑器

**关键帧编辑：**
```
┌─ Animation ─────────────────────┐
│ Name: [fadeIn]                  │
│ Duration: [1]s                  │
│ Timing: [ease-in-out ▼]        │
│ Delay: [0]s                     │
│ Iteration: [1]                  │
│                                 │
│ Keyframes:                      │
│ ┌─────────────────────────────┐ │
│ │ 0%   opacity: 0             │ │
│ │      transform: translateY(-20px) │
│ │                             │ │
│ │ 100% opacity: 1             │ │
│ │      transform: translateY(0) │
│ └─────────────────────────────┘ │
│                                 │
│ [▶ Preview] [+ Add Keyframe]   │
└─────────────────────────────────┘
```

## 🎨 视觉设计规范

### 颜色系统
```css
:root {
  /* 主色 */
  --primary: #00d4aa;
  --primary-hover: #00eebb;
  --primary-active: #00c099;
  
  /* 背景 */
  --bg-primary: #111111;
  --bg-secondary: #1a1a1a;
  --bg-tertiary: #222222;
  
  /* 边框 */
  --border-color: #2a2a2a;
  --border-hover: #3a3a3a;
  
  /* 文字 */
  --text-primary: #ffffff;
  --text-secondary: #d0d0d0;
  --text-tertiary: #888888;
  --text-disabled: #555555;
  
  /* 状态 */
  --success: #4caf50;
  --warning: #ff9800;
  --error: #f44336;
  --info: #2196f3;
}
```

### 间距系统
```css
:root {
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;
  --space-2xl: 32px;
}
```

### 字体系统
```css
:root {
  --font-family: -apple-system, 'PingFang SC', 'Helvetica Neue', sans-serif;
  --font-mono: 'SF Mono', 'Monaco', 'Consolas', monospace;
  
  --font-size-xs: 10px;
  --font-size-sm: 11px;
  --font-size-md: 12px;
  --font-size-lg: 13px;
  --font-size-xl: 14px;
}
```

## 📦 技术实现

### 核心模块

#### 1. 元素树管理器
```javascript
class ElementTreeManager {
  constructor(rootElement) {
    this.root = rootElement;
    this.selectedNode = null;
  }
  
  // 构建树结构
  buildTree(element) {
    return {
      id: this.generateId(element),
      tag: element.tagName.toLowerCase(),
      classes: Array.from(element.classList),
      attributes: this.getAttributes(element),
      children: Array.from(element.children).map(child => 
        this.buildTree(child)
      )
    };
  }
  
  // 选中节点
  selectNode(nodeId) {
    this.selectedNode = nodeId;
    this.emit('nodeSelected', nodeId);
  }
  
  // 拖拽重排
  reorderNode(nodeId, newParentId, index) {
    // 实现拖拽逻辑
  }
}
```

#### 2. 属性面板管理器
```javascript
class PropertyPanelManager {
  constructor() {
    this.panels = {
      design: new DesignPanel(),
      position: new PositionPanel(),
      layout: new LayoutPanel(),
      dimensions: new DimensionsPanel(),
      padding: new PaddingPanel(),
      margin: new MarginPanel(),
      appearance: new AppearancePanel(),
      text: new TextPanel()
    };
  }
  
  // 更新面板
  updatePanel(element) {
    const styles = window.getComputedStyle(element);
    
    Object.values(this.panels).forEach(panel => {
      panel.update(element, styles);
    });
  }
  
  // 应用修改
  applyChange(property, value) {
    this.selectedElement.style[property] = value;
    this.emit('propertyChanged', { property, value });
  }
}
```

#### 3. 布局编辑器
```javascript
class FlexboxEditor {
  constructor(element) {
    this.element = element;
    this.initVisualizer();
  }
  
  // 初始化可视化
  initVisualizer() {
    this.overlay = this.createOverlay();
    this.showFlexLines();
    this.showGaps();
  }
  
  // 显示 Flex 线
  showFlexLines() {
    const children = Array.from(this.element.children);
    children.forEach((child, index) => {
      this.drawFlexLine(child, index);
    });
  }
  
  // 更新布局
  updateLayout(property, value) {
    this.element.style[property] = value;
    this.refreshVisualizer();
  }
}
```

## 🚀 开发计划

### Week 1: 核心界面
- [ ] Day 1-2: 三栏布局实现
- [ ] Day 3-4: 元素树面板
- [ ] Day 5-7: 属性面板基础框架

### Week 2: 属性面板
- [ ] Day 1-2: Design + Position 面板
- [ ] Day 3-4: Layout + Dimensions 面板
- [ ] Day 5-7: Padding + Margin + Appearance + Text 面板

### Week 3: 布局编辑
- [ ] Day 1-3: Flexbox 可视化编辑器
- [ ] Day 4-6: Grid 可视化编辑器
- [ ] Day 7: 实时同步优化

### Week 4: 高级功能
- [ ] Day 1-2: CSS 类管理
- [ ] Day 3-4: 伪类编辑
- [ ] Day 5-6: 动画编辑器
- [ ] Day 7: 测试和优化

## 📝 下一步行动

你想从哪个部分开始？我建议：

1. **立即开始**：实现三栏布局和元素树面板
2. **第二步**：实现专业属性面板
3. **第三步**：Flexbox/Grid 可视化编辑
4. **第四步**：实时同步和交互增强

准备好开始了吗？🚀
