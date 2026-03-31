import { useEffect, useState } from 'react';
import { Typography, Card, Button, Input, Select, Row, Col, Toast, Space, Table, Tag, Progress, Modal, Descriptions } from '@douyinfe/semi-ui';
import { IconPlus, IconPlay, IconDelete, IconEye } from '@douyinfe/semi-icons';
import { mlApi } from '../api';

const { Title, Text } = Typography;

interface MLModel {
  name: string;
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    auc?: number;
  };
  created_at: string;
  features: number;
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
      const res = await mlApi.trainModel({
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
      setSelectedModel(res.data);
      setShowDetailModal(true);
    } catch (err: any) {
      Toast.error('加载详情失败');
    }
  };

  const columns = [
    { title: '模型名称', dataIndex: 'name' },
    { title: '准确率', dataIndex: 'metrics', render: (m: any) => `${(m.accuracy * 100).toFixed(1)}%` },
    { title: 'F1分数', dataIndex: 'metrics', render: (m: any) => m.f1.toFixed(3) },
    { title: '特征数', dataIndex: 'features' },
    { title: '创建时间', dataIndex: 'created_at', render: (v: string) => new Date(v).toLocaleDateString() },
    {
      title: '操作',
      render: (_: any, record: MLModel) => (
        <Space>
          <Button icon={<IconEye />} size="small" onClick={() => viewDetail(record)}>详情</Button>
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

      <Modal title="模型详情" visible={showDetailModal} onCancel={() => setShowDetailModal(false)} footer={null} width={700}>
        {selectedModel && (
          <Descriptions>
            <Descriptions.Item itemKey="名称">{selectedModel.name}</Descriptions.Item>
            <Descriptions.Item itemKey="准确率">{(selectedModel.metrics.accuracy * 100).toFixed(2)}%</Descriptions.Item>
            <Descriptions.Item itemKey="精确率">{(selectedModel.metrics.precision * 100).toFixed(2)}%</Descriptions.Item>
            <Descriptions.Item itemKey="召回率">{(selectedModel.metrics.recall * 100).toFixed(2)}%</Descriptions.Item>
            <Descriptions.Item itemKey="F1分数">{selectedModel.metrics.f1.toFixed(4)}</Descriptions.Item>
            {selectedModel.metrics.auc && <Descriptions.Item itemKey="AUC">{selectedModel.metrics.auc.toFixed(4)}</Descriptions.Item>}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
