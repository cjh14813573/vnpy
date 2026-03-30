import { useEffect, useState, useCallback } from 'react';
import {
  Typography, Card, Input, Select, Button, Row, Col, Toast,
  Table, Progress, Tag, Space, Tabs, Empty, Spin
} from '@douyinfe/semi-ui';
import {
  IconPlay, IconDelete, IconRefresh, IconPieChartStroked,
  IconList, IconSetting
} from '@douyinfe/semi-icons';
import { backtestApi } from '../api';
import { useRealtimeStore } from '../stores/realtimeStore';
import { useWebSocket } from '../services/websocket';
import type { BacktestTask, BacktestTaskStatus } from '../api/types';

const { Title } = Typography;
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
      const res = await backtestApi.createTask({
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
  const labelStyle = { marginBottom: 8, display: 'block' };

  // 任务列表列定义
  const taskColumns = [
    {
      title: '任务ID',
      dataIndex: 'task_id',
      width: 200,
      render: (v: string) => <span className="font-mono text-secondary">{v.slice(0, 16)}...</span>,
    },
    {
      title: '策略',
      dataIndex: 'class_name',
      width: 150,
    },
    {
      title: '合约',
      dataIndex: 'vt_symbol',
      width: 140,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: BacktestTaskStatus) => (
        <Tag color={statusMap[v]?.color || 'default'}>{statusMap[v]?.label || v}</Tag>
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
            <Button
              icon={<IconPieChartStroked />}
              size="small"
              type="primary"
              onClick={() => handleViewResult(record)}
            >
              结果
            </Button>
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

      <Tabs activeKey={activeTab} onChange={setActiveTab} lazy>
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
                  <Tag color={statusMap[selectedTask.status]?.color}>
                    {statusMap[selectedTask.status]?.label}
                  </Tag>
                </div>
              </Card>

              {taskResult ? (
                <Row gutter={[16, 16]}>
                  {Object.entries(taskResult).map(([k, v]) => (
                    <Col span={6} key={k}>
                      <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 12 }}>
                        <Typography.Text type="tertiary" size="small">{k}</Typography.Text>
                        <br />
                        <Typography.Text strong style={{ fontSize: 24 }}>
                          {typeof v === 'number' ? v.toFixed(4) : String(v)}
                        </Typography.Text>
                      </Card>
                    </Col>
                  ))}
                </Row>
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
      </Tabs>
    </div>
  );
}
