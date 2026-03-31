import { useEffect, useState } from 'react';
import { Typography, Button, Table, Card, Toast, Modal, Input, Select, Row, Col, Space, Popconfirm, Tag, Progress, Spin, Tabs, Upload } from '@douyinfe/semi-ui';
import { IconDownload, IconDelete, IconRefresh, IconUpload, IconExport } from '@douyinfe/semi-icons';
import { dataApi, marketApi } from '../api';
import type { Contract } from '../api/types';

const { TabPane } = Tabs;

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
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [, setContractsLoading] = useState(false);
  const [dlForm, setDlForm] = useState({
    vt_symbol: '',
    start: '2024-01-01',
    end: '2024-12-31',
    interval: '1m',
    exchange: 'SHFE'
  });
  const [importForm, setImportForm] = useState({
    vt_symbol: '',
    interval: '1m',
  });
  const [exportForm, setExportForm] = useState({
    vt_symbol: '',
    interval: '1m',
    start: '',
    end: '',
  });
  const [previewData, setPreviewData] = useState<any>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);
  const [importing, setImporting] = useState(false);
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

  // 导入数据
  const handleImport = async () => {
    if (!importFile || !importForm.vt_symbol) {
      Toast.error('请选择文件和合约');
      return;
    }

    setImporting(true);
    try {
      const res = await dataApi.importCsv(importFile, importForm.vt_symbol, importForm.interval);
      setImportResult(res.data);
      Toast.success(`导入完成: ${res.data.imported} 条成功`);
      load();
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  // 导出数据
  const handleExport = async () => {
    if (!exportForm.vt_symbol) {
      Toast.error('请选择合约');
      return;
    }

    try {
      const res = await dataApi.exportCsv(
        exportForm.vt_symbol,
        exportForm.interval,
        exportForm.start || undefined,
        exportForm.end || undefined
      );

      // 下载文件
      const blob = new Blob([res.data], { type: 'text/csv' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${exportForm.vt_symbol.replace('.', '_')}_${exportForm.interval}_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();

      Toast.success('导出成功');
      setExportOpen(false);
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '导出失败');
    }
  };

  // 预览数据
  const handlePreview = async () => {
    if (!importForm.vt_symbol) {
      Toast.error('请选择合约');
      return;
    }

    try {
      const res = await dataApi.preview(importForm.vt_symbol, importForm.interval, 10);
      setPreviewData(res.data);
      setPreviewOpen(true);
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '预览失败');
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
          <Button theme="solid" icon={<IconUpload />} onClick={() => setImportOpen(true)}>导入 CSV</Button>
          <Button theme="solid" icon={<IconExport />} onClick={() => setExportOpen(true)}>导出 CSV</Button>
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
        onCancel={() => { if (!downloading) setDownloadOpen(false); }}
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

      {/* 导入 CSV 对话框 */}
      <Modal
        title="导入 CSV 数据"
        visible={importOpen}
        onCancel={() => { if (!importing) setImportOpen(false); }}
        footer={null}
        style={{ borderRadius: 12 }}
      >
        <Spin spinning={importing} tip="导入中...">
          <div>
            <label style={{ marginBottom: 8, display: 'block' }}>选择合约</label>
            <Select
              value={importForm.vt_symbol}
              onChange={(v) => setImportForm({ ...importForm, vt_symbol: v as string })}
              style={{ width: '100%', marginBottom: 12 }}
              placeholder="请选择合约"
              optionList={contracts.map((c) => ({ value: c.vt_symbol, label: `${c.vt_symbol} - ${c.name}` }))}
              filter
              searchPlaceholder="搜索合约"
            />

            <label style={{ marginBottom: 8, display: 'block' }}>数据周期</label>
            <Select
              value={importForm.interval}
              onChange={(v) => setImportForm({ ...importForm, interval: v as string })}
              style={{ width: '100%', marginBottom: 12 }}
              optionList={[
                { value: '1m', label: '1分钟' },
                { value: '5m', label: '5分钟' },
                { value: '15m', label: '15分钟' },
                { value: '1h', label: '1小时' },
                { value: 'd', label: '日线' },
              ]}
            />

            <label style={{ marginBottom: 8, display: 'block' }}>选择 CSV 文件</label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              style={{ marginBottom: 12, display: 'block' }}
            />

            {importFile && (
              <div style={{ marginBottom: 12, padding: 8, background: 'var(--semi-color-fill-0)', borderRadius: 4 }}>
                <Typography.Text size="small">已选择: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)</Typography.Text>
              </div>
            )}

            <div style={{ marginBottom: 16, padding: 12, background: 'var(--semi-color-fill-0)', borderRadius: 8 }}>
              <Typography.Text strong size="small">CSV 格式要求:</Typography.Text>
              <ul style={{ margin: '8px 0', paddingLeft: 20, fontSize: 12 }}>
                <li>必需列: datetime, open, high, low, close, volume</li>
                <li>可选列: open_interest</li>
                <li>datetime 格式: YYYY-MM-DD HH:MM:SS</li>
              </ul>
            </div>

            <Space style={{ width: '100%' }}>
              <Button style={{ flex: 1 }} onClick={handlePreview} disabled={!importForm.vt_symbol}>预览数据</Button>
              <Button theme="solid" style={{ flex: 2 }} onClick={handleImport} disabled={importing || !importFile || !importForm.vt_symbol}>
                {importing ? '导入中...' : '开始导入'}
              </Button>
            </Space>

            {importResult && (
              <div style={{ marginTop: 16, padding: 12, background: importResult.errors > 0 ? '#fff7e6' : '#f6ffed', borderRadius: 8 }}>
                <Typography.Text strong>导入结果:</Typography.Text>
                <div style={{ marginTop: 8 }}>
                  <Typography.Text size="small" type="success">成功: {importResult.imported} 条</Typography.Text>
                  {importResult.errors > 0 && (
                    <div>
                      <Typography.Text size="small" type="danger">失败: {importResult.errors} 条</Typography.Text>
                      {importResult.error_details?.length > 0 && (
                        <ul style={{ margin: '4px 0', paddingLeft: 16, fontSize: 11 }}>
                          {importResult.error_details.slice(0, 3).map((err: any, idx: number) => (
                            <li key={idx}>第 {err.row} 行: {err.error}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Spin>
      </Modal>

      {/* 导出 CSV 对话框 */}
      <Modal
        title="导出 CSV 数据"
        visible={exportOpen}
        onCancel={() => setExportOpen(false)}
        footer={null}
        style={{ borderRadius: 12 }}
      >
        <div>
          <label style={{ marginBottom: 8, display: 'block' }}>选择合约</label>
          <Select
            value={exportForm.vt_symbol}
            onChange={(v) => setExportForm({ ...exportForm, vt_symbol: v as string })}
            style={{ width: '100%', marginBottom: 12 }}
            placeholder="请选择合约"
            optionList={contracts.map((c) => ({ value: c.vt_symbol, label: `${c.vt_symbol} - ${c.name}` }))}
            filter
            searchPlaceholder="搜索合约"
          />

          <label style={{ marginBottom: 8, display: 'block' }}>数据周期</label>
          <Select
            value={exportForm.interval}
            onChange={(v) => setExportForm({ ...exportForm, interval: v as string })}
            style={{ width: '100%', marginBottom: 12 }}
            optionList={[
              { value: '1m', label: '1分钟' },
              { value: '5m', label: '5分钟' },
              { value: '15m', label: '15分钟' },
              { value: '1h', label: '1小时' },
              { value: 'd', label: '日线' },
            ]}
          />

          <Row gutter={8}>
            <Col span={12}>
              <label style={{ marginBottom: 8, display: 'block' }}>开始日期 (可选)</label>
              <Input type="date" value={exportForm.start} onChange={(v) => setExportForm({ ...exportForm, start: v })} style={{ marginBottom: 12 }} />
            </Col>
            <Col span={12}>
              <label style={{ marginBottom: 8, display: 'block' }}>结束日期 (可选)</label>
              <Input type="date" value={exportForm.end} onChange={(v) => setExportForm({ ...exportForm, end: v })} style={{ marginBottom: 12 }} />
            </Col>
          </Row>

          <Button theme="solid" block onClick={handleExport} disabled={!exportForm.vt_symbol} style={{ borderRadius: 10 }}>
            导出 CSV
          </Button>
        </div>
      </Modal>

      {/* 数据预览对话框 */}
      <Modal
        title="数据预览"
        visible={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={null}
        style={{ borderRadius: 12, width: 800 }}
      >
        {previewData ? (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Typography.Text type="tertiary">合约: </Typography.Text>
              <Typography.Text strong>{previewData.vt_symbol}</Typography.Text>
              <Typography.Text type="tertiary" style={{ marginLeft: 16 }}>周期: </Typography.Text>
              <Typography.Text strong>{previewData.interval}</Typography.Text>
              <Typography.Text type="tertiary" style={{ marginLeft: 16 }}>总条数: </Typography.Text>
              <Typography.Text strong>{previewData.total}</Typography.Text>
            </div>
            <Table
              columns={[
                { title: '时间', dataIndex: 'datetime', width: 160 },
                { title: '开盘', dataIndex: 'open', align: 'right' as const, render: (v: number) => v?.toFixed(2) },
                { title: '最高', dataIndex: 'high', align: 'right' as const, render: (v: number) => v?.toFixed(2) },
                { title: '最低', dataIndex: 'low', align: 'right' as const, render: (v: number) => v?.toFixed(2) },
                { title: '收盘', dataIndex: 'close', align: 'right' as const, render: (v: number) => v?.toFixed(2) },
                { title: '成交量', dataIndex: 'volume', align: 'right' as const },
              ]}
              dataSource={previewData.preview}
              pagination={false}
              size="small"
              scroll={{ y: 300 }}
            />
          </div>
        ) : (
          <Typography.Text type="tertiary">加载中...</Typography.Text>
        )}
      </Modal>
    </div>
  );
}
