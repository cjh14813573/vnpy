import { useState } from 'react';
import {
  Typography,
  Card,
  Button,
  Input,
  Select,
  Row,
  Col,
  Toast,
  Table,
  Tag,
  Progress,
  Form,
  Checkbox,
  Spin,
  Descriptions,
} from '@douyinfe/semi-ui';
import { IconSearch, IconPlay } from '@douyinfe/semi-icons';
import { mlApi } from '../api';

const { Title, Text } = Typography;

interface FeatureStat {
  name: string;
  mean: number;
  std: number;
  min: number;
  max: number;
  median: number;
  target_correlation: number;
}

interface PreviewResult {
  vt_symbol: string;
  interval: string;
  samples_count: number;
  features_count: number;
  target_distribution: Record<string, number>;
  target_config: {
    horizon: number;
    type: string;
  };
  feature_stats: FeatureStat[];
  date_range: {
    start: string;
    end: string;
  };
}

const TECHNICAL_INDICATORS = [
  { label: 'SMA (简单移动平均)', value: 'sma' },
  { label: 'EMA (指数移动平均)', value: 'ema' },
  { label: 'RSI (相对强弱指数)', value: 'rsi' },
  { label: 'MACD (异同移动平均线)', value: 'macd' },
  { label: 'ATR (真实波幅)', value: 'atr' },
  { label: '布林带', value: 'bollinger' },
];

const WINDOW_SIZES = [
  { label: '5', value: 5 },
  { label: '10', value: 10 },
  { label: '20', value: 20 },
  { label: '30', value: 30 },
  { label: '60', value: 60 },
];

