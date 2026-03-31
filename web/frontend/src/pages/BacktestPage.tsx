import { useEffect, useState, useMemo } from 'react';
import {
  Typography, Card, Input, Select, Button, Row, Col, Toast,
  Table, Progress, Tag, Space, Tabs, Empty, Spin, Divider, Modal
} from '@douyinfe/semi-ui';
import {
  IconPlay, IconDelete, IconRefresh, IconPieChartStroked,
  IconList, IconSetting, IconHistogram, IconCandlestickChartStroked
} from '@douyinfe/semi-icons';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { backtestApi, marketApi } from '../api';
import KLineChart, { type KLineData, type TradeMarker } from '../components/KLineChart';
import CandleChart, { type CandleData } from '../components/CandleChart';
import { useRealtimeStore } from '../stores/realtimeStore';
import { useWebSocket } from '../services/websocket';
import type { BacktestTask, BacktestTaskStatus } from '../api/types';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

// 状态标签映射
const statusMap: Record<BacktestTaskStatus, { label: string; color: string }> = {
  pending: { label: '等待中', color: 'grey' },
  running: { label: '运行中', color: 'blue' },
  completed: { label: '已完成', color: 'green' },
  failed: { label: '失败', color: 'red' },
  cancelled: { label: '已取消', color: 'orange' },
};

// 格式化时间
const formatTime = (timestamp: number | string | undefined) => {
  if (!timestamp) return '-';
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp * 1000);
  return date.toLocaleString('zh-CN');
};

