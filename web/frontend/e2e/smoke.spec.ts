import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login', { timeout: 60000 });
    // 等待应用加载
    await page.waitForTimeout(2000);
    // 检查是否有登录文本
    await expect(page.getByText('登录').first()).toBeVisible({ timeout: 10000 });
  });

  test('login works with valid credentials', async ({ page }) => {
    await page.goto('/login', { timeout: 60000 });
    await page.waitForTimeout(2000);

    // 使用更通用的选择器
    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button:has-text("登")');

    // 等待跳转
    await page.waitForURL('/', { timeout: 15000 });
    await expect(page).toHaveURL('/');
  });

  test('dashboard loads after login', async ({ page }) => {
    await page.goto('/login', { timeout: 60000 });
    await page.waitForTimeout(2000);

    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button:has-text("登")');

    await page.waitForURL('/', { timeout: 15000 });
    // 检查总览文本
    await expect(page.getByText('账户总资金').first()).toBeVisible({ timeout: 10000 });
  });

  test('navigation menu works', async ({ page }) => {
    await page.goto('/login', { timeout: 60000 });
    await page.waitForTimeout(2000);

    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button:has-text("登")');

    await page.waitForURL('/', { timeout: 15000 });

    // 检查导航菜单
    await expect(page.getByText('行情中心').first()).toBeVisible();
    await expect(page.getByText('交易面板').first()).toBeVisible();
    await expect(page.getByText('策略管理').first()).toBeVisible();
  });

  test('strategy editor page loads', async ({ page }) => {
    await page.goto('/login', { timeout: 60000 });
    await page.waitForTimeout(2000);

    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button:has-text("登")');

    await page.waitForURL('/', { timeout: 15000 });

    // 点击策略编辑器
    await page.click('text=策略编辑器');
    await page.waitForTimeout(1000);

    // 检查编辑器页面元素
    await expect(page.getByText('策略编辑器').first()).toBeVisible();
  });

  test('ml page loads', async ({ page }) => {
    await page.goto('/login', { timeout: 60000 });
    await page.waitForTimeout(2000);

    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button:has-text("登")');

    await page.waitForURL('/', { timeout: 15000 });

    // 点击机器学习
    await page.click('text=机器学习');
    await page.waitForTimeout(1000);

    // 检查机器学习页面元素
    await expect(page.getByText('机器学习').first()).toBeVisible();
  });
});