import { useEffect, useState } from 'react';
import { Typography, Card, Button, Input, Tag, Row, Col, Toast, Modal, Space, Switch, Select, Spin, Tabs, Divider } from '@douyinfe/semi-ui';
import { IconRefresh, IconSetting, IconUndo } from '@douyinfe/semi-icons';
import { systemApi, settingsApi } from '../api';

interface Settings {
  trading: {
    default_volume: number;
    default_slippage: number;
    confirm_before_order: boolean;
    auto_refresh_interval: number;
  };
  backtest: {
    default_capital: number;
    default_rate: number;
    default_slippage: number;
    default_size: number;
    default_interval: string;
  };
  display: {
    theme: string;
    chart_type: string;
    show_trade_markers: boolean;
    language: string;
  };
  notification: {
    order_filled: boolean;
    order_rejected: boolean;
    stop_loss_triggered: boolean;
    take_profit_triggered: boolean;
    price_alert: boolean;
  };
  risk: {
    daily_loss_limit: number;
    single_order_limit: number;
    enable_order_flow_control: boolean;
  };
}

const DEFAULT_SETTINGS: Settings = {
  trading: {
    default_volume: 1,
    default_slippage: 0,
    confirm_before_order: true,
    auto_refresh_interval: 3,
  },
  backtest: {
    default_capital: 1000000,
    default_rate: 0.0001,
    default_slippage: 0,
    default_size: 1,
    default_interval: '1m',
  },
  display: {
    theme: 'light',
    chart_type: 'lightweight',
    show_trade_markers: true,
    language: 'zh-CN',
  },
  notification: {
    order_filled: true,
    order_rejected: true,
    stop_loss_triggered: true,
    take_profit_triggered: true,
    price_alert: true,
  },
  risk: {
    daily_loss_limit: 10000,
    single_order_limit: 100,
    enable_order_flow_control: true,
  },
};

