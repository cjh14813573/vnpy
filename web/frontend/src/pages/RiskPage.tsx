import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Switch, TextField,
  Button, Alert, Grid,
} from '@mui/material';
import client from '../api/client';

interface RiskRule {
  name: string;
  active: boolean;
  setting: Record<string, any>;
}

export default function RiskPage() {
  const [rules, setRules] = useState<RiskRule[]>([]);
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      const res = await client.get('/api/risk/rules');
      setRules(res.data);
    } catch {
      // 501 — 后端集成中
      setRules([]);
    }
  };

  useEffect(() => { load(); }, []);

  const handleToggle = async (name: string, active: boolean) => {
    const rule = rules.find((r) => r.name === name);
    if (!rule) return;
    try {
      await client.put(`/api/risk/rules/${name}`, { active, setting: rule.setting });
      setRules(rules.map((r) => (r.name === name ? { ...r, active } : r)));
      setMsg(`${name} 已${active ? '启用' : '禁用'}`);
    } catch (err: any) {
      setMsg(`操作失败: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleSave = async (name: string, setting: Record<string, any>) => {
    const rule = rules.find((r) => r.name === name);
    if (!rule) return;
    try {
      await client.put(`/api/risk/rules/${name}`, { active: rule.active, setting });
      setMsg(`${name} 配置已保存`);
    } catch (err: any) {
      setMsg(`保存失败: ${err.response?.data?.detail || err.message}`);
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight={600}>风控设置</Typography>
      {msg && <Alert severity={msg.includes('失败') ? 'error' : 'success'} sx={{ mb: 2 }} onClose={() => setMsg('')}>{msg}</Alert>}

      {rules.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <Typography variant="h6">风控引擎集成中</Typography>
          <Typography variant="body2">当前版本暂不支持风控规则配置</Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {rules.map((rule) => (
            <Grid size={{ xs: 12, md: 6 }} key={rule.name}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight={600}>{rule.name}</Typography>
                    <Switch
                      checked={rule.active}
                      onChange={(e) => handleToggle(rule.name, e.target.checked)}
                    />
                  </Box>
                  {Object.entries(rule.setting).map(([key, value]) => (
                    <TextField
                      key={key}
                      label={key}
                      size="small"
                      fullWidth
                      margin="dense"
                      value={String(value)}
                      onChange={(e) => {
                        const newSetting = { ...rule.setting, [key]: e.target.value };
                        setRules(rules.map((r) => (r.name === rule.name ? { ...r, setting: newSetting } : r)));
                      }}
                    />
                  ))}
                  <Button variant="outlined" size="small" sx={{ mt: 1 }} onClick={() => handleSave(rule.name, rule.setting)}>
                    保存
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
