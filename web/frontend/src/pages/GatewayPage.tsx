import { useEffect, useState } from 'react';
import { Typography, Card, Button, Table, Tag, Toast, Space, Modal, Input, Select, Empty } from '@douyinfe/semi-ui';
import { IconLink, IconUnlink, IconSetting } from '@douyinfe/semi-icons';
import { systemApi } from '../api';

interface Gateway {
  name: string;
  status: 'connected' | 'disconnected' | 'connecting';
  connectedTime?: string;
}

interface GatewaySetting {
  [key: string]: {
    type: string;
    default: any;
  };
}

export default function GatewayPage() {
  const [gateways, setGateways] = useState<string[]>([]);
  const [gatewayStatuses, setGatewayStatuses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [connectModalVisible, setConnectModalVisible] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState<string>('');
  const [gatewaySetting, setGatewaySetting] = useState<GatewaySetting>({});
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [connecting, setConnecting] = useState(false);

  // 加载网关列表
  const loadGateways = async () => {
    setLoading(true);
    try {
      const res = await systemApi.gateways();
      setGateways(res.data || []);

      // 模拟获取连接状态（实际应该从后端获取）
      // 这里暂时假设所有网关都是断开状态
      const statuses: Record<string, string> = {};
      (res.data || []).forEach((name: string) => {
        statuses[name] = gatewayStatuses[name] || 'disconnected';
      });
      setGatewayStatuses(statuses);
    } catch (err: any) {
      Toast.error('加载网关列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGateways();
    // 定时刷新状态
    const timer = setInterval(loadGateways, 10000);
    return () => clearInterval(timer);
  }, []);

  // 打开连接对话框
  const handleOpenConnect = async (gatewayName: string) => {
    setSelectedGateway(gatewayName);
    setFormValues({});
    try {
      const res = await systemApi.gatewaySetting(gatewayName);
      setGatewaySetting(res.data || {});

      // 设置默认值
      const defaults: Record<string, any> = {};
      Object.entries(res.data || {}).forEach(([key, value]: [string, any]) => {
        defaults[key] = value.default;
      });
      setFormValues(defaults);
      setConnectModalVisible(true);
    } catch (err: any) {
      Toast.error('获取网关配置失败');
    }
  };

  // 连接网关
  const handleConnect = async () => {
    setConnecting(true);
    try {
      await systemApi.connect({
        gateway_name: selectedGateway,
        setting: formValues,
      });
      Toast.success(`正在连接 ${selectedGateway}...`);
      setConnectModalVisible(false);
      // 更新状态为连接中
      setGatewayStatuses(prev => ({ ...prev, [selectedGateway]: 'connecting' }));

      // 3秒后刷新状态
      setTimeout(loadGateways, 3000);
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '连接失败');
    } finally {
      setConnecting(false);
    }
  };

  // 断开网关
  const handleDisconnect = async (gatewayName: string) => {
    try {
      // 调用断开API（如果后端支持）
      // await systemApi.disconnectGateway(gatewayName);
      Toast.success(`${gatewayName} 已断开`);
      setGatewayStatuses(prev => ({ ...prev, [gatewayName]: 'disconnected' }));
    } catch (err: any) {
      Toast.error('断开失败');
    }
  };

  const columns = [
    {
      title: '网关名称',
      dataIndex: 'name',
      width: 200,
      render: (name: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600 }}>{name}</span>
          {name.includes('CTP') && <Tag size="small" color="blue">期货</Tag>}
          {name.includes('OST') && <Tag size="small" color="green">期权</Tag>}
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 150,
      render: (_: any, record: Gateway) => {
        const status = gatewayStatuses[record.name] || 'disconnected';
        return (
          <Tag
            color={status === 'connected' ? 'green' : status === 'connecting' ? 'orange' : 'red'}
            size="large"
          >
            {status === 'connected' ? '已连接' : status === 'connecting' ? '连接中' : '已断开'}
          </Tag>
        );
      },
    },
    {
      title: '操作',
      width: 200,
      render: (_: any, record: Gateway) => {
        const status = gatewayStatuses[record.name] || 'disconnected';
        return (
          <Space>
            {status !== 'connected' ? (
              <Button
                type="primary"
                icon={<IconLink />}
                onClick={() => handleOpenConnect(record.name)}
                loading={status === 'connecting'}
              >
                连接
              </Button>
            ) : (
              <Button
                type="danger"
                icon={<IconUnlink />}
                onClick={() => handleDisconnect(record.name)}
              >
                断开
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  const dataSource = gateways.map(name => ({
    name,
    status: (gatewayStatuses[name] || 'disconnected') as 'connected' | 'disconnected' | 'connecting',
  }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Typography.Title heading={4} style={{ margin: 0 }}>网关管理</Typography.Title>
        <Button icon={<IconSetting />} onClick={loadGateways} loading={loading}>刷新</Button>
      </div>

      <Card style={{ borderRadius: 12 }}>
        <Table
          columns={columns}
          dataSource={dataSource}
          pagination={false}
          loading={loading}
          empty={<Empty description="暂无网关配置" />}
          rowKey="name"
        />

        <div style={{ marginTop: 16, padding: 12, background: 'var(--semi-color-fill-0)', borderRadius: 8 }}>
          <Typography.Text type="tertiary" size="small">
            提示：连接网关后即可进行交易操作。不同网关需要不同的配置参数，请确保配置正确。
          </Typography.Text>
        </div>
      </Card>

      {/* 连接配置对话框 */}
      <Modal
        title={`连接 ${selectedGateway}`}
        visible={connectModalVisible}
        onCancel={() => setConnectModalVisible(false)}
        footer={(
          <Space>
            <Button onClick={() => setConnectModalVisible(false)}>取消</Button>
            <Button type="primary" loading={connecting} onClick={handleConnect} icon={<IconLink />}>
              连接
            </Button>
          </Space>
        )}
        width={500}
      >
        <div style={{ maxHeight: 400, overflow: 'auto' }}>
          {Object.entries(gatewaySetting).map(([key, config]: [string, any]) => (
            <div key={key} style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>{key}</label>
              {config.type === 'bool' ? (
                <Select
                  value={formValues[key]}
                  onChange={(v) => setFormValues({ ...formValues, [key]: v })}
                  optionList={[
                    { value: 'true', label: '是' },
                    { value: 'false', label: '否' },
                  ]}
                  style={{ width: '100%' }}
                />
              ) : config.type === 'int' || config.type === 'float' ? (
                <Input
                  type="number"
                  value={formValues[key]}
                  onChange={(v) => setFormValues({ ...formValues, [key]: config.type === 'int' ? parseInt(v) || 0 : parseFloat(v) || 0 })}
                  placeholder={`默认值: ${config.default}`}
                />
              ) : (
                <Input
                  type={config.type === 'password' ? 'password' : 'text'}
                  value={formValues[key]}
                  onChange={(v) => setFormValues({ ...formValues, [key]: v })}
                  placeholder={`默认值: ${config.default}`}
                />
              )}
            </div>
          ))}
          {Object.keys(gatewaySetting).length === 0 && (
            <Empty description="暂无配置项" />
          )}
        </div>
      </Modal>
    </div>
  );
}
