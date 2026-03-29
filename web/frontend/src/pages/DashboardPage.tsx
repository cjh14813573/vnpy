import { useEffect, useState } from 'react';
import { Card, Typography, Table, Tag, Row, Col } from '@douyinfe/semi-ui';
import { tradingApi, systemApi } from '../api';

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [acc, pos, orders, logRes, statusRes] = await Promise.all([
          tradingApi.accounts(), tradingApi.positions(),
          tradingApi.activeOrders(), systemApi.logs(), systemApi.status(),
        ]);
        setAccounts(acc.data); setPositions(pos.data);
        setActiveOrders(orders.data); setLogs(logRes.data.slice(-20).reverse());
        setStatus(statusRes.data);
      } catch { /* ignore */ }
    };
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const totalPnl = positions.reduce((s, p) => s + (p.pnl || 0), 0);

  const columns = [
    { title: '合约', dataIndex: 'vt_symbol', width: 140 },
    { title: '方向', dataIndex: 'direction', width: 80, render: (v: string) => (
      <Tag color={v === '多' ? 'green' : 'red'}>{v}</Tag>
    )},
    { title: '数量', dataIndex: 'volume', width: 80, align: 'right' as const },
    { title: '冻结', dataIndex: 'frozen', width: 80, align: 'right' as const },
    { title: '均价', dataIndex: 'price', width: 100, align: 'right' as const, render: (v: number) => v?.toFixed(2) },
    { title: '盈亏', dataIndex: 'pnl', width: 120, align: 'right' as const, render: (v: number) => (
      <Typography.Text type={v >= 0 ? 'success' : 'danger'} strong>{v?.toFixed(2)}</Typography.Text>
    )},
  ];

  const logColumns = [
    { title: '时间', dataIndex: 'time', width: 90, render: (v: string) => v?.slice(11, 19) || '-' },
    { title: '级别', dataIndex: 'level', width: 80, render: (v: string) => <Tag>{v || 'INFO'}</Tag> },
    { title: '内容', dataIndex: 'msg' },
  ];

  return (
    <div>
      <Typography.Title heading={4}>总览</Typography.Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card bodyStyle={{ padding: 20 }}>
            <Typography.Text type="tertiary">账户总资金</Typography.Text>
            <Typography.Title heading={2} style={{ margin: '4px 0 0' }}>¥{totalBalance.toLocaleString()}</Typography.Title>
          </Card>
        </Col>
        <Col span={6}>
          <Card bodyStyle={{ padding: 20 }}>
            <Typography.Text type="tertiary">持仓盈亏</Typography.Text>
            <Typography.Title heading={2} style={{ margin: '4px 0 0', color: totalPnl >= 0 ? 'var(--semi-color-success)' : 'var(--semi-color-danger)' }}>
              ¥{totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Typography.Title>
          </Card>
        </Col>
        <Col span={6}>
          <Card bodyStyle={{ padding: 20 }}>
            <Typography.Text type="tertiary">活跃委托</Typography.Text>
            <Typography.Title heading={2} style={{ margin: '4px 0 0' }}>{activeOrders.length}</Typography.Title>
          </Card>
        </Col>
        <Col span={6}>
          <Card bodyStyle={{ padding: 20 }}>
            <Typography.Text type="tertiary">已连接网关</Typography.Text>
            <Typography.Title heading={2} style={{ margin: '4px 0 0' }}>{status?.gateways?.length || 0}</Typography.Title>
          </Card>
        </Col>
      </Row>

      <Typography.Title heading={5} style={{ marginBottom: 12 }}>持仓</Typography.Title>
      <Card style={{ marginBottom: 24, borderRadius: 12 }}>
        <Table columns={columns} dataSource={positions} pagination={false} size="small"
          empty="暂无持仓" />
      </Card>

      <Typography.Title heading={5} style={{ marginBottom: 12 }}>系统日志</Typography.Title>
      <Card style={{ borderRadius: 12 }}>
        <Table columns={logColumns} dataSource={logs} pagination={false} size="small"
          empty="暂无日志" />
      </Card>
    </div>
  );
}
