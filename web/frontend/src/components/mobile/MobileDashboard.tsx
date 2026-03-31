import { useEffect, useState } from 'react';
import { Card, Tag, PullToRefresh } from 'antd-mobile';
import { Typography } from '@douyinfe/semi-ui';
import { systemApi } from '../../api';
import { useRealtimeStore } from '../../stores/realtimeStore';

const { Title, Text } = Typography;

export default function MobileDashboard() {
  const { ticks, orders, positions, accounts } = useRealtimeStore();
  const [systemStatus, setSystemStatus] = useState<any>(null);

  const loadData = async () => {
    try {
      const res = await systemApi.status();
      setSystemStatus(res.data);
    } catch {}
  };

  useEffect(() => {
    loadData();
  }, []);

  // 计算总资产
  const totalBalance = Object.values(accounts).reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0);
  const totalAvailable = Object.values(accounts).reduce((sum: number, acc: any) => sum + (acc.available || 0), 0);

  // 计算持仓盈亏
  const totalPnl = Object.values(positions).reduce((sum: number, pos: any) => sum + (pos.pnl || 0), 0);

  // 活跃订单数
  const activeOrderCount = Object.values(orders).filter((o: any) => o.status === '未成交').length;

  return (
    <PullToRefresh onRefresh={loadData}>
      <div style={{ padding: 12 }}>
        {/* 资产概览 */}
        <Card style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <Text type="tertiary" style={{ fontSize: 12 }}>总资产</Text>
              <Title heading={2} style={{ margin: '4px 0 0 0' }}>
                ¥{totalBalance.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </Title>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Text type="tertiary" style={{ fontSize: 12 }}>可用</Text>
              <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>
                ¥{totalAvailable.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <Tag color={totalPnl >= 0 ? 'danger' : 'success'}>
              盈亏 {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}
            </Tag>
            <Tag color="primary">
              持仓 {Object.keys(positions).length}
            </Tag>
            <Tag color="warning">
              委托 {activeOrderCount}
            </Tag>
          </div>
        </Card>

        {/* 系统状态 */}
        <Card title="系统状态" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {systemStatus?.gateways?.map((gw: any) => (
              <Tag
                key={gw.name}
                color={gw.connected ? 'success' : 'default'}
              >
                {gw.name} {gw.connected ? '已连接' : '未连接'}
              </Tag>
            ))}
          </div>
        </Card>

        {/* 行情快讯 */}
        <Card title="行情快讯">
          {Object.values(ticks).slice(0, 5).map((tick: any) => {
            const change = tick.pre_close ? tick.last_price - tick.pre_close : 0;
            const changePct = tick.pre_close ? (change / tick.pre_close) * 100 : 0;
            const isUp = change >= 0;

            return (
              <div
                key={tick.vt_symbol}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: '1px solid var(--semi-color-border)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 500 }}>{tick.vt_symbol}</div>
                  <Text type="tertiary" style={{ fontSize: 12 }}>
                    量 {tick.volume}
                  </Text>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: isUp ? 'var(--semi-color-danger)' : 'var(--semi-color-success)',
                  }}>
                    {tick.last_price?.toFixed(2)}
                  </div>
                  <Text style={{
                    fontSize: 12,
                    color: isUp ? 'var(--semi-color-danger)' : 'var(--semi-color-success)',
                  }}>
                    {isUp ? '+' : ''}{changePct.toFixed(2)}%
                  </Text>
                </div>
              </div>
            );
          })}
          {Object.values(ticks).length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--semi-color-text-2)' }}>
              暂无行情数据
            </div>
          )}
        </Card>
      </div>
    </PullToRefresh>
  );
}
