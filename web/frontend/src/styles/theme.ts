/**
 * 主题配置 - vnpy Web 交易系统
 * 支持深色/浅色模式
 */

export type ThemeMode = 'light' | 'dark';

// 主题色板 - 金融专业风格
export const colors = {
  // 主色调 - 深蓝
  primary: {
    50: '#e6f0ff',
    100: '#b3d1ff',
    200: '#80b3ff',
    300: '#4d94ff',
    400: '#1a75ff',
    500: '#0056e6',
    600: '#0042b3',
    700: '#002e80',
    800: '#001a4d',
    900: '#000d1a',
  },
  // 功能色
  success: '#00b578',  // 涨、盈利
  warning: '#ff7d00',  // 警告
  danger: '#f53f3f',   // 跌、亏损、错误
  info: '#165dff',     // 信息
  // 中性色
  gray: {
    50: '#f7f8fa',
    100: '#f2f3f5',
    200: '#e5e6eb',
    300: '#c9cdd4',
    400: '#86909c',
    500: '#4e5969',
    600: '#272e3b',
    700: '#1d2129',
    800: '#16181a',
    900: '#000000',
  },
  // 金融专用色
  finance: {
    up: '#d93026',      // A股红涨
    down: '#238636',    // A股绿跌
    upBg: 'rgba(217, 48, 38, 0.1)',
    downBg: 'rgba(35, 134, 54, 0.1)',
    gold: '#ffc107',
    silver: '#c0c0c0',
  },
};

// 圆角
export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

// 阴影
export const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  md: '0 4px 12px rgba(0, 0, 0, 0.08)',
  lg: '0 8px 24px rgba(0, 0, 0, 0.12)',
  xl: '0 16px 48px rgba(0, 0, 0, 0.16)',
  glow: '0 0 20px rgba(0, 86, 230, 0.3)',
};

// 动画
export const transitions = {
  fast: 'all 0.15s ease',
  normal: 'all 0.25s ease',
  slow: 'all 0.4s ease',
  bounce: 'all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
};

// 生成 Semi Design 主题配置
export function getSemiTheme(mode: ThemeMode) {
  const isDark = mode === 'dark';

  return {
    mode,
    theme: isDark ? 'dark' : 'light',
    colors: {
      // 覆盖 Semi Design 默认色
      '--semi-color-primary': colors.primary[500],
      '--semi-color-primary-hover': colors.primary[400],
      '--semi-color-primary-active': colors.primary[600],
      '--semi-color-success': colors.success,
      '--semi-color-warning': colors.warning,
      '--semi-color-danger': colors.danger,
      '--semi-color-link': colors.primary[500],

      // 背景色
      '--semi-color-bg-0': isDark ? colors.gray[800] : '#ffffff',
      '--semi-color-bg-1': isDark ? colors.gray[700] : colors.gray[50],
      '--semi-color-bg-2': isDark ? colors.gray[600] : colors.gray[100],
      '--semi-color-bg-3': isDark ? colors.gray[500] : colors.gray[200],

      // 文字色
      '--semi-color-text-0': isDark ? '#ffffff' : colors.gray[900],
      '--semi-color-text-1': isDark ? colors.gray[200] : colors.gray[700],
      '--semi-color-text-2': isDark ? colors.gray[300] : colors.gray[500],
      '--semi-color-text-3': isDark ? colors.gray[400] : colors.gray[400],

      // 边框色
      '--semi-color-border': isDark ? colors.gray[600] : colors.gray[200],
      '--semi-color-shadow': isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.08)',

      // 填充色
      '--semi-color-fill-0': isDark ? colors.gray[700] : colors.gray[50],
      '--semi-color-fill-1': isDark ? colors.gray[600] : colors.gray[100],
      '--semi-color-fill-2': isDark ? colors.gray[500] : colors.gray[200],

      // 自定义变量
      '--vnpy-color-up': colors.finance.up,
      '--vnpy-color-down': colors.finance.down,
      '--vnpy-color-up-bg': colors.finance.upBg,
      '--vnpy-color-down-bg': colors.finance.downBg,
      '--vnpy-radius-sm': `${radius.sm}px`,
      '--vnpy-radius-md': `${radius.md}px`,
      '--vnpy-radius-lg': `${radius.lg}px`,
      '--vnpy-shadow-sm': shadows.sm,
      '--vnpy-shadow-md': shadows.md,
      '--vnpy-shadow-lg': shadows.lg,
    },
  };
}

// 图表配色方案
export const chartColors = [
  '#165dff', '#00b578', '#ff7d00', '#f53f3f',
  '#722ed1', '#13c2c2', '#eb2f96', '#fadb14',
];
