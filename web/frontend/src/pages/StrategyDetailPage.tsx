import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Tabs, TabPane, Table, Tag, Button, Card, Space, Toast, Switch, Input, DatePicker, Select } from '@douyinfe/semi-ui';
import { IconArrowLeft, IconRefresh, IconExport, IconSearch, IconFilter } from '@douyinfe/semi-icons';
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
          <TabPane tab={`日志 (${logs.length})`} itemKey="logs">
            <StrategyLogViewer logs={logs} />
          </TabPane>
          <TabPane tab={`成交 (${trades.length})`} itemKey="trades">
            <StrategyTradeTable trades={trades} />
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

// 策略日志查看器组件
function StrategyLogViewer({ logs }: { logs: any[] }) {
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [dateRange, setDateRange] = useState<(string | null)[]>([null, null]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (levelFilter && log.level !== levelFilter) return false;
      if (keyword && !log.msg?.toLowerCase().includes(keyword.toLowerCase())) return false;
      if (dateRange[0] && log.time && log.time < dateRange[0]) return false;
      if (dateRange[1] && log.time && log.time > dateRange[1]) return false;
      return true;
    }).reverse();
  }, [logs, levelFilter, keyword, dateRange]);

  const exportLogs = () => {
    const csvContent = [
      ['时间', '级别', '内容'].join(','),
      ...filteredLogs.map(log => [
        log.time || '',
        log.level || 'INFO',
        `"${(log.msg || '').replace(/"/g, '""')}"`,
      ].join(',')),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `strategy_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    Toast.success('日志已导出');
  };

  const levelColors: Record<string, string> = {
    DEBUG: 'grey',
    INFO: 'blue',
    WARNING: 'orange',
    ERROR: 'red',
    CRITICAL: 'red',
  };

  const columns = [
    {
      title: '时间',
      dataIndex: 'time',
      width: 160,
      render: (v: string) => v?.slice(0, 19) || '-',
    },
    {
      title: '级别',
      dataIndex: 'level',
      width: 80,
      render: (v: string) => {
        const level = v || 'INFO';
        return <Tag color={(levelColors[level] || 'blue') as any}>{level}</Tag>;
      },
    },
    {
      title: '内容',
      dataIndex: 'msg',
      render: (v: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {v}
        </span>
      ),
    },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space spacing={12} wrap>
          <Select
            placeholder="日志级别"
            value={levelFilter}
            onChange={(v) => setLevelFilter((v as string) || '')}
            style={{ width: 120 }}
            optionList={[
              { label: '全部级别', value: '' },
              { label: 'DEBUG', value: 'DEBUG' },
              { label: 'INFO', value: 'INFO' },
              { label: 'WARNING', value: 'WARNING' },
              { label: 'ERROR', value: 'ERROR' },
            ]}
          />
          <Input
            prefix={<IconSearch />}
            placeholder="关键词搜索"
            value={keyword}
            onChange={(v) => setKeyword(v)}
            style={{ width: 200 }}
          />
          <DatePicker
            type="dateRange"
            placeholder={['开始日期', '结束日期']}
            onChange={(dates) => {
              if (Array.isArray(dates) && dates.length === 2) {
                setDateRange([dates[0] as string, dates[1] as string]);
              } else {
                setDateRange([null, null]);
              }
            }}
            style={{ width: 280 }}
          />
          <Button icon={<IconFilter />} onClick={() => { setLevelFilter(''); setKeyword(''); setDateRange([null, null]); }}>
            重置
          </Button>
          <Button icon={<IconExport />} onClick={exportLogs} disabled={filteredLogs.length === 0}>
            导出
          </Button>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={filteredLogs}
        pagination={{ pageSize: 20 }}
        size="small"
        scroll={{ y: 400 }}
        empty={<Typography.Text type="tertiary">暂无日志</Typography.Text>}
      />
    </div>
  );
}

// 策略成交表格组件
function StrategyTradeTable({ trades }: { trades: any[] }) {
  const [directionFilter, setDirectionFilter] = useState<string>('');
  const [offsetFilter, setOffsetFilter] = useState<string>('');

  const filteredTrades = useMemo(() => {
    return trades.filter(trade => {
      if (directionFilter && trade.direction !== directionFilter) return false;
      if (offsetFilter && trade.offset !== offsetFilter) return false;
      return true;
    });
  }, [trades, directionFilter, offsetFilter]);

  const exportTrades = () => {
    const csvContent = [
      ['时间', '合约', '方向', '开平', '价格', '数量'].join(','),
      ...filteredTrades.map(trade => [
        trade.datetime || '',
        trade.vt_symbol || '',
        trade.direction || '',
        trade.offset || '',
        trade.price || '',
        trade.volume || '',
      ].join(',')),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `strategy_trades_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    Toast.success('成交记录已导出');
  };

  const columns = [
    {
      title: '时间',
      dataIndex: 'datetime',
      width: 160,
      render: (v: string) => v?.slice(0, 19) || '-',
    },
    {
      title: '合约',
      dataIndex: 'vt_symbol',
      width: 140,
    },
    {
      title: '方向',
      dataIndex: 'direction',
      width: 80,
      render: (v: string) => (
        <Tag color={v === '多' ? 'red' : 'green'}>{v}</Tag>
      ),
    },
    {
      title: '开平',
      dataIndex: 'offset',
      width: 80,
      render: (v: string) => {
        const colors: Record<string, string> = {
          '开': 'blue',
          '平': 'orange',
          '平今': 'purple',
          '平昨': 'cyan',
        };
        return <Tag color={(colors[v] || 'default') as any}>{v}</Tag>;
      },
    },
    {
      title: '价格',
      dataIndex: 'price',
      width: 100,
      align: 'right' as const,
      render: (v: number) => v?.toFixed(2),
    },
    {
      title: '数量',
      dataIndex: 'volume',
      width: 80,
      align: 'right' as const,
    },
  ];

  // 统计信息
  const stats = useMemo(() => {
    const total = filteredTrades.length;
    const buyTrades = filteredTrades.filter(t => t.direction === '多').length;
    const sellTrades = filteredTrades.filter(t => t.direction === '空').length;
    const totalVolume = filteredTrades.reduce((sum, t) => sum + (t.volume || 0), 0);
    return { total, buyTrades, sellTrades, totalVolume };
  }, [filteredTrades]);

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space spacing={12} wrap>
          <Select
            placeholder="方向筛选"
            value={directionFilter}
            onChange={(v) => setDirectionFilter((v as string) || '')}
            style={{ width: 100 }}
            optionList={[
              { label: '全部', value: '' },
              { label: '多', value: '多' },
              { label: '空', value: '空' },
            ]}
          />
          <Select
            placeholder="开平筛选"
            value={offsetFilter}
            onChange={(v) => setOffsetFilter((v as string) || '')}
            style={{ width: 100 }}
            optionList={[
              { label: '全部', value: '' },
              { label: '开', value: '开' },
              { label: '平', value: '平' },
              { label: '平今', value: '平今' },
              { label: '平昨', value: '平昨' },
            ]}
          />
          <Button icon={<IconFilter />} onClick={() => { setDirectionFilter(''); setOffsetFilter(''); }}>
            重置
          </Button>
          <Button icon={<IconExport />} onClick={exportTrades} disabled={filteredTrades.length === 0}>
            导出
          </Button>
        </Space>
      </Card>

      {/* 统计卡片 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <Card bodyStyle={{ padding: '8px 16px' }}>
          <Typography.Text type="tertiary" size="small">总成交</Typography.Text>
          <div style={{ fontSize: 20, fontWeight: 'bold' }}>{stats.total}</div>
        </Card>
        <Card bodyStyle={{ padding: '8px 16px' }}>
          <Typography.Text type="tertiary" size="small">买入</Typography.Text>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: 'var(--semi-color-danger)' }}>{stats.buyTrades}</div>
        </Card>
        <Card bodyStyle={{ padding: '8px 16px' }}>
          <Typography.Text type="tertiary" size="small">卖出</Typography.Text>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: 'var(--semi-color-success)' }}>{stats.sellTrades}</div>
        </Card>
        <Card bodyStyle={{ padding: '8px 16px' }}>
          <Typography.Text type="tertiary" size="small">总数量</Typography.Text>
          <div style={{ fontSize: 20, fontWeight: 'bold' }}>{stats.totalVolume}</div>
        </Card>
      </div>

      <Table
        columns={columns}
        dataSource={filteredTrades}
        pagination={{ pageSize: 20 }}
        size="small"
        scroll={{ y: 350 }}
        empty={<Typography.Text type="tertiary">暂无成交记录</Typography.Text>}
      />
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
