import { useEffect, useState } from 'react';
import { Typography, Card, Button, Input, Select, Row, Col, Toast, Space, Table, Modal, Descriptions } from '@douyinfe/semi-ui';
import { IconPlus, IconPlay, IconDelete } from '@douyinfe/semi-icons';
import { mlApi } from '../api';
import ModelEvaluationCharts from '../components/ml/ModelEvaluationCharts';

const { Title, Text } = Typography;

interface MLModel {
  name: string;
  model_type?: string;
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    auc?: number;
    cv_mean?: number;
    cv_std?: number;
  };
  created_at: string;
  features: number;
  feature_names?: string[];
  config?: Record<string, any>;
  evaluation?: Record<string, any>;
  feature_importance?: Record<string, number>;
}

// 自定义 Tabs 组件
function SimpleTabs({ defaultActiveKey, children }: { defaultActiveKey: string; children: React.ReactNode }) {
  const [activeKey, setActiveKey] = useState(defaultActiveKey);

  const tabs = Array.isArray(children) ? children : [children];
  const tabItems = tabs.filter(Boolean).map((child: any) => ({
    key: child.props.itemKey,
    tab: child.props.tab,
    content: child.props.children,
  }));

  return (
    <div>
      <div style={{ borderBottom: '1px solid var(--semi-color-border)', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 32 }}>
          {tabItems.map((item) => (
            <div
              key={item.key}
              onClick={() => setActiveKey(item.key)}
              style={{
                padding: '12px 0',
                cursor: 'pointer',
                borderBottom: activeKey === item.key ? '2px solid var(--semi-color-primary)' : '2px solid transparent',
                color: activeKey === item.key ? 'var(--semi-color-primary)' : 'var(--semi-color-text-1)',
                fontWeight: activeKey === item.key ? 600 : 400,
                transition: 'all 0.3s',
              }}
            >
              {item.tab}
            </div>
          ))}
        </div>
      </div>
      <div>
        {tabItems.find((item) => item.key === activeKey)?.content}
      </div>
    </div>
  );
}

function TabPane({ children }: { tab: React.ReactNode; itemKey: string; children: React.ReactNode }) {
  return <>{children}</>;
}

