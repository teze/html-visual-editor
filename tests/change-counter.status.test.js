// tests/change-counter.status.test.js
// 任务 7.4：归零与状态映射单元测试
//
// 验证 src/change-counter.js：
//  - reset() 加载时归零（需求 11.1）；
//  - statusLabel 状态映射（需求 11.4 / 11.5）：
//      count==0 且无错误 → STATUS_READY（'就绪'）；
//      count>0  且无错误 → STATUS_MODIFIED（'已修改'）；
//      hasError 为真     → null；
//  - increment() 上限夹取到 MAX_CHANGE_COUNT。
// _Requirements: 11.1, 11.4, 11.5_

import {
    describe,
    it,
    expect
} from 'vitest';
import {
    ChangeCounter,
    statusLabel,
    formatCountText,
    MAX_CHANGE_COUNT,
    STATUS_READY,
    STATUS_MODIFIED,
} from '../src/change-counter.js';

describe('常量（需求 11.4 / 11.5 / 11.2）', () => {
    it('STATUS_READY 为「就绪」，STATUS_MODIFIED 为「已修改」', () => {
        expect(STATUS_READY).toBe('就绪');
        expect(STATUS_MODIFIED).toBe('已修改');
    });

    it('MAX_CHANGE_COUNT 为 999999', () => {
        expect(MAX_CHANGE_COUNT).toBe(999999);
    });
});

describe('reset() 加载归零（需求 11.1）', () => {
    it('reset() 将计数归零并返回 0', () => {
        const counter = new ChangeCounter();
        counter.increment();
        counter.increment();
        counter.increment();
        expect(counter.count).toBe(3);

        const returned = counter.reset();
        expect(returned).toBe(0);
        expect(counter.count).toBe(0);
    });

    it('reset() 同时清空内联编辑会话去重标记（同一 token 归零后可再次计入）', () => {
        const counter = new ChangeCounter();
        const sid = counter.nextSessionId();

        // 首次计入。
        expect(counter.incrementOncePerSession(sid)).toBe(true);
        expect(counter.count).toBe(1);
        // 同会话再次：不计。
        expect(counter.incrementOncePerSession(sid)).toBe(false);
        expect(counter.count).toBe(1);

        // 归零后去重标记被清空：同一 token 可再次计入。
        counter.reset();
        expect(counter.count).toBe(0);
        expect(counter.incrementOncePerSession(sid)).toBe(true);
        expect(counter.count).toBe(1);
    });

    it('reset() 后状态指示恢复为「就绪」', () => {
        const counter = new ChangeCounter();
        counter.increment();
        expect(counter.statusLabel()).toBe(STATUS_MODIFIED);

        counter.reset();
        expect(counter.statusLabel()).toBe(STATUS_READY);
    });
});

describe('statusLabel 状态映射（需求 11.4 / 11.5）— 导出纯函数', () => {
    it('count==0 且无错误 → 就绪', () => {
        expect(statusLabel(0)).toBe(STATUS_READY);
        expect(statusLabel(0, false)).toBe(STATUS_READY);
    });

    it('count>0 且无错误 → 已修改', () => {
        expect(statusLabel(1)).toBe(STATUS_MODIFIED);
        expect(statusLabel(42, false)).toBe(STATUS_MODIFIED);
        expect(statusLabel(MAX_CHANGE_COUNT)).toBe(STATUS_MODIFIED);
    });

    it('hasError 为真 → null（无论计数）', () => {
        expect(statusLabel(0, true)).toBeNull();
        expect(statusLabel(1, true)).toBeNull();
        expect(statusLabel(MAX_CHANGE_COUNT, true)).toBeNull();
    });
});

describe('statusLabel 状态映射（需求 11.4 / 11.5）— 实例方法', () => {
    it('实例方法与导出纯函数行为一致', () => {
        const counter = new ChangeCounter();

        // count==0 且无错误 → 就绪
        expect(counter.statusLabel()).toBe(STATUS_READY);
        expect(counter.statusLabel(false)).toBe(STATUS_READY);

        // count>0 且无错误 → 已修改
        counter.increment();
        expect(counter.statusLabel()).toBe(STATUS_MODIFIED);

        // hasError 为真 → null
        expect(counter.statusLabel(true)).toBeNull();
    });
});

describe('increment() 上限夹取（需求 11.2）', () => {
    it('达到 MAX_CHANGE_COUNT 后再次 increment() 保持在上限，不溢出', () => {
        const counter = new ChangeCounter();
        // 直接逼近上限（避免百万次循环）。
        counter.count = MAX_CHANGE_COUNT - 1;

        expect(counter.increment()).toBe(MAX_CHANGE_COUNT);
        // 已达上限，后续递增保持不变。
        expect(counter.increment()).toBe(MAX_CHANGE_COUNT);
        expect(counter.increment()).toBe(MAX_CHANGE_COUNT);
        expect(counter.count).toBe(MAX_CHANGE_COUNT);
    });

    it('上限处的计数文本与状态：999999 处修改 / 已修改', () => {
        const counter = new ChangeCounter();
        counter.count = MAX_CHANGE_COUNT;
        counter.increment();

        expect(counter.count).toBe(MAX_CHANGE_COUNT);
        expect(formatCountText(counter.count)).toBe('999999 处修改');
        expect(counter.statusLabel()).toBe(STATUS_MODIFIED);
    });
});