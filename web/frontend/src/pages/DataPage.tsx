import { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Alert, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, FormControl,
  InputLabel, Select, MenuItem,
} from '@mui/material';
import { dataApi } from '../api';

export default function DataPage() {
  const [overview, setOverview] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [dlForm, setDlForm] = useState({ vt_symbol: '', start: '2024-01-01', end: '2024-12-31', interval: '1m' });

  const load = async () => {
    try {
      const res = await dataApi.overview();
      setOverview(res.data);
    } catch { /* 501 时忽略 */ }
  };

  useEffect(() => { load(); }, []);

  const handleDownload = async () => {
    try {
      await dataApi.download(dlForm);
      setDownloadOpen(false);
      setMsg('下载已启动');
      load();
    } catch (err: any) {
      setMsg(`下载失败: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleDelete = async (vt_symbol: string, interval: string) => {
    try {
      await dataApi.delete({ vt_symbol, interval });
      setMsg('数据已删除');
      load();
    } catch (err: any) {
      setMsg(`删除失败: ${err.response?.data?.detail || err.message}`);
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight={600}>数据管理</Typography>
      {msg && <Alert severity={msg.includes('失败') ? 'error' : 'success'} sx={{ mb: 2 }} onClose={() => setMsg('')}>{msg}</Alert>}

      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        <Button variant="contained" onClick={() => setDownloadOpen(true)}>下载数据</Button>
      </Box>

      <Typography variant="h6" gutterBottom>数据概览</Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>合约</TableCell>
              <TableCell>交易所</TableCell>
              <TableCell>周期</TableCell>
              <TableCell align="right">数据量</TableCell>
              <TableCell align="right">开始日期</TableCell>
              <TableCell align="right">结束日期</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {overview.length === 0 ? (
              <TableRow><TableCell colSpan={7} align="center">暂无数据概览（后端引擎集成中）</TableCell></TableRow>
            ) : overview.map((d, i) => (
              <TableRow key={i}>
                <TableCell>{d.symbol}</TableCell>
                <TableCell>{d.exchange}</TableCell>
                <TableCell>{d.interval}</TableCell>
                <TableCell align="right">{d.count}</TableCell>
                <TableCell align="right">{d.start}</TableCell>
                <TableCell align="right">{d.end}</TableCell>
                <TableCell>
                  <Button size="small" color="error" onClick={() => handleDelete(`${d.symbol}.${d.exchange}`, d.interval)}>删除</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 下载弹窗 */}
      <Dialog open={downloadOpen} onClose={() => setDownloadOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>下载历史数据</DialogTitle>
        <DialogContent>
          <TextField label="合约 (vt_symbol)" fullWidth margin="dense"
            value={dlForm.vt_symbol} onChange={(e) => setDlForm({ ...dlForm, vt_symbol: e.target.value })} />
          <TextField label="开始日期" type="date" fullWidth margin="dense"
            value={dlForm.start} onChange={(e) => setDlForm({ ...dlForm, start: e.target.value })}
            slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="结束日期" type="date" fullWidth margin="dense"
            value={dlForm.end} onChange={(e) => setDlForm({ ...dlForm, end: e.target.value })}
            slotProps={{ inputLabel: { shrink: true } }} />
          <FormControl fullWidth margin="dense">
            <InputLabel>周期</InputLabel>
            <Select value={dlForm.interval} label="周期" onChange={(e) => setDlForm({ ...dlForm, interval: e.target.value })}>
              <MenuItem value="1m">1分钟</MenuItem>
              <MenuItem value="1h">1小时</MenuItem>
              <MenuItem value="d">日线</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDownloadOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleDownload}>下载</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
