import { useEffect, useState } from 'react';
import { Typography, Button, Table, Card, Toast, Modal, Input, Select, Row, Col, Space, Popconfirm, Tag, Progress, Spin } from '@douyinfe/semi-ui';
import { IconDownload, IconDelete, IconRefresh } from '@douyinfe/semi-icons';
import { dataApi, marketApi } from '../api';
import type { Contract } from '../api/types';

interface DataOverview {
  symbol: string;
  exchange: string;
  interval: string;
  count: number;
  start: string;
  end: string;
  size_mb?: number;
}

export default function DataPage() {
  const [overview, setOverview] = useState<DataOverview[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [dlForm, setDlForm] = useState({
    vt_symbol: '',
    start: '2024-01-01',
    end: '2024-12-31',
    interval: '1m',
    exchange: 'SHFE'
  });
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const res = await dataApi.overview();
      setOverview(res.data || []);
    } catch (err: any) {
      if (err.response?.status !== 501) {
        Toast.error('加载数据失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadContracts = async () => {
    setContractsLoading(true);
    try {
      const res = await marketApi.contracts();
      setContracts(res.data.data || res.data || []);
    } catch {
      // ignore
    } finally {
      setContractsLoading(false);
    }
  };

  useEffect(() => { load(); loadContracts(); }, []);

  const handleDownload = async () => {
    if (!dlForm.vt_symbol) {
      Toast.error('请选择合约');
      return;
    }

    setDownloading(true);
    setDownloadProgress(0);

    try {
      await dataApi.download({
        vt_symbol: dlForm.vt_symbol,
        start: dlForm.start,
        end: dlForm.end,
        interval: dlForm.interval,
        exchange: dlForm.exchange,
      });

      Toast.success('下载任务已启动');
      setDownloadOpen(false);
      load();
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '下载失败');
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async (vt_symbol: string, interval: string) => {
    try {
      await dataApi.delete({ vt_symbol, interval });
      Toast.success('数据已删除');
      load();
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '删除失败');
    }
  };

  const handleDeleteAll = async () => {
    try {
      await dataApi.delete({ vt_symbol: '*', interval: '*' });
      Toast.success('所有数据已清空');
      load();
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '清空失败');
    }
  };

  const columns = [
    { title: '合约', dataIndex: 'symbol', width: 120 },
    { title: '交易所', dataIndex: 'exchange', width: 100, render: (v: string) => <Tag size="small">{v}</Tag> },
    { title: '周期', dataIndex: 'interval', width: 80, render: (v: string) => <Tag color="blue" size="small">{v}</Tag> },
    { title: '数据量', dataIndex: 'count', align: 'right' as const, width: 100, render: (v: number) => v?.toLocaleString() },
    { title: '大小(MB)', dataIndex: 'size_mb', align: 'right' as const, width: 100, render: (v: number) => v?.toFixed(2) || '-' },
    { title: '开始日期', dataIndex: 'start', align: 'right' as const, width: 120 },
    { title: '结束日期', dataIndex: 'end', align: 'right' as const, width: 120 },
    { title: '操作', width: 100, fixed: 'right' as const, render: (_: any, r: DataOverview) => (
      <Popconfirm
        title="确认删除"
        content={`删除 ${r.symbol}.${r.exchange} ${r.interval} 数据？`}
        onConfirm={() => handleDelete(`${r.symbol}.${r.exchange}`, r.interval)}
      >
        <Button size="small" theme="solid" type="danger" icon={<IconDelete />} />
      </Popconfirm>
    )},
  ];

  const totalCount = overview.reduce((sum, item) => sum + (item.count || 0), 0);
  const totalSize = overview.reduce((sum, item) => sum + (item.size_mb || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Typography.Title heading={4} style={{ margin: 0 }}>数据管理</Typography.Title>
        <Space>
          <Button icon={<IconRefresh />} onClick={load} loading={loading}>刷新</Button>
          <Popconfirm
            title="清空所有数据"
            content="确定要删除所有历史数据吗？此操作不可恢复。"
            onConfirm={handleDeleteAll}
          >
            <Button type="danger" theme="borderless">清空全部</Button>
          </Popconfirm>
          <Button theme="solid" icon={<IconDownload />} onClick={() => setDownloadOpen(true)}>下载数据</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 12 }}>
            <Typography.Text type="tertiary">数据条数</Typography.Text>
            <br />
            <Typography.Text strong style={{ fontSize: 24 }}>{totalCount.toLocaleString()}</Typography.Text>
          </Card>
        </Col>
        <Col span={8}>
          <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 12 }}>
            <Typography.Text type="tertiary">存储大小</Typography.Text>
            <br />
            <Typography.Text strong style={{ fontSize: 24 }}>{totalSize.toFixed(2)} MB</Typography.Text>
          </Card>
        </Col>
        <Col span={8}>
          <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 12 }}>
            <Typography.Text type="tertiary">合约数量</Typography.Text>
            <br />
            <Typography.Text strong style={{ fontSize: 24 }}>{overview.length}</Typography.Text>
          </Card>
        </Col>
      </Row>

      <Card style={{ borderRadius: 12 }}>
        <Table
          columns={columns}
          dataSource={overview}
          pagination={{ pageSize: 20 }}
          size="small"
          loading={loading}
          empty="暂无数据"
          scroll={{ x: 800 }}
        />
      </Card>

      <Modal
        title="下载历史数据"
        visible={downloadOpen}
        onCancel={() => !downloading && setDownloadOpen(false)}
        footer={null}
        style={{ borderRadius: 12 }}
      >
        <Spin spinning={downloading} tip="下载中...">
          {downloading && (
            <Progress percent={downloadProgress} showInfo style={{ marginBottom: 16 }} />
          )}

          <div>
            <label style={{ marginBottom: 8, display: 'block' }}>选择合约</label>
            <Select
              value={dlForm.vt_symbol}
              onChange={(v) => {
                const contract = contracts.find(c => c.vt_symbol === v);
                if (contract) {
                  setDlForm(prev => ({
                    ...prev,
                    vt_symbol: contract.vt_symbol,
                    exchange: contract.exchange,
                  }));
                }
              }}
              style={{ width: '100%', marginBottom: 12 }}
              placeholder="请选择合约"
              optionList={contracts.map((c) => ({ value: c.vt_symbol, label: `${c.vt_symbol} - ${c.name}` }))}
              filter
              searchPlaceholder="搜索合约"
            />

            <Row gutter={8}>
              <Col span={12}>
                <label style={{ marginBottom: 8, display: 'block' }}>开始日期</label>
                <Input type="date" value={dlForm.start} onChange={(v) => setDlForm({ ...dlForm, start: v })} style={{ marginBottom: 12 }} />
              </Col>
              <Col span={12}>
                <label style={{ marginBottom: 8, display: 'block' }}>结束日期</label>
                <Input type="date" value={dlForm.end} onChange={(v) => setDlForm({ ...dlForm, end: v })} style={{ marginBottom: 12 }} />
              </Col>
            </Row>

            <label style={{ marginBottom: 8, display: 'block' }}>周期</label>
            <Select
              value={dlForm.interval}
              onChange={(v) => setDlForm({ ...dlForm, interval: v as string })}
              style={{ width: '100%', marginBottom: 16 }}
              optionList={[
                { value: 'tick', label: 'Tick' },
                { value: '1m', label: '1分钟' },
                { value: '5m', label: '5分钟' },
                { value: '15m', label: '15分钟' },
                { value: '1h', label: '1小时' },
                { value: 'd', label: '日线' },
              ]}
            />

            <Button theme="solid" block onClick={handleDownload} disabled={downloading || !dlForm.vt_symbol} style={{ borderRadius: 10 }}>
              {downloading ? '下载中...' : '开始下载'}
            </Button>
          </div>
        </Spin>
      </Modal>
    </div>
  );
}
