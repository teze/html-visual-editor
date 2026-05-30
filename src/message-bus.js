// message-bus.js — 消息总线（MessageBus，任务 11.3）
//
// 职责（参见 design.md「7. MessageBus」与需求 2.4 / 3.5 / 4.4 / 5.10 / 8.3）：
//   - 上行 onMessage(event)：集中接收来自 iframe 的 postMessage，校验
//     event.data.type 后，把 ready / selected / editing / textInput / changed /
//     deleted 分发给对应处理回调；未知 / 非法类型静默忽略（需求 2.4 健壮性）。
//   - 下行 send(message)：经 iframe.contentWindow.postMessage(msg, '*') 向注入
//     脚本下发 update / delete 指令。
//   - attach() / detach()：在宿主 window 上注册 / 注销 'message' 事件监听器
//     （监听器内部调用 onMessage），便于运行期接线与测试期确定性控制。
//
// 设计取舍（保持解耦 + 可在 jsdom 下独立测试）：
//   - MessageBus 不直接耦合 property-panel / status-bar / change-counter /
//     preview-frame，而是通过一个「handlers（处理回调）对象」接收注入的依赖。
//     这样消息「收发 + 分发」逻辑可独立于其它 src/ 模块测试；具体的「分发去向」
//     由任务 12.1 在组装阶段接线（见文末「任务 12.1 推荐接线」）。
//   - 分发去向（dispatch mapping）固定为「每种上行消息 → 一个 handler」：
//       ready    → onReady()           通知 preview-frame 就绪（进入可编辑态）
//       selected → onSelected(info)    回填属性面板 + 置 has-selection=true
//       editing  → onEditing()         开启一次内联编辑会话（计数去重起点）
//       textInput→ onTextInput(text)   实时文字同步（每会话仅计一次，见需求 4.4）
//       changed  → onChanged()         一次成功属性更新 → Change_Count +1（需求 5.10）
//       deleted  → onDeleted()         清空面板 + 置 has-selection=false + 计数（需求 8.3）
//   - 「计数策略」（每会话仅计一次 / 何时 +1）不属于 MessageBus，而是由 handler
//     如何接到 change-counter 决定（见文末接线说明）。MessageBus 只「忠实转发」
//     每条上行消息到其 handler，保持单一职责。
//
// 导出 API：
//   - UP_MESSAGE_TYPES：受支持的上行消息类型常量集合。
//   - isValidUpMessage(event)：纯函数，判定一个 message 事件是否携带合法的
//     event.data.type（受支持的上行类型）。
//   - dispatchUpMessage(message, handlers)：纯函数，按类型把单条上行消息分发到
//     handlers 对应回调；未知 / 非法类型为 no-op。返回被分发到的类型或 null。
//   - createMessageBus(options)：有状态控制器（onMessage / send / attach / detach
//     / setIframe / setHandlers / getIframe）。

import {
    INJECTED_SCRIPT_ID
} from './inject.js';

// 受支持的上行消息类型（Injected_Script → Editor）。
// 与 design.md「Data Models · 上行消息」一致。
export const UP_MESSAGE_TYPES = Object.freeze([
    'ready', // 注入脚本就绪
    'selected', // 选中某元素，携带 info
    'editing', // 进入 contentEditable（编辑会话开始）
    'textInput', // 内联文字变更，携带 text
    'changed', // 一次成功的样式 / 属性更新
    'deleted', // 元素已删除
]);

// 上行类型 → handlers 回调名 的映射。dispatchUpMessage 据此查找回调。
const TYPE_TO_HANDLER = Object.freeze({
    ready: 'onReady',
    selected: 'onSelected',
    editing: 'onEditing',
    textInput: 'onTextInput',
    changed: 'onChanged',
    deleted: 'onDeleted',
});

// ----------------------------------------------------------------------------
// isValidUpMessage — 纯函数：判定 message 事件是否携带合法的上行类型
//
// 校验链（需求 2.4：收发两侧先校验 event.data 与 event.data.type 再处理）：
//   1. event 存在；
//   2. event.data 存在；
//   3. typeof event.data.type === 'string'；
//   4. 该 type 属于 UP_MESSAGE_TYPES。
// 任一不满足返回 false —— 调用方应静默忽略（不报错、不副作用）。
// ----------------------------------------------------------------------------
export function isValidUpMessage(event) {
    if (!event || typeof event !== 'object') {
        return false;
    }
    const data = event.data;
    if (!data || typeof data !== 'object') {
        return false;
    }
    if (typeof data.type !== 'string') {
        return false;
    }
    return UP_MESSAGE_TYPES.indexOf(data.type) >= 0;
}

