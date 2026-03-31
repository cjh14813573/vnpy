import { useEffect, useState, useCallback } from 'react';
import {
  Typography, Card, Button, Table, Tag, Space, Tabs, Toast,
  Modal, Descriptions, Badge, Select, Popconfirm
} from '@douyinfe/semi-ui';
import { IconRefresh, IconStop, IconInfoCircle } from '@douyinfe/semi-icons';
import { tradingApi } from '../api';

interface ConditionalOrder {
  id: string;
  vt_symbol: string;
  direction: string;
  volume: number;
  trigger_type: string;
  trigger_price?: number;
  status: 'pending' | 'triggered' | 'cancelled' | 'error';
  created_at: string;
  triggered_at?: string;
  vt_orderid?: string;
}

interface StopLossTakeProfitOrder {
  id: string;
  vt_symbol: string;
  direction: string;
  volume: number;
  stop_loss_price?: number;
  take_profit_price?: number;
  status: 'pending' | 'triggered' | 'cancelled' | 'error';
  created_at: string;
  triggered_at?: string;
  triggered_type?: 'stop_loss' | 'take_profit';
  vt_orderid?: string;
}

export default function StopOrderMonitorPage() {
  const [activeTab, setActiveTab] = useState('conditional');

  // 条件单状态
  const [conditionalOrders, setConditionalOrders] = useState<ConditionalOrder[]>([]);
  const [conditionalLoading, setConditionalLoading] = useState(false);
  const [conditionalFilter, setConditionalFilter] = useState('all');

  // 止盈止损单状态
  const [sltpOrders, setSltpOrders] = useState<StopLossTakeProfitOrder[]>([]);
  const [sltpLoading, setSltpLoading] = useState(false);
  const [sltpFilter, setSltpFilter] = useState('all');

  // 详情弹窗
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ConditionalOrder | StopLossTakeProfitOrder | null>(null);
  const [detailType, setDetailType] = useState<'conditional' | 'sltp'>('conditional');

  // 加载条件单
  const loadConditionalOrders = useCallback(async () => {
    setConditionalLoading(true);
    try {
      const res = await tradingApi.conditionalOrders(
        conditionalFilter === 'all' ? undefined : conditionalFilter
      );
      setConditionalOrders(res.data || []);
    } catch (err: any) {
      Toast.error('加载条件单失败: ' + (err.response?.data?.detail || err.message));
    } finally {
      setConditionalLoading(false);
    }
  }, [conditionalFilter]);

  // 加载止盈止损单
  const loadSltpOrders = useCallback(async () => {
    setSltpLoading(true);
    try {
      const res = await tradingApi.stopLossTakeProfitOrders({
        status: sltpFilter === 'all' ? undefined : sltpFilter
      });
      setSltpOrders(res.data || []);
    } catch (err: any) {
      Toast.error('加载止盈止损单失败: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSltpLoading(false);
    }
  }, [sltpFilter]);

  // 初始加载和定时刷新
  useEffect(() => {
    loadConditionalOrders();
    loadSltpOrders();

    const timer = setInterval(() => {
      loadConditionalOrders();
      loadSltpOrders();
    }, 5000);

    return () => clearInterval(timer);
  }, [loadConditionalOrders, loadSltpOrders]);

  // 取消条件单
  const cancelConditional = async (orderId: string) => {
    try {
      await tradingApi.cancelConditional(orderId);
      Toast.success('条件单已取消');
      loadConditionalOrders();
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '取消失败');
    }
  };

  // 取消止盈止损单
  const cancelSltp = async (orderId: string) => {
    try {
      await tradingApi.cancelStopLossTakeProfit(orderId);
      Toast.success('止盈止损单已取消');
      loadSltpOrders();
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '取消失败');
    }
  };

  // 查看详情
  const viewDetail = (order: ConditionalOrder | StopLossTakeProfitOrder, type: 'conditional' | 'sltp') => {
    setSelectedOrder(order);
    setDetailType(type);
    setDetailVisible(true);
  };

  // 状态标签渲染
  const renderStatus = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      pending: { color: 'blue', text: '监控中' },
      triggered: { color: 'green', text: '已触发' },
      cancelled: { color: 'grey', text: '已取消' },
      error: { color: 'red', text: '错误' },
    };
    const s = statusMap[status] || { color: 'default', text: status };
    return <Tag color={s.color as any} size="small">{s.text}</Tag>;
  };

  // 触发类型渲染
  const renderTriggerType = (type: string) => {
    const typeMap: Record<string, string> = {
      price_above: '价格突破',
      price_below: '价格跌破',
      time: '时间触发',
      stop_loss: '止损',
      take_profit: '止盈',
    };
    return typeMap[type] || type;
  };

  // 条件单表格列
  const conditionalColumns = [
    { title: '单号', dataIndex: 'id', width: 160, render: (v: string) => v.slice(0, 12) + '...' },
    { title: '合约', dataIndex: 'vt_symbol', width: 140 },
    {
      title: '方向',
      dataIndex: 'direction',
      width: 70,
      render: (v: string) => <Tag color={v === '多' ? 'red' : 'green'} size="small">{v}</Tag>
    },
    { title: '数量', dataIndex: 'volume', width: 70, align: 'right' as const },
    {
      title: '触发条件',
      dataIndex: 'trigger_type',
      width: 100,
      render: (v: string, r: ConditionalOrder) => (
        <span>
          {renderTriggerType(v)}
          {r.trigger_price && <span className="text-secondary"> @ {r.trigger_price}</span>}
        </span>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: renderStatus
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      width: 120,
      render: (_: any, r: ConditionalOrder) => (
        <Space>
          <Button size="small" icon={<IconInfoCircle />} onClick={() => viewDetail(r, 'conditional')}>详情</Button>
          {r.status === 'pending' && (
            <Popconfirm
              title="确认取消"
              content={`确定要取消条件单 ${r.id.slice(0, 12)}... 吗？`}
              onConfirm={() => cancelConditional(r.id)}
            >
              <Button size="small" type="danger" icon={<IconStop />}>取消</Button>
            </Popconfirm>
          )}
        </Space>
      )
    },
  ];

  // 止盈止损单表格列
  const sltpColumns = [
    { title: '单号', dataIndex: 'id', width: 160, render: (v: string) => v.slice(0, 12) + '...' },
    { title: '合约', dataIndex: 'vt_symbol', width: 140 },
    {
      title: '方向',
      dataIndex: 'direction',
      width: 70,
      render: (v: string) => <Tag color={v === '多' ? 'red' : 'green'} size="small">{v}</Tag>
    },
    { title: '数量', dataIndex: 'volume', width: 70, align: 'right' as const },
    {
      title: '止损价',
      dataIndex: 'stop_loss_price',
      width: 100,
      align: 'right' as const,
      render: (v?: number) => v ? v.toFixed(2) : '-'
    },
    {
      title: '止盈价',
      dataIndex: 'take_profit_price',
      width: 100,
      align: 'right' as const,
      render: (v?: number) => v ? v.toFixed(2) : '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (v: string, r: StopLossTakeProfitOrder) => (
        <span>
          {renderStatus(v)}
          {r.triggered_type && (
            <Tag color={r.triggered_type === 'take_profit' ? 'green' : 'red'} size="small" style={{ marginLeft: 4 }}>
              {r.triggered_type === 'take_profit' ? '止盈' : '止损'}
            </Tag>
          )}
        </span>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      width: 120,
      render: (_: any, r: StopLossTakeProfitOrder) => (
        <Space>
          <Button size="small" icon={<IconInfoCircle />} onClick={() => viewDetail(r, 'sltp')}>详情</Button>
          {r.status === 'pending' && (
            <Popconfirm
              title="确认取消"
              content={`确定要取消止盈止损单 ${r.id.slice(0, 12)}... 吗？`}
              onConfirm={() => cancelSltp(r.id)}
            >
              <Button size="small" type="danger" icon={<IconStop />}>取消</Button>
            </Popconfirm>
          )}
        </Space>
      )
    },
  ];

  // 统计数量
  const conditionalStats = {
    total: conditionalOrders.length,
    pending: conditionalOrders.filter(o => o.status === 'pending').length,
    triggered: conditionalOrders.filter(o => o.status === 'triggered').length,
  };

  const sltpStats = {
    total: sltpOrders.length,
    pending: sltpOrders.filter(o => o.status === 'pending').length,
    triggered: sltpOrders.filter(o => o.status === 'triggered').length,
  };

  const { Title, Text } = Typography;
  const { TabPane } = Tabs;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title heading={4} style={{ margin: 0 }}>条件单监控</Title>
        <Space>
          <Button icon={<IconRefresh />} onClick={() => {
            loadConditionalOrders();
            loadSltpOrders();
          }} loading={conditionalLoading || sltpLoading}>刷新</Button>
        </Space>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane
          tab={
            <span>
              条件单
              {conditionalStats.pending > 0 && (
                <Badge count={conditionalStats.pending} style={{ marginLeft: 8 }} />
              )}
            </span>
          }
          itemKey="conditional"
        >
          {/* 统计卡片 */}
          <Space style={{ marginBottom: 16 }}>
            <Card bodyStyle={{ padding: '12px 20px' }} style={{ borderRadius: 8 }}>
              <Text type="tertiary" size="small">全部</Text>
              <br />
              <Text strong style={{ fontSize: 20 }}>{conditionalStats.total}</Text>
            </Card>
            <Card bodyStyle={{ padding: '12px 20px' }} style={{ borderRadius: 8, background: 'var(--semi-color-primary-light-default)' }}>
              <Text type="tertiary" size="small">监控中</Text>
              <br />
              <Text strong style={{ fontSize: 20, color: 'var(--semi-color-primary)' }}>{conditionalStats.pending}</Text>
            </Card>
            <Card bodyStyle={{ padding: '12px 20px' }} style={{ borderRadius: 8, background: 'var(--semi-color-success-light-default)' }}>
              <Text type="tertiary" size="small">已触发</Text>
              <br />
              <Text strong style={{ fontSize: 20, color: 'var(--semi-color-success)' }}>{conditionalStats.triggered}</Text>
            </Card>
          </Space>

          {/* 筛选 */}
          <div style={{ marginBottom: 16 }}>
            <Select
              value={conditionalFilter}
              onChange={(v) => setConditionalFilter(v as string)}
              style={{ width: 140 }}
              optionList={[
                { value: 'all', label: '全部状态' },
                { value: 'pending', label: '监控中' },
                { value: 'triggered', label: '已触发' },
                { value: 'cancelled', label: '已取消' },
              ]}
            />
          </div>

          {/* 表格 */}
          <Card style={{ borderRadius: 12 }}>
            <Table
              columns={conditionalColumns}
              dataSource={conditionalOrders}
              pagination={false}
              size="small"
              loading={conditionalLoading}
              empty={<Text type="tertiary">暂无条件单</Text>}
            />
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span>
              止盈止损
              {sltpStats.pending > 0 && (
                <Badge count={sltpStats.pending} style={{ marginLeft: 8 }} />
              )}
            </span>
          }
          itemKey="sltp"
        >
          {/* 统计卡片 */}
          <Space style={{ marginBottom: 16 }}>
            <Card bodyStyle={{ padding: '12px 20px' }} style={{ borderRadius: 8 }}>
              <Text type="tertiary" size="small">全部</Text>
              <br />
              <Text strong style={{ fontSize: 20 }}>{sltpStats.total}</Text>
            </Card>
            <Card bodyStyle={{ padding: '12px 20px' }} style={{ borderRadius: 8, background: 'var(--semi-color-primary-light-default)' }}>
              <Text type="tertiary" size="small">监控中</Text>
              <br />
              <Text strong style={{ fontSize: 20, color: 'var(--semi-color-primary)' }}>{sltpStats.pending}</Text>
            </Card>
            <Card bodyStyle={{ padding: '12px 20px' }} style={{ borderRadius: 8, background: 'var(--semi-color-success-light-default)' }}>
              <Text type="tertiary" size="small">已触发</Text>
              <br />
              <Text strong style={{ fontSize: 20, color: 'var(--semi-color-success)' }}>{sltpStats.triggered}</Text>
            </Card>
          </Space>

          {/* 筛选 */}
          <div style={{ marginBottom: 16 }}>
            <Select
              value={sltpFilter}
              onChange={(v) => setSltpFilter(v as string)}
              style={{ width: 140 }}
              optionList={[
                { value: 'all', label: '全部状态' },
                { value: 'pending', label: '监控中' },
                { value: 'triggered', label: '已触发' },
                { value: 'cancelled', label: '已取消' },
              ]}
            />
          </div>

          {/* 表格 */}
          <Card style={{ borderRadius: 12 }}>
            <Table
              columns={sltpColumns}
              dataSource={sltpOrders}
              pagination={false}
              size="small"
              loading={sltpLoading}
              empty={<Text type="tertiary">暂无止盈止损单</Text>}
            />
          </Card>
        </TabPane>
      </Tabs>

      {/* 详情弹窗 */}
      <Modal
        title={detailType === 'conditional' ? '条件单详情' : '止盈止损单详情'}
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={600}
      >
        {selectedOrder && (
          <Descriptions>
            <Descriptions.Item itemKey="单号">{selectedOrder.id}</Descriptions.Item>
            <Descriptions.Item itemKey="合约">{selectedOrder.vt_symbol}</Descriptions.Item>
            <Descriptions.Item itemKey="方向">{selectedOrder.direction}</Descriptions.Item>
            <Descriptions.Item itemKey="数量">{selectedOrder.volume}</Descriptions.Item>
            <Descriptions.Item itemKey="状态">{renderStatus(selectedOrder.status)}</Descriptions.Item>
            {'trigger_type' in selectedOrder && (
              <Descriptions.Item itemKey="触发条件">
                {renderTriggerType(selectedOrder.trigger_type)}
                {selectedOrder.trigger_price && ` @ ${selectedOrder.trigger_price}`}
              </Descriptions.Item>
            )}
            {'stop_loss_price' in selectedOrder && selectedOrder.stop_loss_price && (
              <Descriptions.Item itemKey="止损价格">{selectedOrder.stop_loss_price.toFixed(2)}</Descriptions.Item>
            )}
            {'take_profit_price' in selectedOrder && selectedOrder.take_profit_price && (
              <Descriptions.Item itemKey="止盈价格">{selectedOrder.take_profit_price.toFixed(2)}</Descriptions.Item>
            )}
            {'triggered_type' in selectedOrder && selectedOrder.triggered_type && (
              <Descriptions.Item itemKey="触发类型">
                <Tag color={selectedOrder.triggered_type === 'take_profit' ? 'green' : 'red'}>
                  {selectedOrder.triggered_type === 'take_profit' ? '止盈触发' : '止损触发'}
                </Tag>
              </Descriptions.Item>
            )}
            <Descriptions.Item itemKey="创建时间">
              {new Date(selectedOrder.created_at).toLocaleString('zh-CN')}
            </Descriptions.Item>
            {selectedOrder.triggered_at && (
              <Descriptions.Item itemKey="触发时间">
                {new Date(selectedOrder.triggered_at).toLocaleString('zh-CN')}
              </Descriptions.Item>
            )}
            {selectedOrder.vt_orderid && (
              <Descriptions.Item itemKey="委托号">{selectedOrder.vt_orderid}</Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
