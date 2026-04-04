import { ReactNode } from 'react';
import { useMediaQuery } from '../hooks/useMediaQuery';

interface Props {
  children: ReactNode;
  className?: string;
  mobilePadding?: number;
  desktopPadding?: number;
}

/**
 * 响应式容器 - 自动适配移动端和桌面端
 *
 * 使用场景：为没有专门移动端适配的页面提供基础响应式布局
 */
export default function ResponsiveContainer({
  children,
  className = '',
  mobilePadding = 16,
  desktopPadding = 24,
}: Props) {
  const { isMobile } = useMediaQuery();

  return (
    <div
      className={`responsive-container ${className}`}
      style={{
        padding: isMobile ? mobilePadding : desktopPadding,
        maxWidth: '100%',
        overflowX: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

/**
 * 响应式网格 - 移动端单列，桌面端多列
 */
export function ResponsiveGrid({
  children,
  mobileCols = 1,
  tabletCols = 2,
  desktopCols = 4,
  gap = 16,
}: {
  children: ReactNode;
  mobileCols?: number;
  tabletCols?: number;
  desktopCols?: number;
  gap?: number;
}) {
  const { isMobile, isTablet } = useMediaQuery();

  const cols = isMobile ? mobileCols : isTablet ? tabletCols : desktopCols;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: `${gap}px`,
      }}
    >
      {children}
    </div>
  );
}

/**
 * 响应式表格容器 - 处理移动端表格溢出
 */
export function ResponsiveTable({
  children,
  minWidth = 600,
}: {
  children: ReactNode;
  minWidth?: number;
}) {
  const { isMobile } = useMediaQuery();

  return (
    <div
      style={{
        overflowX: 'auto',
        maxWidth: '100%',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div style={{ minWidth: isMobile ? minWidth : undefined }}>
        {children}
      </div>
    </div>
  );
}

/**
 * 响应式卡片网格 - 常见的卡片布局
 */
export function ResponsiveCardGrid({
  children,
}: {
  children: ReactNode;
}) {
  const { isMobile, isTablet } = useMediaQuery();

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile
          ? '1fr'
          : isTablet
          ? 'repeat(2, 1fr)'
          : 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '16px',
      }}
    >
      {children}
    </div>
  );
}
