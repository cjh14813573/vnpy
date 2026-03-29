import { useEffect, useState } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Chip,
} from '@mui/material';
import { tradingApi, systemApi } from '../api';

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [acc, pos, orders, logRes, statusRes] = await Promise.all([
          tradingApi.accounts(),
          tradingApi.positions(),
          tradingApi.activeOrders(),
          systemApi.logs(),
          systemApi.status(),
        ]);
        setAccounts(acc.data);
        setPositions(pos.data);
        setActiveOrders(orders.data);
        setLogs(logRes.data.slice(-20).reverse());
        setStatus(statusRes.data);
      } catch { /* 初始加载可能失败 */ }
    };
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const totalPnl = positions.reduce((s, p) => s + (p.pnl || 0), 0);

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight={600}>
        总览
      </Typography>

      {/* 概览卡片 */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="body2">账户总资金</Typography>
              <Typography variant="h5" fontWeight={600}>
                ¥{totalBalance.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="body2">持仓盈亏</Typography>
              <Typography variant="h5" fontWeight={600} color={totalPnl >= 0 ? 'success.main' : 'error.main'}>
                ¥{totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="body2">活跃委托</Typography>
              <Typography variant="h5" fontWeight={600}>{activeOrders.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="body2">已连接网关</Typography>
              <Typography variant="h5" fontWeight={600}>
                {status?.gateways?.length || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 持仓表格 */}
      <Typography variant="h6" gutterBottom>持仓</Typography>
      <TableContainer component={Paper} sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>合约</TableCell>
              <TableCell>方向</TableCell>
              <TableCell align="right">数量</TableCell>
              <TableCell align="right">冻结</TableCell>
              <TableCell align="right">均价</TableCell>
              <TableCell align="right">盈亏</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {positions.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center">暂无持仓</TableCell></TableRow>
            ) : positions.map((p, i) => (
              <TableRow key={i}>
                <TableCell>{p.vt_symbol}</TableCell>
                <TableCell>
                  <Chip label={p.direction} size="small" color={p.direction === '多' ? 'success' : 'error'} />
                </TableCell>
                <TableCell align="right">{p.volume}</TableCell>
                <TableCell align="right">{p.frozen}</TableCell>
                <TableCell align="right">{p.price?.toFixed(2)}</TableCell>
                <TableCell align="right" sx={{ color: p.pnl >= 0 ? 'success.main' : 'error.main' }}>
                  {p.pnl?.toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 最新日志 */}
      <Typography variant="h6" gutterBottom>系统日志</Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>时间</TableCell>
              <TableCell>级别</TableCell>
              <TableCell>内容</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow><TableCell colSpan={3} align="center">暂无日志</TableCell></TableRow>
            ) : logs.map((l, i) => (
              <TableRow key={i}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{l.time?.slice(11, 19) || '-'}</TableCell>
                <TableCell><Chip label={l.level || 'INFO'} size="small" /></TableCell>
                <TableCell>{l.msg}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
