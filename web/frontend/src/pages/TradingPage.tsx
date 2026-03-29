import { useEffect, useState } from 'react';
import { Typography, Card, Input, Select, Button, Table, Tag, Row, Col, Toast } from '@douyinfe/semi-ui';
import { tradingApi } from '../api';

export default function TradingPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [, setAccounts] = useState<any[]>([]);

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
    try {
      const res = await tradingApi.sendOrder({ ...form, volume: parseFloat(form.volume), price: parseFloat(form.price) });
      Toast.success(`下单成功: ${res.data.vt_orderid}`);
      load();
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '下单失败');
    }
  };

  const handleCancel = async (vt_orderid: string) => {
    try { await tradingApi.cancelOrder({ vt_orderid }); load(); } catch { /* ignore */ }
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

  return (
    <div>
      <Typography.Title heading={4}>交易面板</Typography.Title>
      <Row gutter={16}>
        <Col span={8}>
          <Card title="下单" style={{ borderRadius: 12 }}>
            <div>
              <label style={labelStyle}>合约代码</label>
              <Input placeholder="rb2410" value={form.symbol} onChange={(v) => updateForm('symbol', v)} style={{ marginBottom: 12 }} />
            </div>
            <div>
              <label style={labelStyle}>交易所</label>
              <Select value={form.exchange} onChange={(v) => updateForm('exchange', v)} style={{ width: '100%', marginBottom: 12 }}
                optionList={['SHFE','CFFEX','DCE','CZCE','INE','SSE','SZSE'].map((e) => ({ value: e, label: e }))} />
            </div>
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
              <Col span={12}><div><label style={labelStyle}>价格</label>
                <Input type="number" value={form.price} onChange={(v) => updateForm('price', v)} /></div></Col>
              <Col span={12}><div><label style={labelStyle}>数量</label>
                <Input type="number" value={form.volume} onChange={(v) => updateForm('volume', v)} /></div></Col>
            </Row>
            <div>
              <label style={labelStyle}>网关</label>
              <Select value={form.gateway_name} onChange={(v) => updateForm('gateway_name', v)} style={{ width: '100%', marginBottom: 16 }}
                optionList={[{ value: 'CTP', label: 'CTP' }, { value: 'SIM', label: 'SIM' }]} />
            </div>
            <Button theme="solid" type={form.direction === '多' ? 'primary' : 'danger'} block size="large"
              onClick={handleSendOrder} style={{ borderRadius: 10 }}>
              {form.direction === '多' ? '买入' : '卖出'} {form.symbol}
            </Button>
          </Card>
        </Col>
        <Col span={16}>
          <Typography.Title heading={5}>活跃委托</Typography.Title>
          <Card style={{ marginBottom: 16, borderRadius: 12 }}>
            <Table columns={orderCols} dataSource={orders} pagination={false} size="small" empty="暂无活跃委托" />
          </Card>
          <Typography.Title heading={5}>最新成交</Typography.Title>
          <Card style={{ marginBottom: 16, borderRadius: 12 }}>
            <Table columns={tradeCols} dataSource={trades.slice(-20).reverse()} pagination={false} size="small" empty="暂无成交" />
          </Card>
          <Typography.Title heading={5}>持仓明细</Typography.Title>
          <Card style={{ borderRadius: 12 }}>
            <Table columns={posCols} dataSource={positions} pagination={false} size="small" empty="暂无持仓" />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
