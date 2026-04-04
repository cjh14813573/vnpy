import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Card, Button, Table, Tag, Row, Col, Modal, Input, Select, Toast, Space,
  Popconfirm, Popover
} from '@douyinfe/semi-ui';
import { IconLock, IconKey, IconCode } from '@douyinfe/semi-icons';
import { strategyApi } from '../api';
import type { StrategyInstance } from '../api/types';
import StrategyCodeViewer from '../components/StrategyCodeViewer';
import { useMediaQuery } from '../hooks/useMediaQuery';

const { Title, Text } = Typography;

export default function StrategyPage() {
  const navigate = useNavigate();
  const { isMobile } = useMediaQuery();
  const [classes, setClasses] = useState<string[]>([]);
  const [instances, setInstances] = useState<StrategyInstance[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ class_name: '', strategy_name: '', vt_symbol: '' });
  const [classParams, setClassParams] = useState<Record<string, any>>({});
  const [addSetting, setAddSetting] = useState<Record<string, string>>({});
  const [isAdmin] = useState(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.role === 'admin';
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<StrategyInstance | null>(null);
  const [editParams, setEditParams] = useState<Record<string, any>>({});
  const [editSetting, setEditSetting] = useState<Record<string, string>>({});
  const [codeViewerOpen, setCodeViewerOpen] = useState(false);
  const [codeViewerClassName, setCodeViewerClassName] = useState('');

  const load = async () => {
    try {
      const [cls, inst] = await Promise.all([strategyApi.classes(), strategyApi.instances()]);
      setClasses(cls.data);
      setInstances(inst.data.data || inst.data);
    } catch { /* ignore */ }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setAddOpen(true);
    setAddForm({ class_name: '', strategy_name: '', vt_symbol: '' });
    setClassParams({});
    setAddSetting({});
  };

  const handleClassChange = async (className: string) => {
    setAddForm({ ...addForm, class_name: className });
    try {
      const res = await strategyApi.classParams(className);
      setClassParams(res.data);
      const defaults: Record<string, string> = {};
      Object.entries(res.data).forEach(([k, v]: [string, any]) => {
        defaults[k] = String(v.default ?? '');
      });
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
      const detail = err.response?.data?.detail || '';
      if (detail.includes('锁定')) {
        Toast.error(detail);
      } else {
        Toast.error(detail || '操作失败');
      }
    }
  };

  const handleForceUnlock = async (name: string) => {
    try {
      await strategyApi.edit(name, { force_unlock: true });
      Toast.success('已强制解锁');
      load();
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '解锁失败');
    }
  };

  const openEdit = async (instance: StrategyInstance) => {
    setEditingStrategy(instance);
    setEditOpen(true);
    try {
      const res = await strategyApi.classParams(instance.class_name);
      setEditParams(res.data);
      const currentSettings: Record<string, string> = {};
      Object.entries(res.data).forEach(([k, v]: [string, any]) => {
        const currentValue = instance.parameters?.[k];
        currentSettings[k] = String(currentValue ?? v.default ?? '');
      });
      setEditSetting(currentSettings);
    } catch {
      Toast.error('获取策略参数失败');
    }
  };

  const handleEditSave = async () => {
    if (!editingStrategy) return;
    try {
      if (editingStrategy.trading) {
        await strategyApi.stop(editingStrategy.strategy_name);
      }
      await strategyApi.edit(editingStrategy.strategy_name, { setting: editSetting });
      Toast.success(editingStrategy.trading ? '参数已更新，请重新初始化' : '参数已更新');
      setEditOpen(false);
      setEditingStrategy(null);
      load();
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '保存失败');
    }
  };

  const openCodeView = (className: string) => {
    setCodeViewerClassName(className);
    setCodeViewerOpen(true);
  };

  const statusColor = (s: StrategyInstance) => s.trading ? 'green' : s.inited ? 'blue' : 'grey';
  const statusText = (s: StrategyInstance) => s.trading ? '运行中' : s.inited ? '已初始化' : '未初始化';

  const LockIndicator = ({ lock }: { lock?: { locked: boolean; holder: string | null } }) => {
    if (!lock?.locked) return null;
    return (
      <Popover content={`持有者: ${lock.holder || '未知'}`}>
        <Tag color="orange" style={{ marginLeft: 8 }}><IconLock />锁定</Tag>
      </Popover>
    );
  };

  // 移动端精简列
  const mobileCols = [
    {
      title: '策略',
      dataIndex: 'strategy_name',
      width: 140,
      render: (v: string, r: StrategyInstance) => (
        <div>
          <div style={{ fontWeight: 500 }}>{v}</div>
          <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>{r.vt_symbol}</div>
        </div>
      ),
    },
    {
      title: '状态',
      width: 80,
      render: (_: any, r: StrategyInstance) => <Tag color={statusColor(r)} size="small">{statusText(r)}</Tag>,
    },
    {
      title: '操作',
      width: 100,
      render: (_: any, r: StrategyInstance) => (
        <Button size="small" onClick={() => navigate(`/strategy/${r.strategy_name}`)}>详情</Button>
      ),
    },
  ];

  // 桌面端完整列
  const desktopCols = [
    {
      title: '策略名',
      dataIndex: 'strategy_name',
      render: (v: string, r: StrategyInstance) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Button theme="borderless" onClick={() => navigate(`/strategy/${v}`)}>{v}</Button>
          <LockIndicator lock={r.lock} />
        </div>
      ),
    },
    { title: '类名', dataIndex: 'class_name' },
    { title: '合约', dataIndex: 'vt_symbol' },
    { title: '状态', dataIndex: 'status', width: 100, render: (_: any, r: StrategyInstance) => <Tag color={statusColor(r)}>{statusText(r)}</Tag> },
    {
      title: '操作',
      width: 360,
      render: (_: any, r: StrategyInstance) => (
        <Space>
          <Button size="small" onClick={() => handleAction('init', r.strategy_name)} disabled={r.lock?.locked}>初始化</Button>
          <Button size="small" theme="solid" type="primary" onClick={() => handleAction('start', r.strategy_name)} disabled={r.lock?.locked}>启动</Button>
          <Button size="small" theme="solid" type="danger" onClick={() => handleAction('stop', r.strategy_name)} disabled={r.lock?.locked}>停止</Button>
          <Button size="small" onClick={() => openEdit(r)} disabled={r.lock?.locked || r.trading}>编辑参数</Button>
          <Button size="small" theme="solid" type="danger" onClick={() => handleAction('remove', r.strategy_name)} disabled={r.lock?.locked}>删除</Button>
          {isAdmin && r.lock?.locked && (
            <Popconfirm title="强制解锁" content={`确定要强制解锁策略 "${r.strategy_name}" 吗？`} onConfirm={() => handleForceUnlock(r.strategy_name)}>
              <Button size="small" icon={<IconKey />} type="warning">解锁</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: isMobile ? 12 : 24 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'flex-start' : 'center',
        marginBottom: 20,
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 12 : 0,
      }}>
        <Title heading={isMobile ? 5 : 4} style={{ margin: 0 }}>策略管理</Title>
        <Space wrap={isMobile}>
          <Button theme="solid" onClick={openAdd} size={isMobile ? 'small' : 'default'}>添加策略</Button>
          <Button onClick={() => strategyApi.initAll().then(load)} size={isMobile ? 'small' : 'default'}>全部初始化</Button>
          {!isMobile && <Button theme="solid" type="primary" onClick={() => strategyApi.startAll().then(load)}>全部启动</Button>}
          {!isMobile && <Button theme="solid" type="danger" onClick={() => strategyApi.stopAll().then(load)}>全部停止</Button>}
        </Space>
      </div>

      <Title heading={isMobile ? 6 : 5} style={{ marginBottom: 12 }}>策略类</Title>
      <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]} style={{ marginBottom: 24 }}>
        {classes.map((cls) => (
          <Col span={isMobile ? 12 : 6} key={cls}>
            <div onClick={() => { setAddForm({ ...addForm, class_name: cls }); handleClassChange(cls); setAddOpen(true); }} style={{ cursor: 'pointer' }}>
            <Card
                bodyStyle={{ padding: isMobile ? 12 : 16 }}
                style={{ borderRadius: 12 }}
                actions={[
                  <Button theme="borderless" icon={<IconCode />} onClick={(e) => { e?.stopPropagation(); openCodeView(cls); }}>源码</Button>
                ]}
              >
                <Text strong style={{ fontSize: isMobile ? 14 : 16 }}>{cls}</Text>
              </Card>
            </div>
          </Col>
        ))}
      </Row>

      <Title heading={isMobile ? 6 : 5} style={{ marginBottom: 12 }}>已部署策略</Title>
      <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: isMobile ? 0 : 12 }}>
        {isMobile ? (
          <div style={{ overflowX: 'auto' }}>
            <Table columns={mobileCols} dataSource={instances} pagination={false} size="small" empty="暂无策略实例" />
          </div>
        ) : (
          <Table columns={desktopCols} dataSource={instances} pagination={false} size="small" empty="暂无策略实例" />
        )}
      </Card>

      {/* 添加策略对话框 */}
      <Modal
        title="添加策略"
        visible={addOpen}
        onCancel={() => setAddOpen(false)}
        footer={null}
        style={{ borderRadius: 12, maxWidth: isMobile ? '90vw' : 520 }}
      >
        <Select
          value={addForm.class_name}
          onChange={(v) => handleClassChange(v as string)}
          style={{ width: '100%', marginBottom: 12 }}
          placeholder="选择策略类"
          optionList={classes.map((c) => ({ value: c, label: c }))}
        />
        <Input
          value={addForm.strategy_name}
          onChange={(v) => setAddForm({ ...addForm, strategy_name: v })}
          placeholder="策略名称"
          style={{ marginBottom: 12 }}
        />
        <Input
          value={addForm.vt_symbol}
          onChange={(v) => setAddForm({ ...addForm, vt_symbol: v })}
          placeholder="合约代码 (rb2410.SHFE)"
          style={{ marginBottom: 12 }}
        />
        {Object.entries(classParams).map(([key, val]: [string, any]) => (
          <div key={key}>
            <label style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>{key}</label>
            <Input
              value={addSetting[key] ?? ''}
              onChange={(v) => setAddSetting({ ...addSetting, [key]: v })}
              suffix={`默认: ${val.default ?? '-'}`}
              style={{ marginBottom: 8 }}
            />
          </div>
        ))}
        <Button theme="solid" block onClick={handleAdd} disabled={!addForm.class_name || !addForm.strategy_name}>
          添加
        </Button>
      </Modal>

      {/* 编辑参数对话框 */}
      <Modal
        title={`编辑参数 - ${editingStrategy?.strategy_name || ''}`}
        visible={editOpen}
        onCancel={() => setEditOpen(false)}
        footer={null}
        style={{ borderRadius: 12, maxWidth: isMobile ? '90vw' : 520 }}
      >
        <Text type="tertiary" style={{ display: 'block', marginBottom: 16 }}>
          {editingStrategy?.class_name} | {editingStrategy?.vt_symbol}
        </Text>
        {editingStrategy?.trading && <Tag color="orange" style={{ marginBottom: 16 }}>策略运行中，修改需先停止</Tag>}
        {Object.entries(editParams).map(([key, val]: [string, any]) => (
          <div key={key}>
            <label style={{ fontSize: 12 }}>{key}</label>
            <Input
              value={editSetting[key] ?? ''}
              onChange={(v) => setEditSetting({ ...editSetting, [key]: v })}
              suffix={`默认: ${val.default ?? '-'}`}
              style={{ marginBottom: 12 }}
            />
          </div>
        ))}
        <Button theme="solid" block onClick={handleEditSave} disabled={editingStrategy?.trading}>
          保存参数
        </Button>
      </Modal>

      <StrategyCodeViewer
        className={codeViewerClassName}
        visible={codeViewerOpen}
        onClose={() => setCodeViewerOpen(false)}
        onEdit={(cls) => navigate(`/editor/${cls}`)}
      />
    </div>
  );
}
