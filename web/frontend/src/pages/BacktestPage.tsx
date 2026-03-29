import { useEffect, useState } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, TextField, Button,
  Select, MenuItem, FormControl, InputLabel, Alert,
} from '@mui/material';
import { backtestApi } from '../api';

export default function BacktestPage() {
  const [classes, setClasses] = useState<string[]>([]);
  const [msg, setMsg] = useState('');
  const [result, setResult] = useState<any>(null);

  const [form, setForm] = useState({
    class_name: '', vt_symbol: '', interval: '1m',
    start: '2024-01-01', end: '2024-12-31',
    rate: '0.0001', slippage: '0', size: '1', capital: '1000000',
  });

  useEffect(() => {
    backtestApi.classes().then((r) => setClasses(r.data)).catch(() => {});
  }, []);

  const handleRun = async () => {
    setMsg(''); setResult(null);
    try {
      const res = await backtestApi.run({
        ...form, rate: parseFloat(form.rate), slippage: parseFloat(form.slippage),
        size: parseFloat(form.size), capital: parseFloat(form.capital), setting: {},
      });
      setResult(res.data);
      setMsg('回测完成');
    } catch (err: any) {
      setMsg(`回测失败: ${err.response?.data?.detail || err.message}`);
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight={600}>回测中心</Typography>
      {msg && <Alert severity={msg.includes('失败') ? 'error' : 'success'} sx={{ mb: 2 }}>{msg}</Alert>}

      <Grid container spacing={2}>
        {/* 配置表单 */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>回测配置</Typography>
              <FormControl fullWidth size="small" margin="dense">
                <InputLabel>策略类</InputLabel>
                <Select value={form.class_name} label="策略类"
                  onChange={(e) => setForm({ ...form, class_name: e.target.value })}>
                  {classes.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField label="合约" fullWidth size="small" margin="dense"
                value={form.vt_symbol} onChange={(e) => setForm({ ...form, vt_symbol: e.target.value })}
                placeholder="rb2410.SHFE" />
              <FormControl fullWidth size="small" margin="dense">
                <InputLabel>周期</InputLabel>
                <Select value={form.interval} label="周期"
                  onChange={(e) => setForm({ ...form, interval: e.target.value })}>
                  <MenuItem value="1m">1分钟</MenuItem>
                  <MenuItem value="1h">1小时</MenuItem>
                  <MenuItem value="d">日线</MenuItem>
                  <MenuItem value="w">周线</MenuItem>
                </Select>
              </FormControl>
              <TextField label="开始日期" fullWidth size="small" margin="dense" type="date"
                value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }} />
              <TextField label="结束日期" fullWidth size="small" margin="dense" type="date"
                value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }} />
              <TextField label="手续费率" fullWidth size="small" margin="dense" type="number"
                value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
              <TextField label="滑点" fullWidth size="small" margin="dense" type="number"
                value={form.slippage} onChange={(e) => setForm({ ...form, slippage: e.target.value })} />
              <TextField label="合约乘数" fullWidth size="small" margin="dense" type="number"
                value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} />
              <TextField label="初始资金" fullWidth size="small" margin="dense" type="number"
                value={form.capital} onChange={(e) => setForm({ ...form, capital: e.target.value })} />
              <Button variant="contained" fullWidth sx={{ mt: 2 }} onClick={handleRun}
                disabled={!form.class_name || !form.vt_symbol}>
                执行回测
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* 结果 */}
        <Grid size={{ xs: 12, md: 8 }}>
          {result ? (
            <>
              <Typography variant="h6" gutterBottom>回测结果</Typography>
              <Grid container spacing={1} sx={{ mb: 2 }}>
                {Object.entries(result.statistics || result).slice(0, 8).map(([k, v]) => (
                  <Grid size={{ xs: 6, sm: 4, md: 3 }} key={k}>
                    <Card variant="outlined">
                      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Typography variant="caption" color="text.secondary">{k}</Typography>
                        <Typography variant="body1" fontWeight={600}>{String(v)}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </>
          ) : (
            <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
              <Typography variant="h6">配置参数后执行回测</Typography>
              <Typography variant="body2">回测结果将在此展示</Typography>
            </Box>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
