import { useEffect, useState, useMemo, useCallback } from 'react';
import { Typography, Card, Input, Select, Button, Table, Tag, Row, Col, Toast, Space, Spin, Modal, Popover, Divider } from '@douyinfe/semi-ui';
import { IconPriceTag, IconPlus, IconMinus, IconSetting, IconDelete } from '@douyinfe/semi-icons';
import { tradingApi, marketApi } from '../api';
import { useRealtimeStore } from '../stores/realtimeStore';
import { useWebSocket, wsService } from '../services/websocket';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useMediaQuery } from '../hooks/useMediaQuery';
import ResponsivePageHeader from '../components/ResponsivePageHeader';
import MobileTradingPanel from '../components/mobile/MobileTradingPanel';
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

  // 响应式检测
  const { isMobile } = useMediaQuery();

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

  // 批量撤单
  const handleCancelAll = useCallback(async () => {
    if (activeOrders.length === 0) {
      Toast.info('没有活跃委托');
      return;
    }
    try {
      const res = await tradingApi.cancelAll(selectedAccount?.gateway_name);
      Toast.success(`已撤销 ${res.data.count} 个委托`);
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '批量撤单失败');
    }
  }, [activeOrders.length, selectedAccount?.gateway_name]);

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

  // 从 WebSocket 获取实时盈亏数据
  const pnlData = useRealtimeStore(s => s.pnl);

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

  // 键盘快捷键配置
  const shortcuts = useMemo(() => [
    {
      key: 'F1',
      description: '买开 (做多开仓)',
      action: () => {
        if (selectedContract) {
          setForm(prev => ({ ...prev, direction: '多', offset: '开' }));
          Toast.info('已切换: 买开 (F1)');
        }
      },
    },
    {
      key: 'F2',
      description: '卖开 (做空开仓)',
      action: () => {
        if (selectedContract) {
          setForm(prev => ({ ...prev, direction: '空', offset: '开' }));
          Toast.info('已切换: 卖开 (F2)');
        }
      },
    },
    {
      key: 'F3',
      description: '买平 (平空仓)',
      action: () => {
        if (selectedContract) {
          setForm(prev => ({ ...prev, direction: '多', offset: '平' }));
          Toast.info('已切换: 买平 (F3)');
        }
      },
    },
    {
      key: 'F4',
      description: '卖平 (平多仓)',
      action: () => {
        if (selectedContract) {
          setForm(prev => ({ ...prev, direction: '空', offset: '平' }));
          Toast.info('已切换: 卖平 (F4)');
        }
      },
    },
    {
      key: 'z',
      ctrl: true,
      description: '撤销最后订单',
      action: () => {
        const lastOrder = activeOrders[0];
        if (lastOrder) {
          handleCancel(lastOrder.vt_orderid);
        } else {
          Toast.info('没有可撤销的订单');
        }
      },
    },
    {
      key: 'Enter',
      ctrl: true,
      description: '确认下单',
      action: () => {
        if (selectedContract && form.price && form.volume) {
          handleSendOrder();
        }
      },
    },
    {
      key: 'x',
      ctrl: true,
      description: '批量撤单',
      action: handleCancelAll,
    },
    {
      key: 'Escape',
      description: '关闭弹窗',
      action: () => {
        if (stopLossTakeProfitModal) {
          setStopLossTakeProfitModal(false);
        }
      },
    },
  ], [selectedContract, activeOrders, form.price, form.volume, stopLossTakeProfitModal, handleCancelAll]);

  // 使用键盘快捷键
  useKeyboardShortcuts(shortcuts, !!selectedContract);

  // 快捷键帮助内容
  const ShortcutHelpContent = () => (
    <div style={{ padding: 12, maxWidth: 300 }}>
      <Typography.Text strong style={{ display: 'block', marginBottom: 12 }}>键盘快捷键</Typography.Text>
      {shortcuts.map((s, idx) => (
        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <Typography.Text size="small">{s.description}</Typography.Text>
          <Tag size="small">{s.ctrl ? 'Ctrl+' : ''}{s.key}</Tag>
        </div>
      ))}
      <Divider style={{ margin: '12px 0' }} />
      <Typography.Text type="tertiary" size="small">
        提示: 快捷键仅在选中合约时生效
      </Typography.Text>
    </div>
  );

  // 移动端简化布局
  if (isMobile) {
    return (
      <div>
        <ResponsivePageHeader
          title="交易面板"
          extra={<ConnectionIndicator />}
        />

        {/* 账户概览 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, overflowX: 'auto' }}>
          {accounts.slice(0, 3).map((account) => (
            <div
              key={account.vt_accountid}
              onClick={() => handleSelectAccount(account)}
              style={{
                minWidth: 140,
                borderRadius: 8,
                border: selectedAccount?.vt_accountid === account.vt_accountid
                  ? '2px solid var(--semi-color-primary)'
                  : '1px solid var(--semi-color-border)',
                padding: 12,
                background: 'var(--semi-color-bg-1)',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>
                {account.gateway_name}
                {account.account_type === 'paper' && <Tag color="blue" size="small" style={{ marginLeft: 4 }}>模拟</Tag>}
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>
                ¥{(account.available || 0).toFixed(0)}
              </div>
            </div>
          ))}
        </div>

        {/* 快速交易 */}
        <MobileTradingPanel vtSymbol={selectedContract?.vt_symbol} />

        {/* 持仓列表 */}
        <Card title={`持仓 (${Object.keys(positions).length})`} style={{ marginBottom: 12 }}>
          {Object.entries(positions).slice(0, 5).map(([vtSymbol, pos]: [string, any]) => (
            <div
              key={vtSymbol}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: '1px solid var(--semi-color-border)',
              }}
            >
              <div>
                <div style={{ fontWeight: 500 }}>{vtSymbol}</div>
                <Tag size="small" color={pos.direction === '多' ? 'red' : 'green'}>
                  {pos.direction} {pos.volume}手
                </Tag>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: (pos.pnl || 0) >= 0 ? '#f5222d' : '#52c41a' }}>
                  {pos.pnl >= 0 ? '+' : ''}{pos.pnl?.toFixed(2)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>
                  均价 {pos.price?.toFixed(2)}
                </div>
              </div>
            </div>
          ))}
          {Object.keys(positions).length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--semi-color-text-2)' }}>
              暂无持仓
            </div>
          )}
        </Card>

        {/* 当前委托 */}
        <Card title={`当前委托 (${activeOrders.length})`}>
          {activeOrders.slice(0, 5).map((order: any) => (
            <div
              key={order.vt_orderid}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: '1px solid var(--semi-color-border)',
              }}
            >
              <div>
                <div style={{ fontWeight: 500 }}>{order.vt_symbol}</div>
                <Tag size="small" color={order.direction === '多' ? 'red' : 'green'}>
                  {order.direction} {order.volume}手 @ {order.price}
                </Tag>
              </div>
              <Button
                size="small"
                type="danger"
                onClick={() => handleCancel(order.vt_orderid)}
              >
                撤
              </Button>
            </div>
          ))}
          {activeOrders.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--semi-color-text-2)' }}>
              暂无委托
            </div>
          )}
        </Card>
      </div>
    );
  }

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

        {/* 实时盈亏卡片 */}
        <Col span={6}>
          <Card
            bodyStyle={{ padding: 16 }}
            style={{
              borderRadius: 12,
              background: pnlData?.summary?.total_pnl && pnlData.summary.total_pnl >= 0
                ? 'rgba(245, 34, 45, 0.05)'
                : 'rgba(82, 196, 26, 0.05)',
            }}
          >
            <Typography.Text type="tertiary" style={{ display: 'block', marginBottom: 8 }}>
              实时盈亏 (WebSocket)
            </Typography.Text>
            <div style={{
              fontSize: 28,
              fontWeight: 700,
              color: pnlData?.summary?.total_pnl && pnlData.summary.total_pnl >= 0 ? '#f5222d' : '#52c41a'
            }}>
              {pnlData?.summary?.total_pnl
                ? `${pnlData.summary.total_pnl >= 0 ? '+' : ''}¥${pnlData.summary.total_pnl.toFixed(2)}`
                : '--'}
            </div>
            <Row style={{ marginTop: 8 }} gutter={8}>
              <Col span={12}>
                <Typography.Text type="tertiary" size="small">浮动盈亏</Typography.Text>
                <br />
                <Typography.Text
                  strong
                  style={{ color: (pnlData?.summary?.total_unrealized_pnl || 0) >= 0 ? '#f5222d' : '#52c41a' }}
                >
                  {pnlData?.summary?.total_unrealized_pnl
                    ? `${pnlData.summary.total_unrealized_pnl >= 0 ? '+' : ''}¥${pnlData.summary.total_unrealized_pnl.toFixed(2)}`
                    : '--'}
                </Typography.Text>
              </Col>
              <Col span={12}>
                <Typography.Text type="tertiary" size="small">已实现盈亏</Typography.Text>
                <br />
                <Typography.Text
                  strong
                  style={{ color: (pnlData?.summary?.total_realized_pnl || 0) >= 0 ? '#f5222d' : '#52c41a' }}
                >
                  {pnlData?.summary?.total_realized_pnl
                    ? `${pnlData.summary.total_realized_pnl >= 0 ? '+' : ''}¥${pnlData.summary.total_realized_pnl.toFixed(2)}`
                    : '--'}
                </Typography.Text>
              </Col>
            </Row>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Typography.Title heading={5} style={{ margin: 0 }}>活跃委托 ({activeOrders.length})</Typography.Title>
            <Space>
              <Button
                size="small"
                type="danger"
                icon={<IconDelete />}
                onClick={handleCancelAll}
                disabled={activeOrders.length === 0}
              >
                全部撤销 (Ctrl+X)
              </Button>
              <Popover content={<ShortcutHelpContent />} trigger="click" position="bottomRight">
                <Button size="small">快捷键</Button>
              </Popover>
            </Space>
          </div>
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
