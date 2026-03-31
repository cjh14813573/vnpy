import { useEffect, useState, useMemo } from 'react';
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
  Progress,
  Descriptions,
  Tabs,
  Modal,
  Form,
  Input,
  Select,
  Spin,
  Empty,
  Switch,
} from '@douyinfe/semi-ui';
import {
  IconRefresh,
  IconAlertTriangle,
  IconShield,
} from '@douyinfe/semi-icons';
import { riskApi } from '../api';
import ReactECharts from 'echarts-for-react';

const { Title, Text } = Typography;

interface ExposureData {
  exposures: {
    vt_symbol: string;
    direction: string;
    volume: number;
    price: number;
    notional: number;
    margin: number;
    pnl: number;
    margin_ratio: number;
  }[];
  summary: {
    total_exposure: number;
    net_exposure: number;
    long_exposure: number;
    short_exposure: number;
    total_margin: number;
    total_pnl: number;
    account_balance: number;
    margin_ratio: number;
    var_95: number;
    var_99: number;
    concentration_risk: number;
    position_count: number;
  };
  timestamp: string;
}

interface TriggerConfig {
  enabled: boolean;
  threshold: number;
  action: string;
}

interface TriggerStatus {
  status: 'safe' | 'warning' | 'danger';
  triggered_rules: {
    trigger: string;
    severity: 'high' | 'medium' | 'low';
    message: string;
    action: string;
    current_value: number;
    threshold: number;
  }[];
  trigger_count: number;
}

