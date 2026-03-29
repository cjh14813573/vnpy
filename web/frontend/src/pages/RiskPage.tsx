import { useEffect, useState } from 'react';
import { Typography, Card, Switch, Input, Button, Toast, Row, Col } from '@douyinfe/semi-ui';
import client from '../api/client';

export default function RiskPage() {
  const [rules, setRules] = useState<any[]>([]);

  const load = async () => {
    try { const res = await client.get('/api/risk/rules'); setRules(res.data); }
    catch { setRules([]); }
  };

  useEffect(() => { load(); }, []);

  const handleToggle = async (name: string, active: boolean) => {
    const rule = rules.find((r) => r.name === name);
    if (!rule) return;
    try { await client.put(`/api/risk/rules/${name}`, { active, setting: rule.setting }); setRules(rules.map((r) => (r.name === name ? { ...r, active } : r))); }
    catch { Toast.error('操作失败'); }
  };

  const handleSave = async (name: string, setting: Record<string, any>) => {
    const rule = rules.find((r) => r.name === name);
    if (!rule) return;
    try { await client.put(`/api/risk/rules/${name}`, { active: rule.active, setting }); Toast.success(`${name} 配置已保存`); }
    catch { Toast.error('保存失败'); }
  };

  return (
    <div>
      <Typography.Title heading={4}>风控设置</Typography.Title>
      {rules.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <Typography.Title heading={4} type="tertiary">风控引擎集成中</Typography.Title>
          <Typography.Text type="tertiary">当前版本暂不支持风控规则配置</Typography.Text>
        </div>
      ) : (
        <Row gutter={[16, 16]}>
          {rules.map((rule) => (
            <Col span={8} key={rule.name}>
              <Card bodyStyle={{ padding: 20 }} style={{ borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Typography.Text strong style={{ fontSize: 16 }}>{rule.name}</Typography.Text>
                  <Switch checked={rule.active} onChange={(v) => handleToggle(rule.name, v)} />
                </div>
                {Object.entries(rule.setting).map(([key, value]) => (
                  <div key={key}>
                    <label style={{ marginBottom: 4, display: 'block' }}>{key}</label>
                    <Input value={String(value)} onChange={(v) => {
                      const s = { ...rule.setting, [key]: v };
                      setRules(rules.map((r) => (r.name === rule.name ? { ...r, setting: s } : r)));
                    }} style={{ marginBottom: 8 }} />
                  </div>
                ))}
                <Button style={{ marginTop: 8, borderRadius: 8 }} onClick={() => handleSave(rule.name, rule.setting)}>保存</Button>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}
