import { useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';

interface KLineBar {
  datetime: string;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  volume: number;
  turnover: number;
}

interface KLineChartProps {
  data: KLineBar[];
  title?: string;
}

export default function KLineChart({ data, title = 'K线图' }: KLineChartProps) {
  const chartRef = useRef<ReactECharts>(null);

  // 转换为 ECharts K线格式: [open, close, low, high]
  const candleData = data.map((d) => [d.open_price, d.close_price, d.low_price, d.high_price]);
  const dates = data.map((d) => d.datetime?.slice(0, 16) || '');
  const volumes = data.map((d) => d.volume);
  const colors = data.map((d) => d.close_price >= d.open_price ? '#ef5350' : '#26a69a');

  const option: EChartsOption = {
    title: { text: title, left: 'center', textStyle: { fontSize: 14 } },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params: any) => {
        if (!params || !params.length) return '';
        const idx = params[0].dataIndex;
        const bar = data[idx];
        if (!bar) return '';
        return `<b>${dates[idx]}</b><br/>
          开: ${bar.open_price}  高: ${bar.high_price}<br/>
          低: ${bar.low_price}  收: ${bar.close_price}<br/>
          量: ${bar.volume}`;
      },
    },
    legend: { data: ['K线', '成交量'], top: 30 },
    grid: [
      { left: '8%', right: '3%', height: '55%' },
      { left: '8%', right: '3%', top: '72%', height: '18%' },
    ],
    xAxis: [
      { type: 'category', data: dates, gridIndex: 0, axisLabel: { fontSize: 10 } },
      { type: 'category', data: dates, gridIndex: 1, axisLabel: { fontSize: 10 } },
    ],
    yAxis: [
      { scale: true, gridIndex: 0, splitArea: { show: true } },
      { scale: true, gridIndex: 1, splitNumber: 2 },
    ],
    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1], start: Math.max(0, 100 - (500 / data.length) * 100), end: 100 },
      { show: true, xAxisIndex: [0, 1], type: 'slider', top: '92%', height: 20 },
    ],
    series: [
      {
        name: 'K线',
        type: 'candlestick',
        data: candleData,
        xAxisIndex: 0,
        yAxisIndex: 0,
        itemStyle: {
          color: '#ef5350',
          color0: '#26a69a',
          borderColor: '#ef5350',
          borderColor0: '#26a69a',
        },
      },
      {
        name: '成交量',
        type: 'bar',
        data: volumes.map((v, i) => ({ value: v, itemStyle: { color: colors[i] } })),
        xAxisIndex: 1,
        yAxisIndex: 1,
      },
    ],
  };

  if (data.length === 0) {
    return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无K线数据</div>;
  }

  return (
    <ReactECharts
      ref={chartRef}
      option={option}
      style={{ height: 500, width: '100%' }}
      notMerge
      lazyUpdate
    />
  );
}
