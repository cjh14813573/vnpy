import { useEffect, useState, useRef } from 'react';
import {
  Typography, Card, Button, Table, Tag, Space, DatePicker, Select, Input, Switch, Toast
} from '@douyinfe/semi-ui';
import { IconSearch, IconRefresh, IconExport } from '@douyinfe/semi-icons';
import { systemApi } from '../api';

const { Title, Text } = Typography;

interface LogEntry {
  msg: string;
  level: string;
  time: string;
  gateway_name: string;
}

interface Filters {
  level: string;
  keyword: string;
  source: string;
  startTime: string | null;
  endTime: string | null;
}

const levelColors: Record<string, string> = {
  DEBUG: 'grey',
  INFO: 'blue',
  WARNING: 'orange',
  ERROR: 'red',
  CRITICAL: 'red',
};

const levelOptions = [
  { label: '全部级别', value: '' },
  { label: 'DEBUG', value: 'DEBUG' },
  { label: 'INFO', value: 'INFO' },
  { label: 'WARNING', value: 'WARNING' },
  { label: 'ERROR', value: 'ERROR' },
];

export default function SystemLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [highlightKeyword, setHighlightKeyword] = useState('');
  const tableBottomRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState<Filters>({
    level: '',
    keyword: '',
    source: '',
    startTime: null,
    endTime: null,
  });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {};
      if (filters.level) params.level = filters.level;
      if (filters.keyword) {
        params.keyword = filters.keyword;
        setHighlightKeyword(filters.keyword);
      }
      if (filters.source) params.source = filters.source;
      if (filters.startTime) params.start_time = filters.startTime;
      if (filters.endTime) params.end_time = filters.endTime;
      params.limit = 500;

      const res = await systemApi.logs(params);
      setLogs(res.data.data || []);
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '获取日志失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh) return;

    const timer = setInterval(() => {
      fetchLogs();
    }, 2000);

    return () => clearInterval(timer);
  }, [autoRefresh, filters]);

  // 自动滚动到底部
  useEffect(() => {
    if (autoRefresh && tableBottomRef.current) {
      tableBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoRefresh]);

  const handleDateChange = (date: Date | Date[] | string | string[] | undefined) => {
    if (Array.isArray(date) && date.length === 2) {
      setFilters(prev => ({
        ...prev,
        startTime: date[0] as string,
        endTime: date[1] as string,
      }));
    } else {
      setFilters(prev => ({
        ...prev,
        startTime: null,
        endTime: null,
      }));
    }
  };

  // 关键词高亮
  const highlightText = (text: string, keyword: string) => {
    if (!keyword || !text) return text;

    const parts = text.split(new RegExp(`(${keyword})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === keyword.toLowerCase() ? (
        <mark key={i} style={{ background: '#ffd591', padding: '0 2px', borderRadius: 2 }}>
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // 导出日志
  const exportLogs = () => {
    const csvContent = [
      ['时间', '级别', '来源', '消息'].join(','),
      ...logs.map(log => [
        log.time || '',
        log.level || '',
        log.gateway_name || '',
        `"${(log.msg || '').replace(/"/g, '""')}"`,
      ].join(',')),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `system_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();

    Toast.success('日志已导出');
  };

  // 清空筛选
  const clearFilters = () => {
    setFilters({
      level: '',
      keyword: '',
      source: '',
      startTime: null,
      endTime: null,
    });
    setHighlightKeyword('');
    fetchLogs();
  };

  const columns = [
    {
      title: '时间',
      dataIndex: 'time',
      width: 180,
      render: (v: string) => v ? new Date(v).toLocaleString() : '-',
    },
    {
      title: '级别',
      dataIndex: 'level',
      width: 100,
      render: (v: string) => {
        const color = levelColors[v?.toUpperCase()] || 'default';
        return <Tag color={color as any}>{v || 'UNKNOWN'}</Tag>;
      },
    },
    {
      title: '来源',
      dataIndex: 'gateway_name',
      width: 120,
      render: (v: string) => v || '系统',
    },
    {
      title: '消息',
      dataIndex: 'msg',
      render: (v: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {highlightKeyword ? highlightText(v || '', highlightKeyword) : v}
        </span>
      ),
    },
  ];

  // 统计各级别日志数量
  const levelStats = logs.reduce((acc, log) => {
    const level = log.level?.toUpperCase() || 'UNKNOWN';
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title heading={4} style={{ margin: 0 }}>系统日志</Title>
        <Space>
          <Switch
            checked={autoRefresh}
            onChange={setAutoRefresh}
            checkedText="自动刷新"
            uncheckedText="自动刷新"
          />
          <Button icon={<IconExport />} onClick={exportLogs} disabled={logs.length === 0}>
            导出
          </Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <Card bodyStyle={{ padding: '12px 16px' }} style={{ minWidth: 120 }}>
          <Text type="tertiary" size="small">总日志数</Text>
          <div style={{ fontSize: 24, fontWeight: 'bold' }}>{logs.length}</div>
        </Card>
        {Object.entries(levelStats)
          .sort(([a], [b]) => (levelColors[b] ? 1 : -1) - (levelColors[a] ? 1 : -1))
          .slice(0, 4)
          .map(([level, count]) => (
            <Card key={level} bodyStyle={{ padding: '12px 16px' }} style={{ minWidth: 100 }}>
              <Text type="tertiary" size="small">{level}</Text>
              <div style={{ fontSize: 20, fontWeight: 'bold', color: `var(--semi-color-${levelColors[level] || 'text-2'})` }}>
                {count}
              </div>
            </Card>
          ))}
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space spacing={16} wrap>
          <Select
            placeholder="日志级别"
            value={filters.level}
            onChange={(v) => setFilters(prev => ({ ...prev, level: (v as string) || '' }))}
            style={{ width: 120 }}
            optionList={levelOptions}
          />
          <Input
            prefix={<IconSearch />}
            placeholder="关键词搜索"
            value={filters.keyword}
            onChange={(v: string) => setFilters(prev => ({ ...prev, keyword: v }))}
            style={{ width: 200 }}
          />
          <Input
            placeholder="来源筛选"
            value={filters.source}
            onChange={(v: string) => setFilters(prev => ({ ...prev, source: v }))}
            style={{ width: 150 }}
          />
          <DatePicker
            type="dateTimeRange"
            placeholder={['开始时间', '结束时间']}
            onChange={handleDateChange}
            style={{ width: 320 }}
          />
          <Button type="primary" icon={<IconSearch />} onClick={fetchLogs}>查询</Button>
          <Button icon={<IconRefresh />} onClick={clearFilters}>重置</Button>
        </Space>
      </Card>

      <Card style={{ borderRadius: 12 }}>
        <Table
          columns={columns}
          dataSource={logs}
          loading={loading}
          pagination={false}
          size="small"
          scroll={{ y: 500 }}
          empty={<Text type="tertiary">暂无日志</Text>}
        />
        <div ref={tableBottomRef} />
      </Card>
    </div>
  );
}
