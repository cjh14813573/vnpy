import { useEffect, useState, useMemo } from 'react';
import { Typography, Card, Input, Select, Button, Table, Tag, Row, Col, Toast, Space, Spin } from '@douyinfe/semi-ui';
import { IconPriceTag, IconPlus, IconMinus } from '@douyinfe/semi-icons';
import { tradingApi, marketApi } from '../api';
import { useRealtimeStore } from '../stores/realtimeStore';
import { useWebSocket, wsService } from '../services/websocket';
import type { Contract } from '../api/types';

export default function TradingPage() {
  const { orders, trades, positions, ticks, connectionState } = useRealtimeStore();
  const [, setAccounts] = useState<any[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  const [form, setForm] = useState({
    symbol: '', exchange: 'SHFE', direction: '多', type: '限价',
    volume: '1', price: '', offset: '开', gateway_name: 'CTP',
  });

  // 初始化 WebSocket
  useWebSocket();

  // 加载合约列表
  useEffect(() => {
    const loadContracts = async () => {
      setContractsLoading(true);
      try {
        const res = await marketApi.contracts();
        const list = res.data.data || res.data || [];
        setContracts(list);
      } catch {
        // ignore
      } finally {
        setContractsLoading(false);
      }
    };
    loadContracts();
  }, []);

  // 选择合约时自动填充信息
  const handleSelectContract = (vtSymbol: string) => {
    const contract = contracts.find(c => c.vt_symbol === vtSymbol);
    if (contract) {
      setSelectedContract(contract);
      setForm(prev => ({
        ...prev,
        symbol: contract.symbol,
        exchange: contract.exchange,
        gateway_name: contract.gateway_name,
      }));
      // 订阅该合约行情
      wsService.subscribe([vtSymbol]);
    }
  };

  // 获取当前合约的最新价格
  const currentTick = selectedContract ? ticks[selectedContract.vt_symbol] : null;
  const lastPrice = currentTick?.last_price;

  // 根据持仓计算可开/平仓数量
  const currentPosition = useMemo(() => {
    if (!selectedContract) return null;
    return positions[selectedContract.vt_symbol];
  }, [positions, selectedContract]);

  // 快捷设置价格
  const setQuickPrice = (type: 'last' | 'up' | 'down') => {
    if (!currentTick) {
      Toast.warning('暂无行情数据');
      return;
    }
    let price: number;
    switch (type) {
      case 'last':
        price = currentTick.last_price;
        break;
      case 'up':
        price = currentTick.last_price + (selectedContract?.pricetick || 1);
        break;
      case 'down':
        price = currentTick.last_price - (selectedContract?.pricetick || 1);
        break;
      default:
        price = currentTick.last_price;
    }
    setForm(prev => ({ ...prev, price: price.toFixed(2) }));
  };

  // 快捷设置数量
  const adjustVolume = (delta: number) => {
    const current = parseInt(form.volume) || 0;
    const newVolume = Math.max(1, current + delta);
    setForm(prev => ({ ...prev, volume: String(newVolume) }));
  };

  // 初始加载账户数据
  useEffect(() => {
    const load = async () => {
      try {
        const [o, t, p, a] = await Promise.all([
          tradingApi.activeOrders(),
          tradingApi.trades(),
          tradingApi.positions(),
          tradingApi.accounts(),
        ]);

        // 初始化 store
        const orderMap: Record<string, any> = {};
        (o.data.data || o.data || []).forEach((order: any) => {
          orderMap[order.vt_orderid] = order;
        });
        useRealtimeStore.getState().setOrders(orderMap);

        useRealtimeStore.getState().setTrades(t.data.data || t.data || []);

        const posMap: Record<string, any> = {};
        (p.data.data || p.data || []).forEach((pos: any) => {
          posMap[pos.vt_symbol] = pos;
        });
        useRealtimeStore.getState().setPositions(posMap);

        setAccounts(a.data.data || a.data || []);

        // 订阅所有持仓合约的行情
        const symbols = Object.keys(posMap);
        if (symbols.length > 0) {
          wsService.subscribe(symbols);
        }
      } catch { /* ignore */ }
    };

    load();
  }, []);

  const activeOrders = Object.values(orders).filter((o: any) =>
    ['待报', '已报', '部成', '撤单中'].includes(o.status)
  );
  const tradeList = Object.values(trades).slice(0, 20);
  const positionList = Object.values(positions);

  const handleSendOrder = async () => {
    try {
      const res = await tradingApi.sendOrder({ ...form, volume: parseFloat(form.volume), price: parseFloat(form.price) });
      Toast.success(`下单成功: ${res.data.vt_orderid}`);
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '下单失败');
    }
  };

  const handleCancel = async (vt_orderid: string) => {
    try {
      await tradingApi.cancelOrder({ vt_orderid });
      Toast.success(`撤单已发送: ${vt_orderid}`);
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '撤单失败');
    }
  };

  const updateForm = (key: string, value: any) => setForm({ ...form, [key]: value });

  const orderCols = [
    { title: '委托号', dataIndex: 'orderid', width: 100 },
    { title: '合约', dataIndex: 'vt_symbol' },
    { title: '方向', dataIndex: 'direction', width: 70, render: (v: string) => <Tag color={v === '多' ? 'green' : 'red'}>{v}</Tag> },
    { title: '价格', dataIndex: 'price', align: 'right' as const, width: 80 },
    { title: '数量', dataIndex: 'volume', align: 'right' as const, width: 60 },
    { title: '成交', dataIndex: 'traded', align: 'right' as const, width: 60 },
    { title: '状态', dataIndex: 'status', width: 70, render: (v: string) => <Tag>{v}</Tag> },
    { title: '操作', width: 70, render: (_: any, r: any) => (
      <Button size="small" theme="solid" type="danger" onClick={() => handleCancel(r.vt_orderid)}>撤单</Button>
    )},
  ];

  const tradeCols = [
    { title: '成交号', dataIndex: 'tradeid', width: 100 },
    { title: '合约', dataIndex: 'vt_symbol' },
    { title: '方向', dataIndex: 'direction', width: 70, render: (v: string) => <Tag color={v === '多' ? 'green' : 'red'}>{v}</Tag> },
    { title: '价格', dataIndex: 'price', align: 'right' as const, width: 80 },
    { title: '数量', dataIndex: 'volume', align: 'right' as const, width: 60 },
    { title: '时间', dataIndex: 'datetime', width: 90, render: (v: string) => v?.slice(11, 19) },
  ];

  const posCols = [
    { title: '合约', dataIndex: 'vt_symbol' },
    { title: '方向', dataIndex: 'direction', width: 70, render: (v: string) => <Tag color={v === '多' ? 'green' : 'red'}>{v}</Tag> },
    { title: '数量', dataIndex: 'volume', align: 'right' as const, width: 60 },
    { title: '冻结', dataIndex: 'frozen', align: 'right' as const, width: 60 },
    { title: '均价', dataIndex: 'price', align: 'right' as const, width: 80, render: (v: number) => v?.toFixed(2) },
    { title: '盈亏', dataIndex: 'pnl', align: 'right' as const, width: 100, render: (v: number) => (
      <Typography.Text type={v >= 0 ? 'success' : 'danger'} strong>{v?.toFixed(2)}</Typography.Text>
    )},
  ];

  const labelStyle = { marginBottom: 12, display: 'block' };

  // 连接状态指示器
  const ConnectionIndicator = () => (
    <Tag
      color={connectionState === 'connected' ? 'green' : connectionState === 'connecting' ? 'orange' : 'red'}
      size="small"
      style={{ marginLeft: 8 }}
    >
      {connectionState === 'connected' ? '实时连接' : connectionState === 'connecting' ? '连接中' : '已断开'}
    </Tag>
  );

  return (
    <div>
      <Typography.Title heading={4}>
        交易面板
        <ConnectionIndicator />
      </Typography.Title>
      <Row gutter={16}>
        <Col span={8}>
          <Card title="下单" style={{ borderRadius: 12 }}>
            {/* 合约选择 */}
            <div>
              <label style={labelStyle}>
                选择合约
                {contractsLoading && <Spin size="small" style={{ marginLeft: 8 }} />}
              </label>
              <Select
                placeholder="请选择合约"
                value={selectedContract?.vt_symbol || ''}
                onChange={(v) => handleSelectContract(v as string)}
                style={{ width: '100%', marginBottom: 12 }}
                optionList={contracts.map(c => ({
                  value: c.vt_symbol,
                  label: `${c.vt_symbol} - ${c.name}`,
                }))}
                filter
                searchPlaceholder="搜索合约代码或名称"
              />
            </div>

            {/* 当前价格和持仓信息 */}
            {selectedContract && (
              <Card bodyStyle={{ padding: 12, marginBottom: 12 }} style={{ background: 'var(--semi-color-fill-0)' }}>
                <Row>
                  <Col span={12}>
                    <Typography.Text type="tertiary" size="small">最新价</Typography.Text>
                    <br />
                    <Typography.Text strong style={{ fontSize: 20, color: currentTick?.last_price ? (currentTick.last_price >= (currentTick.pre_close || 0) ? 'var(--semi-color-success)' : 'var(--semi-color-danger)') : undefined }}>
                      {currentTick?.last_price?.toFixed(2) || '-'}
                    </Typography.Text>
                  </Col>
                  <Col span={12}>
                    <Typography.Text type="tertiary" size="small">当前持仓</Typography.Text>
                    <br />
                    <Typography.Text strong style={{ fontSize: 20 }}>
                      {currentPosition ? `${currentPosition.direction === '多' ? '+' : '-'}${currentPosition.volume}` : '0'}
                    </Typography.Text>
                  </Col>
                </Row>
              </Card>
            )}

            {/* 价格和数量快捷按钮 */}
            {currentTick && (
              <Space style={{ marginBottom: 12 }}>
                <Button size="small" onClick={() => setQuickPrice('up')} icon={<IconPriceTag />}>+{selectedContract?.pricetick || 1}</Button>
                <Button size="small" onClick={() => setQuickPrice('last')} type="secondary">最新价</Button>
                <Button size="small" onClick={() => setQuickPrice('down')} icon={<IconPriceTag />}>-{selectedContract?.pricetick || 1}</Button>
              </Space>
            )}

            <Row gutter={8}>
              <Col span={12}>
                <div><label style={labelStyle}>方向</label>
                <Select value={form.direction} onChange={(v) => updateForm('direction', v)} style={{ width: '100%' }}
                  optionList={[{ value: '多', label: '做多' }, { value: '空', label: '做空' }]} /></div>
              </Col>
              <Col span={12}>
                <div><label style={labelStyle}>开平</label>
                <Select value={form.offset} onChange={(v) => updateForm('offset', v)} style={{ width: '100%' }}
                  optionList={[{ value: '开', label: '开仓' }, { value: '平', label: '平仓' }, { value: '平今', label: '平今' }, { value: '平昨', label: '平昨' }]} /></div>
              </Col>
            </Row>
            <div>
              <label style={labelStyle}>委托类型</label>
              <Select value={form.type} onChange={(v) => updateForm('type', v)} style={{ width: '100%', marginBottom: 12 }}
                optionList={[{ value: '限价', label: '限价' }, { value: '市价', label: '市价' }, { value: 'FAK', label: 'FAK' }, { value: 'FOK', label: 'FOK' }]} />
            </div>
            <Row gutter={8}>
              <Col span={12}>
                <div><label style={labelStyle}>价格</label>
                <Input type="number" value={form.price} onChange={(v) => updateForm('price', v)} placeholder={lastPrice?.toString()} /></div>
              </Col>
              <Col span={12}>
                <div><label style={labelStyle}>数量</label>
                  <Input
                    type="number"
                    value={form.volume}
                    onChange={(v) => updateForm('volume', v)}
                    suffix={
                      <Space>
                        <Button size="small" type="tertiary" icon={<IconMinus />} onClick={() => adjustVolume(-1)} />
                        <Button size="small" type="tertiary" icon={<IconPlus />} onClick={() => adjustVolume(1)} />
                      </Space>
                    }
                  />
                </div>
              </Col>
            </Row>
            <Button
              theme="solid"
              type={form.direction === '多' ? 'primary' : 'danger'}
              block
              size="large"
              onClick={handleSendOrder}
              disabled={!selectedContract}
              style={{ borderRadius: 10, marginTop: 16 }}
            >
              {selectedContract ? (form.direction === '多' ? '买入 ' : '卖出 ') + selectedContract.symbol : '请先选择合约'}
            </Button>
          </Card>
        </Col>
        <Col span={16}>
          <Typography.Title heading={5}>活跃委托</Typography.Title>
          <Card style={{ marginBottom: 16, borderRadius: 12 }}>
            <Table columns={orderCols} dataSource={activeOrders} pagination={false} size="small" empty="暂无活跃委托" />
          </Card>
          <Typography.Title heading={5}>最新成交</Typography.Title>
          <Card style={{ marginBottom: 16, borderRadius: 12 }}>
            <Table columns={tradeCols} dataSource={tradeList} pagination={false} size="small" empty="暂无成交" />
          </Card>
          <Typography.Title heading={5}>持仓明细</Typography.Title>
          <Card style={{ borderRadius: 12 }}>
            <Table columns={posCols} dataSource={positionList} pagination={false} size="small" empty="暂无持仓" />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
