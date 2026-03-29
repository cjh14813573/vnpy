import { useEffect, useState } from 'react';
import { Typography, Card, Button, Input, Tag, Row, Col, Toast, Modal, Space } from '@douyinfe/semi-ui';
import { systemApi } from '../api';

export default function SettingsPage() {
  const [gateways, setGateways] = useState<string[]>([]);
  const [apps, setApps] = useState<any[]>([]);
  const [exchanges, setExchanges] = useState<string[]>([]);

  const [connectOpen, setConnectOpen] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState('');
  const [gatewaySetting, setGatewaySetting] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      const [gw, app, ex] = await Promise.all([systemApi.gateways(), systemApi.apps(), systemApi.exchanges()]);
      setGateways(gw.data); setApps(app.data); setExchanges(ex.data);
    } catch { /* ignore */ }
  };

  useEffect(() => { load(); }, []);

  const openConnect = async (name: string) => {
    setSelectedGateway(name);
    try {
      const res = await systemApi.gatewaySetting(name);
      const s: Record<string, string> = {};
      Object.entries(res.data).forEach(([k, v]) => { s[k] = String(v ?? ''); });
      setGatewaySetting(s);
    } catch { setGatewaySetting({}); }
    setConnectOpen(true);
  };

  const handleConnect = async () => {
    try { await systemApi.connect({ gateway_name: selectedGateway, setting: gatewaySetting }); setConnectOpen(false); Toast.success(`${selectedGateway} 正在连接...`); }
    catch (err: any) { Toast.error(err.response?.data?.detail || '连接失败'); }
  };

  return (
    <div>
      <Typography.Title heading={4}>系统设置</Typography.Title>

      <Typography.Title heading={5}>网关管理</Typography.Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {gateways.map((gw) => (
          <Col span={6} key={gw}>
            <Card bodyStyle={{ padding: 20 }} style={{ borderRadius: 12 }}>
              <Typography.Text strong style={{ fontSize: 16 }}>{gw}</Typography.Text>
              <br /><Button theme="solid" size="small" style={{ marginTop: 12, borderRadius: 8 }} onClick={() => openConnect(gw)}>连接</Button>
            </Card>
          </Col>
        ))}
        {gateways.length === 0 && <Col><Typography.Text type="tertiary">暂无可用网关</Typography.Text></Col>}
      </Row>

      <Typography.Title heading={5}>应用模块</Typography.Title>
      <Space wrap style={{ marginBottom: 24 }}>
        {apps.map((app) => <Tag key={app.app_name} size="large">{app.display_name || app.app_name}</Tag>)}
      </Space>

      <Typography.Title heading={5}>支持交易所</Typography.Title>
      <Space wrap>
        {exchanges.map((ex) => <Tag key={ex}>{ex}</Tag>)}
      </Space>

      <Modal title={`连接网关: ${selectedGateway}`} visible={connectOpen} onCancel={() => setConnectOpen(false)} footer={null}>
        <div>
          {Object.entries(gatewaySetting).length === 0 ? (
            <Typography.Text type="tertiary">该网关无需配置</Typography.Text>
          ) : Object.entries(gatewaySetting).map(([key, val]) => (
            <div key={key}>
              <label style={{ marginBottom: 4, display: 'block' }}>{key}</label>
              <Input value={val} onChange={(v) => setGatewaySetting({ ...gatewaySetting, [key]: v })} style={{ marginBottom: 12 }}
                type={key.includes('密码') || key.toLowerCase().includes('password') ? 'password' : 'text'} />
            </div>
          ))}
          <Button theme="solid" block onClick={handleConnect} style={{ borderRadius: 10 }}>连接</Button>
        </div>
      </Modal>
    </div>
  );
}
