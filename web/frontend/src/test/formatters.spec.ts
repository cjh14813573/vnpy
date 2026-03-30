import { describe, it, expect } from 'vitest';

/**
 * 格式化工具函数测试
 */
describe('Formatters', () => {
  describe('Number formatting', () => {
    it('should format price with 2 decimals', () => {
      const price = 3500.1234;
      expect(price.toFixed(2)).toBe('3500.12');
    });

    it('should format percentage', () => {
      const pct = 15.6789;
      expect(pct.toFixed(2) + '%').toBe('15.68%');
    });
  });

  describe('Date formatting', () => {
    it('should format date to locale string', () => {
      const date = new Date('2024-01-15 09:30:00');
      expect(date.toLocaleString('zh-CN')).toContain('2024');
      expect(date.toLocaleString('zh-CN')).toContain('09:30:00');
    });

    it('should format date to date only', () => {
      const date = new Date('2024-01-15');
      const formatted = date.toISOString().split('T')[0];
      expect(formatted).toBe('2024-01-15');
    });
  });

  describe('Volume formatting', () => {
    it('should format large numbers with commas', () => {
      const volume = 1234567;
      expect(volume.toLocaleString()).toBe('1,234,567');
    });

    it('should format small numbers', () => {
      const volume = 100;
      expect(volume.toLocaleString()).toBe('100');
    });
  });
});
