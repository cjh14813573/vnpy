import { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Button,
  Table,
  Tag,
  Toast,
  Space,
  Row,
  Col,
  Select,
  Modal,
  Form,
  Input,
  Tabs,
  Descriptions,
  Spin,
  Empty,
  Badge,
} from '@douyinfe/semi-ui';
import { IconPlus, IconRefresh, IconPlay, IconHistogram } from '@douyinfe/semi-icons';
import { mlApi } from '../api';
import ReactECharts from 'echarts-for-react';

const { Title, Text } = Typography;

interface ModelInfo {
  name: string;
  model_type: string;
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    auc?: number;
  };
  composite_score: number;
  top_features: string[];
  feature_count: number;
  created_at: string;
}

interface ComparisonResult {
  models: ModelInfo[];
  rankings: Record<string, { name: string; value: number }[]>;
  best_model: string;
  model_count: number;
}

interface BacktestResult {
  model_name: string;
  vt_symbol: string;
  initial_capital: number;
  final_equity: number;
  total_return: number;
  total_return_pct: number;
  max_drawdown: number;
  max_drawdown_pct: number;
  trade_count: number;
  win_count: number;
  loss_count: number;
  win_rate: number;
  win_rate_pct: number;
  trades: any[];
  equity_curve: { date: string; equity: number }[];
  daily_pnl: { date: string; pnl: number }[];
}

