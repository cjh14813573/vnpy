import { useEffect, useState } from 'react';
import { Typography, Card, Switch, Input, Button, Toast, Row, Col, Space, Tag, Table, Empty, Spin } from '@douyinfe/semi-ui';
import { IconRefresh, IconReset, IconShield } from '@douyinfe/semi-icons';
import { riskApi } from '../api';

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

export default function RiskPage() {
  const [rules, setRules] = useState<RiskRule[]>([]);
  const [events, setEvents] = useState<RiskEvent[]>([]);
  const [status, setStatus] = useState<{ enabled: boolean; total_events: number; active_rules: number; total_rules: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingLimits, setEditingLimits] = useState<Record<string, string>>({});

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

  useEffect(() => { load(); }, []);

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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Typography.Title heading={4} style={{ margin: 0 }}>
          <IconShield style={{ marginRight: 8 }} />
          风控设置
        </Typography.Title>
        <Space>
          <Button icon={<IconRefresh />} onClick={load} loading={loading}>刷新</Button>
          <Button icon={<IconReset />} onClick={handleReset} type="warning">重置默认</Button>
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
        {/* 风控规则配置 */}
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

        {/* 风控事件日志 */}
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
      </Spin>
    </div>
  );
}
