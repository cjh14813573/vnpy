import { create } from 'zustand';

interface TickData {
  symbol: string;
  exchange: string;
  vt_symbol: string;
  gateway_name: string;
  name: string;
  last_price: number;
  volume: number;
  bid_price_1: number;
  bid_volume_1: number;
  ask_price_1: number;
  ask_volume_1: number;
  [key: string]: any;
}

interface MarketState {
  ticks: Record<string, TickData>;
  subscribed: Set<string>;

  updateTick: (tick: TickData) => void;
  addSubscribed: (vtSymbol: string) => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  ticks: {},
  subscribed: new Set(),

  updateTick: (tick) =>
    set((state) => ({
      ticks: { ...state.ticks, [tick.vt_symbol]: tick },
    })),

  addSubscribed: (vtSymbol) =>
    set((state) => {
      const next = new Set(state.subscribed);
      next.add(vtSymbol);
      return { subscribed: next };
    }),
}));
