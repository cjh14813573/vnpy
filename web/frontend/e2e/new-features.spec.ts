import { test, expect } from '@playwright/test';

test.describe('New Features Tests', () => {
  // 登录辅助函数
  async function login(page: any) {
    await page.goto('/login', { timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button:has-text("登")');
    await page.waitForURL('/', { timeout: 15000 });
  }

  test('gateway management page loads', async ({ page }) => {
    await login(page);

    // 点击网关管理
    await page.click('text=网关管理');
    await page.waitForTimeout(1000);

    // 检查页面元素
    await expect(page.getByText('网关管理').first()).toBeVisible();
    await expect(page.getByText('刷新').first()).toBeVisible();
  });

  test('paper trading page loads', async ({ page }) => {
    await login(page);

    // 点击模拟交易
    await page.click('text=模拟交易');
    await page.waitForTimeout(1000);

    // 检查页面元素
    await expect(page.getByText('模拟交易').first()).toBeVisible();
    await expect(page.getByText('运行中').first()).toBeVisible();
    await expect(page.getByText('总持仓量').first()).toBeVisible();
    await expect(page.getByText('总盈亏').first()).toBeVisible();
  });

  test('strategy code viewer works', async ({ page }) => {
    await login(page);

    // 进入策略管理
    await page.click('text=策略管理');
    await page.waitForTimeout(1000);

    // 检查策略类卡片上的源码按钮
    await expect(page.getByText('源码').first()).toBeVisible();
  });

  test('kline chart component loads in market page', async ({ page }) => {
    await login(page);

    // 进入行情中心
    await page.click('text=行情中心');
    await page.waitForTimeout(1000);

    // 检查页面元素
    await expect(page.getByText('行情中心').first()).toBeVisible();
    await expect(page.getByText('已订阅行情').first()).toBeVisible();
  });

  test('backtest page has kline button', async ({ page }) => {
    await login(page);

    // 进入回测中心
    await page.click('text=回测中心');
    await page.waitForTimeout(1000);

    // 检查页面元素
    await expect(page.getByText('回测中心').first()).toBeVisible();
    await expect(page.getByText('任务列表').first()).toBeVisible();
    await expect(page.getByText('新建回测').first()).toBeVisible();
  });

  test('strategy editor page with monaco editor', async ({ page }) => {
    await login(page);

    // 进入策略编辑器
    await page.click('text=策略编辑器');
    await page.waitForTimeout(1000);

    // 检查编辑器相关元素
    await expect(page.getByText('策略编辑器').first()).toBeVisible();
  });

  test('ml page loads correctly', async ({ page }) => {
    await login(page);

    // 进入机器学习
    await page.click('text=机器学习');
    await page.waitForTimeout(1000);

    // 检查页面元素
    await expect(page.getByText('机器学习').first()).toBeVisible();
    await expect(page.getByText('训练新模型').first()).toBeVisible();
  });
});
