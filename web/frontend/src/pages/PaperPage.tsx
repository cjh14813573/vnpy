import { useEffect, useState, useMemo } from 'react';
import { Typography, Card, Button, Input, Switch, Table, Toast, Badge, Space, Popconfirm, Row, Col } from '@douyinfe/semi-ui';
import { IconRefresh, IconDelete, IconCoinMoneyStroked } from '@douyinfe/semi-icons';
import { paperApi } from '../api';
import { useRealtimeStore } from '../stores/realtimeStore';
import { useWebSocket } from '../services/websocket';

interface PaperSetting {
  instant_trade: boolean;
  trade_slippage: number;
  timer_interval: number;
}

interface PaperPosition {
  vt_symbol: string;
  volume: number;
  frozen: number;
  price: number;
  pnl: number;
  direction?: string;
  lastPrice?: number;
  realtimePnl?: number;
}

export default function PaperPage() {
  const [setting, setSetting] = useState<PaperSetting>({
    instant_trade: true,
    trade_slippage: 0.0,
    timer_interval: 3,
  });
  const [positions, setPositions] = useState<PaperPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ totalVolume: 0, totalPnl: 0, longCount: 0, shortCount: 0 });

  // 使用WebSocket获取实时行情计算动态盈亏
  const { ticks } = useRealtimeStore();
  useWebSocket();

  const loadData = async () => {
    try {
      const [settingRes, posRes] = await Promise.all([
        paperApi.setting(),
        paperApi.positions(),
      ]);
      setSetting(settingRes.data);
      setPositions(posRes.data || []);
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '加载失败');
    }
  };

  useEffect(() => {
    loadData();
    // 定时刷新
    const timer = setInterval(loadData, 5000);
    return () => clearInterval(timer);
  }, []);

  // 计算统计数据
  useEffect(() => {
    const totalVolume = positions.reduce((sum, p) => sum + p.volume, 0);
    const totalPnl = positions.reduce((sum, p) => sum + (p.pnl || 0), 0);
    const longCount = positions.filter(p => (p.direction === '多') || p.volume > 0).length;
    const shortCount = positions.filter(p => p.direction === '空').length;
    setStats({ totalVolume, totalPnl, longCount, shortCount });
  }, [positions]);

  // 计算实时盈亏（根据最新行情）
  const positionsWithRealtimePnl = useMemo(() => {
    return positions.map(pos => {
      const tick = ticks[pos.vt_symbol];
      if (tick && tick.last_price) {
        // 简化计算：使用最新价 vs 持仓成本
        const priceDiff = tick.last_price - pos.price;
        const direction = pos.direction === '空' ? -1 : 1;
        const realtimePnl = priceDiff * pos.volume * direction;
        return { ...pos, realtimePnl, lastPrice: tick.last_price };
      }
      return { ...pos, realtimePnl: pos.pnl };
    });
  }, [positions, ticks]);

  const handleUpdateSetting = async () => {
    setLoading(true);
    try {
      await paperApi.updateSetting(setting);
      Toast.success('设置已更新');
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '更新失败');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    try {
      await paperApi.clear();
      Toast.success('持仓已清空');
      loadData();
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '清空失败');
    }
  };

  const positionColumns = [
    {
      title: '合约',
      dataIndex: 'vt_symbol',
      width: 160,
      render: (v: string, record: PaperPosition) => (
        <div>
          <strong>{v}</strong>
          {record.lastPrice && (
            <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>
              最新: {record.lastPrice.toFixed(2)}
            </div>
          )}
        </div>
      ),
    },
    {
      title: '方向',
      dataIndex: 'direction',
      width: 80,
      render: (v: string, record: PaperPosition) => (
        <Badge
          type={record.volume > 0 ? v === '空' ? 'danger' : 'success' : 'tertiary'}
          theme={v === '空' ? 'light' : 'solid'}
        >
          {v || (record.volume > 0 ? '多' : '-')}
        </Badge>
      ),
    },
    { title: '持仓量', dataIndex: 'volume', width: 100, align: 'right' as const },
    { title: '冻结量', dataIndex: 'frozen', width: 100, align: 'right' as const },
    {
      title: '持仓成本',
      dataIndex: 'price',
      width: 120,
      align: 'right' as const,
      render: (v: number) => v.toFixed(2),
    },
    {
      title: '浮动盈亏',
      dataIndex: 'realtimePnl',
      width: 140,
      align: 'right' as const,
      render: (v: number, record: any) => {
        const pnl = v ?? record.pnl ?? 0;
        return (
          <span style={{ color: pnl >= 0 ? '#f5222d' : '#52c41a', fontWeight: 600 }}>
            {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
          </span>
        );
      },
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Typography.Title heading={4} style={{ margin: 0 }}>
          模拟交易
          <Badge type="success" style={{ marginLeft: 12 }}>运行中</Badge>
        </Typography.Title>
        <Button icon={<IconRefresh />} onClick={loadData}>刷新</Button>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col span={6}>
          <Card style={{ borderRadius: 12, background: 'var(--semi-color-primary-light-default)' }}>
            <Typography.Text type="tertiary" style={{ display: 'block', marginBottom: 8 }}>总持仓量</Typography.Text>
            <div style={{ fontSize: 28, fontWeight: 600 }}>{stats.totalVolume} <span style={{ fontSize: 14, fontWeight: 400 }}>手</span></div>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{
            borderRadius: 12,
            background: stats.totalPnl >= 0 ? 'rgba(245, 34, 45, 0.1)' : 'rgba(82, 196, 26, 0.1)'
          }}>
            <Typography.Text type="tertiary" style={{ display: 'block', marginBottom: 8 }}>总盈亏</Typography.Text>
            <div style={{ fontSize: 28, fontWeight: 600, color: stats.totalPnl >= 0 ? '#f5222d' : '#52c41a' }}>
              {stats.totalPnl >= 0 ? '+' : ''}{stats.totalPnl.toFixed(2)}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: 12, background: 'rgba(0, 180, 100, 0.1)' }}>
            <Typography.Text type="tertiary" style={{ display: 'block', marginBottom: 8 }}>多头持仓</Typography.Text>
            <div style={{ fontSize: 28, fontWeight: 600 }}>{stats.longCount} <span style={{ fontSize: 14, fontWeight: 400 }}>个</span></div>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: 12, background: 'rgba(255, 100, 100, 0.1)' }}>
            <Typography.Text type="tertiary" style={{ display: 'block', marginBottom: 8 }}>空头持仓</Typography.Text>
            <div style={{ fontSize: 28, fontWeight: 600 }}>{stats.shortCount} <span style={{ fontSize: 14, fontWeight: 400 }}>个</span></div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card title="模拟设置" style={{ borderRadius: 12 }}>
            <Space vertical style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>即时成交</span>
                <Switch
                  checked={setting.instant_trade}
                  onChange={(v) => setSetting({ ...setting, instant_trade: v })}
                />
              </div>
              <div>
                <div style={{ marginBottom: 8 }}>滑点（跳）</div>
                <Input
                  type="number"
                  value={setting.trade_slippage}
                  onChange={(v) => setSetting({ ...setting, trade_slippage: parseFloat(v) || 0 })}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <div style={{ marginBottom: 8 }}>定时器间隔（秒）</div>
                <Input
                  type="number"
                  value={setting.timer_interval}
                  onChange={(v) => setSetting({ ...setting, timer_interval: parseInt(v) || 3 })}
                  style={{ width: '100%' }}
                />
              </div>
              <Space style={{ marginTop: 16 }}>
                <Button theme="solid" loading={loading} onClick={handleUpdateSetting} icon={<IconCoinMoneyStroked />}>
                  保存设置
                </Button>
                <Popconfirm
                  title="确认清空"
                  content="确定要清空所有模拟持仓吗？此操作不可恢复。"
                  onConfirm={handleClear}
                >
                  <Button type="danger" icon={<IconDelete />}>清空持仓</Button>
                </Popconfirm>
              </Space>
            </Space>
          </Card>
        </Col>

        <Col span={16}>
          <Card title="模拟持仓" style={{ borderRadius: 12 }}>
            <Table
              columns={positionColumns}
              dataSource={positionsWithRealtimePnl}
              pagination={false}
              empty={<Typography.Text type="tertiary">暂无持仓</Typography.Text>}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
