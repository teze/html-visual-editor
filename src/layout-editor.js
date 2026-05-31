// layout-editor.js - 布局编辑器模块
// 提供 Flexbox 和 Grid 的可视化编辑功能

/**
 * 检测元素的布局类型
 * @param {Object} elementInfo - 元素信息对象
 * @returns {string} 布局类型：'flex', 'grid', 'block', 'inline' 等
 */
export function detectLayoutType(elementInfo) {
    if (!elementInfo || !elementInfo.inlineStyle) return 'block';

    const display = elementInfo.inlineStyle.display || '';

    if (display.includes('flex')) return 'flex';
    if (display.includes('grid')) return 'grid';
    if (display.includes('inline')) return 'inline';

    return 'block';
}

/**
 * 获取 Flexbox 属性
 * @param {Object} elementInfo - 元素信息对象
 * @returns {Object} Flexbox 属性对象
 */
export function getFlexboxProperties(elementInfo) {
    if (!elementInfo || !elementInfo.inlineStyle) {
        return getDefaultFlexboxProperties();
    }

    const style = elementInfo.inlineStyle;

    return {
        display: style.display || 'flex',
        flexDirection: style.flexDirection || 'row',
        justifyContent: style.justifyContent || 'flex-start',
        alignItems: style.alignItems || 'stretch',
        flexWrap: style.flexWrap || 'nowrap',
        gap: parseGap(style.gap) || 0
    };
}

/**
 * 获取 Grid 属性
 * @param {Object} elementInfo - 元素信息对象
 * @returns {Object} Grid 属性对象
 */
export function getGridProperties(elementInfo) {
    if (!elementInfo || !elementInfo.inlineStyle) {
        return getDefaultGridProperties();
    }

    const style = elementInfo.inlineStyle;

    return {
        display: style.display || 'grid',
        gridTemplateColumns: style.gridTemplateColumns || '1fr',
        gridTemplateRows: style.gridTemplateRows || 'auto',
        gap: parseGap(style.gap) || 0,
        justifyItems: style.justifyItems || 'stretch',
        alignItems: style.alignItems || 'stretch'
    };
}

/**
 * 解析 gap 值
 * @param {string} gap - gap 字符串（如 "10px"）
 * @returns {number} 数值（去掉单位）
 */
function parseGap(gap) {
    if (!gap) return 0;
    const match = gap.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
}

/**
 * 获取默认 Flexbox 属性
 * @returns {Object} 默认属性
 */
function getDefaultFlexboxProperties() {
    return {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'stretch',
        flexWrap: 'nowrap',
        gap: 0
    };
}

/**
 * 获取默认 Grid 属性
 * @returns {Object} 默认属性
 */
function getDefaultGridProperties() {
    return {
        display: 'grid',
        gridTemplateColumns: '1fr',
        gridTemplateRows: 'auto',
        gap: 0,
        justifyItems: 'stretch',
        alignItems: 'stretch'
    };
}

/**
 * 渲染 Flexbox 编辑器 HTML
 * @param {Object} properties - Flexbox 属性
 * @returns {string} HTML 字符串
 */
export function renderFlexboxEditor(properties) {
    const props = properties || getDefaultFlexboxProperties();

    let html = '<div class="layout-editor layout-flex">';

    // Direction
    html += '<div class="control-row">';
    html += '<label class="control-label">Direction</label>';
    html += '<div class="btn-group">';
    html += renderButton('row', '→ 横向', props.flexDirection === 'row', 'flexDirection');
    html += renderButton('column', '↓ 纵向', props.flexDirection === 'column', 'flexDirection');
    html += '</div>';
    html += '</div>';

    // Justify Content
    html += '<div class="control-row">';
    html += '<label class="control-label">Justify</label>';
    html += '<div class="btn-group">';
    html += renderButton('flex-start', '⊣ 开始', props.justifyContent === 'flex-start', 'justifyContent');
    html += renderButton('center', '⊢⊣ 居中', props.justifyContent === 'center', 'justifyContent');
    html += renderButton('flex-end', '⊢ 结束', props.justifyContent === 'flex-end', 'justifyContent');
    html += renderButton('space-between', '⊣ ⊢ 间隔', props.justifyContent === 'space-between', 'justifyContent');
    html += '</div>';
    html += '</div>';

    // Align Items
    html += '<div class="control-row">';
    html += '<label class="control-label">Align</label>';
    html += '<div class="btn-group">';
    html += renderButton('flex-start', '⊤ 顶部', props.alignItems === 'flex-start', 'alignItems');
    html += renderButton('center', '⊥⊤ 居中', props.alignItems === 'center', 'alignItems');
    html += renderButton('flex-end', '⊥ 底部', props.alignItems === 'flex-end', 'alignItems');
    html += renderButton('stretch', '⇅ 拉伸', props.alignItems === 'stretch', 'alignItems');
    html += '</div>';
    html += '</div>';

    // Wrap
    html += '<div class="control-row">';
    html += '<label class="control-label">Wrap</label>';
    html += '<div class="btn-group">';
    html += renderButton('nowrap', '不换行', props.flexWrap === 'nowrap', 'flexWrap');
    html += renderButton('wrap', '换行', props.flexWrap === 'wrap', 'flexWrap');
    html += '</div>';
    html += '</div>';

    // Gap
    html += '<div class="control-row">';
    html += '<label class="control-label">Gap</label>';
    html += '<input type="number" class="control-input" id="flexGap" ';
    html += 'value="' + props.gap + '" min="0" max="100" data-prop="gap"> px';
    html += '</div>';

    html += '</div>';

    return html;
}

