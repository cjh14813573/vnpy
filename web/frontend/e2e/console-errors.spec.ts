import { test, expect } from '@playwright/test';

test.describe('Console Error Tests', () => {
  test.beforeEach(async ({ page }) => {
    // 收集所有 console 错误
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    (page as any).errors = errors;
  });

  test('login page should have no console errors', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const errors = (page as any).errors as string[];
    expect(errors).toHaveLength(0);
  });

  test('dashboard page should have no console errors after login', async ({ page }) => {
    // 先登录
    await page.goto('/login');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // 等待跳转到首页
    await page.waitForURL('/');
    await page.waitForLoadState('networkidle');

    const errors = (page as any).errors as string[];
    expect(errors).toHaveLength(0);
  });

  test('backtest page should have no duplicate key errors', async ({ page }) => {
    // 登录
    await page.goto('/login');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // 进入回测中心
    await page.click('text=回测中心');
    await page.waitForLoadState('networkidle');

    // 等待几秒让可能的错误出现
    await page.waitForTimeout(2000);

    const errors = (page as any).errors as string[];

    // 过滤出 key 重复错误
    const keyErrors = errors.filter(e =>
      e.includes('same key') || e.includes('task_id')
    );

    expect(keyErrors).toHaveLength(0);
  });
});
