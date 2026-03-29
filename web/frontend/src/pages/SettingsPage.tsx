import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Button, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, Grid, Chip,
} from '@mui/material';
import { systemApi } from '../api';

export default function SettingsPage() {
  const [gateways, setGateways] = useState<string[]>([]);
  const [apps, setApps] = useState<any[]>([]);
  const [exchanges, setExchanges] = useState<string[]>([]);
  const [msg, setMsg] = useState('');

  // 网关连接弹窗
  const [connectOpen, setConnectOpen] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState('');
  const [gatewaySetting, setGatewaySetting] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      const [gw, app, ex] = await Promise.all([
        systemApi.gateways(), systemApi.apps(), systemApi.exchanges(),
      ]);
      setGateways(gw.data);
      setApps(app.data);
      setExchanges(ex.data);
    } catch { /* ignore */ }
  };

  useEffect(() => { load(); }, []);

  const openConnect = async (name: string) => {
    setSelectedGateway(name);
    try {
      const res = await systemApi.gatewaySetting(name);
      const settings: Record<string, string> = {};
      Object.entries(res.data).forEach(([k, v]) => { settings[k] = String(v ?? ''); });
      setGatewaySetting(settings);
    } catch {
      setGatewaySetting({});
    }
    setConnectOpen(true);
  };

  const handleConnect = async () => {
    try {
      await systemApi.connect({ gateway_name: selectedGateway, setting: gatewaySetting });
      setConnectOpen(false);
      setMsg(`${selectedGateway} 正在连接...`);
    } catch (err: any) {
      setMsg(`连接失败: ${err.response?.data?.detail || err.message}`);
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight={600}>系统设置</Typography>
      {msg && <Alert severity={msg.includes('失败') ? 'error' : 'success'} sx={{ mb: 2 }} onClose={() => setMsg('')}>{msg}</Alert>}

      {/* 网关管理 */}
      <Typography variant="h6" gutterBottom>网关管理</Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {gateways.map((gw) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={gw}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600}>{gw}</Typography>
                <Button variant="contained" size="small" sx={{ mt: 1 }} onClick={() => openConnect(gw)}>
                  连接
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
        {gateways.length === 0 && (
          <Grid size={12}>
            <Typography color="text.secondary">暂无可用网关</Typography>
          </Grid>
        )}
      </Grid>

      {/* 已加载应用 */}
      <Typography variant="h6" gutterBottom>应用模块</Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
        {apps.map((app) => (
          <Chip key={app.app_name} label={app.display_name || app.app_name} variant="outlined" />
        ))}
      </Box>

      {/* 支持交易所 */}
      <Typography variant="h6" gutterBottom>支持交易所</Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {exchanges.map((ex) => (
          <Chip key={ex} label={ex} size="small" />
        ))}
      </Box>

      {/* 连接弹窗 */}
      <Dialog open={connectOpen} onClose={() => setConnectOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>连接网关: {selectedGateway}</DialogTitle>
        <DialogContent>
          {Object.entries(gatewaySetting).length === 0 ? (
            <Typography color="text.secondary">该网关无需配置</Typography>
          ) : Object.entries(gatewaySetting).map(([key, val]) => (
            <TextField key={key} label={key} fullWidth size="small" margin="dense"
              value={val} onChange={(e) => setGatewaySetting({ ...gatewaySetting, [key]: e.target.value })}
              type={key.includes('密码') || key.toLowerCase().includes('password') ? 'password' : 'text'} />
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConnectOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleConnect}>连接</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
