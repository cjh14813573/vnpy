import { ReactNode } from 'react';
import { Typography } from '@douyinfe/semi-ui';
import { useMediaQuery } from '../hooks/useMediaQuery';

const { Title } = Typography;

interface Props {
  children: ReactNode;
  title?: string;
  extra?: ReactNode;
  padding?: number;
}

/**
 * 移动端页面包装器
 *
 * 为未专门适配移动端的页面提供：
 * 1. 响应式内边距
 * 2. 标题栏（可选）
 * 3. 防止内容溢出
 * 4. 统一的页面间距
 */
export default function MobilePageWrapper({
  children,
  title,
  extra,
  padding = 16,
}: Props) {
  const { isMobile } = useMediaQuery();

  return (
    <div
      style={{
        padding: isMobile ? padding : 24,
        maxWidth: '100%',
        overflowX: 'hidden',
        minHeight: 'calc(100vh - 116px)',
      }}
    >
      {(title || extra) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          {title && (
            <Title
              heading={isMobile ? 5 : 4}
              style={{ margin: 0 }}
            >
              {title}
            </Title>
          )}
          {extra && <div>{extra}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * 响应式表格容器
 * 解决移动端表格宽度溢出问题
 */
export function MobileTableWrapper({
  children,
  minWidth = 600,
}: {
  children: ReactNode;
  minWidth?: number;
}) {
  const { isMobile } = useMediaQuery();

  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <div
      style={{
        overflowX: 'auto',
        maxWidth: '100vw',
        marginLeft: -16,
        marginRight: -16,
        paddingLeft: 16,
        paddingRight: 16,
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div style={{ minWidth }}>{children}</div>
    </div>
  );
}

/**
 * 响应式操作栏
 * 移动端按钮换行显示
 */
export function MobileActionBar({
  children,
}: {
  children: ReactNode;
}) {
  const { isMobile } = useMediaQuery();

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        marginBottom: 16,
        flexWrap: isMobile ? 'wrap' : 'nowrap',
        justifyContent: isMobile ? 'flex-start' : 'flex-end',
      }}
    >
      {children}
    </div>
  );
}
