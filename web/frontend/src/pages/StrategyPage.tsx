import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Card, Button, Table, Tag, Row, Col, Modal, Input, Select, Toast, Space } from '@douyinfe/semi-ui';
import { strategyApi } from '../api';

export default function StrategyPage() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<string[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ class_name: '', strategy_name: '', vt_symbol: '' });
  const [classParams, setClassParams] = useState<Record<string, any>>({});
  const [addSetting, setAddSetting] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      const [cls, inst] = await Promise.all([strategyApi.classes(), strategyApi.instances()]);
      setClasses(cls.data); setInstances(inst.data);
    } catch { /* ignore */ }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setAddOpen(true); setAddForm({ class_name: '', strategy_name: '', vt_symbol: '' }); setClassParams({}); setAddSetting({}); };

  const handleClassChange = async (className: string) => {
    setAddForm({ ...addForm, class_name: className });
    try {
      const res = await strategyApi.classParams(className);
      setClassParams(res.data);
      const defaults: Record<string, string> = {};
      Object.entries(res.data).forEach(([k, v]: [string, any]) => { defaults[k] = String(v.default ?? ''); });
      setAddSetting(defaults);
    } catch { /* ignore */ }
  };

  const handleAdd = async () => {
    try {
      await strategyApi.add({ ...addForm, setting: addSetting });
      setAddOpen(false);
      Toast.success(`策略 ${addForm.strategy_name} 已添加`);
      load();
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '添加失败');
    }
  };

  const handleAction = async (action: string, name: string) => {
    try {
      if (action === 'init') await strategyApi.init(name);
      else if (action === 'start') await strategyApi.start(name);
      else if (action === 'stop') await strategyApi.stop(name);
      else if (action === 'remove') await strategyApi.remove(name);
      Toast.success('操作成功');
      load();
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '操作失败');
    }
  };

  const statusColor = (s: any) => s.trading ? 'green' : s.inited ? 'blue' : 'grey';
  const statusText = (s: any) => s.trading ? '运行中' : s.inited ? '已初始化' : '未初始化';

  const instCols = [
    { title: '策略名', dataIndex: 'strategy_name', render: (v: string) => (
      <Button theme="borderless" onClick={() => navigate(`/strategy/${v}`)}>{v}</Button>
    )},
    { title: '类名', dataIndex: 'class_name' },
    { title: '合约', dataIndex: 'vt_symbol' },
    { title: '状态', dataIndex: 'status', width: 100, render: (_: any, r: any) => (
      <Tag color={statusColor(r)}>{statusText(r)}</Tag>
    )},
    { title: '操作', width: 300, render: (_: any, r: any) => (
      <Space>
        <Button size="small" onClick={() => handleAction('init', r.strategy_name)}>初始化</Button>
        <Button size="small" theme="solid" type="primary" onClick={() => handleAction('start', r.strategy_name)}>启动</Button>
        <Button size="small" theme="solid" type="danger" onClick={() => handleAction('stop', r.strategy_name)}>停止</Button>
        <Button size="small" theme="solid" type="danger" onClick={() => handleAction('remove', r.strategy_name)}>删除</Button>
      </Space>
    )},
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Typography.Title heading={4} style={{ margin: 0 }}>策略管理</Typography.Title>
        <Space>
          <Button theme="solid" onClick={openAdd}>添加策略</Button>
          <Button onClick={() => strategyApi.initAll().then(load)}>全部初始化</Button>
          <Button theme="solid" type="primary" onClick={() => strategyApi.startAll().then(load)}>全部启动</Button>
          <Button theme="solid" type="danger" onClick={() => strategyApi.stopAll().then(load)}>全部停止</Button>
        </Space>
      </div>

      <Typography.Title heading={5} style={{ marginBottom: 12 }}>策略类</Typography.Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {classes.map((cls) => (
          <Col span={6} key={cls}>
            <div onClick={() => { setAddForm({ ...addForm, class_name: cls }); handleClassChange(cls); setAddOpen(true); }} style={{ cursor: 'pointer' }}>
            <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 12 }}>
              <Typography.Text strong>{cls}</Typography.Text>
              <br /><Typography.Text type="tertiary" size="small">CTA 策略模板</Typography.Text>
            </Card>
            </div>
          </Col>
        ))}
      </Row>

      <Typography.Title heading={5} style={{ marginBottom: 12 }}>已部署策略</Typography.Title>
      <Card style={{ borderRadius: 12 }}>
        <Table columns={instCols} dataSource={instances} pagination={false} size="small" empty="暂无策略实例" />
      </Card>

      <Modal title="添加策略" visible={addOpen} onCancel={() => setAddOpen(false)} footer={null} style={{ borderRadius: 12 }}>
        <div>
          <label style={{ marginBottom: 8, display: 'block' }}>策略类</label>
          <Select value={addForm.class_name} onChange={(v) => handleClassChange(v as string)} style={{ width: '100%', marginBottom: 12 }}
            placeholder="选择策略类" optionList={classes.map((c) => ({ value: c, label: c }))} />
          <label style={{ marginBottom: 8, display: 'block' }}>策略名称</label>
          <Input value={addForm.strategy_name} onChange={(v) => setAddForm({ ...addForm, strategy_name: v })} style={{ marginBottom: 12 }} />
          <label style={{ marginBottom: 8, display: 'block' }}>合约 (vt_symbol)</label>
          <Input value={addForm.vt_symbol} onChange={(v) => setAddForm({ ...addForm, vt_symbol: v })} placeholder="rb2410.SHFE" style={{ marginBottom: 12 }} />
          {Object.entries(classParams).length > 0 && (
            <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>策略参数</Typography.Text>
          )}
          {Object.entries(classParams).map(([key, val]: [string, any]) => (
            <div key={key}>
              <label style={{ marginBottom: 4, display: 'block' }}>{key}</label>
              <Input value={addSetting[key] ?? ''} onChange={(v) => setAddSetting({ ...addSetting, [key]: v })}
              suffix={`默认: ${val.default ?? '-'}`} style={{ marginBottom: 8 }} />
            </div>
          ))}
          <Button theme="solid" block size="large" onClick={handleAdd}
            disabled={!addForm.class_name || !addForm.strategy_name} style={{ marginTop: 16, borderRadius: 10 }}>
            添加
          </Button>
        </div>
      </Modal>
    </div>
  );
}
