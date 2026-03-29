import { useEffect, useState } from 'react';
import { Typography, Card, Input, Select, Button, Row, Col, Toast } from '@douyinfe/semi-ui';
import { backtestApi } from '../api';

export default function BacktestPage() {
  const [classes, setClasses] = useState<string[]>([]);
  const [result, setResult] = useState<any>(null);

  const [form, setForm] = useState({
    class_name: '', vt_symbol: '', interval: '1m',
    start: '2024-01-01', end: '2024-12-31',
    rate: '0.0001', slippage: '0', size: '1', capital: '1000000',
  });

  useEffect(() => { backtestApi.classes().then((r) => setClasses(r.data)).catch(() => {}); }, []);

  const handleRun = async () => {
    try {
      const res = await backtestApi.run({ ...form, rate: parseFloat(form.rate), slippage: parseFloat(form.slippage), size: parseFloat(form.size), capital: parseFloat(form.capital), setting: {} });
      setResult(res.data);
      Toast.success('回测完成');
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '回测失败');
    }
  };

  const updateForm = (key: string, value: string) => setForm({ ...form, [key]: value });
  const labelStyle = { marginBottom: 8, display: 'block' };

  return (
    <div>
      <Typography.Title heading={4}>回测中心</Typography.Title>
      <Row gutter={16}>
        <Col span={6}>
          <Card title="回测配置" style={{ borderRadius: 12 }}>
            <div><label style={labelStyle}>策略类</label>
              <Select value={form.class_name} onChange={(v) => updateForm('class_name', v as string)} style={{ width: '100%', marginBottom: 12 }} placeholder="选择策略"
                optionList={classes.map((c) => ({ value: c, label: c }))} /></div>
            <div><label style={labelStyle}>合约</label>
              <Input value={form.vt_symbol} onChange={(v) => updateForm('vt_symbol', v)} placeholder="rb2410.SHFE" style={{ marginBottom: 12 }} /></div>
            <div><label style={labelStyle}>周期</label>
              <Select value={form.interval} onChange={(v) => updateForm('interval', v as string)} style={{ width: '100%', marginBottom: 12 }}
                optionList={[{ value: '1m', label: '1分钟' }, { value: '1h', label: '1小时' }, { value: 'd', label: '日线' }, { value: 'w', label: '周线' }]} /></div>
            <Row gutter={8}>
              <Col span={12}><div><label style={labelStyle}>开始日期</label><Input type="date" value={form.start} onChange={(v) => updateForm('start', v)} /></div></Col>
              <Col span={12}><div><label style={labelStyle}>结束日期</label><Input type="date" value={form.end} onChange={(v) => updateForm('end', v)} /></div></Col>
            </Row>
            <div><label style={labelStyle}>手续费率</label><Input type="number" value={form.rate} onChange={(v) => updateForm('rate', v)} style={{ marginBottom: 12 }} /></div>
            <div><label style={labelStyle}>滑点</label><Input type="number" value={form.slippage} onChange={(v) => updateForm('slippage', v)} style={{ marginBottom: 12 }} /></div>
            <div><label style={labelStyle}>合约乘数</label><Input type="number" value={form.size} onChange={(v) => updateForm('size', v)} style={{ marginBottom: 12 }} /></div>
            <div><label style={labelStyle}>初始资金</label><Input type="number" value={form.capital} onChange={(v) => updateForm('capital', v)} style={{ marginBottom: 16 }} /></div>
            <Button theme="solid" block size="large" onClick={handleRun}
              disabled={!form.class_name || !form.vt_symbol} style={{ borderRadius: 10 }}>执行回测</Button>
          </Card>
        </Col>
        <Col span={18}>
          {result ? (
            <div>
              <Typography.Title heading={5}>回测结果</Typography.Title>
              <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
                {Object.entries(result.statistics || result).slice(0, 8).map(([k, v]) => (
                  <Col span={6} key={k}>
                    <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 12 }}>
                      <Typography.Text type="tertiary" size="small">{k}</Typography.Text><br />
                      <Typography.Text strong style={{ fontSize: 20 }}>{String(v)}</Typography.Text>
                    </Card>
                  </Col>
                ))}
              </Row>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--semi-color-text-2)' }}>
              <Typography.Title heading={4} type="tertiary">配置参数后执行回测</Typography.Title>
              <Typography.Text type="tertiary">回测结果将在此展示</Typography.Text>
            </div>
          )}
        </Col>
      </Row>
    </div>
  );
}