export default function FeatureEngineeringPage() {
  const [loading, setLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);

  // 表单状态
  const [formData, setFormData] = useState({
    vt_symbol: 'rb2410.SHFE',
    interval: '1d',
    start: '2023-01-01',
    end: '2024-01-01',
    technical_indicators: ['sma', 'ema', 'rsi', 'macd', 'atr', 'bollinger'],
    window_sizes: [5, 10, 20, 60],
    target_horizon: 5,
    target_type: 'direction',
  });

  const handlePreview = async () => {
    if (!formData.vt_symbol || !formData.start || !formData.end) {
      Toast.error('请填写完整的参数');
      return;
    }

    if (formData.technical_indicators.length === 0) {
      Toast.error('请至少选择一个技术指标');
      return;
    }

    setLoading(true);
    try {
      const res = await mlApi.previewFeatures({
        vt_symbol: formData.vt_symbol,
        interval: formData.interval,
        start: formData.start,
        end: formData.end,
        feature_config: {
          technical_indicators: formData.technical_indicators,
          window_sizes: formData.window_sizes,
          target_horizon: formData.target_horizon,
          target_type: formData.target_type,
        },
      });
      setPreviewResult(res.data);
      Toast.success('特征预览生成成功');
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '特征预览失败');
    } finally {
      setLoading(false);
    }
  };

  const getCorrelationColor = (corr: number) => {
    const abs = Math.abs(corr);
    if (abs >= 0.5) return 'red';
    if (abs >= 0.3) return 'orange';
    if (abs >= 0.1) return 'blue';
    return 'grey';
  };

  const getCorrelationText = (corr: number) => {
    const abs = Math.abs(corr);
    if (abs >= 0.5) return '强相关';
    if (abs >= 0.3) return '中等相关';
    if (abs >= 0.1) return '弱相关';
    return '无关';
  };

  const columns = [
    { title: '特征名称', dataIndex: 'name', width: 180 },
    {
      title: '均值',
      dataIndex: 'mean',
      render: (v: number) => v.toFixed(4),
    },
    {
      title: '标准差',
      dataIndex: 'std',
      render: (v: number) => v.toFixed(4),
    },
    {
      title: '最小值',
      dataIndex: 'min',
      render: (v: number) => v.toFixed(4),
    },
    {
      title: '最大值',
      dataIndex: 'max',
      render: (v: number) => v.toFixed(4),
    },
    {
      title: '中位数',
      dataIndex: 'median',
      render: (v: number) => v.toFixed(4),
    },
    {
      title: '目标相关性',
      dataIndex: 'target_correlation',
      render: (v: number) => (
        <div>
          <Progress
            percent={Math.abs(v) * 100}
            size="small"
            stroke={getCorrelationColor(v)}
            showInfo={false}
            style={{ width: 60, marginRight: 8 }}
          />
          <Tag color={getCorrelationColor(v)} size="small">
            {v.toFixed(3)} ({getCorrelationText(v)})
          </Tag>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title heading={4} style={{ margin: 0 }}>
          特征工程
        </Title>
        <Text type="tertiary">选择技术指标并预览特征与目标变量的相关性</Text>
      </div>

      <Row gutter={16}>
        <Col span={8}>
          <Card title="特征配置" style={{ borderRadius: 12 }}>
            <Form layout="vertical">
              <Form.Label text="合约代码" required>
                <Input
                  value={formData.vt_symbol}
                  onChange={(v) => setFormData({ ...formData, vt_symbol: v })}
                  placeholder="如: rb2410.SHFE"
                />
              </Form.Label>

              <Row gutter={8}>
                <Col span={12}>
                  <Form.Label text="周期">
                    <Select
                      value={formData.interval}
                      onChange={(v) => setFormData({ ...formData, interval: v as string })}
                      style={{ width: '100%' }}
                      optionList={[
                        { value: '1m', label: '1分钟' },
                        { value: '5m', label: '5分钟' },
                        { value: '15m', label: '15分钟' },
                        { value: '1h', label: '1小时' },
                        { value: '1d', label: '日线' },
                      ]}
                    />
                  </Form.Label>
                </Col>
                <Col span={12}>
                  <Form.Label text="预测周期">
                    <Input
                      type="number"
                      value={formData.target_horizon}
                      onChange={(v) =>
                        setFormData({ ...formData, target_horizon: parseInt(v) || 5 })
                      }
                      suffix="期"
                    />
                  </Form.Label>
                </Col>
              </Row>

              <Row gutter={8}>
                <Col span={12}>
                  <Form.Label text="开始日期" required>
                    <Input
                      type="date"
                      value={formData.start}
                      onChange={(v) => setFormData({ ...formData, start: v })}
                    />
                  </Form.Label>
                </Col>
                <Col span={12}>
                  <Form.Label text="结束日期" required>
                    <Input
                      type="date"
                      value={formData.end}
                      onChange={(v) => setFormData({ ...formData, end: v })}
                    />
                  </Form.Label>
                </Col>
              </Row>

              <Form.Label text="技术指标">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {TECHNICAL_INDICATORS.map((indicator) => (
                    <Checkbox
                      key={indicator.value}
                      checked={formData.technical_indicators.includes(indicator.value)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormData({
                          ...formData,
                          technical_indicators: checked
                            ? [...formData.technical_indicators, indicator.value]
                            : formData.technical_indicators.filter((i) => i !== indicator.value),
                        });
                      }}
                    >
                      {indicator.label}
                    </Checkbox>
                  ))}
                </div>
              </Form.Label>

              <Form.Label text="窗口大小">
                <Select
                  multiple
                  value={formData.window_sizes}
                  onChange={(v) => setFormData({ ...formData, window_sizes: v as number[] })}
                  style={{ width: '100%' }}
                  optionList={WINDOW_SIZES}
                />
              </Form.Label>

              <Form.Label text="目标变量类型">
                <Select
                  value={formData.target_type}
                  onChange={(v) => setFormData({ ...formData, target_type: v as string })}
                  style={{ width: '100%' }}
                  optionList={[
                    { value: 'direction', label: '未来N期方向 (涨跌)' },
                    { value: 'return', label: '未来N期收益率' },
                  ]}
                />
              </Form.Label>

              <Button
                theme="solid"
                icon={<IconSearch />}
                loading={loading}
                onClick={handlePreview}
                style={{ marginTop: 16 }}
                block
              >
                生成特征预览
              </Button>
            </Form>
          </Card>
        </Col>

        <Col span={16}>
          <Spin spinning={loading}>
            {previewResult ? (
              <>
                <Card style={{ borderRadius: 12, marginBottom: 16 }}>
                  <Descriptions row>
                    <Descriptions.Item itemKey="合约">
                      {previewResult.vt_symbol}
                    </Descriptions.Item>
                    <Descriptions.Item itemKey="周期">
                      {previewResult.interval}
                    </Descriptions.Item>
                    <Descriptions.Item itemKey="样本数">
                      {previewResult.samples_count}
                    </Descriptions.Item>
                    <Descriptions.Item itemKey="特征数">
                      {previewResult.features_count}
                    </Descriptions.Item>
                    <Descriptions.Item itemKey="预测周期">
                      {previewResult.target_config.horizon}期
                    </Descriptions.Item>
                    <Descriptions.Item itemKey="日期范围">
                      {previewResult.date_range.start} ~ {previewResult.date_range.end}
                    </Descriptions.Item>
                  </Descriptions>

                  <div style={{ marginTop: 16 }}>
                    <Text strong>目标分布: </Text>
                    {Object.entries(previewResult.target_distribution).map(([key, value]) => (
                      <Tag key={key} color={key === '1' ? 'green' : 'red'} style={{ marginLeft: 8 }}>
                        {key === '1' ? '涨' : '跌'}: {value}
                      </Tag>
                    ))}
                  </div>
                </Card>

                <Card title="特征统计与相关性" style={{ borderRadius: 12 }}>
                  <Table
                    columns={columns}
                    dataSource={previewResult.feature_stats}
                    pagination={{ pageSize: 15 }}
                    size="small"
                  />
                </Card>
              </>
            ) : (
              <Card style={{ borderRadius: 12, textAlign: 'center', padding: '60px 0' }}>
                <IconSearch style={{ fontSize: 48, color: '#d9d9d9' }} />
                <Text type="tertiary" style={{ display: 'block', marginTop: 16 }}>
                  配置参数并点击"生成特征预览"查看结果
                </Text>
              </Card>
            )}
          </Spin>
        </Col>
      </Row>
    </div>
  );
}