export default function RiskExposurePage() {
  const [exposureData, setExposureData] = useState<ExposureData | null>(null);
  const [triggerStatus, setTriggerStatus] = useState<TriggerStatus | null>(null);
  const [triggerConfigs, setTriggerConfigs] = useState<Record<string, TriggerConfig>>({});
  const [triggerEvents, setTriggerEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showExecuteModal, setShowExecuteModal] = useState(false);
  const [executeAction, setExecuteAction] = useState({
    action: 'alert',
    target: 'all',
    reason: '',
    ratio: 0.5,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [exposureRes, triggerRes, configRes, eventsRes] = await Promise.all([
        riskApi.getRiskExposure(),
        riskApi.getRiskTriggerStatus(),
        riskApi.getRiskTriggers(),
        riskApi.getTriggerEvents(20),
      ]);
      setExposureData(exposureRes.data);
      setTriggerStatus(triggerRes.data);
      setTriggerConfigs(configRes.data);
      setTriggerEvents(eventsRes.data || []);
    } catch (err: any) {
      Toast.error('加载风控数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // 每5秒刷新
    return () => clearInterval(interval);
  }, []);

  const handleExecuteAction = async () => {
    try {
      await riskApi.executeRiskAction(executeAction);
      Toast.success('风控操作已执行');
      setShowExecuteModal(false);
      loadData();
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '执行失败');
    }
  };

  const handleUpdateTrigger = async (name: string, config: Partial<TriggerConfig>) => {
    try {
      await riskApi.updateRiskTrigger(name, config);
      Toast.success('配置已更新');
      loadData();
    } catch (err: any) {
      Toast.error('更新失败');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'safe':
        return 'green';
      case 'warning':
        return 'orange';
      case 'danger':
        return 'red';
      default:
        return 'grey';
    }
  };

  const exposureColumns = [
    {
      title: '合约',
      dataIndex: 'vt_symbol',
      width: 150,
    },
    {
      title: '方向',
      dataIndex: 'direction',
      render: (v: string) => (
        <Tag color={v === 'long' ? 'green' : 'red'}>{v === 'long' ? '多' : '空'}</Tag>
      ),
      width: 80,
    },
    { title: '数量', dataIndex: 'volume', width: 100 },
    {
      title: '价格',
      dataIndex: 'price',
      render: (v: number) => v.toFixed(2),
      width: 100,
    },
    {
      title: '名义价值',
      dataIndex: 'notional',
      render: (v: number) => (v / 10000).toFixed(2) + '万',
      width: 120,
    },
    {
      title: '保证金',
      dataIndex: 'margin',
      render: (v: number) => (v / 10000).toFixed(2) + '万',
      width: 120,
    },
    {
      title: '盈亏',
      dataIndex: 'pnl',
      render: (v: number) => (
        <span style={{ color: v >= 0 ? '#52c41a' : '#f5222d' }}>
          {v >= 0 ? '+' : ''}
          {v.toFixed(2)}
        </span>
      ),
      width: 120,
    },
    {
      title: '保证金占比',
      dataIndex: 'margin_ratio',
      render: (v: number) => (
        <Progress
          percent={v}
          size="small"
          stroke={v > 30 ? '#f5222d' : v > 15 ? '#fa8c16' : '#52c41a'}
          showInfo
        />
      ),
      width: 150,
    },
  ];

  const gaugeOption = useMemo(() => {
    if (!exposureData) return {};
    const ratio = exposureData.summary.margin_ratio;

    return {
      series: [
        {
          type: 'gauge',
          startAngle: 180,
          endAngle: 0,
          min: 0,
          max: 100,
          splitNumber: 10,
          itemStyle: {
            color: ratio > 80 ? '#f5222d' : ratio > 50 ? '#fa8c16' : '#52c41a',
          },
          progress: {
            show: true,
            width: 20,
          },
          pointer: { show: false },
          axisLine: { lineStyle: { width: 20 } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          title: { show: true, offsetCenter: [0, '-20%'], fontSize: 14 },
          detail: {
            valueAnimation: true,
            fontSize: 36,
            offsetCenter: [0, '0%'],
            formatter: '{value}%',
          },
          data: [{ value: ratio.toFixed(1), name: '保证金使用率' }],
        },
      ],
    };
  }, [exposureData]);

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title heading={4} style={{ margin: 0 }}>
            <IconShield style={{ marginRight: 8 }} />
            风险敞口监控
          </Title>
          <Text type="tertiary">实时监控组合风险，自动风控预警</Text>
        </div>
        <Space>
          {triggerStatus && (
            <Tag
              color={getStatusColor(triggerStatus.status) as any}
            >
              {triggerStatus.status === 'safe'
                ? '风险正常'
                : triggerStatus.status === 'warning'
                ? '风险警告'
                : '风险危险'}
            </Tag>
          )}
          <Button icon={<IconRefresh />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          {triggerStatus?.status === 'danger' && (
            <Button
              theme="solid"
              type="danger"
              icon={<IconAlertTriangle />}
              onClick={() => setShowExecuteModal(true)}
            >
              执行风控操作
            </Button>
          )}
        </Space>
      </div>

      <Tabs type="line" key="risk-exposure-tabs">
        <Tabs.TabPane tab="风险概览" itemKey="overview" key="overview-pane">
          <Spin spinning={loading}>
            {exposureData ? (
              <>
                {/* 关键指标卡片 */}
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                  <Col span={6}>
                    <Card style={{ borderRadius: 12 }}>
                      <ReactECharts option={gaugeOption} style={{ height: 200 }} />
                    </Card>
                  </Col>
                  <Col span={18}>
                    <Row gutter={[16, 16]}>
                      <Col span={8}>
                        <Card style={{ borderRadius: 12 }}>
                          <div>
                            <Text type="tertiary">总敞口</Text>
                            <div style={{ fontSize: 24, fontWeight: 600 }}>
                              {(exposureData.summary.total_exposure / 10000).toFixed(2)}万
                            </div>
                          </div>
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card style={{ borderRadius: 12 }}>
                          <div>
                            <Text type="tertiary">净敞口</Text>
                            <div style={{
                              fontSize: 24,
                              fontWeight: 600,
                              color: exposureData.summary.net_exposure >= 0 ? '#52c41a' : '#f5222d'
                            }}>
                              {(exposureData.summary.net_exposure / 10000).toFixed(2)}万
                            </div>
                          </div>
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card style={{ borderRadius: 12 }}>
                          <div>
                            <Text type="tertiary">总盈亏</Text>
                            <div style={{
                              fontSize: 24,
                              fontWeight: 600,
                              color: exposureData.summary.total_pnl >= 0 ? '#52c41a' : '#f5222d'
                            }}>
                              {exposureData.summary.total_pnl.toFixed(2)}
                            </div>
                          </div>
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card style={{ borderRadius: 12 }}>
                          <div>
                            <Text type="tertiary">多头敞口</Text>
                            <div style={{ fontSize: 24, fontWeight: 600 }}>
                              {(exposureData.summary.long_exposure / 10000).toFixed(2)}万
                            </div>
                          </div>
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card style={{ borderRadius: 12 }}>
                          <div>
                            <Text type="tertiary">空头敞口</Text>
                            <div style={{ fontSize: 24, fontWeight: 600 }}>
                              {(exposureData.summary.short_exposure / 10000).toFixed(2)}万
                            </div>
                          </div>
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card style={{ borderRadius: 12 }}>
                          <div>
                            <Text type="tertiary">集中度风险</Text>
                            <div style={{
                              fontSize: 24,
                              fontWeight: 600,
                              color: exposureData.summary.concentration_risk > 30 ? '#f5222d' : '#52c41a'
                            }}>
                              {exposureData.summary.concentration_risk.toFixed(1)}%
                            </div>
                          </div>
                        </Card>
                      </Col>
                    </Row>
                  </Col>
                </Row>

                {/* VaR 指标 */}
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                  <Col span={12}>
                    <Card title="风险价值 (VaR)" style={{ borderRadius: 12 }}>
                      <Row gutter={16}>
                        <Col span={12}>
                          <div>
                            <Text type="tertiary">VaR (95%)</Text>
                            <div style={{ fontSize: 24, fontWeight: 600, color: '#fa8c16' }}>
                              {(exposureData.summary.var_95 / 10000).toFixed(2)}万
                            </div>
                          </div>
                          <Text type="tertiary" size="small">
                            95%置信度下的日最大损失
                          </Text>
                        </Col>
                        <Col span={12}>
                          <div>
                            <Text type="tertiary">VaR (99%)</Text>
                            <div style={{ fontSize: 24, fontWeight: 600, color: '#f5222d' }}>
                              {(exposureData.summary.var_99 / 10000).toFixed(2)}万
                            </div>
                          </div>
                          <Text type="tertiary" size="small">
                            99%置信度下的极端损失
                          </Text>
                        </Col>
                      </Row>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card title="账户信息" style={{ borderRadius: 12 }}>
                      <Descriptions>
                        <Descriptions.Item itemKey="账户权益">
                          {(exposureData.summary.account_balance / 10000).toFixed(2)} 万
                        </Descriptions.Item>
                        <Descriptions.Item itemKey="已用保证金">
                          {(exposureData.summary.total_margin / 10000).toFixed(2)} 万
                        </Descriptions.Item>
                        <Descriptions.Item itemKey="持仓数量">
                          {exposureData.summary.position_count} 个
                        </Descriptions.Item>
                      </Descriptions>
                    </Card>
                  </Col>
                </Row>

                {/* 持仓明细 */}
                <Card title="持仓风险明细" style={{ borderRadius: 12 }}>
                  <Table
                    columns={exposureColumns}
                    dataSource={exposureData.exposures}
                    pagination={{ pageSize: 10 }}
                    size="small"
                  />
                </Card>
              </>
            ) : (
              <Empty description="暂无风险数据" />
            )}
          </Spin>
        </Tabs.TabPane>

        <Tabs.TabPane tab="风控触发器" itemKey="triggers" key="triggers-pane">
          <Row gutter={[16, 16]}>
            <Col span={16}>
              <Card title="触发器配置" style={{ borderRadius: 12 }}>
                {Object.entries(triggerConfigs).map(([name, config]) => (
                  <div
                    key={name}
                    style={{
                      padding: '16px 0',
                      borderBottom: '1px solid var(--semi-color-border)',
                    }}
                  >
                    <Row align="middle">
                      <Col span={6}>
                        <Text strong>
                          {name === 'margin_call' && '保证金预警'}
                          {name === 'daily_loss_limit' && '日亏损限制'}
                          {name === 'var_limit' && 'VaR限制'}
                          {name === 'concentration_limit' && '集中度限制'}
                        </Text>
                      </Col>
                      <Col span={6}>
                        <Space>
                          <span>启用</span>
                          <Switch
                            checked={config.enabled}
                            onChange={(v) => handleUpdateTrigger(name, { enabled: v })}
                          />
                        </Space>
                      </Col>
                      <Col span={6}>
                        <Input
                          prefix="阈值:"
                          value={config.threshold}
                          onChange={(v) => handleUpdateTrigger(name, { threshold: parseFloat(v) })}
                          style={{ width: 120 }}
                        />
                      </Col>
                      <Col span={6}>
                        <Select
                          value={config.action}
                          onChange={(v) => handleUpdateTrigger(name, { action: v as string })}
                          style={{ width: 120 }}
                          optionList={[
                            { value: 'alert', label: '仅警告' },
                            { value: 'reduce_position', label: '减仓' },
                            { value: 'close_all', label: '全平仓' },
                          ]}
                        />
                      </Col>
                    </Row>
                  </div>
                ))}
              </Card>
            </Col>

            <Col span={8}>
              <Card title="触发事件历史" style={{ borderRadius: 12 }}>
                {triggerEvents.length === 0 ? (
                  <Empty description="暂无触发记录" />
                ) : (
                  <div style={{ maxHeight: 400, overflow: 'auto' }}>
                    {triggerEvents.map((event, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: 12,
                          borderBottom: '1px solid var(--semi-color-border)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Tag
                            color={
                              event.action === 'close_all'
                                ? 'red'
                                : event.action === 'reduce_position'
                                ? 'orange'
                                : 'blue'
                            }
                          >
                            {event.action}
                          </Tag>
                          <Text type="tertiary" size="small">
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </Text>
                        </div>
                        <Text size="small" style={{ marginTop: 4, display: 'block' }}>
                          {event.reason}
                        </Text>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </Col>
          </Row>
        </Tabs.TabPane>
      </Tabs>

      {/* 执行风控操作弹窗 */}
      <Modal
        title="执行风控操作"
        visible={showExecuteModal}
        onCancel={() => setShowExecuteModal(false)}
        onOk={handleExecuteAction}
      >
        <Form layout="vertical">
          <Form.Label text="操作类型" required>
            <Select
              value={executeAction.action}
              onChange={(v) => setExecuteAction({ ...executeAction, action: v as string })}
              style={{ width: '100%' }}
              optionList={[
                { value: 'alert', label: '仅发送警告' },
                { value: 'reduce_position', label: '减仓' },
                { value: 'close_all', label: '全仓平仓' },
              ]}
            />
          </Form.Label>
          {executeAction.action === 'reduce_position' && (
            <Form.Label text="减仓比例">
              <Input
                type="number"
                value={executeAction.ratio}
                onChange={(v) =>
                  setExecuteAction({ ...executeAction, ratio: parseFloat(v) })
                }
                min={0.1}
                max={1}
                step={0.1}
                suffix="%"
              />
            </Form.Label>
          )}
          <Form.Label text="操作原因">
            <Input
              value={executeAction.reason}
              onChange={(v) => setExecuteAction({ ...executeAction, reason: v })}
              placeholder="输入风控操作原因"
            />
          </Form.Label>
        </Form>
      </Modal>
    </div>
  );
}
