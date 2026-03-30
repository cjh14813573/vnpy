import { useState, useEffect } from 'react';
import {
  Card, Typography, Table, Tag, Space, DatePicker,
  Select, Button, Input, Popover
} from '@douyinfe/semi-ui';
import { IconSearch, IconRefresh, IconInfoCircle } from '@douyinfe/semi-icons';
import { logsApi } from '../api';
import type { OperationLog } from '../api/types';

const { Title } = Typography;

interface Filters {
  username: string;
  operation: string;
  startDate: string | null;
  endDate: string | null;
}

const operationTypeMap: Record<string, { label: string; color: string }> = {
  login: { label: '登录', color: 'blue' },
  logout: { label: '登出', color: 'grey' },
  order_send: { label: '下单', color: 'green' },
  order_cancel: { label: '撤单', color: 'orange' },
  strategy_add: { label: '添加策略', color: 'purple' },
  strategy_edit: { label: '编辑策略', color: 'purple' },
  strategy_remove: { label: '删除策略', color: 'red' },
  strategy_init: { label: '初始化策略', color: 'cyan' },
  strategy_start: { label: '启动策略', color: 'green' },
  strategy_stop: { label: '停止策略', color: 'orange' },
  gateway_connect: { label: '连接网关', color: 'blue' },
  backtest_create: { label: '创建回测', color: 'indigo' },
  backtest_cancel: { label: '取消回测', color: 'red' },
};

export default function LogsPage() {
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState<Filters>({
    username: '',
    operation: '',
    startDate: null,
    endDate: null,
  });

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page,
        page_size: pagination.pageSize,
      };
      if (filters.username) params.username = filters.username;
      if (filters.operation) params.operation = filters.operation;
      if (filters.startDate) params.start_date = filters.startDate;
      if (filters.endDate) params.end_date = filters.endDate;

      const res = await logsApi.query(params);
      setLogs(res.data.data);
      setPagination(prev => ({
        ...prev,
        page,
        total: res.data.pagination.total,
      }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleDateChange = (date: Date | Date[] | string | string[] | undefined) => {
    if (Array.isArray(date) && date.length === 2) {
      setFilters(prev => ({
        ...prev,
        startDate: date[0] as string,
        endDate: date[1] as string,
      }));
    } else {
      setFilters(prev => ({
        ...prev,
        startDate: null,
        endDate: null,
      }));
    }
  };

  const columns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      width: 180,
      render: (v: number) => new Date(v * 1000).toLocaleString(),
    },
    {
      title: '用户',
      dataIndex: 'username',
      width: 120,
    },
    {
      title: '操作类型',
      dataIndex: 'operation',
      width: 140,
      render: (v: string) => {
        const config = operationTypeMap[v] || { label: v, color: 'default' };
        return <Tag color={config.color as any}>{config.label}</Tag>;
      },
    },
    {
      title: '目标',
      dataIndex: 'target_id',
      width: 180,
      render: (v: string, record: OperationLog) => (
        v ? `${record.target_type}: ${v}` : '-'
      ),
    },
    {
      title: '状态',
      dataIndex: 'success',
      width: 100,
      render: (v: boolean) => (
        <Tag color={v ? 'green' : 'red'}>{v ? '成功' : '失败'}</Tag>
      ),
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      width: 140,
    },
    {
      title: '详情',
      width: 80,
      render: (_: any, record: OperationLog) => (
        record.details ? (
          <Popover
            content={
              <div style={{ maxWidth: 400, maxHeight: 300, overflow: 'auto' }}>
                <pre style={{ margin: 0, fontSize: 12 }}>
                  {JSON.stringify(JSON.parse(record.details), null, 2)}
                </pre>
              </div>
            }
          >
            <Button icon={<IconInfoCircle />} theme="borderless" size="small" />
          </Popover>
        ) : '-'
      ),
    },
  ];

  return (
    <div>
      <Title heading={4} style={{ marginBottom: 24 }}>操作日志</Title>

      <Card style={{ marginBottom: 24 }}>
        <Space spacing={16}>
          <Input
            prefix={<IconSearch />}
            placeholder="用户名"
            value={filters.username}
            onChange={(v: string) => setFilters(prev => ({ ...prev, username: v }))}
            style={{ width: 150 }}
          />
          <Select
            placeholder="操作类型"
            value={filters.operation}
            onChange={(v: string | number | any[] | Record<string, any> | undefined) =>
              setFilters(prev => ({ ...prev, operation: (v as string) || '' }))
            }
            style={{ width: 150 }}
            optionList={[
              { label: '全部', value: '' },
              ...Object.entries(operationTypeMap).map(([key, { label }]) => ({
                label,
                value: key,
              })),
            ]}
          />
          <DatePicker
            type="dateRange"
            placeholder={['开始日期', '结束日期']}
            onChange={handleDateChange}
          />
          <Button type="primary" onClick={() => fetchLogs(1)}>查询</Button>
          <Button icon={<IconRefresh />} onClick={() => {
            setFilters({ username: '', operation: '', startDate: null, endDate: null });
            fetchLogs(1);
          }}>重置</Button>
        </Space>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={logs}
          loading={loading}
          pagination={{
            currentPage: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: fetchLogs,
          }}
          size="small"
        />
      </Card>
    </div>
  );
}
