import { useEffect, useState, useRef } from 'react';
import {
  Typography,
  Card,
  Button,
  Input,
  Select,
  Table,
  Tag,
  Toast,
  Space,
  Modal,
  Form,
  Spin,
  Empty,
} from '@douyinfe/semi-ui';
import { IconPlus, IconDelete, IconRefresh } from '@douyinfe/semi-icons';
import { mlApi } from '../api';
import { useWebSocket } from '../hooks/useWebSocket';

const { Title, Text } = Typography;

interface Signal {
  id: string;
  model_name: string;
  vt_symbol: string;
  prediction: number;
  probability: number[];
  signal: Record<string, number>;
  price: number;
  timestamp: string;
}

interface Subscription {
  model_name: string;
  interval: number;
  last_prediction?: Signal;
  last_run?: string;
}

export default function MLSignalMonitorPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [subscriptions, setSubscriptions] = useState<Record<string, Subscription>>({});
  const [models, setModels] = useState<{ name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [serviceStatus, setServiceStatus] = useState({ running: false, subscription_count: 0 });

  const [subscribeForm, setSubscribeForm] = useState({
    model_name: '',
    vt_symbol: 'rb2410.SHFE',
    interval: 60,
  });

  const { lastMessage } = useWebSocket();
  const signalsRef = useRef<Signal[]>([]);

  // 保持引用最新
  useEffect(() => {
    signalsRef.current = signals;
  }, [signals]);

  // 监听 WebSocket 消息
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'event' && lastMessage.topic === 'ml.signal') {
      const newSignal = lastMessage.data as Signal;
      setSignals((prev) => {
        const exists = prev.some((s) => s.id === newSignal.id);
        if (exists) return prev;
        return [newSignal, ...prev].slice(0, 100);
      });
    }
  }, [lastMessage]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [historyRes, subsRes, statusRes, modelsRes] = await Promise.all([
        mlApi.getSignalHistory({ limit: 50 }),
        mlApi.getSignalSubscriptions(),
        mlApi.getSignalStatus(),
        mlApi.listModels(),
      ]);
      setSignals(historyRes.data.signals || []);
      setSubscriptions(subsRes.data.subscriptions || {});
      setServiceStatus(statusRes.data);
      setModels(modelsRes.data || []);
    } catch (err: any) {
      Toast.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // 定时刷新状态
    const interval = setInterval(() => {
      mlApi.getSignalStatus().then((res) => setServiceStatus(res.data));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSubscribe = async () => {
    if (!subscribeForm.model_name || !subscribeForm.vt_symbol) {
      Toast.error('请选择模型和合约');
      return;
    }

    try {
      await mlApi.subscribeSignals({
        model_name: subscribeForm.model_name,
        vt_symbol: subscribeForm.vt_symbol,
        interval: subscribeForm.interval,
      });
      Toast.success('订阅成功');
      setShowSubscribeModal(false);
      loadData();
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '订阅失败');
    }
  };

  const handleUnsubscribe = async (vtSymbol: string) => {
    try {
      await mlApi.unsubscribeSignals(vtSymbol);
      Toast.success('已取消订阅');
      loadData();
    } catch (err: any) {
      Toast.error('取消订阅失败');
    }
  };

  const handleClearHistory = async () => {
    Modal.confirm({
      title: '确认清空',
      content: '确定要清空所有信号历史吗？',
      onOk: async () => {
        try {
          await mlApi.clearSignalHistory();
          Toast.success('历史已清空');
          setSignals([]);
        } catch (err: any) {
          Toast.error('清空失败');
        }
      },
    });
  };

  const getSignalColor = (prediction: number) => {
    return prediction === 1 ? 'green' : 'red';
  };

  const getSignalText = (prediction: number) => {
    return prediction === 1 ? '上涨' : '下跌';
  };

  const getConfidence = (probability?: number[]) => {
    if (!probability || probability.length < 2) return 0;
    return Math.max(...probability) * 100;
  };

  const signalColumns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      render: (v: string) => new Date(v).toLocaleString(),
      width: 180,
    },
    {
      title: '模型',
      dataIndex: 'model_name',
      width: 150,
    },
    {
      title: '合约',
      dataIndex: 'vt_symbol',
      width: 120,
    },
    {
      title: '信号',
      dataIndex: 'prediction',
      render: (v: number, record: Signal) => (
        <Space>
          <Tag color={getSignalColor(v)} size="large">
            {getSignalText(v)}
          </Tag>
          <Text type="tertiary">{getConfidence(record.probability).toFixed(1)}%</Text>
        </Space>
      ),
      width: 150,
    },
    {
      title: '价格',
      dataIndex: 'price',
      render: (v: number) => v?.toFixed(2) || '-',
      width: 100,
    },
    {
      title: '概率分布',
      dataIndex: 'probability',
      render: (v?: number[]) =>
        v ? (
          <div style={{ fontSize: 12 }}>
            <div>跌: {(v[0] * 100).toFixed(1)}%</div>
            <div>涨: {(v[1] * 100).toFixed(1)}%</div>
          </div>
        ) : (
          '-'
        ),
      width: 100,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title heading={4} style={{ margin: 0 }}>
            ML 信号监控
          </Title>
          <Text type="tertiary">实时机器学习预测信号</Text>
        </div>
        <Space>
          <Tag color={serviceStatus.running ? 'green' : 'grey'}>
            {serviceStatus.running ? '● 服务运行中' : '○ 服务停止'}
          </Tag>
          <Button icon={<IconRefresh />} onClick={loadData}>
            刷新
          </Button>
          <Button theme="solid" icon={<IconPlus />} onClick={() => setShowSubscribeModal(true)}>
            订阅信号
          </Button>
        </Space>
      </div>

      {/* 订阅状态卡片 */}
      <Card title="活跃订阅" style={{ borderRadius: 12, marginBottom: 16 }}>
        {Object.keys(subscriptions).length === 0 ? (
          <Empty description="暂无活跃订阅" />
        ) : (
          <Space wrap>
            {Object.entries(subscriptions).map(([vtSymbol, sub]) => (
              <Card
                key={vtSymbol}
                style={{ width: 280, borderRadius: 8 }}
                bodyStyle={{ padding: 12 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong>{vtSymbol}</Text>
                    <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>
                      模型: {sub.model_name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>
                      间隔: {sub.interval}秒
                    </div>
                    {sub.last_run && (
                      <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>
                        上次: {new Date(sub.last_run).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                  <Button
                    icon={<IconDelete />}
                    type="danger"
                    theme="borderless"
                    size="small"
                    onClick={() => handleUnsubscribe(vtSymbol)}
                  />
                </div>
              </Card>
            ))}
          </Space>
        )}
      </Card>

      {/* 信号历史 */}
      <Card
        header={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>信号历史 ({signals.length})</span>
            <Button type="tertiary" size="small" onClick={handleClearHistory}>
              清空历史
            </Button>
          </div>
        }
        style={{ borderRadius: 12 }}
      >
        <Spin spinning={loading}>
          <Table
            columns={signalColumns}
            dataSource={signals}
            pagination={{ pageSize: 10 }}
            empty={<Empty description="暂无信号" />}
            size="small"
          />
        </Spin>
      </Card>

      {/* 订阅弹窗 */}
      <Modal
        title="订阅 ML 信号"
        visible={showSubscribeModal}
        onCancel={() => setShowSubscribeModal(false)}
        onOk={handleSubscribe}
      >
        <Form layout="vertical">
          <Form.Label text="选择模型" required>
            <Select
              value={subscribeForm.model_name}
              onChange={(v) => setSubscribeForm({ ...subscribeForm, model_name: v as string })}
              placeholder="请选择模型"
              style={{ width: '100%' }}
              optionList={models.map((m) => ({ value: m.name, label: m.name }))}
            />
          </Form.Label>
          <Form.Label text="合约代码" required>
            <Input
              value={subscribeForm.vt_symbol}
              onChange={(v) => setSubscribeForm({ ...subscribeForm, vt_symbol: v })}
              placeholder="如: rb2410.SHFE"
            />
          </Form.Label>
          <Form.Label text="预测间隔（秒）">
            <Select
              value={subscribeForm.interval}
              onChange={(v) => setSubscribeForm({ ...subscribeForm, interval: v as number })}
              style={{ width: '100%' }}
              optionList={[
                { value: 30, label: '30秒' },
                { value: 60, label: '1分钟' },
                { value: 300, label: '5分钟' },
                { value: 900, label: '15分钟' },
                { value: 1800, label: '30分钟' },
              ]}
            />
          </Form.Label>
        </Form>
      </Modal>
    </div>
  );
}
