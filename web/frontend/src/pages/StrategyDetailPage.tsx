import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Tabs, TabPane, Table, Tag, Button, Card, Space } from '@douyinfe/semi-ui';
import { IconArrowLeft } from '@douyinfe/semi-icons';
import { strategyApi, tradingApi } from '../api';

export default function StrategyDetailPage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [instance, setInstance] = useState<any>(null);
  const [variables, setVariables] = useState<Record<string, any>>({});
  const [logs, setLogs] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [code, setCode] = useState('');
  const strategyName = name || '';

  useEffect(() => {
    if (!strategyName) return;
    const load = async () => {
      try {
        const [inst, vars, logRes, tradeRes] = await Promise.all([
          strategyApi.instance(strategyName), strategyApi.variables(strategyName),
          strategyApi.logs(strategyName), strategyApi.trades(strategyName),
        ]);
        setInstance(inst.data); setVariables(vars.data);
        setLogs(logRes.data); setTrades(tradeRes.data);
      } catch { /* ignore */ }
      try {
        const codeRes = await strategyApi.classCode(instance?.class_name || '');
        setCode(codeRes.data.code);
      } catch { setCode(''); }
    };
    load();
  }, [strategyName]);

  if (!instance) return <Typography style={{ padding: 20 }}>加载中...</Typography>;

  const statusColor = instance.trading ? 'green' : instance.inited ? 'blue' : 'grey';
  const statusText = instance.trading ? '运行中' : instance.inited ? '已初始化' : '未初始化';

  const twoColStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
        <Button icon={<IconArrowLeft />} theme="borderless" onClick={() => navigate('/strategy')} style={{ marginRight: 12 }} />
        <Typography.Title heading={4} style={{ margin: 0 }}>{instance.strategy_name}</Typography.Title>
        <Tag color={statusColor} style={{ marginLeft: 12 }}>{statusText}</Tag>
        <Typography.Text type="tertiary" style={{ marginLeft: 12 }}>{instance.class_name} · {instance.vt_symbol}</Typography.Text>
      </div>

      <Space style={{ marginBottom: 20 }}>
        {!instance.inited && <Button theme="solid" onClick={() => strategyApi.init(strategyName).then(() => window.location.reload())}>初始化</Button>}
        {instance.inited && !instance.trading && <Button theme="solid" type="primary" onClick={() => strategyApi.start(strategyName).then(() => window.location.reload())}>启动</Button>}
        {instance.trading && <Button theme="solid" type="danger" onClick={() => strategyApi.stop(strategyName).then(() => window.location.reload())}>停止</Button>}
      </Space>

      <Card style={{ borderRadius: 12 }}>
        <Tabs activeKey={tab} onChange={setTab} type="line">
          <TabPane tab="概览" itemKey="overview">
            <div style={twoColStyle}>
              <div><Typography.Text type="tertiary">策略名称</Typography.Text><br /><Typography.Text strong>{instance.strategy_name}</Typography.Text></div>
              <div><Typography.Text type="tertiary">策略类</Typography.Text><br /><Typography.Text strong>{instance.class_name}</Typography.Text></div>
              <div><Typography.Text type="tertiary">合约</Typography.Text><br /><Typography.Text strong>{instance.vt_symbol}</Typography.Text></div>
              <div><Typography.Text type="tertiary">作者</Typography.Text><br /><Typography.Text strong>{instance.author || '-'}</Typography.Text></div>
            </div>
          </TabPane>
          <TabPane tab="参数" itemKey="params">
            <Table columns={[{ title: '参数名', dataIndex: 'key' }, { title: '值', dataIndex: 'value' }]}
              dataSource={Object.entries(instance.parameters || {}).map(([k, v]) => ({ key: k, value: String(v) }))} pagination={false} size="small" />
          </TabPane>
          <TabPane tab="变量" itemKey="vars">
            {Object.keys(variables).length === 0 ? (
              <Typography.Text type="tertiary">策略未运行，暂无变量</Typography.Text>
            ) : (
              <Table columns={[{ title: '变量名', dataIndex: 'key' }, { title: '值', dataIndex: 'value' }]}
                dataSource={Object.entries(variables).map(([k, v]) => ({ key: k, value: String(v) }))} pagination={false} size="small" />
            )}
          </TabPane>
          <TabPane tab="日志" itemKey="logs">
            <Table columns={[
              { title: '时间', dataIndex: 'time', width: 90, render: (v: string) => v?.slice(11, 19) || '-' },
              { title: '级别', dataIndex: 'level', width: 80, render: (v: string) => <Tag>{v || 'INFO'}</Tag> },
              { title: '内容', dataIndex: 'msg' },
            ]} dataSource={logs.slice(-50).reverse()} pagination={false} size="small" empty="暂无日志" />
          </TabPane>
          <TabPane tab="交易" itemKey="trades">
            <Table columns={[
              { title: '时间', dataIndex: 'datetime', width: 90, render: (v: string) => v?.slice(11, 19) },
              { title: '合约', dataIndex: 'vt_symbol' },
              { title: '方向', dataIndex: 'direction', width: 70, render: (v: string) => <Tag color={v === '多' ? 'green' : 'red'}>{v}</Tag> },
              { title: '价格', dataIndex: 'price', align: 'right' as const, width: 80 },
              { title: '数量', dataIndex: 'volume', align: 'right' as const, width: 60 },
            ]} dataSource={trades} pagination={false} size="small" empty="暂无成交" />
          </TabPane>
          <TabPane tab="持仓" itemKey="pos">
            <PositionTable vtSymbol={instance.vt_symbol} />
          </TabPane>
          <TabPane tab="代码" itemKey="code">
            <pre style={{ background: '#1a1a2e', color: '#e0e0e0', padding: 16, borderRadius: 12, fontSize: '0.85rem', maxHeight: 500, overflow: 'auto' }}>
              {code || '无法加载源码'}
            </pre>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
}

function PositionTable({ vtSymbol }: { vtSymbol: string }) {
  const [positions, setPositions] = useState<any[]>([]);
  useEffect(() => {
    tradingApi.positions().then((r) => setPositions((r.data || []).filter((p: any) => p.vt_symbol === vtSymbol))).catch(() => {});
  }, [vtSymbol]);
  if (positions.length === 0) return <Typography.Text type="tertiary">该合约暂无持仓</Typography.Text>;
  return (
    <Table columns={[
      { title: '方向', dataIndex: 'direction', render: (v: string) => <Tag color={v === '多' ? 'green' : 'red'}>{v}</Tag> },
      { title: '数量', dataIndex: 'volume', align: 'right' as const },
      { title: '均价', dataIndex: 'price', align: 'right' as const, render: (v: number) => v?.toFixed(2) },
      { title: '盈亏', dataIndex: 'pnl', align: 'right' as const, render: (v: number) => (
        <Typography.Text type={v >= 0 ? 'success' : 'danger'} strong>{v?.toFixed(2)}</Typography.Text>
      )},
    ]} dataSource={positions} pagination={false} size="small" />
  );
}
