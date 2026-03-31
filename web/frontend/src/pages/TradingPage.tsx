import { useEffect, useState, useMemo } from 'react';
import { Typography, Card, Input, Select, Button, Table, Tag, Row, Col, Toast, Space, Spin, Modal } from '@douyinfe/semi-ui';
import { IconPriceTag, IconPlus, IconMinus, IconSetting } from '@douyinfe/semi-icons';
import { tradingApi, marketApi } from '../api';
import { useRealtimeStore } from '../stores/realtimeStore';
import { useWebSocket, wsService } from '../services/websocket';
import type { Contract } from '../api/types';

interface Account {
  gateway_name: string;
  accountid: string;
  vt_accountid: string;
  account_type: 'real' | 'paper';
  balance: number;
  frozen: number;
  available: number;
}

export default function TradingPage() {
  const { orders, trades, positions, ticks, connectionState } = useRealtimeStore();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  // 止盈止损相关状态
  const [stopLossTakeProfitModal, setStopLossTakeProfitModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<any>(null);
  const [stopLossPrice, setStopLossPrice] = useState('');
  const [takeProfitPrice, setTakeProfitPrice] = useState('');
  const [stopLossTakeProfitOrders, setStopLossTakeProfitOrders] = useState<any[]>([]);

  const [form, setForm] = useState({
    symbol: '', exchange: 'SHFE', direction: '多', type: '限价',
    volume: '1', price: '', offset: '开', gateway_name: 'CTP', account_type: 'real' as 'real' | 'paper',
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

        const accountList = a.data.data || a.data || [];
        setAccounts(accountList);

        // 默认选择第一个实盘账户
        const defaultAccount = accountList.find((acc: Account) => acc.account_type === 'real') || accountList[0];
        if (defaultAccount) {
          setSelectedAccount(defaultAccount);
          setForm(prev => ({
            ...prev,
            gateway_name: defaultAccount.gateway_name,
            account_type: defaultAccount.account_type,
          }));
        }

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
      const orderData = {
        ...form,
        volume: parseFloat(form.volume),
        price: parseFloat(form.price),
        account_type: selectedAccount?.account_type || 'real',
      };
      const res = await tradingApi.sendOrder(orderData);
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
    {
      title: '止盈止损',
      width: 100,
      render: (_: any, record: any) => {
        const hasOrder = stopLossTakeProfitOrders.some(
          (o: any) => o.vt_symbol === record.vt_symbol && o.status === 'pending'
        );
        return (
          <Button
            size="small"
            type={hasOrder ? 'primary' : 'tertiary'}
            icon={<IconSetting />}
            onClick={() => openStopLossTakeProfit(record)}
          >
            {hasOrder ? '已设置' : '设置'}
          </Button>
        );
      },
    },
  ];

  const labelStyle = { marginBottom: 12, display: 'block' };

  // 选择账户
  const handleSelectAccount = (account: Account) => {
    setSelectedAccount(account);
    setForm(prev => ({
      ...prev,
      gateway_name: account.gateway_name,
      account_type: account.account_type,
    }));
  };

  // 加载止盈止损订单
  const loadStopLossTakeProfitOrders = async () => {
    try {
      const res = await tradingApi.stopLossTakeProfitOrders({ status: 'pending' });
      setStopLossTakeProfitOrders(res.data || []);
    } catch (err) {
      console.error('加载止盈止损订单失败:', err);
    }
  };

  // 打开止盈止损设置
  const openStopLossTakeProfit = (position: any) => {
    setSelectedPosition(position);
    // 查找是否已有设置
    const existing = stopLossTakeProfitOrders.find(
      (o: any) => o.vt_symbol === position.vt_symbol && o.status === 'pending'
    );
    if (existing) {
      setStopLossPrice(existing.stop_loss_price?.toString() || '');
      setTakeProfitPrice(existing.take_profit_price?.toString() || '');
    } else {
      setStopLossPrice('');
      setTakeProfitPrice('');
    }
    setStopLossTakeProfitModal(true);
  };

  // 保存止盈止损设置
  const handleSaveStopLossTakeProfit = async () => {
    if (!selectedPosition) return;

    try {
      await tradingApi.createStopLossTakeProfit({
        vt_symbol: selectedPosition.vt_symbol,
        direction: selectedPosition.direction,
        volume: selectedPosition.volume,
        stop_loss_price: stopLossPrice ? parseFloat(stopLossPrice) : undefined,
        take_profit_price: takeProfitPrice ? parseFloat(takeProfitPrice) : undefined,
        gateway_name: selectedPosition.gateway_name || 'CTP',
        account_type: selectedPosition.account_type || 'real',
      });
      Toast.success('止盈止损设置成功');
      setStopLossTakeProfitModal(false);
      loadStopLossTakeProfitOrders();
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '设置失败');
    }
  };

  // 取消止盈止损
  const handleCancelStopLossTakeProfit = async (orderId: string) => {
    try {
      await tradingApi.cancelStopLossTakeProfit(orderId);
      Toast.success('已取消');
      loadStopLossTakeProfitOrders();
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '取消失败');
    }
  };

  useEffect(() => {
    loadStopLossTakeProfitOrders();
    const timer = setInterval(loadStopLossTakeProfitOrders, 10000);
    return () => clearInterval(timer);
  }, []);

  // 计算总资产
  const totalBalance = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
  }, [accounts]);

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

      {/* 账户卡片区域 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {accounts.map((account) => (
          <Col span={6} key={account.vt_accountid}>
            <div onClick={() => handleSelectAccount(account)} style={{ cursor: 'pointer' }}>
              <Card
                bodyStyle={{ padding: 16 }}
                style={{
                  borderRadius: 12,
                  border: selectedAccount?.vt_accountid === account.vt_accountid
                    ? '2px solid var(--semi-color-primary)'
                    : '1px solid var(--semi-color-border)',
                  background: account.account_type === 'paper'
                    ? 'rgba(100, 100, 255, 0.05)'
                    : 'var(--semi-color-bg-0)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <Typography.Text strong>{account.gateway_name}</Typography.Text>
                    {account.account_type === 'paper' && (
                      <Tag color="blue" style={{ marginLeft: 8 }}>模拟</Tag>
                    )}
                  </div>
                  {selectedAccount?.vt_accountid === account.vt_accountid && (
                    <Tag color="blue" size="small">当前</Tag>
                  )}
                </div>
              <Typography.Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 4 }}>
                账户: {account.accountid}
              </Typography.Text>
              <div style={{ fontSize: 24, fontWeight: 600 }}>
                ¥{(account.balance || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </div>
              <Row style={{ marginTop: 12 }} gutter={8}>
                <Col span={12}>
                  <Typography.Text type="tertiary" size="small">可用</Typography.Text>
                  <br />
                  <Typography.Text strong>¥{(account.available || 0).toFixed(2)}</Typography.Text>
                </Col>
                <Col span={12}>
                  <Typography.Text type="tertiary" size="small">冻结</Typography.Text>
                  <br />
                  <Typography.Text strong>¥{(account.frozen || 0).toFixed(2)}</Typography.Text>
                </Col>
              </Row>
              </Card>
            </div>
          </Col>
        ))}

        {/* 总资产卡片 */}
        <Col span={6}>
          <Card
            bodyStyle={{ padding: 16 }}
            style={{
              borderRadius: 12,
              background: 'var(--semi-color-primary-light-default)',
            }}
          >
            <Typography.Text type="tertiary" style={{ display: 'block', marginBottom: 8 }}>
              总资产 (实盘+模拟)
            </Typography.Text>
            <div style={{ fontSize: 28, fontWeight: 700 }}>
              ¥{totalBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
            </div>
            <Typography.Text type="tertiary" size="small" style={{ marginTop: 8, display: 'block' }}>
              共 {accounts.length} 个账户
            </Typography.Text>
          </Card>
        </Col>
      </Row>

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
              disabled={!selectedContract || !selectedAccount}
              style={{ borderRadius: 10, marginTop: 16 }}
            >
              {selectedContract
                ? `${form.direction === '多' ? '买入' : '卖出'} ${selectedContract.symbol} (${selectedAccount?.account_type === 'paper' ? '模拟' : selectedAccount?.gateway_name || ''})`
                : '请先选择合约'}
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

      {/* 止盈止损设置弹窗 */}
      <Modal
        title={`设置止盈止损 - ${selectedPosition?.vt_symbol || ''}`}
        visible={stopLossTakeProfitModal}
        onCancel={() => setStopLossTakeProfitModal(false)}
        footer={(
          <Space>
            <Button onClick={() => setStopLossTakeProfitModal(false)}>取消</Button>
            <Button type="primary" onClick={handleSaveStopLossTakeProfit}>保存</Button>
          </Space>
        )}
      >
        <div style={{ padding: '20px 0' }}>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <label style={{ display: 'block', marginBottom: 8 }}>合约</label>
              <Input value={selectedPosition?.vt_symbol || ''} disabled />
            </Col>
            <Col span={12}>
              <label style={{ display: 'block', marginBottom: 8 }}>持仓方向</label>
              <Tag color={selectedPosition?.direction === '多' ? 'green' : 'red'}>
                {selectedPosition?.direction}
              </Tag>
            </Col>
          </Row>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <label style={{ display: 'block', marginBottom: 8 }}>持仓数量</label>
              <Input value={selectedPosition?.volume || 0} disabled />
            </Col>
            <Col span={12}>
              <label style={{ display: 'block', marginBottom: 8 }}>持仓成本</label>
              <Input value={selectedPosition?.price?.toFixed(2) || '0.00'} disabled />
            </Col>
          </Row>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8 }}>
              止损价格
              {selectedPosition?.direction === '多'
                ? <span style={{ color: '#52c41a', marginLeft: 8 }}>(低于成本价 {selectedPosition?.price ? ((parseFloat(stopLossPrice || '0') - selectedPosition.price) / selectedPosition.price * 100).toFixed(2) : '0'}%)</span>
                : <span style={{ color: '#f5222d', marginLeft: 8 }}>(高于成本价)</span>
              }
            </label>
            <Input
              type="number"
              value={stopLossPrice}
              onChange={(v) => setStopLossPrice(v)}
              placeholder={selectedPosition?.direction === '多' ? '低于持仓成本' : '高于持仓成本'}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 8 }}>
              止盈价格
              {selectedPosition?.direction === '多'
                ? <span style={{ color: '#f5222d', marginLeft: 8 }}>(高于成本价)</span>
                : <span style={{ color: '#52c41a', marginLeft: 8 }}>(低于成本价)</span>
              }
            </label>
            <Input
              type="number"
              value={takeProfitPrice}
              onChange={(v) => setTakeProfitPrice(v)}
              placeholder={selectedPosition?.direction === '多' ? '高于持仓成本' : '低于持仓成本'}
            />
          </div>

          {/* 已设置的止盈止损列表 */}
          {stopLossTakeProfitOrders.filter((o: any) => o.vt_symbol === selectedPosition?.vt_symbol && o.status === 'pending').length > 0 && (
            <div style={{ marginTop: 24, padding: 16, background: 'var(--semi-color-fill-0)', borderRadius: 8 }}>
              <Typography.Text strong>当前设置</Typography.Text>
              {stopLossTakeProfitOrders
                .filter((o: any) => o.vt_symbol === selectedPosition?.vt_symbol && o.status === 'pending')
                .map((order: any) => (
                  <div key={order.id} style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      {order.stop_loss_price && <Tag color="red">止损 {order.stop_loss_price}</Tag>}
                      {order.take_profit_price && <Tag color="green">止盈 {order.take_profit_price}</Tag>}
                    </div>
                    <Button size="small" type="danger" onClick={() => handleCancelStopLossTakeProfit(order.id)}>
                      取消
                    </Button>
                  </div>
                ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
