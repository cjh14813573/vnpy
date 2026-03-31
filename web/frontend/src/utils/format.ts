/**
 * 格式化数字
 */
export function formatNumber(value: number | undefined | null, decimals = 2): string {
  if (value === undefined || value === null) return '-';
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * 格式化百分比
 */
export function formatPercent(value: number | undefined | null, decimals = 2): string {
  if (value === undefined || value === null) return '-';
  return (value * 100).toFixed(decimals) + '%';
}

/**
 * 格式化货币
 */
export function formatCurrency(value: number | undefined | null, decimals = 2): string {
  if (value === undefined || value === null) return '-';
  const sign = value >= 0 ? '' : '-';
  return sign + '¥' + Math.abs(value).toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * 格式化价格（保留指定小数位）
 */
export function formatPrice(value: number | undefined | null, decimals = 2): string {
  if (value === undefined || value === null) return '-';
  return value.toFixed(decimals);
}

/**
 * 格式化成交量（带单位）
 */
export function formatVolume(value: number | undefined | null): string {
  if (value === undefined || value === null) return '-';
  if (value >= 100000000) {
    return (value / 100000000).toFixed(2) + '亿';
  }
  if (value >= 10000) {
    return (value / 10000).toFixed(2) + '万';
  }
  return value.toString();
}

/**
 * 格式化日期时间
 */
export function formatDateTime(date: string | Date | undefined | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * 格式化日期
 */
export function formatDate(date: string | Date | undefined | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}
