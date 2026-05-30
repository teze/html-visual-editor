import {
    defineConfig
} from 'vitest/config';

export default defineConfig({
    test: {
        // jsdom 提供 DOM / iframe 行为模拟，供注入脚本与属性面板等模块测试使用
        environment: 'jsdom',
        include: ['src/**/*.{test,spec}.{js,mjs}', 'tests/**/*.{test,spec}.{js,mjs}'],
    },
});