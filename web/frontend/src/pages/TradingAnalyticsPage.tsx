import { useState, useMemo } from 'react';
import {
  Card, Typography, Tabs, TabPane, Row, Col,
  DatePicker, Button, Select, Table, Tag, Empty, Spin, Progress
} from '@douyinfe/semi-ui';
import {
  IconArrowUp, IconHistogram, IconLineChartStroked,
  IconCoinMoney, IconSafe
} from '@douyinfe/semi-icons';
import { useData } from '../hooks/useData';
import { analyticsApi } from '../api';
import { formatNumber, formatPercent, formatCurrency } from '../utils/format';
import ReactECharts from 'echarts-for-react';

const { Title, Text } = Typography;

interface PerformanceSummary {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  win_rate_pct: number;
  total_pnl: number;
  avg_pnl: number;
  avg_win: number;
  avg_loss: number;
  max_profit: number;
  max_loss: number;
  profit_factor: number;
  sharpe_ratio: number;
  calmar_ratio: number;
  max_drawdown: number;
  max_drawdown_pct: number;
}

interface MonthlyData {
  year_month: string;
  pnl: number;
  trades: number;
  wins: number;
  win_rate: number;
  cumulative_pnl: number;
}

interface DailyData {
  date: string;
  pnl: number;
  cumulative_pnl: number;
  drawdown: number;
}

interface BenchmarkComparison {
  period: string;
  strategy_return: number;
  benchmark_return: number;
  alpha: number;
  beta: number;
  information_ratio: number;
}