// ----------------------------------------------------------------------------
// dispatchUpMessage — 纯函数：把单条上行消息分发到 handlers 对应回调
//
// message：形如 { type, info?, text? } 的上行消息体（即 event.data）。
// handlers：{ onReady, onSelected, onEditing, onTextInput, onChanged, onDeleted }。
//
// 按类型调用对应回调，并传递该类型约定的载荷：
//   selected  → onSelected(message.info)
//   textInput → onTextInput(message.text)
//   其余       → 无参调用
// 未知 / 非法类型，或对应回调缺失 / 非函数时，均为安全 no-op。
//
// 返回：实际被分发到的类型字符串；若未分发（非法类型 / 无对应回调）返回 null。
// 便于测试断言「某条消息是否被分发」。
// ----------------------------------------------------------------------------
export function dispatchUpMessage(message, handlers) {
    if (!message || typeof message.type !== 'string') {
        return null;
    }
    const type = message.type;
    const handlerName = TYPE_TO_HANDLER[type];
    if (!handlerName) {
        return null; // 未知类型：静默忽略（需求 2.4）
    }
    const fn = handlers && handlers[handlerName];
    if (typeof fn !== 'function') {
        return null; // 未接线的处理器：安全 no-op
    }
    switch (type) {
        case 'selected':
            fn(message.info);
            break;
        case 'textInput':
            fn(message.text);
            break;
        default:
            fn();
            break;
    }
    return type;
}

// 解析宿主 window：显式注入 > 全局 window > null（非浏览器/无 window 环境）。
function resolveWindow(injected) {
    if (injected) {
        return injected;
    }
    if (typeof window !== 'undefined') {
        return window;
    }
    return null;
}

// ----------------------------------------------------------------------------
// createMessageBus — 有状态消息总线控制器
//
// options:
//   iframe          目标 <iframe> 元素（send 经其 contentWindow.postMessage 下发）。
//                   可后续用 setIframe 注入 / 替换（如 iframe 在加载后才可用）。
//   handlers        上行消息处理回调对象，键为：
//                     onReady()             — ready：通知预览就绪（preview-frame.notifyReady）
//                     onSelected(info)      — selected：回填属性面板 + 置 has-selection=true
//                     onEditing()           — editing：开启内联编辑会话（计数去重起点）
//                     onTextInput(text)     — textInput：实时文字同步
//                     onChanged()           — changed：Change_Count +1（需求 5.10）
//                     onDeleted()           — deleted：清空面板 + has-selection=false + 计数（需求 8.3）
//                   缺省 / 缺项回调按 no-op 处理；可后续用 setHandlers 合并更新。
//   windowRef       可选，注册 'message' 监听的目标 window（缺省取全局 window）。
//                   测试可注入一个带 add/removeEventListener 的桩对象做确定性控制。
//
// 返回控制器：
//   onMessage(event)        校验后把 event.data 分发到对应 handler；非法 / 未知静默忽略。
//   send(message)           经 iframe.contentWindow.postMessage(message, '*') 下发。
//                           iframe / contentWindow / postMessage 任一缺失时安全 no-op 并返回 false。
//   attach()                在 windowRef 上注册 'message' 监听（调用 onMessage）；幂等。
//   detach()                注销该监听；幂等。
//   setIframe(iframe)       注入 / 替换下行目标 iframe。
//   setHandlers(partial)    合并更新处理回调（浅合并）。
//   getIframe()             读取当前 iframe（主要供测试断言）。
// ----------------------------------------------------------------------------
export function createMessageBus(options = {}) {
    let iframe = options.iframe || null;
    let handlers = Object.assign({}, options.handlers);
    const win = resolveWindow(options.windowRef);

    let listener = null; // 当前绑定到 window 'message' 的监听器
    let attached = false; // 是否已注册监听（保证 attach/detach 幂等）

    // 上行：校验后分发；非法 / 未知类型静默忽略（需求 2.4）。
    function onMessage(event) {
        if (!isValidUpMessage(event)) {
            return null;
        }
        return dispatchUpMessage(event.data, handlers);
    }

    // 下行：经 iframe.contentWindow.postMessage 下发 update / delete 指令。
    // 守卫各环节，缺失时安全 no-op（便于在无真实 iframe 的测试中调用）。
    function send(message) {
        if (!iframe) {
            return false;
        }
        const cw = iframe.contentWindow;
        if (!cw || typeof cw.postMessage !== 'function') {
            return false;
        }
        cw.postMessage(message, '*');
        return true;
    }

    function attach() {
        if (attached || !win || typeof win.addEventListener !== 'function') {
            return false;
        }
        listener = function messageBusListener(event) {
            onMessage(event);
        };
        win.addEventListener('message', listener);
        attached = true;
        return true;
    }

    function detach() {
        if (!attached || !win || typeof win.removeEventListener !== 'function') {
            return false;
        }
        win.removeEventListener('message', listener);
        listener = null;
        attached = false;
        return true;
    }

    function setIframe(nextIframe) {
        iframe = nextIframe || null;
        return iframe;
    }

    function setHandlers(partial) {
        handlers = Object.assign({}, handlers, partial);
        return handlers;
    }

    function getIframe() {
        return iframe;
    }

    return {
        onMessage,
        send,
        attach,
        detach,
        setIframe,
        setHandlers,
        getIframe,
    };
}

