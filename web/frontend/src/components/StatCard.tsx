import { Card, Typography, Space } from '@douyinfe/semi-ui';
import type { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  prefix?: ReactNode;
  suffix?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  loading?: boolean;
  gradient?: boolean;
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
}

const colorMap = {
  blue: { from: '#165dff', to: '#6aa1ff', bg: 'rgba(22, 93, 255, 0.1)' },
  green: { from: '#00b578', to: '#5cdbd3', bg: 'rgba(0, 181, 120, 0.1)' },
  orange: { from: '#ff7d00', to: '#ffc53d', bg: 'rgba(255, 125, 0, 0.1)' },
  red: { from: '#f53f3f', to: '#ff7875', bg: 'rgba(245, 63, 63, 0.1)' },
  purple: { from: '#722ed1', to: '#b37feb', bg: 'rgba(114, 46, 209, 0.1)' },
};

export default function StatCard({
  title,
  value,
  prefix,
  suffix,
  trend,
  trendValue,
  loading = false,
  gradient = false,
  color = 'blue',
}: StatCardProps) {
  const colors = colorMap[color];

  const cardStyle: React.CSSProperties = gradient
    ? {
        background: `linear-gradient(135deg, ${colors.from} 0%, ${colors.to} 100%)`,
        border: 'none',
        color: '#fff',
      }
    : {
        background: colors.bg,
        border: `1px solid ${colors.from}20`,
      };

  const textColor = gradient ? '#fff' : colors.from;
  const subTextColor = gradient ? 'rgba(255,255,255,0.8)' : 'var(--semi-color-text-2)';

  return (
    <Card
      style={{
        ...cardStyle,
        borderRadius: 16,
        transition: 'all 0.3s ease',
      }}
      bodyStyle={{ padding: 24 }}
      className="card-hover"
    >
      <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
        <div>
          <Typography.Text
            style={{
              fontSize: 14,
              color: subTextColor,
              fontWeight: 500,
            }}
          >
            {title}
          </Typography.Text>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 4 }}>
            {prefix && <span style={{ color: textColor, fontSize: 20 }}>{prefix}</span>}
            <Typography.Title
              heading={3}
              style={{
                margin: 0,
                color: textColor,
                fontFamily: 'var(--semi-font-regular-number)',
              }}
            >
              {loading ? '-' : value}
            </Typography.Title>
            {suffix && <span style={{ color: textColor, fontSize: 14 }}>{suffix}</span>}
          </div>
          {trend && trendValue && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span
                style={{
                  color: trend === 'up' ? 'var(--color-up)' : trend === 'down' ? 'var(--color-down)' : subTextColor,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '−'} {trendValue}
              </span>
              <Typography.Text style={{ fontSize: 12, color: subTextColor }}>
                较昨日
              </Typography.Text>
            </div>
          )}
        </div>
        {gradient && (
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
            }}
          >
            {prefix}
          </div>
        )}
      </Space>
    </Card>
  );
}