export default function TradingAnalyticsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState<any>(null);
  const [benchmark, setBenchmark] = useState('sh000300');

  // 加载绩效汇总
  const {
    data: summary,
    loading: summaryLoading,
    refresh: refreshSummary,
  } = useData<PerformanceSummary | null>({
    fetcher: () => analyticsApi.performanceSummary({
      start_date: dateRange?.[0]?.toISOString().split('T')[0],
      end_date: dateRange?.[1]?.toISOString().split('T')[0],
    }).then(r => r.data),
    defaultValue: null,
  });

  // 加载归因分析
  const {
    data: attribution,
    loading: attributionLoading,
  } = useData({
    fetcher: () => analyticsApi.performanceAttribution().then(r => r.data),
    defaultValue: null,
  });

  // 加载月度数据
  const {
    data: monthlyData,
    loading: monthlyLoading,
  } = useData<{ monthly_data: MonthlyData[]; summary: any }>({
    fetcher: () => analyticsApi.monthlyPerformance(12).then(r => r.data),
    defaultValue: { monthly_data: [], summary: {} },
  });

  // 加载日度数据
  const {
    data: dailyData,
    loading: dailyLoading,
  } = useData<{ daily_data: DailyData[]; summary: any }>({
    fetcher: () => analyticsApi.dailyPerformance(90).then(r => r.data),
    defaultValue: { daily_data: [], summary: {} },
  });

  // 加载基准对比
  const {
    data: benchmarkData,
    loading: benchmarkLoading,
  } = useData<{ comparison: BenchmarkComparison[] }>({
    fetcher: () => analyticsApi.benchmarkComparison(benchmark).then(r => r.data),
    defaultValue: { comparison: [] },
    deps: [benchmark],
  });

  // 绩效指标卡片
  const renderSummaryCards = () => {
    if (!summary) return null;

    const cards = [
      {
        title: '总盈亏',
        value: summary.total_pnl,
        prefix: summary.total_pnl >= 0 ? '+' : '',
        suffix: '元',
        icon: <IconCoinMoney style={{ color: summary.total_pnl >= 0 ? 'var(--semi-color-success)' : 'var(--semi-color-danger)' }} />,
        color: summary.total_pnl >= 0 ? 'success' : 'danger',
      },
      {
        title: '胜率',
        value: summary.win_rate_pct,
        suffix: '%',
        icon: <IconHistogram style={{ color: 'var(--semi-color-primary)' }} />,
        color: 'primary',
      },
      {
        title: '盈亏比',
        value: summary.profit_factor,
        icon: <IconArrowUp style={{ color: summary.profit_factor >= 1 ? 'var(--semi-color-success)' : 'var(--semi-color-danger)' }} />,
        color: summary.profit_factor >= 1 ? 'success' : 'danger',
      },
      {
        title: '夏普比率',
        value: summary.sharpe_ratio,
        icon: <IconLineChartStroked style={{ color: summary.sharpe_ratio >= 1 ? 'var(--semi-color-success)' : 'var(--semi-color-warning)' }} />,
        color: summary.sharpe_ratio >= 1 ? 'success' : 'warning',
      },
      {
        title: '最大回撤',
        value: summary.max_drawdown_pct,
        suffix: '%',
        icon: <IconArrowUp style={{ color: 'var(--semi-color-danger)', transform: 'rotate(180deg)' }} />,
        color: 'danger',
      },
      {
        title: 'Calmar比率',
        value: summary.calmar_ratio,
        icon: <IconSafe style={{ color: summary.calmar_ratio >= 2 ? 'var(--semi-color-success)' : 'var(--semi-color-warning)' }} />,
        color: summary.calmar_ratio >= 2 ? 'success' : 'warning',
      },
    ];

    return (
      <Row gutter={[16, 16]}>
        {cards.map((card, index) => (
          <Col span={8} key={index}>
            <Card style={{ height: 120 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: `var(--semi-color-${card.color}-light-default)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                }}>
                  {card.icon}
                </div>
                <div>
                  <Text type="tertiary" style={{ fontSize: 14 }}>{card.title}</Text>
                  <div style={{ fontSize: 24, fontWeight: 600, color: `var(--semi-color-${card.color})` }}>
                    {card.prefix}{formatNumber(card.value)}{card.suffix}
                  </div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    );
  };

  // 交易统计图表
  const tradeStatsOption = useMemo(() => {
    if (!summary) return {};

    return {
      tooltip: { trigger: 'item' },
      legend: { bottom: '5%', left: 'center' },
      series: [
        {
          name: '交易分布',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: { show: false, position: 'center' },
          emphasis: {
            label: { show: true, fontSize: 20, fontWeight: 'bold' },
          },
          labelLine: { show: false },
          data: [
            { value: summary.winning_trades, name: '盈利', itemStyle: { color: 'var(--semi-color-success)' } },
            { value: summary.losing_trades, name: '亏损', itemStyle: { color: 'var(--semi-color-danger)' } },
          ],
        },
      ],
    };
  }, [summary]);

  // 盈亏分布图表
  const pnlDistributionOption = useMemo(() => {
    if (!summary) return {};

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: ['最大亏损', '平均亏损', '平均盈亏', '平均盈利', '最大盈利'] },
      yAxis: { type: 'value', name: '金额(元)' },
      series: [{
        data: [
          { value: summary.max_loss, itemStyle: { color: 'var(--semi-color-danger)' } },
          { value: summary.avg_loss, itemStyle: { color: '#ff8787' } },
          { value: summary.avg_pnl, itemStyle: { color: summary.avg_pnl >= 0 ? 'var(--semi-color-success)' : 'var(--semi-color-danger)' } },
          { value: summary.avg_win, itemStyle: { color: '#69c286' } },
          { value: summary.max_profit, itemStyle: { color: 'var(--semi-color-success)' } },
        ],
        type: 'bar',
        barWidth: '60%',
        label: { show: true, position: 'top', formatter: '{c}' },
      }],
    };
  }, [summary]);

  // 月度收益图表
  const monthlyChartOption = useMemo(() => {
    if (!monthlyData?.monthly_data?.length) return {};

    const months = monthlyData.monthly_data.map((d: MonthlyData) => d.year_month);
    const pnls = monthlyData.monthly_data.map((d: MonthlyData) => d.pnl);
    const cumulatives = monthlyData.monthly_data.map((d: MonthlyData) => d.cumulative_pnl);

    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['月度盈亏', '累计盈亏'] },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: months },
      yAxis: [
        { type: 'value', name: '月度盈亏', position: 'left' },
        { type: 'value', name: '累计盈亏', position: 'right' },
      ],
      series: [
        {
          name: '月度盈亏',
          type: 'bar',
          data: pnls,
          itemStyle: {
            color: (params: any) => params.value >= 0 ? 'var(--semi-color-success)' : 'var(--semi-color-danger)',
          },
        },
        {
          name: '累计盈亏',
          type: 'line',
          yAxisIndex: 1,
          data: cumulatives,
          smooth: true,
          lineStyle: { color: 'var(--semi-color-primary)', width: 2 },
          itemStyle: { color: 'var(--semi-color-primary)' },
        },
      ],
    };
  }, [monthlyData]);

  // 日度收益与回撤图表
  const dailyChartOption = useMemo(() => {
    if (!dailyData?.daily_data?.length) return {};

    const dates = dailyData.daily_data.map((d: DailyData) => d.date);
    const pnls = dailyData.daily_data.map((d: DailyData) => d.pnl);
    const drawdowns = dailyData.daily_data.map((d: DailyData) => d.drawdown);

    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['日盈亏', '回撤率'] },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: dates },
      yAxis: [
        { type: 'value', name: '盈亏(元)', position: 'left' },
        { type: 'value', name: '回撤(%)', position: 'right', max: 100 },
      ],
      series: [
        {
          name: '日盈亏',
          type: 'bar',
          data: pnls,
          itemStyle: {
            color: (params: any) => params.value >= 0 ? 'rgba(105, 194, 134, 0.6)' : 'rgba(249, 100, 100, 0.6)',
          },
        },
        {
          name: '回撤率',
          type: 'line',
          yAxisIndex: 1,
          data: drawdowns,
          smooth: true,
          lineStyle: { color: 'var(--semi-color-danger)', width: 2 },
          areaStyle: { color: 'rgba(249, 100, 100, 0.2)' },
        },
      ],
    };
  }, [dailyData]);

  // 基准对比图表
  const benchmarkChartOption = useMemo(() => {
    if (!benchmarkData?.comparison?.length) return {};

    const periods = benchmarkData.comparison.map((c: BenchmarkComparison) => c.period);
    const strategyReturns = benchmarkData.comparison.map((c: BenchmarkComparison) => c.strategy_return);
    const benchmarkReturns = benchmarkData.comparison.map((c: BenchmarkComparison) => c.benchmark_return);
    const alphas = benchmarkData.comparison.map((c: BenchmarkComparison) => c.alpha);

    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['策略收益', '基准收益', 'Alpha'] },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: periods },
      yAxis: { type: 'value', name: '收益率(%)' },
      series: [
        {
          name: '策略收益',
          type: 'bar',
          data: strategyReturns,
          itemStyle: { color: 'var(--semi-color-primary)' },
        },
        {
          name: '基准收益',
          type: 'bar',
          data: benchmarkReturns,
          itemStyle: { color: 'var(--semi-color-tertiary)' },
        },
        {
          name: 'Alpha',
          type: 'line',
          data: alphas,
          smooth: true,
          lineStyle: { color: 'var(--semi-color-success)', width: 2 },
          itemStyle: { color: 'var(--semi-color-success)' },
        },
      ],
    };
  }, [benchmarkData]);

  // 归因表格列
  const attributionColumns = [
    { title: '品种', dataIndex: 'symbol', key: 'symbol' },
    {
      title: '盈亏',
      dataIndex: 'pnl',
      key: 'pnl',
      render: (val: number) => (
        <Text style={{ color: val >= 0 ? 'var(--semi-color-success)' : 'var(--semi-color-danger)' }}>
          {val >= 0 ? '+' : ''}{formatCurrency(val)}
        </Text>
      ),
    },
    { title: '交易次数', dataIndex: 'trades', key: 'trades' },
    {
      title: '胜率',
      dataIndex: 'win_rate',
      key: 'win_rate',
      render: (val: number) => formatPercent(val),
    },
    {
      title: '贡献度',
      dataIndex: 'contribution_pct',
      key: 'contribution_pct',
      render: (val: number) => (
        <Progress percent={val} size="small" showInfo={true} />
      ),
    },
  ];

  // 小时归因图表
  const hourlyAttributionOption = useMemo(() => {
    if (!attribution?.hourly_attribution) return {};

    const hours = Object.keys(attribution.hourly_attribution);
    const values = Object.values(attribution.hourly_attribution) as number[];

    return {
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: hours, axisLabel: { interval: 2 } },
      yAxis: { type: 'value', name: '盈亏(元)' },
      series: [{
        data: values,
        type: 'bar',
        itemStyle: {
          color: (params: any) => params.value >= 0 ? 'var(--semi-color-success)' : 'var(--semi-color-danger)',
        },
      }],
    };
  }, [attribution]);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title heading={4}>交易数据分析</Title>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <DatePicker
            type="dateRange"
            value={dateRange}
            onChange={(dates) => setDateRange(dates)}
            placeholder={['开始日期', '结束日期']}
          />
          <Button type="primary" onClick={refreshSummary}>刷新</Button>
        </div>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="绩效概览" itemKey="overview">
          <Spin spinning={summaryLoading}>
            {renderSummaryCards()}

            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col span={8}>
                <Card title="交易分布" style={{ height: 400 }}>
                  {summary ? (
                    <ReactECharts option={tradeStatsOption} style={{ height: 320 }} />
                  ) : (
                    <Empty description="暂无数据" />
                  )}
                </Card>
              </Col>
              <Col span={16}>
                <Card title="盈亏分布" style={{ height: 400 }}>
                  {summary ? (
                    <ReactECharts option={pnlDistributionOption} style={{ height: 320 }} />
                  ) : (
                    <Empty description="暂无数据" />
                  )}
                </Card>
              </Col>
            </Row>

            <Card title="交易统计" style={{ marginTop: 16 }}>
              <Row gutter={[24, 16]}>
                <Col span={6}>
                  <div>
                    <Text type="tertiary">总交易次数</Text>
                    <div style={{ fontSize: 24, fontWeight: 600 }}>{summary?.total_trades || 0}</div>
                  </div>
                </Col>
                <Col span={6}>
                  <div>
                    <Text type="tertiary">盈利次数</Text>
                    <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--semi-color-success)' }}>{summary?.winning_trades || 0}</div>
                  </div>
                </Col>
                <Col span={6}>
                  <div>
                    <Text type="tertiary">亏损次数</Text>
                    <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--semi-color-danger)' }}>{summary?.losing_trades || 0}</div>
                  </div>
                </Col>
                <Col span={6}>
                  <div>
                    <Text type="tertiary">平均盈亏</Text>
                    <div style={{ fontSize: 24, fontWeight: 600, color: summary?.avg_pnl && summary.avg_pnl >= 0 ? 'var(--semi-color-success)' : 'var(--semi-color-danger)' }}>
                      {summary?.avg_pnl && summary.avg_pnl >= 0 ? '+' : ''}{formatNumber(summary?.avg_pnl || 0)}元
                    </div>
                  </div>
                </Col>
              </Row>
            </Card>
          </Spin>
        </TabPane>

        <TabPane tab="月度收益" itemKey="monthly">
          <Spin spinning={monthlyLoading}>
            <Card title="月度盈亏走势">
              <ReactECharts option={monthlyChartOption} style={{ height: 400 }} />
            </Card>

            {monthlyData?.summary && (
              <Card style={{ marginTop: 16 }}>
                <Row gutter={[24, 16]}>
                  <Col span={6}>
                    <div>
                      <Text type="tertiary">统计月数</Text>
                      <div style={{ fontSize: 24, fontWeight: 600 }}>{monthlyData.summary.total_months}月</div>
                    </div>
                  </Col>
                  <Col span={6}>
                    <div>
                      <Text type="tertiary">盈利月数</Text>
                      <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--semi-color-success)' }}>
                        {monthlyData.summary.profitable_months}月
                      </div>
                    </div>
                  </Col>
                  <Col span={6}>
                    <div>
                      <Text type="tertiary">亏损月数</Text>
                      <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--semi-color-danger)' }}>
                        {monthlyData.summary.losing_months}月
                      </div>
                    </div>
                  </Col>
                  <Col span={6}>
                    <div>
                      <Text type="tertiary">最佳月份</Text>
                      <div style={{ fontSize: 24, fontWeight: 600 }}>{monthlyData.summary.best_month || '-'}</div>
                    </div>
                  </Col>
                </Row>
              </Card>
            )}
          </Spin>
        </TabPane>

        <TabPane tab="日度收益" itemKey="daily">
          <Spin spinning={dailyLoading}>
            <Card title="日盈亏与回撤">
              <ReactECharts option={dailyChartOption} style={{ height: 400 }} />
            </Card>

            {dailyData?.summary && (
              <Card style={{ marginTop: 16 }}>
                <Row gutter={[24, 16]}>
                  <Col span={6}>
                    <div>
                      <Text type="tertiary">统计天数</Text>
                      <div style={{ fontSize: 24, fontWeight: 600 }}>{dailyData.summary.total_days}天</div>
                    </div>
                  </Col>
                  <Col span={6}>
                    <div>
                      <Text type="tertiary">盈利天数</Text>
                      <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--semi-color-success)' }}>
                        {dailyData.summary.profitable_days}天
                      </div>
                    </div>
                  </Col>
                  <Col span={6}>
                    <div>
                      <Text type="tertiary">最大日盈</Text>
                      <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--semi-color-success)' }}>
                        {formatCurrency(dailyData.summary.max_daily_profit)}
                      </div>
                    </div>
                  </Col>
                  <Col span={6}>
                    <div>
                      <Text type="tertiary">最大日亏</Text>
                      <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--semi-color-danger)' }}>
                        {formatCurrency(dailyData.summary.max_daily_loss)}
                      </div>
                    </div>
                  </Col>
                </Row>
              </Card>
            )}
          </Spin>
        </TabPane>

        <TabPane tab="绩效归因" itemKey="attribution">
          <Spin spinning={attributionLoading}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card title="品种归因 (Top 10)">
                  <Table
                    dataSource={attribution?.symbol_attribution || []}
                    columns={attributionColumns}
                    pagination={false}
                    size="small"
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card title="多空归因">
                  {attribution?.direction_attribution && (
                    <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
                      <Card style={{ flex: 1, textAlign: 'center' }}>
                        <Text type="tertiary">多头盈亏</Text>
                        <div style={{
                          fontSize: 24,
                          fontWeight: 600,
                          color: attribution.direction_attribution.long_pnl >= 0
                            ? 'var(--semi-color-success)'
                            : 'var(--semi-color-danger)'
                        }}>
                          {attribution.direction_attribution.long_pnl >= 0 ? '+' : ''}
                          {formatCurrency(attribution.direction_attribution.long_pnl)}
                        </div>
                      </Card>
                      <Card style={{ flex: 1, textAlign: 'center' }}>
                        <Text type="tertiary">空头盈亏</Text>
                        <div style={{
                          fontSize: 24,
                          fontWeight: 600,
                          color: attribution.direction_attribution.short_pnl >= 0
                            ? 'var(--semi-color-success)'
                            : 'var(--semi-color-danger)'
                        }}>
                          {attribution.direction_attribution.short_pnl >= 0 ? '+' : ''}
                          {formatCurrency(attribution.direction_attribution.short_pnl)}
                        </div>
                      </Card>
                    </div>
                  )}
                </Card>

                <Card title="时间归因 (按小时)" style={{ marginTop: 16 }}>
                  <ReactECharts option={hourlyAttributionOption} style={{ height: 300 }} />
                </Card>
              </Col>
            </Row>
          </Spin>
        </TabPane>

        <TabPane tab="基准对比" itemKey="benchmark">
          <Spin spinning={benchmarkLoading}>
            <Card
              header={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>基准对比分析</span>
                  <Select value={benchmark} onChange={(v) => setBenchmark(v as string)} style={{ width: 150 }}>
                    <Select.Option value="sh000300">沪深300</Select.Option>
                    <Select.Option value="sh000001">上证指数</Select.Option>
                    <Select.Option value="sz399001">深证成指</Select.Option>
                    <Select.Option value="sz399006">创业板指</Select.Option>
                  </Select>
                </div>
              }
            >
              <ReactECharts option={benchmarkChartOption} style={{ height: 400 }} />
            </Card>

            {benchmarkData?.comparison?.length > 0 && (
              <Card style={{ marginTop: 16 }}>
                <Table
                  dataSource={benchmarkData.comparison}
                  pagination={false}
                  columns={[
                    { title: '周期', dataIndex: 'period' },
                    {
                      title: '策略收益',
                      dataIndex: 'strategy_return',
                      render: (v: number) => (
                        <Tag color={v >= 0 ? 'green' : 'red'}>{v}%</Tag>
                      ),
                    },
                    {
                      title: '基准收益',
                      dataIndex: 'benchmark_return',
                      render: (v: number) => (
                        <Tag color={v >= 0 ? 'green' : 'red'}>{v}%</Tag>
                      ),
                    },
                    {
                      title: 'Alpha',
                      dataIndex: 'alpha',
                      render: (v: number) => (
                        <Text style={{ color: v >= 0 ? 'var(--semi-color-success)' : 'var(--semi-color-danger)' }}>
                          {v >= 0 ? '+' : ''}{v}%
                        </Text>
                      ),
                    },
                    { title: 'Beta', dataIndex: 'beta' },
                    { title: '信息比率', dataIndex: 'information_ratio' },
                  ]}
                />
              </Card>
            )}
          </Spin>
        </TabPane>
      </Tabs>
    </div>
  );
}
