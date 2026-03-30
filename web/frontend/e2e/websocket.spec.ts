import { test, expect } from '@playwright/test';

test.describe('WebSocket Connection Tests', () => {
  test('should show connection state correctly', async ({ page }) => {
    // 登录
    await page.goto('/login');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // 等待跳转到首页
    await page.waitForURL('/');

    // 检查连接状态标签 - 应该是"实时连接"或"连接中"
    const statusTag = await page.locator('text=实时连接').or(page.locator('text=连接中')).first();
    await expect(statusTag).toBeVisible({ timeout: 10000 });

    // 验证不是"断开"状态
    const disconnectedTag = await page.locator('text=断开').count();
    expect(disconnectedTag).toBe(0);
  });

  test('backtest page should show real-time status', async ({ page }) => {
    // 登录
    await page.goto('/login');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // 进入回测中心
    await page.click('text=回测中心');

    // 检查回测中心的连接状态 - 显示"实时"
    const statusTag = await page.locator('.semi-tag:has-text("实时")').first();
    await expect(statusTag).toBeVisible({ timeout: 10000 });
  });
});
