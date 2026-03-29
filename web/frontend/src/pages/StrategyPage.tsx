import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Grid, Card, CardContent, CardActions, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel, Alert,
} from '@mui/material';
import { strategyApi } from '../api';

export default function StrategyPage() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<string[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [msg, setMsg] = useState('');

  // 添加策略弹窗
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ class_name: '', strategy_name: '', vt_symbol: '' });
  const [classParams, setClassParams] = useState<Record<string, any>>({});
  const [addSetting, setAddSetting] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      const [cls, inst] = await Promise.all([strategyApi.classes(), strategyApi.instances()]);
      setClasses(cls.data);
      setInstances(inst.data);
    } catch { /* ignore */ }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setAddOpen(true); setAddForm({ class_name: '', strategy_name: '', vt_symbol: '' }); setClassParams({}); setAddSetting({}); };

  const handleClassChange = async (className: string) => {
    setAddForm({ ...addForm, class_name: className });
    try {
      const res = await strategyApi.classParams(className);
      setClassParams(res.data);
      const defaults: Record<string, string> = {};
      Object.entries(res.data).forEach(([k, v]: [string, any]) => { defaults[k] = String(v.default ?? ''); });
      setAddSetting(defaults);
    } catch { /* ignore */ }
  };

  const handleAdd = async () => {
    try {
      await strategyApi.add({ ...addForm, setting: addSetting });
      setAddOpen(false);
      setMsg(`策略 ${addForm.strategy_name} 已添加`);
      load();
    } catch (err: any) {
      setMsg(`添加失败: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleAction = async (action: string, name: string) => {
    try {
      if (action === 'init') await strategyApi.init(name);
      else if (action === 'start') await strategyApi.start(name);
      else if (action === 'stop') await strategyApi.stop(name);
      else if (action === 'remove') await strategyApi.remove(name);
      setMsg(`操作成功`);
      load();
    } catch (err: any) {
      setMsg(`操作失败: ${err.response?.data?.detail || err.message}`);
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight={600}>策略管理</Typography>
      {msg && <Alert severity={msg.includes('失败') ? 'error' : 'success'} sx={{ mb: 2 }} onClose={() => setMsg('')}>{msg}</Alert>}

      {/* 批量操作 */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        <Button variant="contained" size="small" onClick={openAdd}>添加策略</Button>
        <Button variant="outlined" size="small" onClick={() => strategyApi.initAll().then(load)}>全部初始化</Button>
        <Button variant="outlined" size="small" color="success" onClick={() => strategyApi.startAll().then(load)}>全部启动</Button>
        <Button variant="outlined" size="small" color="error" onClick={() => strategyApi.stopAll().then(load)}>全部停止</Button>
      </Box>

      {/* 策略类市场 */}
      <Typography variant="h6" gutterBottom>策略类</Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {classes.map((cls) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={cls}>
            <Card variant="outlined">
              <CardContent sx={{ pb: 1 }}>
                <Typography variant="subtitle1" fontWeight={600}>{cls}</Typography>
                <Typography variant="body2" color="text.secondary">CTA 策略模板</Typography>
              </CardContent>
              <CardActions>
                <Button size="small" onClick={() => { setAddForm({ ...addForm, class_name: cls }); handleClassChange(cls); setAddOpen(true); }}>
                  部署
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* 已部署策略 */}
      <Typography variant="h6" gutterBottom>已部署策略</Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>策略名</TableCell><TableCell>类名</TableCell>
              <TableCell>合约</TableCell><TableCell>状态</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {instances.length === 0 ? (
              <TableRow><TableCell colSpan={5} align="center">暂无策略实例</TableCell></TableRow>
            ) : instances.map((s) => (
              <TableRow key={s.strategy_name}>
                <TableCell>
                  <Button size="small" onClick={() => navigate(`/strategy/${s.strategy_name}`)}>{s.strategy_name}</Button>
                </TableCell>
                <TableCell>{s.class_name}</TableCell>
                <TableCell>{s.vt_symbol}</TableCell>
                <TableCell>
                  <Chip label={s.inited ? (s.trading ? '运行中' : '已初始化') : '未初始化'} size="small"
                    color={s.trading ? 'success' : s.inited ? 'info' : 'default'} />
                </TableCell>
                <TableCell>
                  <Button size="small" onClick={() => handleAction('init', s.strategy_name)}>初始化</Button>
                  <Button size="small" color="success" onClick={() => handleAction('start', s.strategy_name)}>启动</Button>
                  <Button size="small" color="error" onClick={() => handleAction('stop', s.strategy_name)}>停止</Button>
                  <Button size="small" color="error" onClick={() => handleAction('remove', s.strategy_name)}>删除</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 添加策略弹窗 */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>添加策略</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="dense">
            <InputLabel>策略类</InputLabel>
            <Select value={addForm.class_name} label="策略类" onChange={(e) => handleClassChange(e.target.value)}>
              {classes.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="策略名称" fullWidth margin="dense" value={addForm.strategy_name}
            onChange={(e) => setAddForm({ ...addForm, strategy_name: e.target.value })} />
          <TextField label="合约 (vt_symbol)" fullWidth margin="dense" value={addForm.vt_symbol}
            onChange={(e) => setAddForm({ ...addForm, vt_symbol: e.target.value })} placeholder="rb2410.SHFE" />
          {Object.entries(classParams).length > 0 && (
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>策略参数</Typography>
          )}
          {Object.entries(classParams).map(([key, val]: [string, any]) => (
            <TextField key={key} label={key} fullWidth size="small" margin="dense"
              value={addSetting[key] ?? ''} onChange={(e) => setAddSetting({ ...addSetting, [key]: e.target.value })}
              helperText={`默认: ${val.default ?? '-'}`} />
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleAdd} disabled={!addForm.class_name || !addForm.strategy_name}>添加</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
