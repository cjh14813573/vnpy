import { Tag } from '@douyinfe/semi-ui';
import { useNavigate } from 'react-router-dom';

interface MobileMarketCardProps {
  tick: {
    vt_symbol: string;
    last_price: number;
    pre_close?: number;
    bid_price_1?: number;
    ask_price_1?: number;
  };
}

export default function MobileMarketCard({ tick }: MobileMarketCardProps) {
  const navigate = useNavigate();
  const change = tick.pre_close ? tick.last_price - tick.pre_close : 0;
  const changePct = tick.pre_close ? (change / tick.pre_close) * 100 : 0;
  const isUp = change >= 0;

  return (
    <div
      style={{ marginBottom: 8, cursor: 'pointer', padding: 12, background: 'var(--semi-color-bg-1)', borderRadius: 8 }}
      onClick={() => navigate(`/trading?symbol=${tick.vt_symbol}`)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{tick.vt_symbol}</div>
          <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)', marginTop: 4 }}>
            买 {tick.bid_price_1?.toFixed(2)} / 卖 {tick.ask_price_1?.toFixed(2)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: isUp ? 'var(--semi-color-success)' : 'var(--semi-color-danger)',
            }}
          >
            {tick.last_price?.toFixed(2)}
          </div>
          <Tag
            size="small"
            color={isUp ? 'green' : 'red'}
            style={{ marginTop: 4 }}
          >
            {isUp ? '+' : ''}{changePct.toFixed(2)}%
          </Tag>
        </div>
      </div>
    </div>
  );
}