export default function MLPage() {
  const [models, setModels] = useState<MLModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedModel, setSelectedModel] = useState<MLModel | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // 训练表单
  const [trainForm, setTrainForm] = useState({
    name: '',
    model_type: 'random_forest',
    vt_symbol: 'rb2410.SHFE',
    interval: '1d',
    start: '2023-01-01',
    end: '2024-01-01',
    target_horizon: 5,
    n_estimators: 100,
    max_depth: 10,
  });

  const loadModels = async () => {
    try {
      const res = await mlApi.listModels();
      setModels(res.data);
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '加载失败');
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

  const handleTrain = async () => {
    if (!trainForm.name || !trainForm.vt_symbol) {
      Toast.error('请填写模型名称和合约');
      return;
    }

    setLoading(true);
    try {
      await mlApi.trainModel({
        name: trainForm.name,
        model_type: trainForm.model_type,
        vt_symbol: trainForm.vt_symbol,
        interval: trainForm.interval,
        start: trainForm.start,
        end: trainForm.end,
        feature_config: {
          target_horizon: trainForm.target_horizon,
          target_type: 'direction',
        },
        model_params: {
          n_estimators: trainForm.n_estimators,
          max_depth: trainForm.max_depth,
        },
      });
      Toast.success('模型训练完成');
      setShowCreateModal(false);
      loadModels();
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '训练失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await mlApi.deleteModel(name);
      Toast.success('模型已删除');
      loadModels();
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '删除失败');
    }
  };

  const viewDetail = async (model: MLModel) => {
    try {
      const res = await mlApi.getModelDetail(model.name);
      // 合并基础信息和详细数据
      setSelectedModel({ ...model, ...res.data });
      setShowDetailModal(true);
    } catch (err: any) {
      Toast.error('加载详情失败');
    }
  };

  const columns = [
    { title: '模型名称', dataIndex: 'name', key: 'name' },
    { title: '准确率', dataIndex: 'metrics', key: 'accuracy', render: (m: any) => `${(m.accuracy * 100).toFixed(1)}%` },
    { title: 'F1分数', dataIndex: 'metrics', key: 'f1', render: (m: any) => m.f1.toFixed(3) },
    { title: '特征数', dataIndex: 'features', key: 'features' },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', render: (v: string) => new Date(v).toLocaleDateString() },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: MLModel) => (
        <Space>
          <Button icon={<IconPlay />} size="small" onClick={() => viewDetail(record)}>详情</Button>
          <Button icon={<IconDelete />} type="danger" size="small" onClick={() => handleDelete(record.name)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title heading={4} style={{ margin: 0 }}>机器学习</Title>
        <Button theme="solid" icon={<IconPlus />} onClick={() => setShowCreateModal(true)}>训练新模型</Button>
      </div>

      <Card title="模型列表" style={{ borderRadius: 12 }}>
        <Table columns={columns} dataSource={models} pagination={false} empty={<Text type="tertiary">暂无模型</Text>} />
      </Card>

      <Modal title="训练新模型" visible={showCreateModal} onCancel={() => setShowCreateModal(false)} footer={null}>
        <div style={{ marginBottom: 12 }}>
          <Text strong>模型名称</Text>
          <Input value={trainForm.name} onChange={(v) => setTrainForm({ ...trainForm, name: v })} placeholder="my_model" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <Text strong>模型类型</Text>
          <Select
            value={trainForm.model_type}
            onChange={(v) => setTrainForm({ ...trainForm, model_type: v as string })}
            style={{ width: '100%' }}
            optionList={[
              { value: 'random_forest', label: '随机森林' },
              { value: 'gradient_boosting', label: '梯度提升' },
              { value: 'logistic_regression', label: '逻辑回归' },
            ]}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <Text strong>合约</Text>
          <Input value={trainForm.vt_symbol} onChange={(v) => setTrainForm({ ...trainForm, vt_symbol: v })} />
        </div>
        <Row gutter={8} style={{ marginBottom: 12 }}>
          <Col span={12}>
            <Text strong>开始日期</Text>
            <Input type="date" value={trainForm.start} onChange={(v) => setTrainForm({ ...trainForm, start: v })} />
          </Col>
          <Col span={12}>
            <Text strong>结束日期</Text>
            <Input type="date" value={trainForm.end} onChange={(v) => setTrainForm({ ...trainForm, end: v })} />
          </Col>
        </Row>
        <div style={{ marginBottom: 12 }}>
          <Text strong>预测周期</Text>
          <Input type="number" value={trainForm.target_horizon} onChange={(v) => setTrainForm({ ...trainForm, target_horizon: parseInt(v) || 5 })} suffix="天" />
        </div>
        <Button theme="solid" block loading={loading} onClick={handleTrain}>开始训练</Button>
      </Modal>

      <Modal
        title={`模型详情 - ${selectedModel?.name || ''}`}
        visible={showDetailModal}
        onCancel={() => setShowDetailModal(false)}
        footer={null}
        width={900}
        centered
      >
        {selectedModel && (
          <SimpleTabs defaultActiveKey="metrics">
            <TabPane tab="评估指标" itemKey="metrics">
              {selectedModel.evaluation ? (
                <ModelEvaluationCharts
                  data={{
                    metrics: selectedModel.metrics,
                    evaluation: selectedModel.evaluation,
                    feature_importance: selectedModel.feature_importance || {},
                  }}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <Text type="tertiary">该模型没有详细的评估数据</Text>
                </div>
              )}
            </TabPane>
            <TabPane tab="基本信息" itemKey="info">
              <Descriptions layout="horizontal">
                <Descriptions.Item itemKey="模型名称">{selectedModel.name}</Descriptions.Item>
                <Descriptions.Item itemKey="模型类型">{selectedModel.model_type || '未知'}</Descriptions.Item>
                <Descriptions.Item itemKey="特征数量">{selectedModel.features}</Descriptions.Item>
                <Descriptions.Item itemKey="创建时间">
                  {new Date(selectedModel.created_at).toLocaleString()}
                </Descriptions.Item>
              </Descriptions>
              {selectedModel.config && (
                <div style={{ marginTop: 16 }}>
                  <Text strong>特征配置:</Text>
                  <Descriptions style={{ marginTop: 8 }}>
                    <Descriptions.Item itemKey="预测周期">{selectedModel.config.target_horizon} 期</Descriptions.Item>
                    <Descriptions.Item itemKey="目标类型">{selectedModel.config.target_type}</Descriptions.Item>
                    <Descriptions.Item itemKey="技术指标">
                      {selectedModel.config.technical_indicators?.join(', ')}
                    </Descriptions.Item>
                  </Descriptions>
                </div>
              )}
            </TabPane>
            <TabPane tab="特征列表" itemKey="features">
              {selectedModel.feature_names ? (
                <div style={{ maxHeight: 400, overflow: 'auto' }}>
                  {selectedModel.feature_names.map((name, idx) => (
                    <div
                      key={`${selectedModel.name}-feature-${idx}`}
                      style={{
                        padding: '8px 12px',
                        borderBottom: '1px solid var(--semi-color-border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>{name}</span>
                      <span style={{ color: 'var(--semi-color-text-2)' }}>#{idx + 1}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <Text type="tertiary">暂无特征信息</Text>
              )}
            </TabPane>
          </SimpleTabs>
        )}
      </Modal>
    </div>
  );
}
