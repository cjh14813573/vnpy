import { useEffect, useState } from 'react';
import { Typography, AutoComplete, Button, Table, Tag, Card, Row, Col, Space, Input } from '@douyinfe/semi-ui';
import { marketApi } from '../api';
import { useRealtimeStore } from '../stores/realtimeStore';
import { useWebSocket, wsService } from '../services/websocket';
import { useMediaQuery } from '../hooks/useMediaQuery';
import KLineChart from '../components/KLineChart';
import ResponsivePageHeader from '../components/ResponsivePageHeader';
import MobileMarketCard from '../components/mobile/MobileMarketCard';

export default function MarketPage() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const { ticks, connectionState } = useRealtimeStore();
  const { isMobile } = useMediaQuery();

  // 初始化 WebSocket
  useWebSocket();

  useEffect(() => {
    marketApi.contracts().then((r) => {
      const contractsData = r.data.data || r.data || [];
      setContracts(contractsData);
    }).catch(() => {});
  }, []);

  const handleSubscribe = async () => {
    if (!selectedContract) return;
    // 1. 调用后端 API 订阅行情
    await marketApi.subscribe({ vt_symbol: selectedContract.vt_symbol, gateway_name: selectedContract.gateway_name }).catch(() => {});
    // 2. 通过 WebSocket 订阅推送
    wsService.subscribe([selectedContract.vt_symbol]);
  };

  const handleQueryHistory = async () => {
    if (!selectedContract) return;
    try {
      const res = await marketApi.history({ vt_symbol: selectedContract.vt_symbol, start: '2024-01-01', end: '2024-12-31', interval: '1m' });
      setHistoryData(res.data);
    } catch { /* ignore */ }
  };

  const currentTick = selectedContract ? ticks[selectedContract.vt_symbol] : null;

  // 过滤显示的ticks
  const filteredTicks = Object.values(ticks).filter((tick: any) => {
    if (!searchKeyword) return true;
    return tick.vt_symbol?.toLowerCase().includes(searchKeyword.toLowerCase());
  });

  const tickColumns = [
    { title: '合约', dataIndex: 'vt_symbol', render: (v: string, r: any) => `${v} ${r.name}` },
    { title: '最新价', dataIndex: 'last_price', align: 'right' as const },
    { title: '买一', dataIndex: 'bid_price_1', align: 'right' as const, render: (v: number) => <Typography.Text type="success">{v}</Typography.Text> },
    { title: '卖一', dataIndex: 'ask_price_1', align: 'right' as const, render: (v: number) => <Typography.Text type="danger">{v}</Typography.Text> },
    { title: '成交量', dataIndex: 'volume', align: 'right' as const },
    { title: '网关', dataIndex: 'gateway_name', render: (v: string) => <Tag>{v}</Tag> },
  ];

  // 连接状态指示器
  const ConnectionIndicator = () => (
    <Tag
      color={connectionState === 'connected' ? 'green' : connectionState === 'connecting' ? 'orange' : 'red'}
      size="small"
    >
      {connectionState === 'connected' ? '实时连接' : connectionState === 'connecting' ? '连接中' : '已断开'}
    </Tag>
  );

  // 移动端布局
  if (isMobile) {
    return (
      <div>
        <ResponsivePageHeader
          title="行情中心"
          extra={<ConnectionIndicator />}
        />

        {/* 搜索和订阅 */}
        <Card style={{ marginBottom: 12 }} bodyStyle={{ padding: 12 }}>
          <AutoComplete
            data={contracts.map((c) => ({ value: c.vt_symbol, label: `${c.vt_symbol} ${c.name || ''}`, ...c }))}
            style={{ width: '100%', marginBottom: 8 }}
            placeholder="搜索合约"
            value={selectedContract?.vt_symbol || ''}
            onChange={(v) => setSelectedContract(contracts.find((c) => c.vt_symbol === v) || null)}
            onSelect={(v) => setSelectedContract(contracts.find((c) => c.vt_symbol === v) || null)}
            size="small"
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button theme="solid" size="small" onClick={handleSubscribe} disabled={!selectedContract} style={{ flex: 1 }}>
              订阅
            </Button>
            <Button size="small" onClick={handleQueryHistory} disabled={!selectedContract} style={{ flex: 1 }}>
              K线
            </Button>
          </div>
        </Card>

        {/* 当前选中合约行情 */}
        {currentTick && (
          <Card style={{ marginBottom: 12 }} bodyStyle={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <Typography.Title heading={6} style={{ margin: 0 }}>
                {currentTick.name || currentTick.vt_symbol}
              </Typography.Title>
              {selectedContract && <Tag size="small">{selectedContract.gateway_name}</Tag>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <Typography.Title heading={2} style={{ margin: 0, color: 'var(--semi-color-text-0)' }}>
                  {currentTick.last_price?.toFixed(2)}
                </Typography.Title>
                <Typography.Text type="tertiary" size="small">
                  成交量 {currentTick.volume}
                </Typography.Text>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>买一/卖一</div>
                <div>
                  <Typography.Text type="success">{currentTick.bid_price_1}</Typography.Text>
                  <span style={{ margin: '0 4px' }}>/</span>
                  <Typography.Text type="danger">{currentTick.ask_price_1}</Typography.Text>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* K线图表 */}
        {historyData.length > 0 && (
          <Card style={{ marginBottom: 12 }} bodyStyle={{ padding: 8 }}>
            <KLineChart
              data={historyData.map((d: any) => ({
                time: d.datetime || d.date,
                open: d.open_price || d.open,
                high: d.high_price || d.high,
                low: d.low_price || d.low,
                close: d.close_price || d.close,
                volume: d.volume,
              }))}
              height={280}
            />
          </Card>
        )}

        {/* 已订阅行情列表 */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Typography.Text strong>已订阅行情 ({filteredTicks.length})</Typography.Text>
            <Input
              size="small"
              placeholder="搜索"
              value={searchKeyword}
              onChange={setSearchKeyword}
              style={{ width: 120 }}
            />
          </div>
          {filteredTicks.map((tick: any) => (
            <MobileMarketCard key={tick.vt_symbol} tick={tick} />
          ))}
          {filteredTicks.length === 0 && (
            <Card bodyStyle={{ padding: 24, textAlign: 'center' }}>
              <Typography.Text type="tertiary">暂无订阅</Typography.Text>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // 桌面端布局
  return (
    <div>
      <Typography.Title heading={4}>
        行情中心
        <ConnectionIndicator />
      </Typography.Title>

      <Space style={{ marginBottom: 20 }}>
        <AutoComplete
          data={contracts.map((c) => ({ value: c.vt_symbol, label: `${c.vt_symbol} ${c.name || ''}`, ...c }))}
          style={{ width: 380 }}
          placeholder="搜索合约"
          value={selectedContract?.vt_symbol || ''}
          onChange={(v) => setSelectedContract(contracts.find((c) => c.vt_symbol === v) || null)}
          onSelect={(v) => setSelectedContract(contracts.find((c) => c.vt_symbol === v) || null)}
        />
        <Button theme="solid" onClick={handleSubscribe} disabled={!selectedContract}>订阅</Button>
        <Button onClick={handleQueryHistory} disabled={!selectedContract}>查询K线</Button>
      </Space>

      {currentTick && (
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col span={12}>
            <Card bodyStyle={{ padding: 20 }}>
              <Typography.Title heading={5}>{currentTick.name || currentTick.vt_symbol}</Typography.Title>
              <Typography.Title heading={1} style={{ color: 'var(--semi-color-text-0)' }}>{currentTick.last_price}</Typography.Title>
              <Space>
                <Typography.Text type="tertiary">成交量 {currentTick.volume}</Typography.Text>
                <Typography.Text type="tertiary">持仓 {currentTick.open_interest}</Typography.Text>
              </Space>
            </Card>
          </Col>
          <Col span={12}>
            <Card bodyStyle={{ padding: 16 }} title="五档盘口">
              <Table
                columns={[
                  { title: '买价', dataIndex: 'bp', render: (v: number) => <Typography.Text type="success">{v}</Typography.Text> },
                  { title: '买量', dataIndex: 'bv', align: 'right' as const },
                  { title: '卖价', dataIndex: 'ap', render: (v: number) => <Typography.Text type="danger">{v}</Typography.Text> },
                  { title: '卖量', dataIndex: 'av', align: 'right' as const },
                ]}
                dataSource={[1,2,3,4,5].map((i) => {
                  const tick = currentTick as any;
                  return {
                    key: i, bp: tick[`bid_price_${i}`], bv: tick[`bid_volume_${i}`],
                    ap: tick[`ask_price_${i}`], av: tick[`ask_volume_${i}`],
                  };
                })}
                pagination={false} size="small" bordered={false}
              />
            </Card>
          </Col>
        </Row>
      )}

      {historyData.length > 0 && (
        <>
          <Typography.Title heading={5} style={{ marginBottom: 12 }}>
            {selectedContract?.name || selectedContract?.vt_symbol} K线
          </Typography.Title>
          <Card style={{ marginBottom: 20, borderRadius: 12, padding: 8 }}>
            <KLineChart
              data={historyData.map((d: any) => ({
                time: d.datetime || d.date,
                open: d.open_price || d.open,
                high: d.high_price || d.high,
                low: d.low_price || d.low,
                close: d.close_price || d.close,
                volume: d.volume,
              }))}
              height={450}
            />
          </Card>
        </>
      )}

      <Typography.Title heading={5} style={{ marginBottom: 12 }}>已订阅行情</Typography.Title>
      <Card style={{ borderRadius: 12 }}>
        <Table columns={tickColumns} dataSource={Object.values(ticks)} pagination={false} size="small"
          empty="暂无订阅" />
      </Card>
    </div>
  );
}
