import { useEffect, useState } from 'react';
import { Card, Typography, Table, Tag, Row, Col, Empty, Spin } from '@douyinfe/semi-ui';
import { IconCoinMoneyStroked, IconPieChartStroked, IconOrderedList, IconServer } from '@douyinfe/semi-icons';
import { tradingApi, systemApi } from '../api';
import { useRealtimeStore } from '../stores/realtimeStore';
import { useWebSocket } from '../services/websocket';
import StatCard from '../components/StatCard';

const { Title } = Typography;

export default function DashboardPage() {
  const { accounts, positions, orders, logs, connectionState } = useRealtimeStore();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 初始化 WebSocket 连接
  useWebSocket();

  // 初始加载 + 系统状态轮询
  useEffect(() => {
    const load = async () => {
      try {
        const [accRes, posRes, ordersRes, statusRes] = await Promise.all([
          tradingApi.accounts(),
          tradingApi.positions(),
          tradingApi.activeOrders(),
          systemApi.status(),
        ]);

        // 初始化 store 数据
        const accMap: Record<string, any> = {};
        (accRes.data.data || []).forEach((a: any) => {
          accMap[a.vt_accountid || a.accountid] = a;
        });
        useRealtimeStore.getState().setAccounts(accMap);

        const posMap: Record<string, any> = {};
        (posRes.data.data || []).forEach((p: any) => {
          posMap[p.vt_symbol] = p;
        });
        useRealtimeStore.getState().setPositions(posMap);

        const orderMap: Record<string, any> = {};
        (ordersRes.data.data || []).forEach((o: any) => {
          orderMap[o.vt_orderid] = o;
        });
        useRealtimeStore.getState().setOrders(orderMap);

        setStatus(statusRes.data);
      } catch (err) {
        console.error('加载数据失败:', err);
      } finally {
        setLoading(false);
      }
    };

    load();

    // 系统状态每 10 秒轮询一次（轻量级）
    const timer = setInterval(() => {
      systemApi.status().then(r => setStatus(r.data));
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const accountList = Object.values(accounts);
  const positionList = Object.values(positions);
  const activeOrders = Object.values(orders).filter((o: any) =>
    ['待报', '已报', '部成', '撤单中'].includes(o.status)
  );
  const logList = logs.slice(0, 20);

  const totalBalance = accountList.reduce((s, a) => s + (a.balance || 0), 0);
  const totalAvailable = accountList.reduce((s, a) => s + (a.available || 0), 0);
  const totalFrozen = accountList.reduce((s, a) => s + (a.frozen || 0), 0);
  const totalPnl = positionList.reduce((s, p) => s + (p.pnl || 0), 0);

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

  // 连接状态指示器
  const ConnectionIndicator = () => (
    <Tag
      color={connectionState === 'connected' ? 'green' : connectionState === 'connecting' ? 'orange' : 'red'}
      size="small"
      style={{ marginLeft: 8 }}
    >
      {connectionState === 'connected' ? '实时连接' : connectionState === 'connecting' ? '连接中' : '已断开'}
    </Tag>
  );

  return (
    <div>
      <Title heading={4} style={{ marginBottom: 24 }}>
        总览
        <ConnectionIndicator />
      </Title>

      {loading && accountList.length === 0 ? (
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
              dataSource={positionList}
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
              dataSource={logList}
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
