import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Tabs, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, Button,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { strategyApi, tradingApi } from '../api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, index, value }: TabPanelProps) {
  return value === index ? <Box sx={{ py: 2 }}>{children}</Box> : null;
}

export default function StrategyDetailPage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const strategyName = name || '';
  const [instance, setInstance] = useState<any>(null);
  const [variables, setVariables] = useState<Record<string, any>>({});
  const [logs, setLogs] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [code, setCode] = useState('');

  useEffect(() => {
    if (!strategyName) return;
    const load = async () => {
      try {
        const [inst, vars, logRes, tradeRes] = await Promise.all([
          strategyApi.instance(strategyName),
          strategyApi.variables(strategyName),
          strategyApi.logs(strategyName),
          strategyApi.trades(strategyName),
        ]);
        setInstance(inst.data);
        setVariables(vars.data);
        setLogs(logRes.data);
        setTrades(tradeRes.data);
      } catch { /* ignore */ }
      try {
        const codeRes = await strategyApi.classCode(instance?.class_name || '');
        setCode(codeRes.data.code);
      } catch { setCode(''); }
    };
    load();
  }, [strategyName]);

  if (!instance) {
    return <Typography sx={{ p: 3 }}>加载中...</Typography>;
  }

  const statusColor = instance.trading ? 'success' : instance.inited ? 'warning' : 'default';
  const statusText = instance.trading ? '运行中' : instance.inited ? '已初始化' : '未初始化';

  return (
    <Box>
      {/* 头部 */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/strategy')} sx={{ mr: 2 }}>
          返回
        </Button>
        <Typography variant="h5" fontWeight={600}>{instance.strategy_name}</Typography>
        <Chip label={statusText} color={statusColor as any} sx={{ ml: 2 }} />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
          {instance.class_name} · {instance.vt_symbol}
        </Typography>
      </Box>

      {/* 快捷操作 */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        {!instance.inited && (
          <Button variant="contained" size="small" onClick={() => strategyApi.init(strategyName).then(() => window.location.reload())}>
            初始化
          </Button>
        )}
        {instance.inited && !instance.trading && (
          <Button variant="contained" color="success" size="small" onClick={() => strategyApi.start(strategyName).then(() => window.location.reload())}>
            启动
          </Button>
        )}
        {instance.trading && (
          <Button variant="contained" color="error" size="small" onClick={() => strategyApi.stop(strategyName).then(() => window.location.reload())}>
            停止
          </Button>
        )}
      </Box>

      {/* Tab */}
      <Paper>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab label="概览" />
          <Tab label="参数" />
          <Tab label="变量" />
          <Tab label="日志" />
          <Tab label="交易" />
          <Tab label="持仓" />
          <Tab label="代码" />
        </Tabs>

        {/* 概览 */}
        <TabPanel value={tab} index={0}>
          <Grid2 container spacing={2}>
            <Grid2 size={6}>
              <Typography variant="subtitle2">策略名称</Typography>
              <Typography>{instance.strategy_name}</Typography>
            </Grid2>
            <Grid2 size={6}>
              <Typography variant="subtitle2">策略类</Typography>
              <Typography>{instance.class_name}</Typography>
            </Grid2>
            <Grid2 size={6}>
              <Typography variant="subtitle2">合约</Typography>
              <Typography>{instance.vt_symbol}</Typography>
            </Grid2>
            <Grid2 size={6}>
              <Typography variant="subtitle2">作者</Typography>
              <Typography>{instance.author || '-'}</Typography>
            </Grid2>
          </Grid2>
        </TabPanel>

        {/* 参数 */}
        <TabPanel value={tab} index={1}>
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow><TableCell>参数名</TableCell><TableCell>值</TableCell></TableRow></TableHead>
              <TableBody>
                {Object.entries(instance.parameters || {}).map(([k, v]) => (
                  <TableRow key={k}><TableCell>{k}</TableCell><TableCell>{String(v)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* 变量 */}
        <TabPanel value={tab} index={2}>
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow><TableCell>变量名</TableCell><TableCell>值</TableCell></TableRow></TableHead>
              <TableBody>
                {Object.entries(variables).length === 0 ? (
                  <TableRow><TableCell colSpan={2} align="center">策略未运行，暂无变量</TableCell></TableRow>
                ) : Object.entries(variables).map(([k, v]) => (
                  <TableRow key={k}><TableCell>{k}</TableCell><TableCell>{String(v)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* 日志 */}
        <TabPanel value={tab} index={3}>
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow><TableCell>时间</TableCell><TableCell>级别</TableCell><TableCell>内容</TableCell></TableRow></TableHead>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow><TableCell colSpan={3} align="center">暂无日志</TableCell></TableRow>
                ) : logs.slice(-50).reverse().map((l, i) => (
                  <TableRow key={i}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{l.time?.slice(11, 19) || '-'}</TableCell>
                    <TableCell><Chip label={l.level || 'INFO'} size="small" /></TableCell>
                    <TableCell>{l.msg}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* 交易 */}
        <TabPanel value={tab} index={4}>
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow><TableCell>时间</TableCell><TableCell>合约</TableCell><TableCell>方向</TableCell><TableCell align="right">价格</TableCell><TableCell align="right">数量</TableCell></TableRow></TableHead>
              <TableBody>
                {trades.length === 0 ? (
                  <TableRow><TableCell colSpan={5} align="center">暂无成交</TableCell></TableRow>
                ) : trades.map((t, i) => (
                  <TableRow key={i}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{t.datetime?.slice(11, 19)}</TableCell>
                    <TableCell>{t.vt_symbol}</TableCell>
                    <TableCell><Chip label={t.direction} size="small" color={t.direction === '多' ? 'success' : 'error'} /></TableCell>
                    <TableCell align="right">{t.price}</TableCell>
                    <TableCell align="right">{t.volume}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* 持仓 */}
        <TabPanel value={tab} index={5}>
          <PositionTable vtSymbol={instance.vt_symbol} />
        </TabPanel>

        {/* 代码 */}
        <TabPanel value={tab} index={6}>
          <Paper variant="outlined" sx={{ p: 2, bgcolor: '#1e1e1e', color: '#d4d4d4', fontFamily: 'monospace', fontSize: '0.85rem', whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: 500 }}>
            {code || '无法加载源码'}
          </Paper>
        </TabPanel>
      </Paper>
    </Box>
  );
}

/* 持仓子组件 */
import Grid2 from '@mui/material/Grid';

function PositionTable({ vtSymbol }: { vtSymbol: string }) {
  const [positions, setPositions] = useState<any[]>([]);

  useEffect(() => {
    tradingApi.positions().then((r) => {
      const filtered = (r.data || []).filter((p: any) => p.vt_symbol === vtSymbol);
      setPositions(filtered);
    }).catch(() => {});
  }, [vtSymbol]);

  if (positions.length === 0) {
    return <Typography color="text.secondary" sx={{ p: 2 }}>该合约暂无持仓</Typography>;
  }

  return (
    <TableContainer>
      <Table size="small">
        <TableHead><TableRow><TableCell>方向</TableCell><TableCell align="right">数量</TableCell><TableCell align="right">均价</TableCell><TableCell align="right">盈亏</TableCell></TableRow></TableHead>
        <TableBody>
          {positions.map((p, i) => (
            <TableRow key={i}>
              <TableCell><Chip label={p.direction} size="small" color={p.direction === '多' ? 'success' : 'error'} /></TableCell>
              <TableCell align="right">{p.volume}</TableCell>
              <TableCell align="right">{p.price?.toFixed(2)}</TableCell>
              <TableCell align="right" sx={{ color: p.pnl >= 0 ? 'success.main' : 'error.main' }}>{p.pnl?.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
