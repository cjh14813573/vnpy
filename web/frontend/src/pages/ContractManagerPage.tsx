import { useEffect, useState, useCallback } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Row, Col, Select,
  Space, Modal, Descriptions, Toast, Spin, Pagination
} from '@douyinfe/semi-ui';
import { IconSearch, IconRefresh, IconExport, IconInfoCircle } from '@douyinfe/semi-icons';
import { marketApi, systemApi } from '../api';

interface Contract {
  symbol: string;
  exchange: string;
  vt_symbol: string;
  gateway_name: string;
  name: string;
  product: string;
  size: number;
  pricetick: number;
  min_volume: number;
  history_data: boolean;
}

interface ContractDetail extends Contract {
  trading_sessions: Array<{ name: string; start: string; end: string }>;
  margin_rate: {
    long_margin_rate: number;
    short_margin_rate: number;
    min_margin: number;
  };
  delivery_info: Record<string, any>;
}

export default function ContractManagerPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // 筛选条件
  const [keyword, setKeyword] = useState('');
  const [selectedExchange, setSelectedExchange] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');

  // 选项数据
  const [exchanges, setExchanges] = useState<string[]>([]);
  const [products, setProducts] = useState<string[]>([]);

  // 详情弹窗
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedContract, setSelectedContract] = useState<ContractDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 加载合约列表
  const loadContracts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await marketApi.contracts({
        page: currentPage,
        page_size: pageSize,
        keyword: keyword || undefined,
        exchange: selectedExchange || undefined,
        product: selectedProduct || undefined,
      });

      const data = res.data;
      setContracts(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch (err: any) {
      Toast.error('加载合约列表失败: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, keyword, selectedExchange, selectedProduct]);

  // 加载筛选选项
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [exRes, prodRes] = await Promise.all([
          systemApi.exchanges(),
          marketApi.products(),
        ]);
        setExchanges(exRes.data || []);
        const productsData = prodRes.data || [];
        setProducts(Array.isArray(productsData) ? productsData : []);
      } catch (err) {
        console.error('加载选项失败:', err);
      }
    };
    loadOptions();
  }, []);

  // 加载合约数据
  useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  // 查看合约详情
  const viewDetail = async (vtSymbol: string) => {
    setDetailLoading(true);
    setDetailVisible(true);
    try {
      const res = await marketApi.contractDetail(vtSymbol);
      setSelectedContract(res.data);
    } catch (err: any) {
      Toast.error('加载合约详情失败: ' + (err.response?.data?.detail || err.message));
      setDetailVisible(false);
    } finally {
      setDetailLoading(false);
    }
  };

  // 导出 CSV
  const exportCSV = () => {
    const headers = ['合约代码', '名称', '交易所', '产品类型', '合约乘数', '价格跳动', '最小下单量', '网关'];
    const rows = contracts.map(c => [
      c.symbol,
      c.name,
      c.exchange,
      c.product,
      c.size,
      c.pricetick,
      c.min_volume,
      c.gateway_name,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `contracts_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();

    Toast.success('导出成功');
  };

  // 重置筛选
  const resetFilters = () => {
    setKeyword('');
    setSelectedExchange('');
    setSelectedProduct('');
    setCurrentPage(1);
  };

  // 表格列定义
  const columns = [
    {
      title: '合约代码',
      dataIndex: 'vt_symbol',
      width: 180,
      render: (v: string, record: Contract) => (
        <div>
          <Typography.Text strong>{v}</Typography.Text>
          <br />
          <Typography.Text type="tertiary" size="small">{record.name}</Typography.Text>
        </div>
      ),
    },
    {
      title: '交易所',
      dataIndex: 'exchange',
      width: 100,
      render: (v: string) => <Tag size="small">{v}</Tag>,
    },
    {
      title: '产品类型',
      dataIndex: 'product',
      width: 100,
      render: (v: string) => {
        const colorMap: Record<string, string> = {
          '期货': 'blue',
          '期权': 'purple',
          '股票': 'green',
          '基金': 'orange',
          '债券': 'cyan',
        };
        return <Tag color={(colorMap[v] || 'default') as any} size="small">{v || '-'}</Tag>;
      },
    },
    {
      title: '合约乘数',
      dataIndex: 'size',
      width: 90,
      align: 'right' as const,
    },
    {
      title: '价格跳动',
      dataIndex: 'pricetick',
      width: 90,
      align: 'right' as const,
      render: (v: number) => v?.toFixed(2),
    },
    {
      title: '最小下单量',
      dataIndex: 'min_volume',
      width: 100,
      align: 'right' as const,
    },
    {
      title: '历史数据',
      dataIndex: 'history_data',
      width: 90,
      render: (v: boolean) => v ? <Tag color="green" size="small">有</Tag> : <Tag size="small">无</Tag>,
    },
    {
      title: '操作',
      width: 100,
      render: (_: any, record: Contract) => (
        <Button
          size="small"
          icon={<IconInfoCircle />}
          onClick={() => viewDetail(record.vt_symbol)}
        >
          详情
        </Button>
      ),
    },
  ];

  const { Title, Text } = Typography;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title heading={4} style={{ margin: 0 }}>合约查询管理器</Title>
        <Space>
          <Button icon={<IconRefresh />} onClick={loadContracts} loading={loading}>刷新</Button>
          <Button icon={<IconExport />} onClick={exportCSV}>导出CSV</Button>
        </Space>
      </div>

      {/* 筛选区域 */}
      <Card style={{ marginBottom: 16, borderRadius: 12 }}>
        <Row gutter={16} align="middle">
          <Col span={8}>
            <Input
              prefix={<IconSearch />}
              placeholder="搜索合约代码或名称"
              value={keyword}
              onChange={setKeyword}
              onKeyDown={(e) => { if (e.key === 'Enter') { setCurrentPage(1); loadContracts(); } }}
            />
          </Col>
          <Col span={5}>
            <Select
              placeholder="选择交易所"
              value={selectedExchange}
              onChange={(v) => { setSelectedExchange(v as string); setCurrentPage(1); }}
              style={{ width: '100%' }}
              optionList={[
                { value: '', label: '全部交易所' },
                ...exchanges.map(e => ({ value: e, label: e })),
              ]}
            />
          </Col>
          <Col span={5}>
            <Select
              placeholder="选择产品类型"
              value={selectedProduct}
              onChange={(v) => { setSelectedProduct(v as string); setCurrentPage(1); }}
              style={{ width: '100%' }}
              optionList={[
                { value: '', label: '全部类型' },
                ...products.map(p => ({ value: p, label: p })),
              ]}
            />
          </Col>
          <Col span={6}>
            <Space>
              <Button theme="solid" onClick={loadContracts}>搜索</Button>
              <Button onClick={resetFilters}>重置</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 合约列表 */}
      <Card style={{ borderRadius: 12 }}>
        <Table
          columns={columns}
          dataSource={contracts}
          pagination={false}
          loading={loading}
          size="small"
          empty={
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Text type="tertiary">暂无合约数据</Text>
            </div>
          }
        />

        {/* 分页 */}
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Pagination
            total={total}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOpts={[20, 50, 100]}
            showSizeChanger
            showTotal
          />
        </div>
      </Card>

      {/* 合约详情弹窗 */}
      <Modal
        title={selectedContract ? `${selectedContract.vt_symbol} 合约详情` : '合约详情'}
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
          </div>
        ) : selectedContract ? (
          <div>
            <Descriptions style={{ marginBottom: 24 }}>
              <Descriptions.Item itemKey="合约代码">{selectedContract.vt_symbol}</Descriptions.Item>
              <Descriptions.Item itemKey="合约名称">{selectedContract.name}</Descriptions.Item>
              <Descriptions.Item itemKey="交易所">{selectedContract.exchange}</Descriptions.Item>
              <Descriptions.Item itemKey="产品类型">{selectedContract.product}</Descriptions.Item>
              <Descriptions.Item itemKey="合约乘数">{selectedContract.size}</Descriptions.Item>
              <Descriptions.Item itemKey="价格跳动">{selectedContract.pricetick}</Descriptions.Item>
              <Descriptions.Item itemKey="最小下单量">{selectedContract.min_volume}</Descriptions.Item>
              <Descriptions.Item itemKey="网关">{selectedContract.gateway_name}</Descriptions.Item>
            </Descriptions>

            {/* 保证金率 */}
            {selectedContract.margin_rate && (
              <>
                <Title heading={5} style={{ marginBottom: 12 }}>保证金率</Title>
                <Descriptions style={{ marginBottom: 24 }}>
                  <Descriptions.Item itemKey="多头保证金">
                    {(selectedContract.margin_rate.long_margin_rate * 100).toFixed(1)}%
                  </Descriptions.Item>
                  <Descriptions.Item itemKey="空头保证金">
                    {(selectedContract.margin_rate.short_margin_rate * 100).toFixed(1)}%
                  </Descriptions.Item>
                </Descriptions>
              </>
            )}

            {/* 交割信息 */}
            {selectedContract.delivery_info && Object.keys(selectedContract.delivery_info).length > 0 && (
              <>
                <Title heading={5} style={{ marginBottom: 12 }}>交割信息</Title>
                <Descriptions style={{ marginBottom: 24 }}>
                  {Object.entries(selectedContract.delivery_info).map(([key, value]) => (
                    <Descriptions.Item key={key} itemKey={key}>{String(value || '-')}</Descriptions.Item>
                  ))}
                </Descriptions>
              </>
            )}

            {/* 交易时段 */}
            {selectedContract.trading_sessions && selectedContract.trading_sessions.length > 0 && (
              <>
                <Title heading={5} style={{ marginBottom: 12 }}>交易时段</Title>
                <Space wrap>
                  {selectedContract.trading_sessions.map((session, idx) => (
                    <Tag key={idx} size="large" color={session.name.includes('夜盘') ? 'purple' : 'blue'}>
                      {session.name}: {session.start} - {session.end}
                    </Tag>
                  ))}
                </Space>
              </>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
