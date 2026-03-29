import { useEffect, useState } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, TextField, Button,
  Select, MenuItem, FormControl, InputLabel, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Alert,
} from '@mui/material';
import { tradingApi } from '../api';

export default function TradingPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [, setAccounts] = useState<any[]>([]);
  const [msg, setMsg] = useState('');

  // 下单表单
  const [form, setForm] = useState({
    symbol: '', exchange: 'SHFE', direction: '多', type: '限价',
    volume: '1', price: '', offset: '开', gateway_name: 'CTP',
  });

  const load = async () => {
    try {
      const [o, t, p, a] = await Promise.all([
        tradingApi.activeOrders(), tradingApi.trades(),
        tradingApi.positions(), tradingApi.accounts(),
      ]);
      setOrders(o.data); setTrades(t.data);
      setPositions(p.data); setAccounts(a.data);
    } catch { /* ignore */ }
  };

  useEffect(() => { load(); const timer = setInterval(load, 3000); return () => clearInterval(timer); }, []);

  const handleSendOrder = async () => {
    setMsg('');
    try {
      const res = await tradingApi.sendOrder({
        ...form, volume: parseFloat(form.volume), price: parseFloat(form.price),
      });
      setMsg(`下单成功: ${res.data.vt_orderid}`);
      load();
    } catch (err: any) {
      setMsg(`下单失败: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleCancel = async (vtOrderid: string) => {
    try {
      await tradingApi.cancelOrder({ vt_orderid: vtOrderid });
      load();
    } catch { /* ignore */ }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight={600}>交易面板</Typography>

      {msg && <Alert severity={msg.includes('失败') ? 'error' : 'success'} sx={{ mb: 2 }}>{msg}</Alert>}

      <Grid container spacing={2}>
        {/* 下单表单 */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>下单</Typography>
              <TextField label="合约代码" fullWidth size="small" margin="dense"
                value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} />
              <FormControl fullWidth size="small" margin="dense">
                <InputLabel>交易所</InputLabel>
                <Select value={form.exchange} label="交易所" onChange={(e) => setForm({ ...form, exchange: e.target.value })}>
                  {['SHFE', 'CFFEX', 'DCE', 'CZCE', 'INE', 'SSE', 'SZSE'].map((e) => (
                    <MenuItem key={e} value={e}>{e}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small" margin="dense">
                <InputLabel>方向</InputLabel>
                <Select value={form.direction} label="方向" onChange={(e) => setForm({ ...form, direction: e.target.value })}>
                  <MenuItem value="多">做多</MenuItem>
                  <MenuItem value="空">做空</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth size="small" margin="dense">
                <InputLabel>委托类型</InputLabel>
                <Select value={form.type} label="委托类型" onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <MenuItem value="限价">限价</MenuItem>
                  <MenuItem value="市价">市价</MenuItem>
                  <MenuItem value="FAK">FAK</MenuItem>
                  <MenuItem value="FOK">FOK</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth size="small" margin="dense">
                <InputLabel>开平</InputLabel>
                <Select value={form.offset} label="开平" onChange={(e) => setForm({ ...form, offset: e.target.value })}>
                  <MenuItem value="开">开仓</MenuItem>
                  <MenuItem value="平">平仓</MenuItem>
                  <MenuItem value="平今">平今</MenuItem>
                  <MenuItem value="平昨">平昨</MenuItem>
                </Select>
              </FormControl>
              <TextField label="价格" fullWidth size="small" margin="dense" type="number"
                value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              <TextField label="数量" fullWidth size="small" margin="dense" type="number"
                value={form.volume} onChange={(e) => setForm({ ...form, volume: e.target.value })} />
              <FormControl fullWidth size="small" margin="dense">
                <InputLabel>网关</InputLabel>
                <Select value={form.gateway_name} label="网关" onChange={(e) => setForm({ ...form, gateway_name: e.target.value })}>
                  <MenuItem value="CTP">CTP</MenuItem>
                  <MenuItem value="SIM">SIM</MenuItem>
                </Select>
              </FormControl>
              <Button variant="contained" fullWidth sx={{ mt: 2 }} onClick={handleSendOrder}
                color={form.direction === '多' ? 'success' : 'error'}>
                {form.direction === '多' ? '买入' : '卖出'} {form.symbol}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* 委托/成交/持仓 */}
        <Grid size={{ xs: 12, md: 8 }}>
          {/* 活跃委托 */}
          <Typography variant="h6" gutterBottom>活跃委托</Typography>
          <TableContainer component={Paper} sx={{ mb: 2, maxHeight: 200 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>委托号</TableCell><TableCell>合约</TableCell>
                  <TableCell>方向</TableCell><TableCell align="right">价格</TableCell>
                  <TableCell align="right">数量</TableCell><TableCell align="right">成交</TableCell>
                  <TableCell>状态</TableCell><TableCell>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow><TableCell colSpan={8} align="center">暂无活跃委托</TableCell></TableRow>
                ) : orders.map((o) => (
                  <TableRow key={o.vt_orderid}>
                    <TableCell sx={{ fontSize: '0.8rem' }}>{o.orderid}</TableCell>
                    <TableCell>{o.vt_symbol}</TableCell>
                    <TableCell><Chip label={o.direction} size="small" color={o.direction === '多' ? 'success' : 'error'} /></TableCell>
                    <TableCell align="right">{o.price}</TableCell>
                    <TableCell align="right">{o.volume}</TableCell>
                    <TableCell align="right">{o.traded}</TableCell>
                    <TableCell><Chip label={o.status} size="small" /></TableCell>
                    <TableCell>
                      <Button size="small" color="error" onClick={() => handleCancel(o.vt_orderid)}>撤单</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* 最新成交 */}
          <Typography variant="h6" gutterBottom>最新成交</Typography>
          <TableContainer component={Paper} sx={{ mb: 2, maxHeight: 200 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>成交号</TableCell><TableCell>合约</TableCell>
                  <TableCell>方向</TableCell><TableCell align="right">价格</TableCell>
                  <TableCell align="right">数量</TableCell><TableCell>时间</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {trades.length === 0 ? (
                  <TableRow><TableCell colSpan={6} align="center">暂无成交</TableCell></TableRow>
                ) : trades.slice(-20).reverse().map((t) => (
                  <TableRow key={t.vt_tradeid}>
                    <TableCell sx={{ fontSize: '0.8rem' }}>{t.tradeid}</TableCell>
                    <TableCell>{t.vt_symbol}</TableCell>
                    <TableCell><Chip label={t.direction} size="small" color={t.direction === '多' ? 'success' : 'error'} /></TableCell>
                    <TableCell align="right">{t.price}</TableCell>
                    <TableCell align="right">{t.volume}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{t.datetime?.slice(11, 19)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* 持仓 */}
          <Typography variant="h6" gutterBottom>持仓明细</Typography>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>合约</TableCell><TableCell>方向</TableCell>
                  <TableCell align="right">数量</TableCell><TableCell align="right">冻结</TableCell>
                  <TableCell align="right">均价</TableCell><TableCell align="right">盈亏</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {positions.length === 0 ? (
                  <TableRow><TableCell colSpan={6} align="center">暂无持仓</TableCell></TableRow>
                ) : positions.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell>{p.vt_symbol}</TableCell>
                    <TableCell><Chip label={p.direction} size="small" color={p.direction === '多' ? 'success' : 'error'} /></TableCell>
                    <TableCell align="right">{p.volume}</TableCell>
                    <TableCell align="right">{p.frozen}</TableCell>
                    <TableCell align="right">{p.price?.toFixed(2)}</TableCell>
                    <TableCell align="right" sx={{ color: p.pnl >= 0 ? 'success.main' : 'error.main' }}>{p.pnl?.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>
      </Grid>
    </Box>
  );
}
