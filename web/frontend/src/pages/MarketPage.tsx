import { useEffect, useState } from 'react';
import {
  Box, Typography, TextField, Autocomplete, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Button,
  Grid, Card, CardContent, Chip,
} from '@mui/material';
import { marketApi } from '../api';
import { useMarketStore } from '../stores/marketStore';

export default function MarketPage() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const { ticks } = useMarketStore();

  useEffect(() => {
    marketApi.contracts().then((res) => setContracts(res.data)).catch(() => {});
  }, []);

  const handleSubscribe = async () => {
    if (!selectedContract) return;
    try {
      await marketApi.subscribe({
        vt_symbol: selectedContract.vt_symbol,
        gateway_name: selectedContract.gateway_name,
      });
    } catch { /* ignore */ }
  };

  const handleQueryHistory = async () => {
    if (!selectedContract) return;
    try {
      const res = await marketApi.history({
        vt_symbol: selectedContract.vt_symbol,
        start: '2024-01-01',
        end: '2024-12-31',
        interval: '1m',
      });
      setHistoryData(res.data);
    } catch { /* ignore */ }
  };

  const currentTick = selectedContract ? ticks[selectedContract.vt_symbol] : null;

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight={600}>行情中心</Typography>

      {/* 合约搜索 */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
        <Autocomplete
          options={contracts}
          getOptionLabel={(o) => `${o.vt_symbol} ${o.name || ''}`}
          sx={{ width: 400 }}
          value={selectedContract}
          onChange={(_, v) => setSelectedContract(v)}
          renderInput={(params) => <TextField {...params} label="搜索合约" />}
        />
        <Button variant="contained" onClick={handleSubscribe} disabled={!selectedContract}>
          订阅
        </Button>
        <Button variant="outlined" onClick={handleQueryHistory} disabled={!selectedContract}>
          查询K线
        </Button>
      </Box>

      {/* 实时行情 */}
      {currentTick && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {currentTick.name || currentTick.vt_symbol}
                </Typography>
                <Typography variant="h4" fontWeight={700}>
                  {currentTick.last_price}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  成交量 {currentTick.volume} | 持仓 {currentTick.open_interest}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>五档盘口</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>买价</TableCell>
                      <TableCell align="right">买量</TableCell>
                      <TableCell>卖价</TableCell>
                      <TableCell align="right">卖量</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <TableRow key={i}>
                        <TableCell sx={{ color: 'success.main' }}>
                          {currentTick[`bid_price_${i}`] || '-'}
                        </TableCell>
                        <TableCell align="right">{currentTick[`bid_volume_${i}`] || '-'}</TableCell>
                        <TableCell sx={{ color: 'error.main' }}>
                          {currentTick[`ask_price_${i}`] || '-'}
                        </TableCell>
                        <TableCell align="right">{currentTick[`ask_volume_${i}`] || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* 历史K线 */}
      {historyData.length > 0 && (
        <>
          <Typography variant="h6" gutterBottom>K线数据（{historyData.length} 条）</Typography>
          <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>时间</TableCell>
                  <TableCell align="right">开</TableCell>
                  <TableCell align="right">高</TableCell>
                  <TableCell align="right">低</TableCell>
                  <TableCell align="right">收</TableCell>
                  <TableCell align="right">成交量</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {historyData.slice(0, 100).map((bar, i) => (
                  <TableRow key={i}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{bar.datetime?.slice(0, 16)}</TableCell>
                    <TableCell align="right">{bar.open_price}</TableCell>
                    <TableCell align="right">{bar.high_price}</TableCell>
                    <TableCell align="right">{bar.low_price}</TableCell>
                    <TableCell align="right">{bar.close_price}</TableCell>
                    <TableCell align="right">{bar.volume}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* 所有最新行情 */}
      <Typography variant="h6" sx={{ mt: 3 }} gutterBottom>已订阅行情</Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>合约</TableCell>
              <TableCell align="right">最新价</TableCell>
              <TableCell align="right">买一</TableCell>
              <TableCell align="right">卖一</TableCell>
              <TableCell align="right">成交量</TableCell>
              <TableCell>网关</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.values(ticks).length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center">暂无订阅</TableCell></TableRow>
            ) : Object.values(ticks).map((t) => (
              <TableRow key={t.vt_symbol}>
                <TableCell>{t.vt_symbol} {t.name}</TableCell>
                <TableCell align="right">{t.last_price}</TableCell>
                <TableCell align="right" sx={{ color: 'success.main' }}>{t.bid_price_1}</TableCell>
                <TableCell align="right" sx={{ color: 'error.main' }}>{t.ask_price_1}</TableCell>
                <TableCell align="right">{t.volume}</TableCell>
                <TableCell><Chip label={t.gateway_name} size="small" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
