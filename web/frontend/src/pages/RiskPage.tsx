import { useEffect, useState, useCallback } from 'react';
import { Typography, Card, Switch, Input, Button, Toast, Row, Col, Space, Tag, Table, Empty, Spin, Badge, Tabs } from '@douyinfe/semi-ui';
import { IconRefresh, IconShield, IconActivity, IconClock } from '@douyinfe/semi-icons';
import { riskApi, API_BASE_URL } from '../api';

interface RiskRule {
  name: string;
  description: string;
  enabled: boolean;
  limit?: number;
  window?: number;
  allowed_hours?: string[];
}

interface RiskEvent {
  timestamp: string;
  rule_name: string;
  message: string;
  severity: 'warning' | 'error' | 'info';
}

interface OrderFlowRecord {
  id: string;
  timestamp: string;
  vt_symbol: string;
  direction: string;
  offset: string;
  price: number;
  volume: number;
  status: 'passed' | 'blocked' | 'pending';
  reason?: string;
  checked_rules?: string[];
}

interface OrderFlowStats {
  total: number;
  last_minute: number;
  last_hour: number;
  passed: number;
  blocked: number;
  pending: number;
}

export default function RiskPage() {
  const [rules, setRules] = useState<RiskRule[]>([]);
  const [events, setEvents] = useState<RiskEvent[]>([]);
  const [status, setStatus] = useState<{ enabled: boolean; total_events: number; active_rules: number; total_rules: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingLimits, setEditingLimits] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('rules');

  // 订单流监控状态
  const [orderFlow, setOrderFlow] = useState<OrderFlowRecord[]>([]);
  const [orderFlowStats, setOrderFlowStats] = useState<OrderFlowStats | null>(null);
  const [orderFlowWs, setOrderFlowWs] = useState<WebSocket | null>(null);
  const [orderFlowStatus, setOrderFlowStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');

  const load = async () => {
    setLoading(true);
    try {
      const [rulesRes, eventsRes, statusRes] = await Promise.all([
        riskApi.rules(),
        riskApi.events(20),
        riskApi.status(),
      ]);
      setRules(rulesRes.data || []);
      setEvents(eventsRes.data || []);
      setStatus(statusRes.data);

      // 初始化编辑状态
      const limits: Record<string, string> = {};
      (rulesRes.data || []).forEach((rule: RiskRule) => {
        if (rule.limit !== undefined) {
          limits[rule.name] = String(rule.limit);
        }
      });
      setEditingLimits(limits);
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '加载风控数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadOrderFlow = async () => {
    try {
      const [flowRes, statsRes] = await Promise.all([
        riskApi.orderFlow(50),
        riskApi.orderFlowStats(),
      ]);
      setOrderFlow(flowRes.data || []);
      setOrderFlowStats(statsRes.data);
    } catch (err: any) {
      console.error('加载订单流失败:', err);
    }
  };

  // 连接订单流WebSocket
  const connectOrderFlowWs = useCallback(() => {
    const wsUrl = `${API_BASE_URL.replace(/^http/, 'ws')}/api/risk/ws/order-flow`;
    const ws = new WebSocket(wsUrl);
    setOrderFlowStatus('connecting');

    ws.onopen = () => {
      setOrderFlowStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'order_flow') {
          setOrderFlow(prev => [message.data, ...prev].slice(0, 100));
        } else if (message.type === 'history') {
          setOrderFlow(message.data || []);
        }
      } catch (e) {
        console.error('解析WebSocket消息失败:', e);
      }
    };

    ws.onclose = () => {
      setOrderFlowStatus('disconnected');
      // 3秒后重连
      setTimeout(() => connectOrderFlowWs(), 3000);
    };

    ws.onerror = () => {
      setOrderFlowStatus('disconnected');
    };

    setOrderFlowWs(ws);
  }, []);

  useEffect(() => {
    load();
    loadOrderFlow();
  }, []);

  // 订单流WebSocket连接
  useEffect(() => {
    if (activeTab === 'orderflow') {
      connectOrderFlowWs();
    }
    return () => {
      if (orderFlowWs) {
        orderFlowWs.close();
      }
    };
  }, [activeTab, connectOrderFlowWs]);

  const handleToggle = async (name: string, enabled: boolean) => {
    try {
      await riskApi.updateRule(name, { enabled });
      setRules(rules.map((r) => (r.name === name ? { ...r, enabled } : r)));
      Toast.success(`${name} ${enabled ? '已启用' : '已禁用'}`);
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '操作失败');
    }
  };

  const handleUpdateLimit = async (name: string) => {
    const rule = rules.find((r) => r.name === name);
    if (!rule) return;

    const newLimit = parseFloat(editingLimits[name]);
    if (isNaN(newLimit)) {
      Toast.error('请输入有效的数值');
      return;
    }

    try {
      await riskApi.updateRule(name, { enabled: rule.enabled, limit: newLimit });
      setRules(rules.map((r) => (r.name === name ? { ...r, limit: newLimit } : r)));
      Toast.success(`${name} 限制已更新`);
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '保存失败');
    }
  };

  const handleReset = async () => {
    try {
      await riskApi.reset();
      Toast.success('风控规则已重置为默认值');
      load();
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '重置失败');
    }
  };

  const eventColumns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '规则',
      dataIndex: 'rule_name',
      width: 150,
      render: (v: string) => <Tag size="small">{v}</Tag>,
    },
    {
      title: '级别',
      dataIndex: 'severity',
      width: 80,
      render: (v: string) => (
        <Tag color={v === 'error' ? 'red' : v === 'warning' ? 'orange' : 'blue'} size="small">
          {v === 'error' ? '错误' : v === 'warning' ? '警告' : '信息'}
        </Tag>
      ),
    },
    { title: '描述', dataIndex: 'message' },
  ];

  const orderFlowColumns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      width: 160,
      render: (v: string) => new Date(v).toLocaleTimeString('zh-CN'),
    },
    {
      title: '合约',
      dataIndex: 'vt_symbol',
      width: 120,
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
      title: '开平',
      dataIndex: 'offset',
      width: 80,
      render: (v: string) => <Tag size="small">{v}</Tag>,
    },
    {
      title: '价格',
      dataIndex: 'price',
      width: 100,
      render: (v: number) => v.toFixed(2),
    },
    {
      title: '数量',
      dataIndex: 'volume',
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => {
        const colorMap: Record<string, string> = {
          passed: 'green',
          blocked: 'red',
          pending: 'orange',
        };
        const labelMap: Record<string, string> = {
          passed: '已通过',
          blocked: '已拦截',
          pending: '检查中',
        };
        return <Tag color={(colorMap[v] || 'default') as any} size="small">{labelMap[v] || v}</Tag>;
      },
    },
    {
      title: '原因',
      dataIndex: 'reason',
      render: (v: string) => v || '-',
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Typography.Title heading={4} style={{ margin: 0 }}>
          <IconShield style={{ marginRight: 8 }} />
          风控设置
        </Typography.Title>
        <Space>
          <Button icon={<IconRefresh />} onClick={load} loading={loading}>刷新</Button>
          <Button icon={<IconRefresh />} onClick={handleReset} type="warning">重置默认</Button>
        </Space>
      </div>

      {/* 风控状态概览 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 12 }}>
            <Typography.Text type="tertiary">风控状态</Typography.Text>
            <br />
            <Typography.Text
              strong
              style={{ fontSize: 24, color: status?.enabled ? 'var(--semi-color-success)' : 'var(--semi-color-danger)' }}
            >
              {status?.enabled ? '运行中' : '已暂停'}
            </Typography.Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 12 }}>
            <Typography.Text type="tertiary">启用规则</Typography.Text>
            <br />
            <Typography.Text strong style={{ fontSize: 24 }}>
              {status?.active_rules || 0} / {status?.total_rules || 0}
            </Typography.Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 12 }}>
            <Typography.Text type="tertiary">风控事件</Typography.Text>
            <br />
            <Typography.Text strong style={{ fontSize: 24 }}>
              {status?.total_events || 0}
            </Typography.Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 12 }}>
            <Typography.Text type="tertiary">今日拦截</Typography.Text>
            <br />
            <Typography.Text strong style={{ fontSize: 24 }}>
              {events.filter(e => new Date(e.timestamp).toDateString() === new Date().toDateString()).length}
            </Typography.Text>
          </Card>
        </Col>
      </Row>

      <Spin spinning={loading}>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <Tabs.TabPane tab="风控规则" itemKey="rules">
            <Typography.Title heading={5} style={{ marginBottom: 16 }}>风控规则配置</Typography.Title>
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              {rules.map((rule) => (
                <Col span={8} key={rule.name}>
                  <Card bodyStyle={{ padding: 20 }} style={{ borderRadius: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <div>
                        <Typography.Text strong style={{ fontSize: 16 }}>{rule.name}</Typography.Text>
                        <br />
                        <Typography.Text type="tertiary" size="small">{rule.description}</Typography.Text>
                      </div>
                      <Switch
                        checked={rule.enabled}
                        onChange={(v) => handleToggle(rule.name, v)}
                      />
                    </div>

                    {rule.limit !== undefined && (
                      <div style={{ marginTop: 12 }}>
                        <label style={{ marginBottom: 4, display: 'block' }}>
                          限制值 {rule.window && `(每${rule.window}秒)`}
                        </label>
                        <Space>
                          <Input
                            value={editingLimits[rule.name] || String(rule.limit)}
                            onChange={(v) => setEditingLimits({ ...editingLimits, [rule.name]: v })}
                            style={{ width: 120 }}
                            disabled={!rule.enabled}
                          />
                          <Button
                            size="small"
                            onClick={() => handleUpdateLimit(rule.name)}
                            disabled={!rule.enabled}
                          >
                            更新
                          </Button>
                        </Space>
                      </div>
                    )}

                    {rule.allowed_hours && (
                      <div style={{ marginTop: 12 }}>
                        <label style={{ marginBottom: 4, display: 'block' }}>允许交易时段</label>
                        <Space wrap>
                          {rule.allowed_hours.map((hour) => (
                            <Tag key={hour} size="small" color="blue">{hour}</Tag>
                          ))}
                        </Space>
                      </div>
                    )}
                  </Card>
                </Col>
              ))}
            </Row>

            <Typography.Title heading={5} style={{ marginBottom: 16 }}>风控事件日志</Typography.Title>
            <Card style={{ borderRadius: 12 }}>
              <Table
                columns={eventColumns}
                dataSource={events}
                pagination={{ pageSize: 10 }}
                size="small"
                empty={<Empty description="暂无风控事件" />}
              />
            </Card>
          </Tabs.TabPane>

          <Tabs.TabPane tab={
            <span>
              <IconActivity style={{ marginRight: 4 }} />
              订单流监控
              {orderFlowStatus === 'connected' && <Badge type="success" style={{ marginLeft: 4 }} />}
            </span>
          } itemKey="orderflow">
            {/* 订单流统计卡片 */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col span={4}>
                <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 12 }}>
                  <Typography.Text type="tertiary">WebSocket</Typography.Text>
                  <br />
                  <Typography.Text
                    strong
                    style={{
                      fontSize: 20,
                      color: orderFlowStatus === 'connected'
                        ? 'var(--semi-color-success)'
                        : orderFlowStatus === 'connecting'
                          ? 'var(--semi-color-warning)'
                          : 'var(--semi-color-danger)'
                    }}
                  >
                    {orderFlowStatus === 'connected' ? '已连接' : orderFlowStatus === 'connecting' ? '连接中' : '已断开'}
                  </Typography.Text>
                </Card>
              </Col>
              <Col span={5}>
                <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 12 }}>
                  <Typography.Text type="tertiary">
                    <IconClock style={{ marginRight: 4 }} />最近1分钟
                  </Typography.Text>
                  <br />
                  <Typography.Text strong style={{ fontSize: 24 }}>
                    {orderFlowStats?.last_minute || 0}
                  </Typography.Text>
                </Card>
              </Col>
              <Col span={5}>
                <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 12 }}>
                  <Typography.Text type="tertiary">最近1小时</Typography.Text>
                  <br />
                  <Typography.Text strong style={{ fontSize: 24 }}>
                    {orderFlowStats?.last_hour || 0}
                  </Typography.Text>
                </Card>
              </Col>
              <Col span={5}>
                <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 12 }}>
                  <Typography.Text type="tertiary" style={{ color: 'var(--semi-color-success)' }}>已通过</Typography.Text>
                  <br />
                  <Typography.Text strong style={{ fontSize: 24, color: 'var(--semi-color-success)' }}>
                    {orderFlowStats?.passed || 0}
                  </Typography.Text>
                </Card>
              </Col>
              <Col span={5}>
                <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 12 }}>
                  <Typography.Text type="tertiary" style={{ color: 'var(--semi-color-danger)' }}>已拦截</Typography.Text>
                  <br />
                  <Typography.Text strong style={{ fontSize: 24, color: 'var(--semi-color-danger)' }}>
                    {orderFlowStats?.blocked || 0}
                  </Typography.Text>
                </Card>
              </Col>
            </Row>

            <Card style={{ borderRadius: 12 }} title="实时订单流监控">
              <Table
                columns={orderFlowColumns}
                dataSource={orderFlow}
                pagination={{ pageSize: 20 }}
                size="small"
                empty={<Empty description="暂无订单流数据" />}
              />
            </Card>
          </Tabs.TabPane>
        </Tabs>
      </Spin>
    </div>
  );
}
