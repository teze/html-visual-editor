// element-tree.js - 元素树管理模块
// 用于构建和渲染 DOM 树结构，类似 Cursor 浏览器的 Components 面板

/**
 * 从 DOM 元素构建树形数据结构
 * @param {HTMLElement} rootElement - 根元素（通常是 body）
 * @param {Array} parentPath - 父元素路径（内部使用）
 * @returns {Object} 树节点对象
 */
export function buildElementTree(rootElement, parentPath = []) {
    if (!rootElement) return null;

    const node = {
        tag: rootElement.tagName.toLowerCase(),
        id: generateNodeId(parentPath),
        path: parentPath,
        children: [],
        hasChildren: rootElement.children.length > 0,
        text: getNodeText(rootElement),
        classes: Array.from(rootElement.classList || []),
        elementId: rootElement.id || null
    };

    // 递归构建子节点
    Array.from(rootElement.children).forEach((child, index) => {
        const childPath = [...parentPath, index];
        const childNode = buildElementTree(child, childPath);
        if (childNode) {
            node.children.push(childNode);
        }
    });

    return node;
}

/**
 * 获取节点的文本内容（仅直接文本，不包括子元素）
 * @param {HTMLElement} element - DOM 元素
 * @returns {string} 文本内容
 */
function getNodeText(element) {
    if (!element) return '';

    // 对于文本节点较多的元素，只取第一个文本节点
    for (let node of element.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            if (text) {
                return text.length > 30 ? text.substring(0, 30) + '...' : text;
            }
        }
    }

    return '';
}

/**
 * 生成节点 ID
 * @param {Array} path - 元素路径
 * @returns {string} 节点 ID
 */
function generateNodeId(path) {
    return 'node-' + path.join('-');
}

/**
 * 渲染树为 HTML
 * @param {Object} treeData - 树数据
 * @param {Object} options - 渲染选项
 * @returns {string} HTML 字符串
 */
export function renderTree(treeData, options = {}) {
    const {
        selectedPath = null,
        expandedNodes = new Set(),
        level = 0
    } = options;

    if (!treeData) return '';

    const isSelected = selectedPath &&
        JSON.stringify(treeData.path) === JSON.stringify(selectedPath);
    const isExpanded = expandedNodes.has(treeData.id) || level === 0;
    const hasChildren = treeData.children.length > 0;

    let html = '<div class="tree-node" data-level="' + level + '">';

    // 节点行
    html += '<div class="tree-node-row' + (isSelected ? ' selected' : '') + '" ';
    html += 'data-node-id="' + treeData.id + '" ';
    html += 'data-path="' + JSON.stringify(treeData.path) + '" ';
    html += 'style="padding-left: ' + (level * 16) + 'px">';

    // 展开/折叠图标
    if (hasChildren) {
        html += '<span class="tree-toggle" data-node-id="' + treeData.id + '">';
        html += isExpanded ? '▼' : '▶';
        html += '</span>';
    } else {
        html += '<span class="tree-toggle-placeholder"></span>';
    }

    // 标签名
    html += '<span class="tree-tag">&lt;' + treeData.tag + '&gt;</span>';

    // ID 或类名
    if (treeData.elementId) {
        html += '<span class="tree-id">#' + treeData.elementId + '</span>';
    } else if (treeData.classes.length > 0) {
        html += '<span class="tree-class">.' + treeData.classes[0] + '</span>';
    }

    // 文本内容预览
    if (treeData.text) {
        html += '<span class="tree-text">"' + escapeHtml(treeData.text) + '"</span>';
    }

    html += '</div>';

    // 子节点
    if (hasChildren && isExpanded) {
        html += '<div class="tree-children">';
        treeData.children.forEach(child => {
            html += renderTree(child, {
                selectedPath,
                expandedNodes,
                level: level + 1
            });
        });
        html += '</div>';
    }

    html += '</div>';

    return html;
}

/**
 * 转义 HTML 特殊字符
 * @param {string} text - 原始文本
 * @returns {string} 转义后的文本
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 创建元素树管理器
 * @param {Object} options - 配置选项
 * @returns {Object} 管理器实例
 */
export function createElementTreeManager(options = {}) {
    const {
        iframe = null,
        onNodeSelect = () => {},
        onNodeExpand = () => {},
        onNodeCollapse = () => {}
    } = options;

    let treeData = null;
    let selectedPath = null;
    let expandedNodes = new Set(['node-']); // 默认展开根节点

    /**
     * 从 iframe 构建树
     */
    function buildTree() {
        if (!iframe) return null;

        try {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            if (!doc || !doc.body) return null;

            treeData = buildElementTree(doc.body, []);
            return treeData;
        } catch (e) {
            console.error('[ElementTree] 构建树失败:', e);
            return null;
        }
    }

    /**
     * 渲染树到容器
     * @param {HTMLElement} container - 容器元素
     */
    function render(container) {
        if (!container || !treeData) return;

        const html = renderTree(treeData, {
            selectedPath,
            expandedNodes
        });

        container.innerHTML = html;

        // 绑定事件
        bindEvents(container);
    }

    /**
     * 绑定事件监听器
     * @param {HTMLElement} container - 容器元素
     */
    function bindEvents(container) {
        // 点击节点行 - 选中元素
        container.querySelectorAll('.tree-node-row').forEach(row => {
            row.addEventListener('click', function(e) {
                if (e.target.classList.contains('tree-toggle')) return;

                const nodeId = this.getAttribute('data-node-id');
                const path = JSON.parse(this.getAttribute('data-path'));

                selectNode(path);
                onNodeSelect(path);
            });
        });

        // 点击展开/折叠图标
        container.querySelectorAll('.tree-toggle').forEach(toggle => {
            toggle.addEventListener('click', function(e) {
                e.stopPropagation();

                const nodeId = this.getAttribute('data-node-id');
                toggleNode(nodeId);
            });
        });
    }

    /**
     * 选中节点
     * @param {Array} path - 元素路径
     */
    function selectNode(path) {
        selectedPath = path;

        // 确保父节点都展开
        expandParents(path);
    }

    /**
     * 展开父节点
     * @param {Array} path - 元素路径
     */
    function expandParents(path) {
        for (let i = 0; i <= path.length; i++) {
            const parentPath = path.slice(0, i);
            const nodeId = generateNodeId(parentPath);
            expandedNodes.add(nodeId);
        }
    }

    /**
     * 切换节点展开/折叠
     * @param {string} nodeId - 节点 ID
     */
    function toggleNode(nodeId) {
        if (expandedNodes.has(nodeId)) {
            expandedNodes.delete(nodeId);
            onNodeCollapse(nodeId);
        } else {
            expandedNodes.add(nodeId);
            onNodeExpand(nodeId);
        }
    }

    /**
     * 展开节点
     * @param {string} nodeId - 节点 ID
     */
    function expandNode(nodeId) {
        expandedNodes.add(nodeId);
    }

    /**
     * 折叠节点
     * @param {string} nodeId - 节点 ID
     */
    function collapseNode(nodeId) {
        expandedNodes.delete(nodeId);
    }

    /**
     * 获取选中的路径
     * @returns {Array|null} 选中的路径
     */
    function getSelectedPath() {
        return selectedPath;
    }

    /**
     * 刷新树（重新构建和渲染）
     * @param {HTMLElement} container - 容器元素
     */
    function refresh(container) {
        buildTree();
        if (container) {
            render(container);
        }
    }

    return {
        buildTree,
        render,
        selectNode,
        expandNode,
        collapseNode,
        toggleNode,
        getSelectedPath,
        refresh
    };
}
