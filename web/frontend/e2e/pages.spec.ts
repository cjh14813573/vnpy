import { test, expect } from '@playwright/test';

test.describe('Page Navigation Tests', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/login');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
  });

  test('dashboard page should render correctly', async ({ page }) => {
    await expect(page.getByText('账户总资金')).toBeVisible();
    await expect(page.getByText('可用资金')).toBeVisible();
  });

  test('market page should render correctly', async ({ page }) => {
    await page.click('text=行情中心');
    // 检查页面是否加载（通过 URL 或特定元素）
    await expect(page.locator('.semi-table, .semi-empty').first()).toBeVisible();
  });

  test('trading page should render correctly', async ({ page }) => {
    await page.click('text=交易面板');
    await expect(page.locator('.semi-tabs, .semi-card').first()).toBeVisible();
  });

  test('strategy page should render correctly', async ({ page }) => {
    await page.click('text=策略管理');
    await expect(page.locator('.semi-table, .semi-tabs').first()).toBeVisible();
  });

  test('backtest page should render correctly', async ({ page }) => {
    await page.click('text=回测中心');
    await expect(page.getByText('任务列表')).toBeVisible();
    await expect(page.getByText('新建回测')).toBeVisible();
  });

  test('logs page should render correctly', async ({ page }) => {
    await page.click('text=操作日志');
    await expect(page.locator('.semi-table, .semi-empty').first()).toBeVisible();
  });
});
