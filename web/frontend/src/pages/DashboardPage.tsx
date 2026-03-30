import { useEffect, useState } from 'react';
import { Card, Typography, Table, Tag, Row, Col, Empty, Spin } from '@douyinfe/semi-ui';
import { IconCoinMoneyStroked, IconPieChartStroked, IconOrderedList, IconServer } from '@douyinfe/semi-icons';
import { tradingApi, systemApi } from '../api';
import StatCard from '../components/StatCard';

const { Title } = Typography;

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [accRes, posRes, ordersRes, logRes, statusRes] = await Promise.all([
          tradingApi.accounts(),
          tradingApi.positions(),
          tradingApi.activeOrders(),
          systemApi.logs(),
          systemApi.status(),
        ]);

        setAccounts(accRes.data.data || []);
        setPositions(posRes.data.data || []);
        setActiveOrders(ordersRes.data.data || []);
        setLogs((logRes.data || []).slice(-20).reverse());
        setStatus(statusRes.data);
      } catch (err) {
        console.error('加载数据失败:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const totalAvailable = accounts.reduce((s, a) => s + (a.available || 0), 0);
  const totalFrozen = accounts.reduce((s, a) => s + (a.frozen || 0), 0);
  const totalPnl = positions.reduce((s, p) => s + (p.pnl || 0), 0);

  const positionColumns = [
    {
      title: '合约',
      dataIndex: 'vt_symbol',
      width: 140,
      render: (v: string) => <strong>{v}</strong>,
    },
    {
      title: '方向',
      dataIndex: 'direction',
      width: 80,
      render: (v: string) => (
        <Tag color={v === '多' ? 'red' : 'green'} size="small">{v}</Tag>
      ),
    },
    {
      title: '持仓量',
      dataIndex: 'volume',
      width: 100,
      align: 'right' as const,
      render: (v: number) => <span className="font-mono">{v}</span>,
    },
    {
      title: '冻结',
      dataIndex: 'frozen',
      width: 80,
      align: 'right' as const,
      render: (v: number) => <span className="font-mono text-secondary">{v}</span>,
    },
    {
      title: '均价',
      dataIndex: 'price',
      width: 120,
      align: 'right' as const,
      render: (v: number) => <span className="font-mono">{v?.toFixed(2)}</span>,
    },
    {
      title: '盈亏',
      dataIndex: 'pnl',
      width: 140,
      align: 'right' as const,
      render: (v: number) => (
        <span className={`font-mono font-bold ${v >= 0 ? 'text-up' : 'text-down'}`}>
          {v >= 0 ? '+' : ''}{v?.toFixed(2)}
        </span>
      ),
    },
  ];

  const logColumns = [
    {
      title: '时间',
      dataIndex: 'time',
      width: 90,
      render: (v: string) => <span className="font-mono text-secondary">{v?.slice(11, 19)}</span>,
    },
    {
      title: '级别',
      dataIndex: 'level',
      width: 80,
      render: (v: string) => {
        const colorMap: Record<string, any> = {
          INFO: 'blue',
          WARNING: 'orange',
          ERROR: 'red',
          DEBUG: 'grey',
        };
        return <Tag color={colorMap[v] || 'blue'} size="small">{v || 'INFO'}</Tag>;
      },
    },
    {
      title: '内容',
      dataIndex: 'msg',
      ellipsis: true,
    },
  ];

  return (
    <div>
      <Title heading={4} style={{ marginBottom: 24 }}>总览</Title>

      {loading && accounts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          {/* 统计卡片 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <StatCard
                title="账户总资金"
                value={`¥${totalBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                prefix={<IconCoinMoneyStroked />}
                color="blue"
                gradient
              />
            </Col>
            <Col span={6}>
              <StatCard
                title="可用资金"
                value={`¥${totalAvailable.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                prefix={<IconPieChartStroked />}
                color="green"
              />
            </Col>
            <Col span={6}>
              <StatCard
                title="冻结资金"
                value={`¥${totalFrozen.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                prefix={<IconOrderedList />}
                color="orange"
              />
            </Col>
            <Col span={6}>
              <StatCard
                title="持仓盈亏"
                value={`${totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                prefix={<IconServer />}
                color={totalPnl >= 0 ? 'green' : 'red'}
                trend={totalPnl > 0 ? 'up' : totalPnl < 0 ? 'down' : 'neutral'}
                trendValue={`${((totalPnl / (totalBalance || 1)) * 100).toFixed(2)}%`}
              />
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <StatCard
                title="活跃委托"
                value={activeOrders.length}
                color="purple"
              />
            </Col>
            <Col span={6}>
              <StatCard
                title="持仓数量"
                value={positions.length}
                color="blue"
              />
            </Col>
            <Col span={6}>
              <StatCard
                title="已连接网关"
                value={status?.gateways?.length || 0}
                color="green"
              />
            </Col>
            <Col span={6}>
              <StatCard
                title="运行策略"
                value="-"
                color="orange"
              />
            </Col>
          </Row>

          {/* 持仓列表 */}
          <Card
            title="持仓"
            style={{ marginBottom: 24, borderRadius: 12 }}
            bodyStyle={{ padding: 0 }}
          >
            <Table
              columns={positionColumns}
              dataSource={positions}
              pagination={false}
              size="small"
              empty={<Empty description="暂无持仓" />}
            />
          </Card>

          {/* 系统日志 */}
          <Card
            title="系统日志"
            style={{ borderRadius: 12 }}
            bodyStyle={{ padding: 0 }}
          >
            <Table
              columns={logColumns}
              dataSource={logs}
              pagination={false}
              size="small"
              empty={<Empty description="暂无日志" />}
            />
          </Card>
        </>
      )}
    </div>
  );
}
