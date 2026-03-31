import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Card, Row, Col, Typography } from '@douyinfe/semi-ui';

const { Title, Text } = Typography;

interface EvaluationData {
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    auc?: number;
    cv_mean?: number;
    cv_std?: number;
  };
  evaluation: {
    roc_curve?: {
      fpr: number[];
      tpr: number[];
      thresholds: number[];
    };
    confusion_matrix?: {
      matrix: number[][];
      labels: string[];
    };
    prediction_distribution?: {
      bins: number[];
      counts: number[];
    };
    learning_curve?: {
      train_sizes: number[];
      train_scores: number[];
      val_scores: number[];
    };
    classification_report?: Record<string, any>;
  };
  feature_importance: Record<string, number>;
}

interface Props {
  data: EvaluationData;
}

export default function ModelEvaluationCharts({ data }: Props) {
  const { metrics, evaluation, feature_importance } = data;

  // ROC 曲线配置
  const rocOption = useMemo(() => {
    if (!evaluation.roc_curve) return null;

    return {
      title: {
        text: `ROC 曲线 (AUC = ${metrics.auc?.toFixed(4) || 'N/A'})`,
        left: 'center',
        textStyle: { fontSize: 14 },
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const p = params[0];
          return `FPR: ${p.data[0].toFixed(3)}<br>TPR: ${p.data[1].toFixed(3)}`;
        },
      },
      grid: { left: '10%', right: '10%', bottom: '15%', top: '20%' },
      xAxis: {
        type: 'value',
        name: 'False Positive Rate',
        min: 0,
        max: 1,
        nameLocation: 'middle',
        nameGap: 25,
      },
      yAxis: {
        type: 'value',
        name: 'True Positive Rate',
        min: 0,
        max: 1,
        nameLocation: 'middle',
        nameGap: 35,
      },
      series: [
        {
          name: 'ROC',
          type: 'line',
          data: evaluation.roc_curve.fpr.map((fpr, i) => [fpr, evaluation.roc_curve!.tpr[i]]),
          smooth: true,
          lineStyle: { color: '#5470c6', width: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(84, 112, 198, 0.3)' },
                { offset: 1, color: 'rgba(84, 112, 198, 0.05)' },
              ],
            },
          },
        },
        {
          name: 'Random',
          type: 'line',
          data: [[0, 0], [1, 1]],
          lineStyle: { color: '#999', type: 'dashed', width: 1 },
          symbol: 'none',
        },
      ],
    };
  }, [evaluation.roc_curve, metrics.auc]);

  // 混淆矩阵配置
  const confusionOption = useMemo(() => {
    if (!evaluation.confusion_matrix) return null;

    const { matrix, labels } = evaluation.confusion_matrix;
    const maxVal = Math.max(...matrix.flat());

    return {
      title: {
        text: '混淆矩阵',
        left: 'center',
        textStyle: { fontSize: 14 },
      },
      tooltip: {
        position: 'top',
        formatter: (params: any) => {
          return `${labels[params.data[1]]} / ${labels[params.data[0]]}: ${params.data[2]}`;
        },
      },
      grid: { left: '15%', right: '10%', bottom: '15%', top: '20%' },
      xAxis: {
        type: 'category',
        data: labels,
        name: '预测',
        nameLocation: 'middle',
        nameGap: 30,
        splitArea: { show: true },
      },
      yAxis: {
        type: 'category',
        data: labels.slice().reverse(),
        name: '真实',
        nameLocation: 'middle',
        nameGap: 40,
        splitArea: { show: true },
      },
      visualMap: {
        min: 0,
        max: maxVal,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '0%',
        inRange: {
          color: ['#f0f9ff', '#0066ff'],
        },
      },
      series: [{
        name: 'Confusion Matrix',
        type: 'heatmap',
        data: matrix.flatMap((row, i) =>
          row.map((val, j) => [j, labels.length - 1 - i, val])
        ),
        label: {
          show: true,
          formatter: (params: any) => params.data[2],
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
      }],
    };
  }, [evaluation.confusion_matrix]);

  // 特征重要性配置
  const importanceOption = useMemo(() => {
    if (!feature_importance || Object.keys(feature_importance).length === 0) return null;

    const sorted = Object.entries(feature_importance)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15);

    return {
      title: {
        text: '特征重要性 (Top 15)',
        left: 'center',
        textStyle: { fontSize: 14 },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: '{b}: {c}',
      },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
      xAxis: {
        type: 'value',
        axisLabel: { formatter: '{value}' },
      },
      yAxis: {
        type: 'category',
        data: sorted.map(([name]) => name).reverse(),
        axisLabel: { fontSize: 10 },
      },
      series: [{
        type: 'bar',
        data: sorted.map(([, val]) => val).reverse(),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#91cc75' },
              { offset: 1, color: '#5470c6' },
            ],
          },
        },
      }],
    };
  }, [feature_importance]);

  // 学习曲线配置
  const learningCurveOption = useMemo(() => {
    if (!evaluation.learning_curve) return null;

    const { train_sizes, train_scores, val_scores } = evaluation.learning_curve;

    return {
      title: {
        text: '学习曲线',
        left: 'center',
        textStyle: { fontSize: 14 },
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          return `样本数: ${params[0].axisValue}<br>` +
            `训练集: ${(params[0].data * 100).toFixed(1)}%<br>` +
            `验证集: ${(params[1].data * 100).toFixed(1)}%`;
        },
      },
      legend: {
        data: ['训练集', '验证集'],
        bottom: 0,
      },
      grid: { left: '10%', right: '10%', bottom: '15%', top: '20%' },
      xAxis: {
        type: 'category',
        data: train_sizes,
        name: '训练样本数',
        nameLocation: 'middle',
        nameGap: 30,
      },
      yAxis: {
        type: 'value',
        name: '准确率',
        min: 0,
        max: 1,
        axisLabel: { formatter: '{value}' },
      },
      series: [
        {
          name: '训练集',
          type: 'line',
          data: train_scores,
          smooth: true,
          lineStyle: { color: '#5470c6' },
          itemStyle: { color: '#5470c6' },
        },
        {
          name: '验证集',
          type: 'line',
          data: val_scores,
          smooth: true,
          lineStyle: { color: '#91cc75' },
          itemStyle: { color: '#91cc75' },
        },
      ],
    };
  }, [evaluation.learning_curve]);

  // 预测分布配置
  const predictionDistOption = useMemo(() => {
    if (!evaluation.prediction_distribution) return null;

    const { bins, counts } = evaluation.prediction_distribution;
    const binLabels = bins.slice(0, -1).map((b, i) =>
      `${b.toFixed(2)}-${bins[i + 1].toFixed(2)}`
    );

    return {
      title: {
        text: '预测概率分布',
        left: 'center',
        textStyle: { fontSize: 14 },
      },
      tooltip: {
        trigger: 'axis',
        formatter: '{b}: {c} 个',
      },
      grid: { left: '10%', right: '10%', bottom: '15%', top: '20%' },
      xAxis: {
        type: 'category',
        data: binLabels,
        name: '概率区间',
        nameLocation: 'middle',
        nameGap: 30,
        axisLabel: { rotate: 45, fontSize: 9 },
      },
      yAxis: {
        type: 'value',
        name: '样本数',
      },
      series: [{
        type: 'bar',
        data: counts,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#fac858' },
              { offset: 1, color: '#f4e4ba' },
            ],
          },
        },
      }],
    };
  }, [evaluation.prediction_distribution]);

  const metricCards = [
    { label: '准确率', value: metrics.accuracy, color: '#5470c6' },
    { label: '精确率', value: metrics.precision, color: '#91cc75' },
    { label: '召回率', value: metrics.recall, color: '#fac858' },
    { label: 'F1 分数', value: metrics.f1, color: '#ee6666' },
    { label: 'AUC', value: metrics.auc, color: '#73c0de' },
    { label: 'CV 均值', value: metrics.cv_mean, color: '#3ba272' },
  ];

  return (
    <div>
      {/* 指标卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {metricCards.filter(m => m.value !== undefined).map((metric) => (
          <Col span={4} key={metric.label}>
            <Card style={{ textAlign: 'center', borderRadius: 8 }}>
              <Text type="tertiary" style={{ fontSize: 12 }}>{metric.label}</Text>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: metric.color }}>
                {(metric.value * 100).toFixed(1)}%
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 图表区域 */}
      <Row gutter={[16, 16]}>
        {rocOption && (
          <Col span={12}>
            <Card style={{ borderRadius: 12 }}>
              <ReactECharts option={rocOption} style={{ height: 300 }} />
            </Card>
          </Col>
        )}
        {confusionOption && (
          <Col span={12}>
            <Card style={{ borderRadius: 12 }}>
              <ReactECharts option={confusionOption} style={{ height: 300 }} />
            </Card>
          </Col>
        )}
        {importanceOption && (
          <Col span={12}>
            <Card style={{ borderRadius: 12 }}>
              <ReactECharts option={importanceOption} style={{ height: 350 }} />
            </Card>
          </Col>
        )}
        {learningCurveOption && (
          <Col span={12}>
            <Card style={{ borderRadius: 12 }}>
              <ReactECharts option={learningCurveOption} style={{ height: 300 }} />
            </Card>
          </Col>
        )}
        {predictionDistOption && (
          <Col span={12}>
            <Card style={{ borderRadius: 12 }}>
              <ReactECharts option={predictionDistOption} style={{ height: 300 }} />
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
}
