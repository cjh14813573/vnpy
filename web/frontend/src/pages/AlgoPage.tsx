import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Card, Button, Table, Tag, Row, Col, Modal, Input, Select, Toast, Space,
  Descriptions, Badge, Progress
} from '@douyinfe/semi-ui';
import { IconPlay, IconPause, IconStop, IconPlus } from '@douyinfe/semi-icons';
import { algoApi } from '../api';

const { Title, Text } = Typography;

interface AlgoTemplate {
  name: string;
  display_name: string;
  default_setting: Record<string, any>;
}

interface AlgoInstance {
  name: string;
  template_name: string;
  vt_symbol: string;
  direction: string;
  offset: string;
  price: number;
  volume: number;
  traded: number;
  status: string;
  variables: Record<string, any>;
}

export default function AlgoPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<AlgoTemplate[]>([]);
  const [algos, setAlgos] = useState<AlgoInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<AlgoTemplate | null>(null);

  // 创建算法表单
  const [createForm, setCreateForm] = useState({
    template_name: '',
    vt_symbol: '',
    direction: '多',
    offset: '开',
    price: '',
    volume: '',
    setting: {} as Record<string, string>,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [tplRes, algoRes] = await Promise.all([
        algoApi.templates(),
        algoApi.list(),
      ]);
      setTemplates(tplRes.data || []);
      setAlgos(algoRes.data || []);
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // 定时刷新
    const timer = setInterval(loadData, 3000);
    return () => clearInterval(timer);
  }, []);

  const openCreate = (template: AlgoTemplate) => {
    setSelectedTemplate(template);
    setCreateForm({
      template_name: template.name,
      vt_symbol: '',
      direction: '多',
      offset: '开',
      price: '',
      volume: '',
      setting: {},
    });
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    try {
      await algoApi.start({
        template_name: createForm.template_name,
        vt_symbol: createForm.vt_symbol,
        direction: createForm.direction,
        offset: createForm.offset,
        price: parseFloat(createForm.price),
        volume: parseFloat(createForm.volume),
        setting: createForm.setting,
      });
      Toast.success('算法已启动');
      setCreateOpen(false);
      loadData();
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '启动失败');
    }
  };

  const handleStop = async (name: string) => {
    try {
      await algoApi.stop(name);
      Toast.success('算法已停止');
      loadData();
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '停止失败');
    }
  };

  const handlePause = async (name: string) => {
    try {
      await algoApi.pause(name);
      Toast.success('算法已暂停');
      loadData();
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '暂停失败');
    }
  };

  const handleResume = async (name: string) => {
    try {
      await algoApi.resume(name);
      Toast.success('算法已恢复');
      loadData();
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '恢复失败');
    }
  };

  const handleStopAll = async () => {
    try {
      await algoApi.stopAll();
      Toast.success('所有算法已停止');
      loadData();
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '操作失败');
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case '运行中': return 'green';
      case '已暂停': return 'orange';
      case '已完成': return 'blue';
      case '已停止': return 'grey';
      default: return 'default';
    }
  };

  const algoColumns = [
    { title: '算法名称', dataIndex: 'name', width: 180 },
    { title: '模板', dataIndex: 'template_name', width: 120 },
    { title: '合约', dataIndex: 'vt_symbol', width: 140 },
    { title: '方向', dataIndex: 'direction', width: 80 },
    { title: '开平', dataIndex: 'offset', width: 80 },
    {
      title: '进度',
      dataIndex: 'traded',
      width: 150,
      render: (v: number, r: AlgoInstance) => (
        <div>
          <Progress percent={Math.round((v / r.volume) * 100)} size="small" showInfo={false} />
          <Text size="small" type="tertiary">{v} / {r.volume}</Text>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => <Tag color={statusColor(v)}>{v}</Tag>,
    },
    {
      title: '操作',
      width: 200,
      render: (_: any, r: AlgoInstance) => (
        <Space>
          {r.status === '运行中' && (
            <Button size="small" icon={<IconPause />} onClick={() => handlePause(r.name)}>
              暂停
            </Button>
          )}
          {r.status === '已暂停' && (
            <Button size="small" icon={<IconPlay />} onClick={() => handleResume(r.name)}>
              恢复
            </Button>
          )}
          {r.status !== '已停止' && r.status !== '已完成' && (
            <Button size="small" type="danger" icon={<IconStop />} onClick={() => handleStop(r.name)}>
              停止
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title heading={4} style={{ margin: 0 }}>算法交易</Title>
        <Space>
          <Button onClick={loadData} loading={loading}>刷新</Button>
          <Button type="danger" onClick={handleStopAll}>全部停止</Button>
        </Space>
      </div>

      <Title heading={5} style={{ marginBottom: 12 }}>算法模板</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {templates.map((tpl) => (
          <Col span={6} key={tpl.name}>
            <Card
              bodyStyle={{ padding: 16 }}
              style={{ borderRadius: 12 }}
              actions={[
                <Button theme="solid" icon={<IconPlus />} onClick={() => openCreate(tpl)}>
                  启动
                </Button>,
              ]}
            >
              <Text strong>{tpl.display_name || tpl.name}</Text>
              <br />
              <Text type="tertiary" size="small">{tpl.name}</Text>
            </Card>
          </Col>
        ))}
        {templates.length === 0 && (
          <Col span={24}>
            <Text type="tertiary">暂无可用算法模板</Text>
          </Col>
        )}
      </Row>

      <Title heading={5} style={{ marginBottom: 12 }}>运行中的算法</Title>
      <Card style={{ borderRadius: 12 }}>
        <Table
          columns={algoColumns}
          dataSource={algos}
          pagination={false}
          size="small"
          empty={<Text type="tertiary">暂无运行中的算法</Text>}
        />
      </Card>

      {/* 创建算法对话框 */}
      <Modal
        title={`启动算法 - ${selectedTemplate?.display_name || selectedTemplate?.name}`}
        visible={createOpen}
        onCancel={() => setCreateOpen(false)}
        footer={null}
        style={{ borderRadius: 12 }}
      >
        <div>
          <label style={{ marginBottom: 8, display: 'block' }}>合约 (vt_symbol)</label>
          <Input
            value={createForm.vt_symbol}
            onChange={(v) => setCreateForm({ ...createForm, vt_symbol: v })}
            placeholder="rb2410.SHFE"
            style={{ marginBottom: 12 }}
          />

          <Row gutter={8}>
            <Col span={12}>
              <label style={{ marginBottom: 8, display: 'block' }}>方向</label>
              <Select
                value={createForm.direction}
                onChange={(v) => setCreateForm({ ...createForm, direction: v as string })}
                style={{ width: '100%', marginBottom: 12 }}
                optionList={[
                  { value: '多', label: '买入' },
                  { value: '空', label: '卖出' },
                ]}
              />
            </Col>
            <Col span={12}>
              <label style={{ marginBottom: 8, display: 'block' }}>开平</label>
              <Select
                value={createForm.offset}
                onChange={(v) => setCreateForm({ ...createForm, offset: v as string })}
                style={{ width: '100%', marginBottom: 12 }}
                optionList={[
                  { value: '开', label: '开仓' },
                  { value: '平', label: '平仓' },
                  { value: '平今', label: '平今' },
                  { value: '平昨', label: '平昨' },
                ]}
              />
            </Col>
          </Row>

          <Row gutter={8}>
            <Col span={12}>
              <label style={{ marginBottom: 8, display: 'block' }}>价格</label>
              <Input
                type="number"
                value={createForm.price}
                onChange={(v) => setCreateForm({ ...createForm, price: v })}
                placeholder="0"
                style={{ marginBottom: 12 }}
              />
            </Col>
            <Col span={12}>
              <label style={{ marginBottom: 8, display: 'block' }}>数量</label>
              <Input
                type="number"
                value={createForm.volume}
                onChange={(v) => setCreateForm({ ...createForm, volume: v })}
                placeholder="1"
                style={{ marginBottom: 12 }}
              />
            </Col>
          </Row>

          {selectedTemplate?.default_setting && Object.keys(selectedTemplate.default_setting).length > 0 && (
            <>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>算法参数</Text>
              {Object.entries(selectedTemplate.default_setting).map(([key, val]: [string, any]) => (
                <div key={key}>
                  <label style={{ marginBottom: 4, display: 'block' }}>{key}</label>
                  <Input
                    value={createForm.setting[key] ?? String(val) ?? ''}
                    onChange={(v) => setCreateForm({
                      ...createForm,
                      setting: { ...createForm.setting, [key]: v }
                    })}
                    style={{ marginBottom: 8 }}
                  />
                </div>
              ))}
            </>
          )}

          <Button
            theme="solid"
            block
            size="large"
            onClick={handleCreate}
            disabled={!createForm.vt_symbol || !createForm.volume}
            style={{ marginTop: 16, borderRadius: 10 }}
          >
            启动算法
          </Button>
        </div>
      </Modal>
    </div>
  );
}
