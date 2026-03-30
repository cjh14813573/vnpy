import { useEffect, useState } from 'react';
import { Typography, Card, Button, Input, Switch, Table, Toast, Descriptions, Badge, Space, Popconfirm } from '@douyinfe/semi-ui';
import { paperApi } from '../api';

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
}

export default function PaperPage() {
  const [setting, setSetting] = useState<PaperSetting>({
    instant_trade: true,
    trade_slippage: 0.0,
    timer_interval: 3,
  });
  const [positions, setPositions] = useState<PaperPosition[]>([]);
  const [loading, setLoading] = useState(false);

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
  }, []);

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
      setShowClearModal(false);
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '清空失败');
    }
  };

  const positionColumns = [
    { title: '合约', dataIndex: 'vt_symbol' },
    { title: '持仓量', dataIndex: 'volume' },
    { title: '冻结量', dataIndex: 'frozen' },
    { title: '持仓成本', dataIndex: 'price', render: (v: number) => v.toFixed(2) },
    {
      title: '盈亏',
      dataIndex: 'pnl',
      render: (v: number) => (
        <span style={{ color: v >= 0 ? '#f5222d' : '#52c41a' }}>
          {v >= 0 ? '+' : ''}{v.toFixed(2)}
        </span>
      ),
    },
  ];

  return (
    <div>
      <Typography.Title heading={4}>模拟交易</Typography.Title>

      <Card style={{ marginBottom: 16, borderRadius: 12 }}>
        <Descriptions>
          <Descriptions.Item itemKey="状态">
            <Badge color="green" dot /> 运行中
          </Descriptions.Item>
          <Descriptions.Item itemKey="即时成交">
            <Switch
              checked={setting.instant_trade}
              onChange={(v) => setSetting({ ...setting, instant_trade: v })}
            />
          </Descriptions.Item>
          <Descriptions.Item itemKey="滑点">
            <Input
              type="number"
              value={setting.trade_slippage}
              onChange={(v) => setSetting({ ...setting, trade_slippage: parseFloat(v) || 0 })}
              style={{ width: 120 }}
            />
          </Descriptions.Item>
          <Descriptions.Item itemKey="定时器间隔(秒)">
            <Input
              type="number"
              value={setting.timer_interval}
              onChange={(v) => setSetting({ ...setting, timer_interval: parseInt(v) || 3 })}
              style={{ width: 120 }}
            />
          </Descriptions.Item>
        </Descriptions>

        <Space style={{ marginTop: 16 }}>
          <Button theme="solid" loading={loading} onClick={handleUpdateSetting}>
            保存设置
          </Button>
          <Popconfirm
            title="确认清空"
            content="确定要清空所有模拟持仓吗？"
            onConfirm={handleClear}
          >
            <Button type="danger">清空持仓</Button>
          </Popconfirm>
        </Space>
      </Card>

      <Card title="模拟持仓" style={{ borderRadius: 12 }}>
        <Table
          columns={positionColumns}
          dataSource={positions}
          pagination={false}
          empty={<Typography.Text type="tertiary">暂无持仓</Typography.Text>}
        />
      </Card>
    </div>
  );
}
