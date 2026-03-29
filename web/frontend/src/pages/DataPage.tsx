import { useEffect, useState } from 'react';
import { Typography, Button, Table, Card, Toast, Modal, Input, Select } from '@douyinfe/semi-ui';
import { dataApi } from '../api';

export default function DataPage() {
  const [overview, setOverview] = useState<any[]>([]);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [dlForm, setDlForm] = useState({ vt_symbol: '', start: '2024-01-01', end: '2024-12-31', interval: '1m' });

  const load = async () => {
    try { const res = await dataApi.overview(); setOverview(res.data); } catch { /* 501 */ }
  };

  useEffect(() => { load(); }, []);

  const handleDownload = async () => {
    try { await dataApi.download(dlForm); setDownloadOpen(false); Toast.success('下载已启动'); load(); }
    catch (err: any) { Toast.error(err.response?.data?.detail || '下载失败'); }
  };

  const handleDelete = async (vt_symbol: string, interval: string) => {
    try { await dataApi.delete({ vt_symbol, interval }); Toast.success('数据已删除'); load(); }
    catch (err: any) { Toast.error(err.response?.data?.detail || '删除失败'); }
  };

  const columns = [
    { title: '合约', dataIndex: 'symbol' },
    { title: '交易所', dataIndex: 'exchange' },
    { title: '周期', dataIndex: 'interval' },
    { title: '数据量', dataIndex: 'count', align: 'right' as const },
    { title: '开始日期', dataIndex: 'start', align: 'right' as const },
    { title: '结束日期', dataIndex: 'end', align: 'right' as const },
    { title: '操作', width: 80, render: (_: any, r: any) => (
      <Button size="small" theme="solid" type="danger" onClick={() => handleDelete(`${r.symbol}.${r.exchange}`, r.interval)}>删除</Button>
    )},
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Typography.Title heading={4} style={{ margin: 0 }}>数据管理</Typography.Title>
        <Button theme="solid" onClick={() => setDownloadOpen(true)}>下载数据</Button>
      </div>

      <Card style={{ borderRadius: 12 }}>
        <Table columns={columns} dataSource={overview} pagination={false} size="small"
          empty="暂无数据概览（后端引擎集成中）" />
      </Card>

      <Modal title="下载历史数据" visible={downloadOpen} onCancel={() => setDownloadOpen(false)} footer={null}>
        <div>
          <label style={{ marginBottom: 8, display: 'block' }}>合约 (vt_symbol)</label>
          <Input value={dlForm.vt_symbol} onChange={(v) => setDlForm({ ...dlForm, vt_symbol: v })} style={{ marginBottom: 12 }} />
          <label style={{ marginBottom: 8, display: 'block' }}>开始日期</label>
          <Input type="date" value={dlForm.start} onChange={(v) => setDlForm({ ...dlForm, start: v })} style={{ marginBottom: 12 }} />
          <label style={{ marginBottom: 8, display: 'block' }}>结束日期</label>
          <Input type="date" value={dlForm.end} onChange={(v) => setDlForm({ ...dlForm, end: v })} style={{ marginBottom: 12 }} />
          <label style={{ marginBottom: 8, display: 'block' }}>周期</label>
          <Select value={dlForm.interval} onChange={(v) => setDlForm({ ...dlForm, interval: v as string })} style={{ width: '100%', marginBottom: 16 }}
            optionList={[{ value: '1m', label: '1分钟' }, { value: '1h', label: '1小时' }, { value: 'd', label: '日线' }]} />
          <Button theme="solid" block onClick={handleDownload} style={{ borderRadius: 10 }}>下载</Button>
        </div>
      </Modal>
    </div>
  );
}
