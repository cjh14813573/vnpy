import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Tabs, TabPane, Table, Tag, Button, Card, Space, Toast, Switch } from '@douyinfe/semi-ui';
import { IconArrowLeft, IconRefresh, IconExport } from '@douyinfe/semi-icons';
import { strategyApi, tradingApi } from '../api';

interface VariableChange {
  key: string;
  oldValue: any;
  newValue: any;
  timestamp: number;
}

export default function StrategyDetailPage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [instance, setInstance] = useState<any>(null);
  const [variables, setVariables] = useState<Record<string, any>>({});
  const [variableChanges, setVariableChanges] = useState<Record<string, VariableChange>>({});
  const [logs, setLogs] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [code, setCode] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const strategyName = name || '';

  // 加载策略实例信息
  const loadInstance = useCallback(async () => {
    if (!strategyName) return;
    try {
      const res = await strategyApi.instance(strategyName);
      setInstance(res.data);
    } catch { /* ignore */ }
  }, [strategyName]);

  // 加载变量（带变化检测）
  const loadVariables = useCallback(async () => {
    if (!strategyName) return;
    try {
      const res = await strategyApi.variables(strategyName);
      const newVariables = res.data || {};

      // 检测变量变化
      setVariableChanges(prev => {
        const changes: Record<string, VariableChange> = { ...prev };
        Object.entries(newVariables).forEach(([key, newValue]) => {
          const oldValue = variables[key];
          if (oldValue !== undefined && oldValue !== newValue) {
            changes[key] = {
              key,
              oldValue,
              newValue,
              timestamp: Date.now(),
            };
          }
        });
        return changes;
      });

      setVariables(newVariables);
    } catch { /* ignore */ }
  }, [strategyName, variables]);

  // 加载日志
  const loadLogs = useCallback(async () => {
    if (!strategyName) return;
    try {
      const res = await strategyApi.logs(strategyName);
      setLogs(res.data || []);
    } catch { /* ignore */ }
  }, [strategyName]);

  // 加载成交
  const loadTrades = useCallback(async () => {
    if (!strategyName) return;
    try {
      const res = await strategyApi.trades(strategyName);
      setTrades(res.data || []);
    } catch { /* ignore */ }
  }, [strategyName]);

  // 加载代码
  const loadCode = useCallback(async () => {
    if (!strategyName || !instance?.class_name) return;
    try {
      const res = await strategyApi.classCode(instance.class_name);
      setCode(res.data.code);
    } catch { setCode(''); }
  }, [strategyName, instance?.class_name]);

  // 初始加载
  useEffect(() => {
    loadInstance();
    loadVariables();
    loadLogs();
    loadTrades();
  }, [loadInstance, loadVariables, loadLogs, loadTrades]);

  // 加载代码
  useEffect(() => {
    loadCode();
  }, [loadCode]);

  // 自动刷新变量（当策略运行时）
  useEffect(() => {
    if (!autoRefresh || !instance?.trading) return;

    const timer = setInterval(() => {
      loadVariables();
    }, 2000);

    return () => clearInterval(timer);
  }, [autoRefresh, instance?.trading, loadVariables]);

  // 清除变化高亮（3秒后）
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setVariableChanges(prev => {
        const updated: Record<string, VariableChange> = {};
        Object.entries(prev).forEach(([key, change]) => {
          if (now - change.timestamp < 3000) {
            updated[key] = change;
          }
        });
        return updated;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 导出变量
  const exportVariables = () => {
    const data = Object.entries(variables).map(([key, value]) => ({
      变量名: key,
      值: String(value),
      类型: typeof value,
    }));

    const csvContent = [
      ['变量名', '值', '类型'].join(','),
      ...data.map(row => [row.变量名, row.值, row.类型].map(v => `"${v}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `strategy_${strategyName}_variables_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();

    Toast.success('变量已导出');
  };

  if (!instance) return <Typography style={{ padding: 20 }}>加载中...</Typography>;

  const statusColor = instance.trading ? 'green' : instance.inited ? 'blue' : 'grey';
  const statusText = instance.trading ? '运行中' : instance.inited ? '已初始化' : '未初始化';

  const twoColStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 };

  // 变量表格数据
  const variableData = Object.entries(variables).map(([key, value]) => {
    const change = variableChanges[key];
    return {
      key,
      value: String(value),
      type: typeof value,
      changed: !!change,
      changeTime: change?.timestamp,
    };
  });

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
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <Switch checked={autoRefresh} onChange={setAutoRefresh} />
                <Typography.Text>自动刷新 {instance.trading ? '(2秒)' : '(策略未运行)'}</Typography.Text>
              </Space>
              <Space>
                <Button icon={<IconRefresh />} onClick={loadVariables}>手动刷新</Button>
                <Button icon={<IconExport />} onClick={exportVariables}>导出CSV</Button>
              </Space>
            </div>
            {Object.keys(variables).length === 0 ? (
              <Typography.Text type="tertiary">策略未运行，暂无变量</Typography.Text>
            ) : (
              <VariableTable data={variableData} />
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

// 变量表格组件（带高亮动画）
function VariableTable({ data }: { data: any[] }) {
  // 跟踪变化的行
  const changedKeys = data.filter(d => d.changed).map(d => d.key);

  // 添加动画样式到变化的行
  useEffect(() => {
    changedKeys.forEach(key => {
      const row = document.querySelector(`[data-variable-key="${key}"]`);
      if (row) {
        row.classList.add('variable-highlight');
        setTimeout(() => {
          row.classList.remove('variable-highlight');
        }, 3000);
      }
    });
  }, [changedKeys]);

  return (
    <>
      <table style={{ width: '100%', borderCollapse: 'collapse' }} className="semi-table semi-table-small">
        <thead>
          <tr>
            <th style={{ width: 200, padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid var(--semi-color-border)' }}>变量名</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid var(--semi-color-border)' }}>值</th>
            <th style={{ width: 100, padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid var(--semi-color-border)' }}>类型</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr
              key={row.key}
              data-variable-key={row.key}
              style={{
                backgroundColor: row.changed ? 'rgba(255, 215, 0, 0.2)' : index % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)',
                transition: 'background-color 1s ease-out',
              }}
            >
              <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--semi-color-border)' }}>
                {row.key}
                {row.changed && <span style={{ marginLeft: 8, fontSize: 12, color: '#faad14' }}>✦</span>}
              </td>
              <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--semi-color-border)', fontFamily: 'monospace' }}>{row.value}</td>
              <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--semi-color-border)' }}>
                <Tag size="small">{row.type}</Tag>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
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