/**
 * 渲染 Grid 编辑器 HTML
 * @param {Object} properties - Grid 属性
 * @returns {string} HTML 字符串
 */
export function renderGridEditor(properties) {
    const props = properties || getDefaultGridProperties();

    let html = '<div class="layout-editor layout-grid">';

    // Columns
    html += '<div class="control-row">';
    html += '<label class="control-label">Columns</label>';
    html += '<input type="text" class="control-input" id="gridColumns" ';
    html += 'value="' + escapeAttr(props.gridTemplateColumns) + '" ';
    html += 'placeholder="1fr 1fr" data-prop="gridTemplateColumns">';
    html += '</div>';

    // Rows
    html += '<div class="control-row">';
    html += '<label class="control-label">Rows</label>';
    html += '<input type="text" class="control-input" id="gridRows" ';
    html += 'value="' + escapeAttr(props.gridTemplateRows) + '" ';
    html += 'placeholder="auto" data-prop="gridTemplateRows">';
    html += '</div>';

    // Gap
    html += '<div class="control-row">';
    html += '<label class="control-label">Gap</label>';
    html += '<input type="number" class="control-input" id="gridGap" ';
    html += 'value="' + props.gap + '" min="0" max="100" data-prop="gap"> px';
    html += '</div>';

    // Justify Items
    html += '<div class="control-row">';
    html += '<label class="control-label">Justify Items</label>';
    html += '<div class="btn-group">';
    html += renderButton('start', '开始', props.justifyItems === 'start', 'justifyItems');
    html += renderButton('center', '居中', props.justifyItems === 'center', 'justifyItems');
    html += renderButton('end', '结束', props.justifyItems === 'end', 'justifyItems');
    html += renderButton('stretch', '拉伸', props.justifyItems === 'stretch', 'justifyItems');
    html += '</div>';
    html += '</div>';

    // Align Items
    html += '<div class="control-row">';
    html += '<label class="control-label">Align Items</label>';
    html += '<div class="btn-group">';
    html += renderButton('start', '开始', props.alignItems === 'start', 'alignItems');
    html += renderButton('center', '居中', props.alignItems === 'center', 'alignItems');
    html += renderButton('end', '结束', props.alignItems === 'end', 'alignItems');
    html += renderButton('stretch', '拉伸', props.alignItems === 'stretch', 'alignItems');
    html += '</div>';
    html += '</div>';

    html += '</div>';

    return html;
}

/**
 * 渲染按钮
 * @param {string} value - 按钮值
 * @param {string} label - 按钮标签
 * @param {boolean} active - 是否激活
 * @param {string} prop - 属性名
 * @returns {string} HTML 字符串
 */
function renderButton(value, label, active, prop) {
    let html = '<button class="layout-btn';
    if (active) html += ' active';
    html += '" data-value="' + escapeAttr(value) + '" ';
    html += 'data-prop="' + escapeAttr(prop) + '" type="button">';
    html += label;
    html += '</button>';
    return html;
}

/**
 * 转义 HTML 属性值
 * @param {string} value - 原始值
 * @returns {string} 转义后的值
 */
function escapeAttr(value) {
    if (!value) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * 创建布局编辑器管理器
 * @param {Object} options - 配置选项
 * @returns {Object} 管理器实例
 */
export function createLayoutEditorManager(options = {}) {
    const {
        onPropertyChange = () => {}
    } = options;

    let currentLayoutType = 'block';
    let container = null;

    /**
     * 渲染编辑器
     * @param {HTMLElement} containerEl - 容器元素
     * @param {Object} elementInfo - 元素信息
     */
    function render(containerEl, elementInfo) {
        if (!containerEl) return;

        container = containerEl;
        currentLayoutType = detectLayoutType(elementInfo);

        let html = '';

        if (currentLayoutType === 'flex') {
            const props = getFlexboxProperties(elementInfo);
            html = renderFlexboxEditor(props);
        } else if (currentLayoutType === 'grid') {
            const props = getGridProperties(elementInfo);
            html = renderGridEditor(props);
        } else {
            html = '<div class="layout-editor-empty">选择 Flexbox 或 Grid 容器以编辑布局</div>';
        }

        container.innerHTML = html;

        // 绑定事件
        bindEvents();
    }

    /**
     * 绑定事件监听器
     */
    function bindEvents() {
        if (!container) return;

        // 按钮点击
        container.querySelectorAll('.layout-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const prop = this.getAttribute('data-prop');
                const value = this.getAttribute('data-value');

                if (prop && value) {
                    onPropertyChange(prop, value);
                }
            });
        });

        // 输入框变化
        container.querySelectorAll('.control-input').forEach(input => {
            input.addEventListener('input', function() {
                const prop = this.getAttribute('data-prop');
                let value = this.value;

                if (prop) {
                    // 对于数字输入，添加 px 单位
                    if (this.type === 'number' && prop === 'gap') {
                        value = value + 'px';
                    }

                    onPropertyChange(prop, value);
                }
            });
        });
    }

    /**
     * 清空编辑器
     */
    function clear() {
        if (container) {
            container.innerHTML = '';
        }
    }

    return {
        render,
        clear
    };
}