export default function SettingsPage() {
  const [gateways, setGateways] = useState<string[]>([]);
  const [apps, setApps] = useState<any[]>([]);
  const [exchanges, setExchanges] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [, setSaving] = useState(false);

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const [connectOpen, setConnectOpen] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState('');
  const [gatewaySetting, setGatewaySetting] = useState<Record<string, string>>({});

  // 加载系统信息和设置
  const load = async () => {
    setLoading(true);
    try {
      const [gw, app, ex, settingsRes] = await Promise.all([
        systemApi.gateways(),
        systemApi.apps(),
        systemApi.exchanges(),
        settingsApi.getAll(),
      ]);
      setGateways(gw.data);
      setApps(app.data);
      setExchanges(ex.data);

      if (settingsRes.data) {
        setSettings({ ...DEFAULT_SETTINGS, ...settingsRes.data });
      }
    } catch (err: any) {
      Toast.error('加载设置失败: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // 保存设置
  const saveSettings = async (category: keyof Settings, updates: Partial<Settings[typeof category]>) => {
    setSaving(true);
    try {
      await settingsApi.updateCategory(category, updates);
      setSettings(prev => ({ ...prev, [category]: { ...prev[category], ...updates } }));
      Toast.success('设置已保存');
    } catch (err: any) {
      Toast.error('保存失败: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  };

  // 重置设置
  const resetSettings = async (category?: string) => {
    try {
      await settingsApi.reset(category);
      await load();
      Toast.success(category ? `${category} 已重置` : '所有设置已重置');
    } catch (err: any) {
      Toast.error('重置失败: ' + (err.response?.data?.detail || err.message));
    }
  };

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
    try {
      await systemApi.connect({ gateway_name: selectedGateway, setting: gatewaySetting });
      setConnectOpen(false);
      Toast.success(`${selectedGateway} 正在连接...`);
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '连接失败');
    }
  };

  const { Title, Text } = Typography;
  const { TabPane } = Tabs;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title heading={4}>
          <IconSetting style={{ marginRight: 8 }} />
          系统设置
        </Title>
        <Space>
          <Button icon={<IconRefresh />} onClick={load} loading={loading}>刷新</Button>
          <Button icon={<IconUndo />} type="warning" onClick={() => resetSettings()}>重置所有</Button>
        </Space>
      </div>

      <Spin spinning={loading}>
        <Tabs type="line">
          <TabPane tab="交易设置" itemKey="trading">
            <Card style={{ borderRadius: 12 }}>
              <Row gutter={[24, 24]}>
                <Col span={12}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8 }}>默认下单数量</label>
                    <Input
                      type="number"
                      value={settings.trading.default_volume}
                      onChange={(v) => setSettings(prev => ({ ...prev, trading: { ...prev.trading, default_volume: parseInt(v) || 1 } }))}
                      onBlur={() => saveSettings('trading', { default_volume: settings.trading.default_volume })}
                      style={{ width: 200 }}
                    />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8 }}>默认滑点（跳）</label>
                    <Input
                      type="number"
                      value={settings.trading.default_slippage}
                      onChange={(v) => setSettings(prev => ({ ...prev, trading: { ...prev.trading, default_slippage: parseFloat(v) || 0 } }))}
                      onBlur={() => saveSettings('trading', { default_slippage: settings.trading.default_slippage })}
                      style={{ width: 200 }}
                    />
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8 }}>下单前确认</label>
                    <Switch
                      checked={settings.trading.confirm_before_order}
                      onChange={(v) => saveSettings('trading', { confirm_before_order: v })}
                    />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8 }}>自动刷新间隔（秒）</label>
                    <Input
                      type="number"
                      value={settings.trading.auto_refresh_interval}
                      onChange={(v) => setSettings(prev => ({ ...prev, trading: { ...prev.trading, auto_refresh_interval: parseInt(v) || 3 } }))}
                      onBlur={() => saveSettings('trading', { auto_refresh_interval: settings.trading.auto_refresh_interval })}
                      style={{ width: 200 }}
                    />
                  </div>
                </Col>
              </Row>
              <Divider />
              <Button type="tertiary" icon={<IconUndo />} onClick={() => resetSettings('trading')}>重置交易设置</Button>
            </Card>
          </TabPane>

          <TabPane tab="回测设置" itemKey="backtest">
            <Card style={{ borderRadius: 12 }}>
              <Row gutter={[24, 24]}>
                <Col span={12}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8 }}>默认初始资金</label>
                    <Input
                      type="number"
                      value={settings.backtest.default_capital}
                      onChange={(v) => setSettings(prev => ({ ...prev, backtest: { ...prev.backtest, default_capital: parseFloat(v) || 1000000 } }))}
                      onBlur={() => saveSettings('backtest', { default_capital: settings.backtest.default_capital })}
                      style={{ width: 200 }}
                    />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8 }}>默认手续费率</label>
                    <Input
                      type="number"
                      value={settings.backtest.default_rate}
                      onChange={(v) => setSettings(prev => ({ ...prev, backtest: { ...prev.backtest, default_rate: parseFloat(v) || 0.0001 } }))}
                      onBlur={() => saveSettings('backtest', { default_rate: settings.backtest.default_rate })}
                      style={{ width: 200 }}
                    />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8 }}>默认滑点</label>
                    <Input
                      type="number"
                      value={settings.backtest.default_slippage}
                      onChange={(v) => setSettings(prev => ({ ...prev, backtest: { ...prev.backtest, default_slippage: parseFloat(v) || 0 } }))}
                      onBlur={() => saveSettings('backtest', { default_slippage: settings.backtest.default_slippage })}
                      style={{ width: 200 }}
                    />
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8 }}>默认合约乘数</label>
                    <Input
                      type="number"
                      value={settings.backtest.default_size}
                      onChange={(v) => setSettings(prev => ({ ...prev, backtest: { ...prev.backtest, default_size: parseInt(v) || 1 } }))}
                      onBlur={() => saveSettings('backtest', { default_size: settings.backtest.default_size })}
                      style={{ width: 200 }}
                    />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8 }}>默认时间周期</label>
                    <Select
                      value={String(settings.backtest.default_interval)}
                      onChange={(v) => saveSettings('backtest', { default_interval: v as string })}
                      style={{ width: 200 }}
                      optionList={[
                        { value: '1m', label: '1分钟' },
                        { value: '5m', label: '5分钟' },
                        { value: '15m', label: '15分钟' },
                        { value: '1h', label: '1小时' },
                        { value: 'd', label: '日线' },
                      ]}
                    />
                  </div>
                </Col>
              </Row>
              <Divider />
              <Button type="tertiary" icon={<IconUndo />} onClick={() => resetSettings('backtest')}>重置回测设置</Button>
            </Card>
          </TabPane>

          <TabPane tab="显示设置" itemKey="display">
            <Card style={{ borderRadius: 12 }}>
              <Row gutter={[24, 24]}>
                <Col span={12}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8 }}>主题</label>
                    <Select
                      value={String(settings.display.theme)}
                      onChange={(v) => saveSettings('display', { theme: v as string })}
                      style={{ width: 200 }}
                      optionList={[
                        { value: 'light', label: '浅色' },
                        { value: 'dark', label: '深色' },
                      ]}
                    />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8 }}>图表类型</label>
                    <Select
                      value={String(settings.display.chart_type)}
                      onChange={(v) => saveSettings('display', { chart_type: v as string })}
                      style={{ width: 200 }}
                      optionList={[
                        { value: 'lightweight', label: 'Lightweight Charts' },
                        { value: 'echarts', label: 'ECharts' },
                      ]}
                    />
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8 }}>显示交易标记</label>
                    <Switch
                      checked={settings.display.show_trade_markers}
                      onChange={(v) => saveSettings('display', { show_trade_markers: v })}
                    />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8 }}>语言</label>
                    <Select
                      value={String(settings.display.language)}
                      onChange={(v) => saveSettings('display', { language: v as string })}
                      style={{ width: 200 }}
                      optionList={[
                        { value: 'zh-CN', label: '简体中文' },
                        { value: 'en-US', label: 'English' },
                      ]}
                    />
                  </div>
                </Col>
              </Row>
              <Divider />
              <Button type="tertiary" icon={<IconUndo />} onClick={() => resetSettings('display')}>重置显示设置</Button>
            </Card>
          </TabPane>

          <TabPane tab="通知设置" itemKey="notification">
            <Card style={{ borderRadius: 12 }}>
              <Row gutter={[24, 24]}>
                <Col span={12}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8 }}>订单成交通知</label>
                    <Switch
                      checked={settings.notification.order_filled}
                      onChange={(v) => saveSettings('notification', { order_filled: v })}
                    />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8 }}>订单拒绝通知</label>
                    <Switch
                      checked={settings.notification.order_rejected}
                      onChange={(v) => saveSettings('notification', { order_rejected: v })}
                    />
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8 }}>止损触发通知</label>
                    <Switch
                      checked={settings.notification.stop_loss_triggered}
                      onChange={(v) => saveSettings('notification', { stop_loss_triggered: v })}
                    />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8 }}>止盈触发通知</label>
                    <Switch
                      checked={settings.notification.take_profit_triggered}
                      onChange={(v) => saveSettings('notification', { take_profit_triggered: v })}
                    />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8 }}>价格预警通知</label>
                    <Switch
                      checked={settings.notification.price_alert}
                      onChange={(v) => saveSettings('notification', { price_alert: v })}
                    />
                  </div>
                </Col>
              </Row>
              <Divider />
              <Button type="tertiary" icon={<IconUndo />} onClick={() => resetSettings('notification')}>重置通知设置</Button>
            </Card>
          </TabPane>

          <TabPane tab="风控设置" itemKey="risk">
            <Card style={{ borderRadius: 12 }}>
              <Row gutter={[24, 24]}>
                <Col span={12}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8 }}>日亏损限制</label>
                    <Input
                      type="number"
                      value={settings.risk.daily_loss_limit}
                      onChange={(v) => setSettings(prev => ({ ...prev, risk: { ...prev.risk, daily_loss_limit: parseFloat(v) || 10000 } }))}
                      onBlur={() => saveSettings('risk', { daily_loss_limit: settings.risk.daily_loss_limit })}
                      style={{ width: 200 }}
                    />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8 }}>单笔订单数量限制</label>
                    <Input
                      type="number"
                      value={settings.risk.single_order_limit}
                      onChange={(v) => setSettings(prev => ({ ...prev, risk: { ...prev.risk, single_order_limit: parseInt(v) || 100 } }))}
                      onBlur={() => saveSettings('risk', { single_order_limit: settings.risk.single_order_limit })}
                      style={{ width: 200 }}
                    />
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8 }}>启用订单流控</label>
                    <Switch
                      checked={settings.risk.enable_order_flow_control}
                      onChange={(v) => saveSettings('risk', { enable_order_flow_control: v })}
                    />
                  </div>
                </Col>
              </Row>
              <Divider />
              <Button type="tertiary" icon={<IconUndo />} onClick={() => resetSettings('risk')}>重置风控设置</Button>
            </Card>
          </TabPane>

          <TabPane tab="网关管理" itemKey="gateways">
            <Card style={{ borderRadius: 12 }}>
              <Title heading={5}>网关管理</Title>
              <Row gutter={[16, 16]} style={{ marginBottom: 24, marginTop: 16 }}>
                {gateways.map((gw) => (
                  <Col span={6} key={gw}>
                    <Card bodyStyle={{ padding: 20 }} style={{ borderRadius: 12 }}>
                      <Text strong style={{ fontSize: 16 }}>{gw}</Text>
                      <br /><Button theme="solid" size="small" style={{ marginTop: 12, borderRadius: 8 }} onClick={() => openConnect(gw)}>连接</Button>
                    </Card>
                  </Col>
                ))}
                {gateways.length === 0 && <Col><Text type="tertiary">暂无可用网关</Text></Col>}
              </Row>

              <Title heading={5}>应用模块</Title>
              <Space wrap style={{ marginBottom: 24 }}>
                {apps.map((app) => <Tag key={app.app_name} size="large">{app.display_name || app.app_name}</Tag>)}
              </Space>

              <Title heading={5}>支持交易所</Title>
              <Space wrap>
                {exchanges.map((ex) => <Tag key={ex}>{ex}</Tag>)}
              </Space>
            </Card>
          </TabPane>
        </Tabs>
      </Spin>

      <Modal title={`连接网关: ${selectedGateway}`} visible={connectOpen} onCancel={() => setConnectOpen(false)} footer={null}>
        <div>
          {Object.entries(gatewaySetting).length === 0 ? (
            <Text type="tertiary">该网关无需配置</Text>
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