// ============================================================================
// 任务 12.1 推荐接线（Recommended wiring for assembly）
// ============================================================================
//
// 在 html-editor.html 组装时，按下表把 handlers 接到各模块，即可满足
// 需求 3.5 / 4.4 / 5.10 / 8.3。INJECTED_SCRIPT_ID 在此一并导出复用（below），
// 供组装层在需要时引用注入脚本 id（如调试 / 校验）。
//
//   const bus = createMessageBus({
//     iframe,
//     handlers: {
//       // ready：通知预览框架就绪，进入可编辑态（需求 2.3）
//       onReady: () => previewFrame.notifyReady(),
//
//       // selected：回填属性面板 + 标记存在选中元素（需求 3.5）
//       onSelected: (info) => {
//         propertyPanel.fillForm(info);
//         propertyPanel.setHasSelection(true);
//       },
//
//       // editing：进入 contentEditable，开启一次编辑会话（计数去重起点，需求 4.4）
//       //   currentSession = changeCounter.beginEditSession(changeCounter.nextSessionId())
//       onEditing: () => { currentSession = changeCounter.beginEditSession(changeCounter.nextSessionId()); },
//
//       // textInput：实时文字同步；同一会话内多次 input 仅计 1（需求 4.4）
//       //   propertyPanel 可据 text 实时回填文字框；计数交给 markEditSessionChanged。
//       onTextInput: (text) => {
//         propertyPanel.syncText?.(text);
//         changeCounter.markEditSessionChanged(currentSession);
//         statusBar.render(changeCounter); // "N 处修改" + 就绪/已修改
//       },
//
//       // changed：一次成功的样式 / 属性更新 → Change_Count +1（需求 5.10）
//       onChanged: () => {
//         changeCounter.increment();
//         statusBar.render(changeCounter);
//       },
//
//       // deleted：清空属性面板 + 取消选中 + 计数（需求 8.3）
//       onDeleted: () => {
//         propertyPanel.clearForm();
//         propertyPanel.setHasSelection(false);
//         changeCounter.increment();
//         statusBar.render(changeCounter);
//       },
//     },
//   });
//   bus.attach();                       // 注册 window 'message' 监听
//   propertyPanel.setSender(bus.send);  // 属性面板下行 update/delete 经 bus.send
//
// 说明：
//   - 「每会话仅计一次」（需求 4.4）由 change-counter 的 beginEditSession +
//     markEditSessionChanged 语义保证：onEditing 开启新会话 token，onTextInput
//     在该会话内多次调用 markEditSessionChanged 仅首次 +1。
//   - 属性变更（需求 5.10）由注入脚本在成功 update 后回发 'changed' 驱动计数，
//     apply* 本身不直接计数（见 property-panel.js 说明）。
//   - 删除（需求 8.3）：注入脚本移除子树后回发 'deleted'，onDeleted 负责清空面板、
//     取消选中并计数。
//
// 注入脚本 id 常量再导出，便于组装层引用（无需重复从 inject.js 导入）。
export {
    INJECTED_SCRIPT_ID
};