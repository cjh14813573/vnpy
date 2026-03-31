import { useEffect, useRef, useCallback } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, createSeriesMarkers, type IChartApi, type ISeriesApi, type CandlestickData, type Time, type SeriesMarker } from 'lightweight-charts';

export interface KLineData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface TradeMarker {
  time: string;
  price: number;
  direction: 'buy' | 'sell' | 'short' | 'cover';
}

interface KLineChartProps {
  data: KLineData[];
  trades?: TradeMarker[];
  height?: number;
  onCrosshairMove?: (data: { time?: string; open?: number; high?: number; low?: number; close?: number }) => void;
}

export default function KLineChart({
  data,
  trades = [],
  height = 400,
  onCrosshairMove,
}: KLineChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const markersPluginRef = useRef<ReturnType<typeof createSeriesMarkers<Time>> | null>(null);

  // 转换时间格式
  const parseTime = useCallback((timeStr: string): Time => {
    // 处理 YYYY-MM-DD 格式
    if (timeStr.includes('-') && timeStr.length === 10) {
      const date = new Date(timeStr);
      return date.getTime() / 1000 as Time;
    }
    // 处理时间戳
    const timestamp = parseInt(timeStr);
    if (!isNaN(timestamp)) {
      return (timestamp > 1e10 ? timestamp / 1000 : timestamp) as Time;
    }
    return timeStr as Time;
  }, []);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 创建图表
    const chart = createChart(chartContainerRef.current, {
      height,
      layout: {
        background: { color: 'transparent' },
        textColor: 'var(--semi-color-text-0)',
      },
      grid: {
        vertLines: { color: 'var(--semi-color-border)' },
        horzLines: { color: 'var(--semi-color-border)' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: 'var(--semi-color-primary)',
          labelBackgroundColor: 'var(--semi-color-primary)',
        },
        horzLine: {
          color: 'var(--semi-color-primary)',
          labelBackgroundColor: 'var(--semi-color-primary)',
        },
      },
      rightPriceScale: {
        borderColor: 'var(--semi-color-border)',
      },
      timeScale: {
        borderColor: 'var(--semi-color-border)',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // 创建K线系列 - 红涨绿跌（中国股市习惯）
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#f5222d',
      downColor: '#52c41a',
      borderUpColor: '#f5222d',
      borderDownColor: '#52c41a',
      wickUpColor: '#f5222d',
      wickDownColor: '#52c41a',
    });
    candlestickSeriesRef.current = candlestickSeries;

    // 创建标记插件
    const markersPlugin = createSeriesMarkers(candlestickSeries);
    markersPluginRef.current = markersPlugin;

    // 创建成交量系列
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });
    volumeSeriesRef.current = volumeSeries;

    // 十字光标移动事件
    if (onCrosshairMove) {
      chart.subscribeCrosshairMove((param) => {
        if (param.time) {
          const data = param.seriesData.get(candlestickSeries) as CandlestickData;
          if (data) {
            onCrosshairMove({
              time: param.time.toString(),
              open: data.open,
              high: data.high,
              low: data.low,
              close: data.close,
            });
          }
        } else {
          onCrosshairMove({});
        }
      });
    }

    // 响应式调整
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [height, onCrosshairMove]);

  // 更新数据
  useEffect(() => {
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current || data.length === 0) return;

    const chartData: CandlestickData[] = data.map((d) => ({
      time: parseTime(d.time),
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const volumeData = data.map((d) => ({
      time: parseTime(d.time),
      value: d.volume || 0,
      color: d.close >= d.open ? '#f5222d50' : '#52c41a50',
    }));

    candlestickSeriesRef.current.setData(chartData);
    volumeSeriesRef.current.setData(volumeData);

    // 添加交易标记
    if (trades.length > 0) {
      const markers: SeriesMarker<Time>[] = trades.map((trade) => ({
        time: parseTime(trade.time),
        position: trade.direction === 'buy' || trade.direction === 'cover' ? 'belowBar' : 'aboveBar',
        color: trade.direction === 'buy' || trade.direction === 'cover' ? '#f5222d' : '#52c41a',
        shape: trade.direction === 'buy' || trade.direction === 'cover' ? 'arrowUp' : 'arrowDown',
        text: trade.direction === 'buy' ? '买开' : trade.direction === 'sell' ? '卖平' : trade.direction === 'short' ? '卖开' : '买平',
        size: 2,
      }));

      markersPluginRef.current?.setMarkers(markers);
    }

    // 适应数据范围
    chartRef.current?.timeScale().fitContent();
  }, [data, trades, parseTime]);

  if (data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--semi-color-text-2)' }}>
        暂无K线数据
      </div>
    );
  }

  return (
    <div
      ref={chartContainerRef}
      style={{
        width: '100%',
        height,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    />
  );
}
