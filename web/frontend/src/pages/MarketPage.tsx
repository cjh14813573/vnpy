import { useEffect, useState } from 'react';
import { Typography, AutoComplete, Button, Table, Tag, Card, Row, Col, Space } from '@douyinfe/semi-ui';
import { marketApi } from '../api';
import { useMarketStore } from '../stores/marketStore';
import KLineChart from '../components/KLineChart';

export default function MarketPage() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const { ticks } = useMarketStore();

  useEffect(() => {
    marketApi.contracts().then((r) => setContracts(r.data)).catch(() => {});
  }, []);

  const handleSubscribe = async () => {
    if (!selectedContract) return;
    await marketApi.subscribe({ vt_symbol: selectedContract.vt_symbol, gateway_name: selectedContract.gateway_name }).catch(() => {});
  };

  const handleQueryHistory = async () => {
    if (!selectedContract) return;
    try {
      const res = await marketApi.history({ vt_symbol: selectedContract.vt_symbol, start: '2024-01-01', end: '2024-12-31', interval: '1m' });
      setHistoryData(res.data);
    } catch { /* ignore */ }
  };

  const currentTick = selectedContract ? ticks[selectedContract.vt_symbol] : null;

  const tickColumns = [
    { title: '合约', dataIndex: 'vt_symbol', render: (v: string, r: any) => `${v} ${r.name}` },
    { title: '最新价', dataIndex: 'last_price', align: 'right' as const },
    { title: '买一', dataIndex: 'bid_price_1', align: 'right' as const, render: (v: number) => <Typography.Text type="success">{v}</Typography.Text> },
    { title: '卖一', dataIndex: 'ask_price_1', align: 'right' as const, render: (v: number) => <Typography.Text type="danger">{v}</Typography.Text> },
    { title: '成交量', dataIndex: 'volume', align: 'right' as const },
    { title: '网关', dataIndex: 'gateway_name', render: (v: string) => <Tag>{v}</Tag> },
  ];

  return (
    <div>
      <Typography.Title heading={4}>行情中心</Typography.Title>

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
                dataSource={[1,2,3,4,5].map((i) => ({
                  key: i, bp: currentTick[`bid_price_${i}`], bv: currentTick[`bid_volume_${i}`],
                  ap: currentTick[`ask_price_${i}`], av: currentTick[`ask_volume_${i}`],
                }))}
                pagination={false} size="small" bordered={false}
              />
            </Card>
          </Col>
        </Row>
      )}

      {historyData.length > 0 && (
        <>
          <Card style={{ marginBottom: 20, borderRadius: 12, padding: 8 }}>
            <KLineChart data={historyData} title={`${selectedContract?.name || selectedContract?.vt_symbol} K线`} />
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
