import { useState } from 'react';
import { Card, Button, Input, Tag, Toast } from '@douyinfe/semi-ui';
import { tradingApi } from '../../api';

interface MobileTradingPanelProps {
  vtSymbol?: string;
}

export default function MobileTradingPanel({ vtSymbol }: MobileTradingPanelProps) {
  const [form, setForm] = useState({
    vt_symbol: vtSymbol || '',
    direction: '多',
    volume: 1,
    price: 0,
    order_type: '限价',
  });
  const [loading, setLoading] = useState(false);

  const handleSendOrder = async () => {
    if (!form.vt_symbol) {
      Toast.error('请选择合约');
      return;
    }
    setLoading(true);
    try {
      await tradingApi.sendOrder({
        vt_symbol: form.vt_symbol,
        direction: form.direction,
        volume: form.volume,
        price: form.price,
        type: form.order_type,
      });
      Toast.success('下单成功');
    } catch (error: any) {
      Toast.error(error.response?.data?.detail || '下单失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)', marginBottom: 4 }}>
          合约
        </div>
        <Input
          value={form.vt_symbol}
          onChange={(v) => setForm({ ...form, vt_symbol: v })}
          placeholder="如: IF2406.CFFEX"
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Button
            type={form.direction === '多' ? 'primary' : 'tertiary'}
            theme="solid"
            style={{ flex: 1 }}
            onClick={() => setForm({ ...form, direction: '多' })}
          >
            买入开多
          </Button>
          <Button
            type={form.direction === '空' ? 'danger' : 'tertiary'}
            theme="solid"
            style={{ flex: 1 }}
            onClick={() => setForm({ ...form, direction: '空' })}
          >
            卖出开空
          </Button>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)', marginBottom: 4 }}>
          价格
        </div>
        <Input
          type="number"
          value={form.price}
          onChange={(v) => setForm({ ...form, price: parseFloat(v) || 0 })}
          step={0.01}
          addonAfter={
            <Tag
              size="small"
              color={form.order_type === '市价' ? 'blue' : 'green'}
              style={{ cursor: 'pointer' }}
              onClick={() =>
                setForm({
                  ...form,
                  order_type: form.order_type === '市价' ? '限价' : '市价',
                })
              }
            >
              {form.order_type}
            </Tag>
          }
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)', marginBottom: 4 }}>
          数量
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button
            size="small"
            onClick={() => setForm({ ...form, volume: Math.max(1, form.volume - 1) })}
          >
            -
          </Button>
          <Input
            type="number"
            value={form.volume}
            onChange={(v) => setForm({ ...form, volume: parseInt(v) || 1 })}
            style={{ textAlign: 'center', flex: 1 }}
          />
          <Button size="small" onClick={() => setForm({ ...form, volume: form.volume + 1 })}>
            +
          </Button>
        </div>
      </div>

      <Button
        theme="solid"
        type={form.direction === '多' ? 'primary' : 'danger'}
        size="large"
        block
        loading={loading}
        onClick={handleSendOrder}
      >
        {form.direction === '多' ? '买入' : '卖出'} {form.volume}手 @ {form.price || '市价'}
      </Button>
    </Card>
  );
}
