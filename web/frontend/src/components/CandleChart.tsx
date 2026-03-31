/**
 * K线图表组件 - 基于 lightweight-charts v5
 *
 * 特性:
 * - 中国红涨绿跌风格
 * - 支持 MA5/MA10/MA20 均线
 * - 响应式设计
 * - 鼠标悬浮显示 OHLCV 数据
 */

import { useEffect, useRef, useCallback } from 'react';
import { createChart, type IChartApi, type ISeriesApi, type CandlestickData, type Time } from 'lightweight-charts';

export interface CandleData {
  time: string;  // YYYY-MM-DD 或 YYYY-MM-DD HH:mm
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface CandleChartProps {
  data: CandleData[];
  width?: number;
  height?: number;
  showMA?: boolean;  // 是否显示均线
  showVolume?: boolean;  // 是否显示成交量
}

// 中国红涨绿跌配色
const COLORS = {
  up: '#f5222d',      // 红色 - 涨
  down: '#52c41a',    // 绿色 - 跌
  upBg: 'rgba(245, 34, 45, 0.1)',
  downBg: 'rgba(82, 196, 26, 0.1)',
  ma5: '#1890ff',     // 蓝色
  ma10: '#faad14',    // 黄色
  ma20: '#722ed1',    // 紫色
  grid: '#e8e8e8',
  text: '#666',
};

// 计算均线
function calculateMA(data: CandleData[], period: number): { time: string; value: number }[] {
  const result: { time: string; value: number }[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push({ time: data[i].time, value: NaN });
      continue;
    }
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    result.push({ time: data[i].time, value: sum / period });
  }
  return result;
}

export default function CandleChart({
  data,
  width = 800,
  height = 400,
  showMA = true,
  showVolume = true,
}: CandleChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ma5Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ma10Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ma20Ref = useRef<ISeriesApi<'Line'> | null>(null);

  // 格式化时间
  const formatTime = useCallback((timeStr: string): Time => {
    // 如果是分钟级别数据 (YYYY-MM-DD HH:mm)
    if (timeStr.includes(' ')) {
      return timeStr.replace(' ', 'T') as Time;
    }
    // 日级别数据
    return timeStr as Time;
  }, []);

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    // 清理旧图表
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    // 创建图表
    const chart = createChart(chartContainerRef.current, {
      width,
      height,
      layout: {
        background: { color: '#ffffff' },
        textColor: COLORS.text,
      },
      grid: {
        vertLines: { color: COLORS.grid },
        horzLines: { color: COLORS.grid },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: COLORS.grid,
      },
      timeScale: {
        borderColor: COLORS.grid,
        timeVisible: data[0]?.time?.includes(' ') || false,
      },
    });

    chartRef.current = chart;

    // K线系列
    const candleSeries = (chart as any).addCandlestickSeries({
      upColor: COLORS.up,
      downColor: COLORS.down,
      borderUpColor: COLORS.up,
      borderDownColor: COLORS.down,
      wickUpColor: COLORS.up,
      wickDownColor: COLORS.down,
    });

    candleSeriesRef.current = candleSeries;

    // 转换数据
    const candleData: CandlestickData[] = data.map(d => ({
      time: formatTime(d.time),
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    candleSeries.setData(candleData);

    // 成交量
    if (showVolume) {
      const volumeSeries = (chart as any).addHistogramSeries({
        color: COLORS.up,
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: '',
      });

      volumeSeriesRef.current = volumeSeries;

      // 设置成交量在底部
      chart.priceScale('').applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });

      const volumeData = data.map(d => ({
        time: formatTime(d.time),
        value: d.volume || 0,
        color: d.close >= d.open ? COLORS.up : COLORS.down,
      }));

      volumeSeries.setData(volumeData);
    }

    // 均线
    if (showMA) {
      const ma5 = calculateMA(data, 5);
      const ma10 = calculateMA(data, 10);
      const ma20 = calculateMA(data, 20);

      // MA5
      const ma5Series = (chart as any).addLineSeries({
        color: COLORS.ma5,
        lineWidth: 1,
        title: 'MA5',
      });
      ma5Ref.current = ma5Series;
      ma5Series.setData(ma5.filter(d => !isNaN(d.value)).map(d => ({
        time: formatTime(d.time),
        value: d.value,
      })));

      // MA10
      const ma10Series = (chart as any).addLineSeries({
        color: COLORS.ma10,
        lineWidth: 1,
        title: 'MA10',
      });
      ma10Ref.current = ma10Series;
      ma10Series.setData(ma10.filter(d => !isNaN(d.value)).map(d => ({
        time: formatTime(d.time),
        value: d.value,
      })));

      // MA20
      const ma20Series = (chart as any).addLineSeries({
        color: COLORS.ma20,
        lineWidth: 1,
        title: 'MA20',
      });
      ma20Ref.current = ma20Series;
      ma20Series.setData(ma20.filter(d => !isNaN(d.value)).map(d => ({
        time: formatTime(d.time),
        value: d.value,
      })));
    }

    // 自适应数据范围
    chart.timeScale().fitContent();

    // 响应式处理
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        const newWidth = chartContainerRef.current.clientWidth;
        chartRef.current.applyOptions({ width: newWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [data, width, height, showMA, showVolume, formatTime]);

  // 更新数据（增量更新）
  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;

    const lastData = data[data.length - 1];
    const time = formatTime(lastData.time);

    // 更新K线
    if (candleSeriesRef.current) {
      candleSeriesRef.current.update({
        time,
        open: lastData.open,
        high: lastData.high,
        low: lastData.low,
        close: lastData.close,
      });
    }

    // 更新成交量
    if (volumeSeriesRef.current && showVolume) {
      volumeSeriesRef.current.update({
        time,
        value: lastData.volume || 0,
        color: lastData.close >= lastData.open ? COLORS.up : COLORS.down,
      });
    }
  }, [data, formatTime, showVolume]);

  return (
    <div
      ref={chartContainerRef}
      style={{
        width: '100%',
        height: `${height}px`,
      }}
    />
  );
}