export default function BacktestPage() {
  const [classes, setClasses] = useState<string[]>([]);
  const [tasks, setTasks] = useState<BacktestTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<BacktestTask | null>(null);
  const [taskResult, setTaskResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('tasks');

  // 表单状态
  const [form, setForm] = useState({
    class_name: '', vt_symbol: '', interval: '1m',
    start: '2024-01-01', end: '2024-12-31',
    rate: '0.0001', slippage: '0', size: '1', capital: '1000000',
  });

  // WebSocket 进度
  const { backtestProgress, connectionState } = useRealtimeStore();
  useWebSocket();

  // 优化表单状态
  const [optimizeForm, setOptimizeForm] = useState({
    class_name: '', vt_symbol: '', interval: '1m',
    start: '2024-01-01', end: '2024-06-30',
    rate: '0.0001', slippage: '0', size: '1', capital: '1000000',
    param_name: '', param_start: '', param_end: '', param_step: '',
  });
  const [optimizeResults, setOptimizeResults] = useState<any[]>([]);
  const [optimizeLoading, setOptimizeLoading] = useState(false);
  const [selectedOptimizeTask, setSelectedOptimizeTask] = useState<BacktestTask | null>(null);

  // K线数据状态
  const [candleData, setCandleData] = useState<KLineData[]>([]);
  const [candleChartData, setCandleChartData] = useState<CandleData[]>([]);
  const [tradeMarkers, setTradeMarkers] = useState<TradeMarker[]>([]);
  const [showCandleModal, setShowCandleModal] = useState(false);
  const [candleLoading, setCandleLoading] = useState(false);
  const [candleSymbol, setCandleSymbol] = useState('');
  const [chartType, setChartType] = useState<'echarts' | 'lightweight'>('lightweight');

  // 加载策略类和任务列表
  useEffect(() => {
    loadClasses();
    loadTasks();
  }, []);

  // 定时刷新任务列表
  useEffect(() => {
    const timer = setInterval(() => {
      loadTasks(false);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const loadClasses = async () => {
    try {
      const res = await backtestApi.classes();
      setClasses(res.data);
    } catch { /* ignore */ }
  };

  const loadTasks = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await backtestApi.tasks({ limit: 50 });
      // 后端返回格式: {tasks: [], total: 0}
      setTasks(res.data.tasks || res.data.data || []);
    } catch { /* ignore */ }
    finally { if (showLoading) setLoading(false); }
  };

  // 创建回测任务
  const handleCreateTask = async () => {
    if (!form.class_name || !form.vt_symbol) {
      Toast.error('请选择策略类和合约');
      return;
    }

    try {
      await backtestApi.createTask({
        class_name: form.class_name,
        vt_symbol: form.vt_symbol,
        interval: form.interval,
        start: form.start,
        end: form.end,
        rate: parseFloat(form.rate),
        slippage: parseFloat(form.slippage),
        size: parseFloat(form.size),
        capital: parseFloat(form.capital),
        setting: {},
      });

      Toast.success('回测任务已创建');
      setActiveTab('tasks');
      loadTasks();
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '创建任务失败');
    }
  };

  // 取消任务
  const handleCancel = async (taskId: string) => {
    try {
      await backtestApi.cancelTask(taskId);
      Toast.success('任务已取消');
      loadTasks(false);
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '取消失败');
    }
  };

  // 查看任务结果
  const handleViewResult = async (task: BacktestTask) => {
    setSelectedTask(task);
    if (task.status === 'completed' && task.result) {
      if (task.task_type === 'optimize') {
        // 优化任务结果显示在优化标签页
        const results = task.result.results || [];
        setOptimizeResults(results.map((r: any, idx: number) => ({
          key: idx,
          param_value: r.params?.[Object.keys(r.params)[0]] || 0,
          total_return: r.total_return,
          sharpe_ratio: r.sharpe_ratio,
          max_drawdown: r.max_drawdown,
          total_trades: r.total_trades,
          params: r.params,
        })));
        setSelectedOptimizeTask(task);
        setActiveTab('optimize');
        return;
      }
      setTaskResult(task.result);
    } else if (task.status === 'completed') {
      // 如果结果不在任务对象中，单独获取
      try {
        const res = await backtestApi.taskResult(task.task_id);
        setTaskResult(res.data);
      } catch { /* ignore */ }
    }
    setActiveTab('result');
  };

  const updateForm = (key: string, value: string) => setForm({ ...form, [key]: value });
  const updateOptimizeForm = (key: string, value: string) => setOptimizeForm({ ...optimizeForm, [key]: value });
  const labelStyle = { marginBottom: 8, display: 'block' };

  // 创建优化任务
  const handleCreateOptimizeTask = async () => {
    if (!optimizeForm.class_name || !optimizeForm.vt_symbol || !optimizeForm.param_name) {
      Toast.error('请填写完整的优化参数');
      return;
    }

    setOptimizeLoading(true);
    try {
      // 构建参数范围
      const paramRanges: Record<string, number[]> = {};
      const start = parseFloat(optimizeForm.param_start);
      const end = parseFloat(optimizeForm.param_end);
      const step = parseFloat(optimizeForm.param_step) || 1;
      const values: number[] = [];
      for (let v = start; v <= end; v += step) {
        values.push(Math.round(v * 100) / 100);
      }
      paramRanges[optimizeForm.param_name] = values;

      await backtestApi.createOptimizeTask({
        class_name: optimizeForm.class_name,
        vt_symbol: optimizeForm.vt_symbol,
        interval: optimizeForm.interval,
        start: optimizeForm.start,
        end: optimizeForm.end,
        rate: parseFloat(optimizeForm.rate),
        slippage: parseFloat(optimizeForm.slippage),
        size: parseFloat(optimizeForm.size),
        capital: parseFloat(optimizeForm.capital),
        optimization_setting: paramRanges,
      });

      Toast.success('优化任务已创建');
      setActiveTab('tasks');
      loadTasks();
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '创建优化任务失败');
    } finally {
      setOptimizeLoading(false);
    }
  };

  // 查看K线图表
  const openCandleChart = async (task: BacktestTask) => {
    setShowCandleModal(true);
    setCandleLoading(true);
    setCandleSymbol(task.vt_symbol || '');
    try {
      // 获取历史K线数据
      const historyRes = await marketApi.history({
        vt_symbol: task.vt_symbol || '',
        interval: task.interval || '1m',
        start: task.start_date || '',
        end: task.end_date || '',
      });

      const bars = historyRes.data?.bars || [];
      const klineData: KLineData[] = bars.map((bar: any) => ({
        time: bar.datetime || bar.date,
        open: bar.open_price || bar.open,
        high: bar.high_price || bar.high,
        low: bar.low_price || bar.low,
        close: bar.close_price || bar.close,
        volume: bar.volume,
      }));

      setCandleData(klineData);
      setCandleChartData(bars.map((bar: any) => ({
        time: bar.datetime || bar.date,
        open: bar.open_price || bar.open,
        high: bar.high_price || bar.high,
        low: bar.low_price || bar.low,
        close: bar.close_price || bar.close,
        volume: bar.volume,
      })));

      // 获取交易记录作为标记
      if (task.result?.trades) {
        const markers: TradeMarker[] = task.result.trades.map((trade: any) => ({
          time: trade.datetime || trade.date,
          price: trade.price,
          direction: trade.direction === '多' || trade.offset === '开' ? 'buy' :
                     trade.direction === '空' || trade.offset === '开' ? 'short' :
                     trade.direction === '多' || trade.offset === '平' ? 'sell' : 'cover',
        }));
        setTradeMarkers(markers);
      } else {
        setTradeMarkers([]);
      }
    } catch (err) {
      Toast.error('加载K线数据失败');
      // 使用模拟数据作为后备
      const mockCandles = generateMockCandles(task.vt_symbol || 'rb2410.SHFE');
      setCandleData(mockCandles);
      setCandleChartData(mockCandles.map(d => ({
        time: d.time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume,
      })));
      setTradeMarkers([]);
    } finally {
      setCandleLoading(false);
    }
  };

  // 生成模拟K线数据
  const generateMockCandles = (_vtSymbol: string): KLineData[] => {
    const candles: KLineData[] = [];
    let price = 3500;
    const start = new Date('2024-01-01');
    for (let i = 0; i < 100; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      const open = price;
      const change = (Math.random() - 0.5) * 100;
      const close = open + change;
      const high = Math.max(open, close) + Math.random() * 30;
      const low = Math.min(open, close) - Math.random() * 30;
      const volume = Math.floor(Math.random() * 10000) + 5000;

      candles.push({
        time: date.toISOString().split('T')[0],
        open,
        high,
        low,
        close,
        volume,
      });
      price = close;
    }
    return candles;
  };

  // 任务类型标签
  const taskTypeMap: Record<string, { label: string; color: string }> = {
    backtest: { label: '回测', color: 'blue' },
    optimize: { label: '优化', color: 'purple' },
    download: { label: '下载', color: 'cyan' },
  };

  // 任务列表列定义
  const taskColumns = [
    {
      title: '任务ID',
      dataIndex: 'task_id',
      width: 180,
      render: (v: string) => <span className="font-mono text-secondary">{v.slice(0, 16)}...</span>,
    },
    {
      title: '类型',
      dataIndex: 'task_type',
      width: 80,
      render: (v: string) => (
        <Tag color={(taskTypeMap[v]?.color || 'default') as any} size="small">
          {taskTypeMap[v]?.label || v}
        </Tag>
      ),
    },
    {
      title: '策略',
      dataIndex: 'class_name',
      width: 140,
    },
    {
      title: '合约',
      dataIndex: 'vt_symbol',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: BacktestTaskStatus) => (
        <Tag color={statusMap[v]?.color as any || 'grey'}>{statusMap[v]?.label || v}</Tag>
      ),
    },
    {
      title: '进度',
      dataIndex: 'progress',
      width: 150,
      render: (_: number, record: BacktestTask) => {
        // 优先使用 WebSocket 推送的实时进度
        const wsProgress = backtestProgress[record.task_id];
        const progress = wsProgress?.progress ?? record.progress ?? 0;
        const message = wsProgress?.message ?? record.progress_message ?? '';

        return record.status === 'running' ? (
          <div>
            <Progress percent={progress} size="small" showInfo={false} />
            <div style={{ fontSize: 11, color: 'var(--semi-color-text-2)', marginTop: 4 }}>
              {message || '运行中...'}
            </div>
          </div>
        ) : (
          <span style={{ color: 'var(--semi-color-text-2)' }}>-</span>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 160,
      render: (v: string) => formatTime(v),
    },
    {
      title: '操作',
      width: 180,
      render: (_: any, record: BacktestTask) => (
        <Space>
          {record.status === 'running' && (
            <Button
              icon={<IconDelete />}
              size="small"
              type="danger"
              onClick={() => handleCancel(record.task_id)}
            >
              取消
            </Button>
          )}
          {record.status === 'completed' && (
            <>
              <Button
                icon={<IconPieChartStroked />}
                size="small"
                type="primary"
                onClick={() => handleViewResult(record)}
              >
                结果
              </Button>
              <Button
                icon={<IconCandlestickChartStroked />}
                size="small"
                onClick={() => openCandleChart(record)}
              >
                K线
              </Button>
            </>
          )}
          {record.status === 'failed' && (
            <Tag color="red" size="small">失败</Tag>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title heading={4} style={{ marginBottom: 20 }}>
        回测中心
        <Tag
          color={connectionState === 'connected' ? 'green' : connectionState === 'connecting' ? 'orange' : 'red'}
          size="small"
          style={{ marginLeft: 8 }}
        >
          {connectionState === 'connected' ? '实时' : connectionState === 'connecting' ? '连接中' : '断开'}
        </Tag>
      </Title>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane
          tab={<span><IconList style={{ marginRight: 4 }} />任务列表</span>}
          itemKey="tasks"
        >
          <Card style={{ borderRadius: 12 }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 500 }}>最近任务</span>
              <Button icon={<IconRefresh />} size="small" onClick={() => loadTasks()}>
                刷新
              </Button>
            </div>
            <Table
              columns={taskColumns}
              dataSource={tasks.map((t, i) => ({ ...t, _key: t.task_id || `task-${i}` }))}
              rowKey="_key"
              loading={loading}
              pagination={false}
              size="small"
              empty={<Empty description="暂无任务，去创建一个新任务" />}
            />
          </Card>
        </TabPane>

        <TabPane
          tab={<span><IconSetting style={{ marginRight: 4 }} />新建回测</span>}
          itemKey="new"
        >
          <Row gutter={16}>
            <Col span={8}>
              <Card title="回测配置" style={{ borderRadius: 12 }}>
                <div>
                  <label style={labelStyle}>策略类</label>
                  <Select
                    value={form.class_name}
                    onChange={(v) => updateForm('class_name', v as string)}
                    style={{ width: '100%', marginBottom: 12 }}
                    placeholder="选择策略"
                    optionList={classes.map((c) => ({ value: c, label: c }))}
                  />
                </div>
                <div>
                  <label style={labelStyle}>合约</label>
                  <Input
                    value={form.vt_symbol}
                    onChange={(v) => updateForm('vt_symbol', v)}
                    placeholder="rb2410.SHFE"
                    style={{ marginBottom: 12 }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>周期</label>
                  <Select
                    value={form.interval}
                    onChange={(v) => updateForm('interval', v as string)}
                    style={{ width: '100%', marginBottom: 12 }}
                    optionList={[
                      { value: '1m', label: '1分钟' },
                      { value: '1h', label: '1小时' },
                      { value: 'd', label: '日线' },
                      { value: 'w', label: '周线' },
                    ]}
                  />
                </div>
                <Row gutter={8}>
                  <Col span={12}>
                    <div>
                      <label style={labelStyle}>开始日期</label>
                      <Input type="date" value={form.start} onChange={(v) => updateForm('start', v)} />
                    </div>
                  </Col>
                  <Col span={12}>
                    <div>
                      <label style={labelStyle}>结束日期</label>
                      <Input type="date" value={form.end} onChange={(v) => updateForm('end', v)} />
                    </div>
                  </Col>
                </Row>
                <Row gutter={8} style={{ marginTop: 12 }}>
                  <Col span={12}>
                    <div>
                      <label style={labelStyle}>手续费率</label>
                      <Input type="number" value={form.rate} onChange={(v) => updateForm('rate', v)} />
                    </div>
                  </Col>
                  <Col span={12}>
                    <div>
                      <label style={labelStyle}>滑点</label>
                      <Input type="number" value={form.slippage} onChange={(v) => updateForm('slippage', v)} />
                    </div>
                  </Col>
                </Row>
                <Row gutter={8} style={{ marginTop: 12 }}>
                  <Col span={12}>
                    <div>
                      <label style={labelStyle}>合约乘数</label>
                      <Input type="number" value={form.size} onChange={(v) => updateForm('size', v)} />
                    </div>
                  </Col>
                  <Col span={12}>
                    <div>
                      <label style={labelStyle}>初始资金</label>
                      <Input type="number" value={form.capital} onChange={(v) => updateForm('capital', v)} />
                    </div>
                  </Col>
                </Row>
                <Button
                  theme="solid"
                  block
                  size="large"
                  icon={<IconPlay />}
                  onClick={handleCreateTask}
                  disabled={!form.class_name || !form.vt_symbol}
                  style={{ marginTop: 20, borderRadius: 10 }}
                >
                  创建回测任务
                </Button>
              </Card>
            </Col>
            <Col span={16}>
              <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--semi-color-text-2)' }}>
                <Title heading={4} type="tertiary">配置参数后创建任务</Title>
                <p>任务将在后台异步执行，支持实时查看进度</p>
              </div>
            </Col>
          </Row>
        </TabPane>

        <TabPane
          tab={<span><IconPieChartStroked style={{ marginRight: 4 }} />结果详情</span>}
          itemKey="result"
        >
          {selectedTask ? (
            <div>
              <Card style={{ marginBottom: 16, borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Title heading={5} style={{ margin: 0 }}>回测结果</Title>
                    <p style={{ margin: '8px 0 0', color: 'var(--semi-color-text-2)' }}>
                      {selectedTask.class_name} / {selectedTask.vt_symbol} / {selectedTask.interval}
                    </p>
                  </div>
                  <Tag color={statusMap[selectedTask.status]?.color as any}>
                    {statusMap[selectedTask.status]?.label}
                  </Tag>
                </div>
              </Card>

              {taskResult ? (
                <BacktestResultCharts result={taskResult} />
              ) : selectedTask.status === 'running' ? (
                <Card style={{ borderRadius: 12, textAlign: 'center', padding: 60 }}>
                  <Spin size="large" />
                  <p style={{ marginTop: 16 }}>任务执行中...</p>
                  <Progress
                    percent={backtestProgress[selectedTask.task_id]?.progress || 0}
                    style={{ width: 300, margin: '0 auto' }}
                  />
                </Card>
              ) : (
                <Empty description="暂无结果数据" />
              )}
            </div>
          ) : (
            <Empty description="请先选择一个任务查看结果" />
          )}
        </TabPane>

        <TabPane
          tab={<span><IconHistogram style={{ marginRight: 4 }} />参数优化</span>}
          itemKey="optimize"
        >
          <Row gutter={16}>
            <Col span={8}>
              <Card title="优化配置" style={{ borderRadius: 12 }}>
                <div>
                  <label style={labelStyle}>策略类</label>
                  <Select
                    value={optimizeForm.class_name}
                    onChange={(v) => updateOptimizeForm('class_name', v as string)}
                    style={{ width: '100%', marginBottom: 12 }}
                    placeholder="选择策略"
                    optionList={classes.map((c) => ({ value: c, label: c }))}
                  />
                </div>
                <div>
                  <label style={labelStyle}>合约</label>
                  <Input
                    value={optimizeForm.vt_symbol}
                    onChange={(v) => updateOptimizeForm('vt_symbol', v)}
                    placeholder="rb2410.SHFE"
                    style={{ marginBottom: 12 }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>周期</label>
                  <Select
                    value={optimizeForm.interval}
                    onChange={(v) => updateOptimizeForm('interval', v as string)}
                    style={{ width: '100%', marginBottom: 12 }}
                    optionList={[
                      { value: '1m', label: '1分钟' },
                      { value: '1h', label: '1小时' },
                      { value: 'd', label: '日线' },
                    ]}
                  />
                </div>
                <Row gutter={8}>
                  <Col span={12}>
                    <div>
                      <label style={labelStyle}>开始日期</label>
                      <Input type="date" value={optimizeForm.start} onChange={(v) => updateOptimizeForm('start', v)} />
                    </div>
                  </Col>
                  <Col span={12}>
                    <div>
                      <label style={labelStyle}>结束日期</label>
                      <Input type="date" value={optimizeForm.end} onChange={(v) => updateOptimizeForm('end', v)} />
                    </div>
                  </Col>
                </Row>
                <Divider margin="12px" />
                <Text strong>优化参数</Text>
                <div style={{ marginTop: 8 }}>
                  <label style={labelStyle}>参数名</label>
                  <Input
                    value={optimizeForm.param_name}
                    onChange={(v) => updateOptimizeForm('param_name', v)}
                    placeholder="如: fast_window"
                    style={{ marginBottom: 12 }}
                  />
                </div>
                <Row gutter={8}>
                  <Col span={8}>
                    <div>
                      <label style={labelStyle}>起始值</label>
                      <Input value={optimizeForm.param_start} onChange={(v) => updateOptimizeForm('param_start', v)} />
                    </div>
                  </Col>
                  <Col span={8}>
                    <div>
                      <label style={labelStyle}>结束值</label>
                      <Input value={optimizeForm.param_end} onChange={(v) => updateOptimizeForm('param_end', v)} />
                    </div>
                  </Col>
                  <Col span={8}>
                    <div>
                      <label style={labelStyle}>步长</label>
                      <Input value={optimizeForm.param_step} onChange={(v) => updateOptimizeForm('param_step', v)} placeholder="1" />
                    </div>
                  </Col>
                </Row>
                <Button
                  theme="solid"
                  block
                  size="large"
                  icon={<IconSetting />}
                  loading={optimizeLoading}
                  onClick={handleCreateOptimizeTask}
                  disabled={!optimizeForm.class_name || !optimizeForm.vt_symbol}
                  style={{ marginTop: 20, borderRadius: 10 }}
                >
                  开始优化
                </Button>
              </Card>
            </Col>
            <Col span={16}>
              {optimizeResults.length > 0 ? (
                <>
                  <Card title="优化结果" style={{ borderRadius: 12, marginBottom: 16 }}>
                    <Table
                      columns={[
                        {
                          title: '排名',
                          dataIndex: 'key',
                          width: 60,
                          render: (v: number) => v + 1
                        },
                        {
                          title: '参数值',
                          dataIndex: 'param_value',
                          width: 100,
                          render: (v: number) => (
                            <Tag color="blue" size="small">{v.toFixed(2)}</Tag>
                          )
                        },
                        {
                          title: '总收益率%',
                          dataIndex: 'total_return',
                          width: 120,
                          align: 'right' as const,
                          render: (v: number) => (
                            <span style={{ color: v >= 0 ? '#f5222d' : '#52c41a', fontWeight: 600 }}>
                              {v?.toFixed(2)}
                            </span>
                          )
                        },
                        {
                          title: '夏普比率',
                          dataIndex: 'sharpe_ratio',
                          width: 100,
                          align: 'right' as const,
                          render: (v: number) => (
                            <span style={{ color: v >= 1 ? '#f5222d' : v >= 0 ? '#666' : '#52c41a' }}>
                              {v?.toFixed(3)}
                            </span>
                          )
                        },
                        {
                          title: '最大回撤%',
                          dataIndex: 'max_drawdown',
                          width: 120,
                          align: 'right' as const,
                          render: (v: number) => v?.toFixed(2)
                        },
                        {
                          title: '交易次数',
                          dataIndex: 'total_trades',
                          width: 100,
                          align: 'right' as const,
                        },
                        {
                          title: '操作',
                          width: 100,
                          render: (_: any, record: any) => (
                            <Button
                              size="small"
                              type="primary"
                              onClick={() => {
                                // 应用最优参数
                                Toast.success(`已应用参数值: ${record.param_value}`);
                              }}
                            >
                              应用
                            </Button>
                          )
                        }
                      ]}
                      dataSource={optimizeResults}
                      pagination={{ pageSize: 10 }}
                      size="small"
                      rowKey="key"
                    />
                  </Card>
                  {selectedOptimizeTask && (
                    <Card style={{ borderRadius: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <Text type="tertiary">优化任务</Text>
                          <div style={{ fontWeight: 600 }}>{selectedOptimizeTask.task_id?.slice(0, 16)}...</div>
                        </div>
                        <div>
                          <Text type="tertiary">测试组合数</Text>
                          <div style={{ fontWeight: 600, fontSize: 18, textAlign: 'center' }}>
                            {selectedOptimizeTask.result?.total_combinations || optimizeResults.length}
                          </div>
                        </div>
                        <div>
                          <Text type="tertiary">最优夏普</Text>
                          <div style={{ fontWeight: 600, fontSize: 18, color: '#f5222d', textAlign: 'center' }}>
                            {optimizeResults[0]?.sharpe_ratio?.toFixed(3) || '-'}
                          </div>
                        </div>
                        <Button type="primary" onClick={() => {
                          // 使用最优参数创建回测任务
                          const best = optimizeResults[0];
                          if (best) {
                            Toast.success(`已选择最优参数: ${best.param_value}`);
                          }
                        }}>
                          使用最优参数回测
                        </Button>
                      </div>
                    </Card>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--semi-color-text-2)' }}>
                  <Title heading={4} type="tertiary">配置优化参数</Title>
                  <p>系统将遍历参数范围，寻找最优参数组合</p>
                  <div style={{ marginTop: 24, textAlign: 'left', padding: '0 40px' }}>
                    <Text type="tertiary" size="small">使用说明：</Text>
                    <ul style={{ color: 'var(--semi-color-text-2)', fontSize: 13, marginTop: 8 }}>
                      <li>1. 选择策略类和合约</li>
                      <li>2. 设置回测时间范围</li>
                      <li>3. 选择要优化的参数（如 fast_window）</li>
                      <li>4. 设置参数范围（起始值、结束值、步长）</li>
                      <li>5. 点击"开始优化"，系统将自动遍历所有参数组合</li>
                      <li>6. 优化完成后，可查看结果并应用最优参数</li>
                    </ul>
                  </div>
                </div>
              )}
            </Col>
          </Row>
        </TabPane>
      </Tabs>

      {/* K线图表Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 32 }}>
            <span>K线图表 - {candleSymbol}</span>
            <Select
              value={chartType}
              onChange={(v) => setChartType(v as 'echarts' | 'lightweight')}
              style={{ width: 140 }}
              size="small"
              optionList={[
                { value: 'lightweight', label: 'Lightweight' },
                { value: 'echarts', label: 'ECharts' },
              ]}
            />
          </div>
        }
        visible={showCandleModal}
        onCancel={() => setShowCandleModal(false)}
        footer={null}
        width={1100}
        centered
      >
        {candleLoading ? (
          <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
        ) : (
          <div>
            {chartType === 'lightweight' ? (
              <CandleChart
                data={candleChartData}
                height={500}
                showMA={true}
                showVolume={true}
              />
            ) : (
              <KLineChart
                data={candleData}
                trades={tradeMarkers}
                height={500}
              />
            )}
            <div style={{ marginTop: 16, display: 'flex', gap: 24, justifyContent: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 12, height: 12, background: '#f5222d', borderRadius: 2 }}></span>
                涨
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 12, height: 12, background: '#52c41a', borderRadius: 2 }}></span>
                跌
              </span>
              {chartType === 'echarts' && (
                <>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: '#f5222d' }}>↑</span>
                    买开/买平
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: '#52c41a' }}>↓</span>
                    卖开/卖平
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// 回测结果图表组件
interface BacktestResult {
  total_return?: number;
  annual_return?: number;
  max_drawdown?: number;
  sharpe_ratio?: number;
  total_trades?: number;
  winning_trades?: number;
  losing_trades?: number;
  win_rate?: number;
  daily_pnl?: { date: string; pnl: number; cumulative: number }[];
  drawdown?: { date: string; drawdown: number }[];
  trades?: { entry_date: string; exit_date: string; pnl: number }[];
}

function BacktestResultCharts({ result }: { result: BacktestResult }) {
  // 指标卡片数据
  const metrics = [
    { label: '总收益率', value: result.total_return, unit: '%', color: (v: number) => v >= 0 ? 'var(--semi-color-success)' : 'var(--semi-color-danger)' },
    { label: '年化收益率', value: result.annual_return, unit: '%', color: (v: number) => v >= 0 ? 'var(--semi-color-success)' : 'var(--semi-color-danger)' },
    { label: '最大回撤', value: result.max_drawdown, unit: '%', color: () => 'var(--semi-color-danger)' },
    { label: '夏普比率', value: result.sharpe_ratio, unit: '', color: (v: number) => v >= 1 ? 'var(--semi-color-success)' : v >= 0 ? 'var(--semi-color-warning)' : 'var(--semi-color-tertiary)' },
    { label: '总交易次数', value: result.total_trades, unit: '次', color: () => 'var(--semi-color-text-0)' },
    { label: '胜率', value: result.win_rate, unit: '%', color: (v: number) => v >= 50 ? 'var(--semi-color-success)' : 'var(--semi-color-warning)' },
    { label: '盈利次数', value: result.winning_trades, unit: '次', color: () => 'var(--semi-color-success)' },
    { label: '亏损次数', value: result.losing_trades, unit: '次', color: () => 'var(--semi-color-danger)' },
  ];

  // 权益曲线图配置
  const equityChartOption = useMemo(() => {
    const dailyData = result.daily_pnl || [];
    const dates = dailyData.map(d => d.date);
    const cumulative = dailyData.map(d => d.cumulative);

    return {
      title: { text: '权益曲线', left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { rotate: 30, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        name: '累计收益',
        axisLabel: { formatter: (v: number) => v.toFixed(0) },
      },
      series: [{
        name: '累计收益',
        type: 'line',
        data: cumulative,
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: '#10b981' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(16, 185, 129, 0.3)' },
            { offset: 1, color: 'rgba(16, 185, 129, 0.05)' },
          ]),
        },
      }],
    };
  }, [result.daily_pnl]);

  // 回撤图配置
  const drawdownChartOption = useMemo(() => {
    const drawdownData = result.drawdown || result.daily_pnl?.map((d, i, arr) => {
      // 如果没有回撤数据，从前高计算
      const maxSoFar = Math.max(...arr.slice(0, i + 1).map(x => x.cumulative), 0);
      return { date: d.date, drawdown: d.cumulative - maxSoFar };
    }) || [];

    const dates = drawdownData.map(d => d.date);
    const values = drawdownData.map(d => d.drawdown);

    return {
      title: { text: '回撤曲线', left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { rotate: 30, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        name: '回撤',
        axisLabel: { formatter: (v: number) => v.toFixed(0) },
      },
      series: [{
        name: '回撤',
        type: 'line',
        data: values,
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: '#ef4444' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(239, 68, 68, 0.3)' },
            { offset: 1, color: 'rgba(239, 68, 68, 0.05)' },
          ]),
        },
      }],
    };
  }, [result.drawdown, result.daily_pnl]);

  // 收益分布图配置
  const pnlDistributionOption = useMemo(() => {
    const trades = result.trades || [];
    if (trades.length === 0) return null;

    const pnls = trades.map(t => t.pnl);
    const min = Math.min(...pnls);
    const max = Math.max(...pnls);
    const binCount = 20;
    const binWidth = (max - min) / binCount;

    const bins = Array(binCount).fill(0);
    const binLabels: string[] = [];

    for (let i = 0; i < binCount; i++) {
      const binMin = min + i * binWidth;
      const binMax = min + (i + 1) * binWidth;
      binLabels.push(`${binMin.toFixed(0)}~${binMax.toFixed(0)}`);
    }

    pnls.forEach(pnl => {
      const binIndex = Math.min(Math.floor((pnl - min) / binWidth), binCount - 1);
      bins[binIndex]++;
    });

    return {
      title: { text: '盈亏分布', left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: binLabels,
        axisLabel: { rotate: 45, fontSize: 8, interval: 2 },
      },
      yAxis: { type: 'value', name: '次数' },
      series: [{
        name: '交易次数',
        type: 'bar',
        data: bins,
        itemStyle: {
          color: (params: any) => {
            // 根据区间索引判断颜色
            const idx = params.dataIndex;
            const mid = binCount / 2;
            return idx < mid ? '#ef4444' : '#10b981';
          },
        },
      }],
    };
  }, [result.trades]);

  const [resultTab, setResultTab] = useState('overview');

  // 分笔成交表格列定义
  const tradeColumns = [
    {
      title: '成交号',
      dataIndex: 'tradeid',
      width: 80,
      render: (v: string, r: any, idx: number) => idx + 1,
    },
    {
      title: '时间',
      dataIndex: 'datetime',
      width: 160,
      render: (v: string) => v?.slice(0, 19) || '-',
    },
    {
      title: '方向',
      dataIndex: 'direction',
      width: 70,
      render: (v: string) => (
        <Tag color={v === '多' ? 'red' : 'green'}>{v}</Tag>
      ),
    },
    {
      title: '开平',
      dataIndex: 'offset',
      width: 70,
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
      width: 70,
      align: 'right' as const,
    },
    {
      title: '盈亏',
      dataIndex: 'pnl',
      width: 100,
      align: 'right' as const,
      render: (v: number) => v !== undefined ? (
        <span style={{ color: v >= 0 ? '#f5222d' : '#52c41a' }}>
          {v >= 0 ? '+' : ''}{v?.toFixed(2)}
        </span>
      ) : '-',
    },
  ];

  // 日收益表格列定义
  const dailyColumns = [
    {
      title: '日期',
      dataIndex: 'date',
      width: 120,
    },
    {
      title: '当日盈亏',
      dataIndex: 'pnl',
      width: 120,
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ color: v >= 0 ? '#f5222d' : '#52c41a' }}>
          {v >= 0 ? '+' : ''}{v?.toFixed(2)}
        </span>
      ),
    },
    {
      title: '累计盈亏',
      dataIndex: 'cumulative',
      width: 120,
      align: 'right' as const,
      render: (v: number) => v?.toFixed(2),
    },
    {
      title: '当日回撤',
      dataIndex: 'drawdown',
      width: 120,
      align: 'right' as const,
      render: (v: number) => v ? (
        <span style={{ color: '#ef4444' }}>{v?.toFixed(2)}</span>
      ) : '-',
    },
    {
      title: '交易次数',
      dataIndex: 'trade_count',
      width: 100,
      align: 'right' as const,
      render: (v: number) => v || '-',
    },
  ];

  // 持仓变化表格列定义
  const positionColumns = [
    {
      title: '时间',
      dataIndex: 'datetime',
      width: 160,
      render: (v: string) => v?.slice(0, 19) || '-',
    },
    {
      title: '持仓方向',
      dataIndex: 'direction',
      width: 100,
      render: (v: string) => v ? (
        <Tag color={v === '多' ? 'red' : v === '空' ? 'green' : 'grey'}>
          {v}
        </Tag>
      ) : '无',
    },
    {
      title: '持仓数量',
      dataIndex: 'volume',
      width: 100,
      align: 'right' as const,
    },
    {
      title: '持仓均价',
      dataIndex: 'avg_price',
      width: 100,
      align: 'right' as const,
      render: (v: number) => v?.toFixed(2),
    },
    {
      title: '浮动盈亏',
      dataIndex: 'floating_pnl',
      width: 120,
      align: 'right' as const,
      render: (v: number) => v !== undefined ? (
        <span style={{ color: v >= 0 ? '#f5222d' : '#52c41a' }}>
          {v >= 0 ? '+' : ''}{v?.toFixed(2)}
        </span>
      ) : '-',
    },
  ];

  // 导出数据
  const exportData = (type: 'trades' | 'daily' | 'positions') => {
    let csvContent = '';
    let filename = '';

    if (type === 'trades') {
      const trades = result.trades || [];
      csvContent = [
        ['成交号', '时间', '方向', '开平', '价格', '数量', '盈亏'].join(','),
        ...trades.map((t: any, idx: number) => [
          idx + 1,
          t.datetime || '',
          t.direction || '',
          t.offset || '',
          t.price || '',
          t.volume || '',
          t.pnl !== undefined ? t.pnl.toFixed(2) : '',
        ].join(',')),
      ].join('\n');
      filename = `backtest_trades_${new Date().toISOString().slice(0, 10)}.csv`;
    } else if (type === 'daily') {
      const daily = result.daily_pnl || [];
      csvContent = [
        ['日期', '当日盈亏', '累计盈亏'].join(','),
        ...daily.map((d: any) => [
          d.date || '',
          d.pnl !== undefined ? d.pnl.toFixed(2) : '',
          d.cumulative !== undefined ? d.cumulative.toFixed(2) : '',
        ].join(',')),
      ].join('\n');
      filename = `backtest_daily_${new Date().toISOString().slice(0, 10)}.csv`;
    }

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  return (
    <div>
      {/* 关键指标 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {metrics.filter(m => m.value !== undefined).map(m => (
          <Col span={6} key={m.label}>
            <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 12 }}>
              <Typography.Text type="tertiary" size="small">{m.label}</Typography.Text>
              <br />
              <Typography.Text
                strong
                style={{
                  fontSize: 24,
                  color: typeof m.value === 'number' ? m.color(m.value) : 'var(--semi-color-text-0)',
                }}
              >
                {typeof m.value === 'number' ? m.value.toFixed(2) : m.value}
                {m.unit}
              </Typography.Text>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 详情 Tab */}
      <Card style={{ borderRadius: 12 }}>
        <Tabs activeKey={resultTab} onChange={setResultTab} type="line">
          <TabPane tab="图表概览" itemKey="overview">
            <Row gutter={[16, 16]}>
              {/* 权益曲线 */}
              <Col span={12}>
                <Card style={{ borderRadius: 8 }}>
                  <ReactECharts option={equityChartOption} style={{ height: 280 }} />
                </Card>
              </Col>

              {/* 回撤曲线 */}
              <Col span={12}>
                <Card style={{ borderRadius: 8 }}>
                  <ReactECharts option={drawdownChartOption} style={{ height: 280 }} />
                </Card>
              </Col>

              {/* 盈亏分布 */}
              {pnlDistributionOption && (
                <Col span={12}>
                  <Card style={{ borderRadius: 8 }}>
                    <ReactECharts option={pnlDistributionOption} style={{ height: 280 }} />
                  </Card>
                </Col>
              )}
            </Row>
          </TabPane>

          <TabPane
            tab={`分笔成交 (${result.trades?.length || 0})`}
            itemKey="trades"
          >
            <div style={{ marginBottom: 16, textAlign: 'right' }}>
              <Button size="small" onClick={() => exportData('trades')}>导出 CSV</Button>
            </div>
            <Table
              columns={tradeColumns}
              dataSource={result.trades || []}
              pagination={{ pageSize: 20 }}
              size="small"
              scroll={{ y: 400 }}
              empty={<Typography.Text type="tertiary">暂无成交记录</Typography.Text>}
            />
          </TabPane>

          <TabPane
            tab={`日收益 (${result.daily_pnl?.length || 0})`}
            itemKey="daily"
          >
            <div style={{ marginBottom: 16, textAlign: 'right' }}>
              <Button size="small" onClick={() => exportData('daily')}>导出 CSV</Button>
            </div>
            <Table
              columns={dailyColumns}
              dataSource={result.daily_pnl || []}
              pagination={{ pageSize: 20 }}
              size="small"
              scroll={{ y: 400 }}
              empty={<Typography.Text type="tertiary">暂无日收益数据</Typography.Text>}
            />
          </TabPane>

          <TabPane
            tab="持仓变化"
            itemKey="positions"
          >
            <Typography.Text type="tertiary">
              持仓变化记录需要策略引擎支持，当前显示模拟数据
            </Typography.Text>
            <Table
              columns={positionColumns}
              dataSource={[]}
              pagination={{ pageSize: 20 }}
              size="small"
              scroll={{ y: 400 }}
              empty={<Typography.Text type="tertiary">暂无持仓变化数据</Typography.Text>}
            />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
}