export default function MLModelComparisonPage() {
  const [models, setModels] = useState<{ name: string }[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showBacktestModal, setShowBacktestModal] = useState(false);
  const [activeTab, setActiveTab] = useState('comparison');

  const [backtestForm, setBacktestForm] = useState({
    model_name: '',
    vt_symbol: 'rb2410.SHFE',
    interval: '1d',
    start: '2023-01-01',
    end: '2024-01-01',
    initial_capital: 1000000,
    position_size: 0.1,
  });

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      const res = await mlApi.listModels();
      setModels(res.data || []);
    } catch (err: any) {
      Toast.error('加载模型列表失败');
    }
  };

  const handleCompare = async () => {
    if (selectedModels.length < 2) {
      Toast.error('请至少选择2个模型进行对比');
      return;
    }

    setLoading(true);
    try {
      const res = await mlApi.compareModels(selectedModels);
      setComparisonResult(res.data);
      setActiveTab('comparison');
      Toast.success('对比完成');
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '对比失败');
    } finally {
      setLoading(false);
    }
  };

  const handleBacktest = async () => {
    if (!backtestForm.model_name) {
      Toast.error('请选择模型');
      return;
    }

    setLoading(true);
    try {
      const res = await mlApi.runMLBacktest(backtestForm);
      setBacktestResult(res.data);
      setShowBacktestModal(false);
      setActiveTab('backtest');
      Toast.success('回测完成');
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '回测失败');
    } finally {
      setLoading(false);
    }
  };

  const getRankingBadge = (modelName: string, ranking: { name: string; value: number }[]) => {
    const rank = ranking.findIndex((r) => r.name === modelName);
    if (rank === 0) return <Badge count="1st" style={{ backgroundColor: '#52c41a' }} />;
    if (rank === 1) return <Badge count="2nd" style={{ backgroundColor: '#1890ff' }} />;
    if (rank === 2) return <Badge count="3rd" style={{ backgroundColor: '#faad14' }} />;
    return null;
  };

  const comparisonColumns = [
    { title: '模型名称', dataIndex: 'name', width: 150 },
    { title: '类型', dataIndex: 'model_type', width: 120 },
    {
      title: '综合评分',
      dataIndex: 'composite_score',
      render: (v: number) => <Tag color="blue">{(v * 100).toFixed(1)}</Tag>,
      sorter: (a: ModelInfo, b: ModelInfo) => a.composite_score - b.composite_score,
    },
    {
      title: '准确率',
      dataIndex: 'metrics',
      render: (m: any) => `${(m.accuracy * 100).toFixed(1)}%`,
    },
    {
      title: '精确率',
      dataIndex: 'metrics',
      render: (m: any) => `${(m.precision * 100).toFixed(1)}%`,
    },
    {
      title: '召回率',
      dataIndex: 'metrics',
      render: (m: any) => `${(m.recall * 100).toFixed(1)}%`,
    },
    {
      title: 'F1分数',
      dataIndex: 'metrics',
      render: (m: any) => m.f1.toFixed(3),
    },
    {
      title: 'AUC',
      dataIndex: 'metrics',
      render: (m: any) => (m.auc ? m.auc.toFixed(3) : '-'),
    },
    {
      title: '特征数',
      dataIndex: 'feature_count',
      width: 80,
    },
    {
      title: 'Top特征',
      dataIndex: 'top_features',
      render: (features: string[]) => (
        <Space wrap>
          {features.slice(0, 3).map((f) => (
            <Tag key={f} size="small">
              {f}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '操作',
      render: (_: any, record: ModelInfo) => (
        <Button
          size="small"
          icon={<IconPlay />}
          onClick={() => {
            setBacktestForm((prev) => ({ ...prev, model_name: record.name }));
            setShowBacktestModal(true);
          }}
        >
          回测
        </Button>
      ),
    },
  ];

  const getRadarOption = () => {
    if (!comparisonResult) return {};

    const indicators = [
      { name: '准确率', max: 1 },
      { name: '精确率', max: 1 },
      { name: '召回率', max: 1 },
      { name: 'F1分数', max: 1 },
      { name: 'AUC', max: 1 },
    ];

    const seriesData = comparisonResult.models.map((m) => ({
      value: [
        m.metrics.accuracy,
        m.metrics.precision,
        m.metrics.recall,
        m.metrics.f1,
        m.metrics.auc || 0,
      ],
      name: m.name,
    }));

    return {
      title: { text: '模型性能雷达图', left: 'center' },
      tooltip: {},
      legend: { bottom: 0, data: comparisonResult.models.map((m) => m.name) },
      radar: {
        indicator: indicators,
        center: ['50%', '50%'],
        radius: '60%',
      },
      series: [
        {
          type: 'radar',
          data: seriesData,
          areaStyle: { opacity: 0.2 },
        },
      ],
    };
  };

  const getBarOption = () => {
    if (!comparisonResult) return {};

    const models = comparisonResult.models;
    const metrics = ['accuracy', 'precision', 'recall', 'f1'];

    return {
      title: { text: '指标对比', left: 'center' },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { bottom: 0, data: metrics.map((m) => m.toUpperCase()) },
      xAxis: {
        type: 'category',
        data: models.map((m) => m.name),
      },
      yAxis: { type: 'value', min: 0, max: 1 },
      series: metrics.map((metric) => ({
        name: metric.toUpperCase(),
        type: 'bar',
        data: models.map((m) => m.metrics[metric as keyof typeof m.metrics]),
      })),
    };
  };

  const getEquityCurveOption = () => {
    if (!backtestResult) return {};

    return {
      title: { text: '权益曲线', left: 'center' },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: backtestResult.equity_curve.map((p) => p.date),
      },
      yAxis: { type: 'value' },
      series: [
        {
          name: '权益',
          type: 'line',
          data: backtestResult.equity_curve.map((p) => p.equity),
          smooth: true,
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(84, 112, 198, 0.3)' },
                { offset: 1, color: 'rgba(84, 112, 198, 0.05)' },
              ],
            },
          },
        },
      ],
    };
  };

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title heading={4} style={{ margin: 0 }}>
            模型对比与回测
          </Title>
          <Text type="tertiary">对比多个模型性能，运行ML信号回测</Text>
        </div>
        <Space>
          <Button icon={<IconRefresh />} onClick={loadModels}>
            刷新
          </Button>
          <Button
            theme="solid"
            icon={<IconHistogram />}
            onClick={() => {
              setSelectedModels([]);
              setComparisonResult(null);
            }}
          >
            重置
          </Button>
        </Space>
      </div>

      {/* 模型选择 */}
      <Card style={{ borderRadius: 12, marginBottom: 16 }}>
        <Form layout="horizontal">
          <Form.Label text="选择模型进行对比（至少2个）">
            <Select
              multiple
              value={selectedModels}
              onChange={(v) => setSelectedModels(v as string[])}
              style={{ width: 400 }}
              placeholder="选择要对比的模型"
              optionList={models.map((m) => ({ value: m.name, label: m.name }))}
            />
            <Button
              theme="solid"
              icon={<IconPlus />}
              onClick={handleCompare}
              disabled={selectedModels.length < 2}
              style={{ marginLeft: 12 }}
              loading={loading}
            >
              开始对比
            </Button>
          </Form.Label>
        </Form>
      </Card>

      {/* 结果展示 */}
      <Tabs activeKey={activeTab} onChange={setActiveTab} key="ml-compare-tabs">
        <Tabs.TabPane tab="模型对比" itemKey="comparison" key="comparison-pane">
          {comparisonResult ? (
            <Spin spinning={loading}>
              {/* 最佳模型 */}
              <Card style={{ borderRadius: 12, marginBottom: 16, background: 'var(--semi-color-success-light-default)' }}>
                <Row align="middle">
                  <Col span={16}>
                    <Title heading={5} style={{ margin: 0 }}>
                      🏆 最佳模型: {comparisonResult.best_model}
                    </Title>
                    <Text>综合评分最高，推荐用于实盘交易</Text>
                  </Col>
                  <Col span={8} style={{ textAlign: 'right' }}>
                    <Button
                      theme="solid"
                      icon={<IconPlay />}
                      onClick={() => {
                        setBacktestForm((prev) => ({ ...prev, model_name: comparisonResult.best_model }));
                        setShowBacktestModal(true);
                      }}
                    >
                      运行回测
                    </Button>
                  </Col>
                </Row>
              </Card>

              {/* 图表 */}
              <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col span={12}>
                  <Card style={{ borderRadius: 12 }}>
                    <ReactECharts option={getRadarOption()} style={{ height: 350 }} />
                  </Card>
                </Col>
                <Col span={12}>
                  <Card style={{ borderRadius: 12 }}>
                    <ReactECharts option={getBarOption()} style={{ height: 350 }} />
                  </Card>
                </Col>
              </Row>

              {/* 对比表格 */}
              <Card title="详细对比" style={{ borderRadius: 12 }}>
                <Table
                  columns={comparisonColumns}
                  dataSource={comparisonResult.models}
                  pagination={false}
                  rowKey="name"
                />
              </Card>
            </Spin>
          ) : (
            <Empty description="请选择模型并点击开始对比" />
          )}
        </Tabs.TabPane>

        <Tabs.TabPane tab="回测结果" itemKey="backtest" key="backtest-pane">
          {backtestResult ? (
            <Spin spinning={loading}>
              {/* 回测指标 */}
              <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col span={4}>
                  <Card style={{ textAlign: 'center', borderRadius: 8 }}>
                    <Text type="tertiary">总收益率</Text>
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 'bold',
                        color: backtestResult.total_return >= 0 ? '#52c41a' : '#f5222d',
                      }}
                    >
                      {backtestResult.total_return_pct}%
                    </div>
                  </Card>
                </Col>
                <Col span={4}>
                  <Card style={{ textAlign: 'center', borderRadius: 8 }}>
                    <Text type="tertiary">最大回撤</Text>
                    <div style={{ fontSize: 24, fontWeight: 'bold', color: '#fa8c16' }}>
                      {backtestResult.max_drawdown_pct}%
                    </div>
                  </Card>
                </Col>
                <Col span={4}>
                  <Card style={{ textAlign: 'center', borderRadius: 8 }}>
                    <Text type="tertiary">交易次数</Text>
                    <div style={{ fontSize: 24, fontWeight: 'bold' }}>{backtestResult.trade_count}</div>
                  </Card>
                </Col>
                <Col span={4}>
                  <Card style={{ textAlign: 'center', borderRadius: 8 }}>
                    <Text type="tertiary">胜率</Text>
                    <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>
                      {backtestResult.win_rate_pct}%
                    </div>
                  </Card>
                </Col>
                <Col span={4}>
                  <Card style={{ textAlign: 'center', borderRadius: 8 }}>
                    <Text type="tertiary">盈利次数</Text>
                    <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
                      {backtestResult.win_count}
                    </div>
                  </Card>
                </Col>
                <Col span={4}>
                  <Card style={{ textAlign: 'center', borderRadius: 8 }}>
                    <Text type="tertiary">亏损次数</Text>
                    <div style={{ fontSize: 24, fontWeight: 'bold', color: '#f5222d' }}>
                      {backtestResult.loss_count}
                    </div>
                  </Card>
                </Col>
              </Row>

              {/* 权益曲线 */}
              <Card title="权益曲线" style={{ borderRadius: 12, marginBottom: 16 }}>
                <ReactECharts option={getEquityCurveOption()} style={{ height: 400 }} />
              </Card>

              {/* 交易明细 */}
              <Card title="交易明细" style={{ borderRadius: 12 }}>
                <Table
                  columns={[
                    { title: '日期', dataIndex: 'date' },
                    { title: '操作', dataIndex: 'action' },
                    { title: '价格', dataIndex: 'price', render: (v: number) => v?.toFixed(2) },
                    { title: '数量', dataIndex: 'size' },
                    {
                      title: '盈亏',
                      dataIndex: 'pnl',
                      render: (v?: number) =>
                        v !== undefined ? (
                          <Tag color={v >= 0 ? 'green' : 'red'}>{v >= 0 ? '+' : ''}{v.toFixed(2)}</Tag>
                        ) : (
                          '-'
                        ),
                    },
                    {
                      title: '置信度',
                      dataIndex: 'confidence',
                      render: (v?: number) => (v !== undefined ? `${(v * 100).toFixed(1)}%` : '-'),
                    },
                  ]}
                  dataSource={backtestResult.trades}
                  pagination={{ pageSize: 10 }}
                />
              </Card>
            </Spin>
          ) : (
            <Empty description="请先运行回测" />
          )}
        </Tabs.TabPane>
      </Tabs>

      {/* 回测弹窗 */}
      <Modal
        title="运行 ML 信号回测"
        visible={showBacktestModal}
        onCancel={() => setShowBacktestModal(false)}
        onOk={handleBacktest}
        confirmLoading={loading}
      >
        <Form layout="vertical">
          <Form.Label text="选择模型" required>
            <Select
              value={backtestForm.model_name}
              onChange={(v) => setBacktestForm((prev) => ({ ...prev, model_name: v as string }))}
              placeholder="选择模型"
              style={{ width: '100%' }}
              optionList={models.map((m) => ({ value: m.name, label: m.name }))}
            />
          </Form.Label>
          <Form.Label text="合约代码" required>
            <Input
              value={backtestForm.vt_symbol}
              onChange={(v) => setBacktestForm((prev) => ({ ...prev, vt_symbol: v }))}
              placeholder="如: rb2410.SHFE"
            />
          </Form.Label>
          <Row gutter={8}>
            <Col span={12}>
              <Form.Label text="开始日期" required>
                <Input
                  type="date"
                  value={backtestForm.start}
                  onChange={(v) => setBacktestForm((prev) => ({ ...prev, start: v }))}
                />
              </Form.Label>
            </Col>
            <Col span={12}>
              <Form.Label text="结束日期" required>
                <Input
                  type="date"
                  value={backtestForm.end}
                  onChange={(v) => setBacktestForm((prev) => ({ ...prev, end: v }))}
                />
              </Form.Label>
            </Col>
          </Row>
          <Row gutter={8}>
            <Col span={12}>
              <Form.Label text="初始资金">
                <Input
                  type="number"
                  value={backtestForm.initial_capital}
                  onChange={(v) => setBacktestForm((prev) => ({ ...prev, initial_capital: parseInt(v) || 1000000 }))}
                />
              </Form.Label>
            </Col>
            <Col span={12}>
              <Form.Label text="仓位比例">
                <Input
                  type="number"
                  value={backtestForm.position_size}
                  onChange={(v) => setBacktestForm((prev) => ({ ...prev, position_size: parseFloat(v) || 0.1 }))}
                  step={0.05}
                  min={0.05}
                  max={1}
                />
              </Form.Label>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
