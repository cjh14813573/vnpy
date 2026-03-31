import { Table, Card, Typography } from '@douyinfe/semi-ui';
import { useMediaQuery } from '../hooks/useMediaQuery';

const { Text } = Typography;

interface ResponsiveTableProps {
  columns: any[];
  dataSource: any[];
  rowKey?: string;
  loading?: boolean;
  pagination?: any;
  empty?: React.ReactNode;
  size?: 'small' | 'middle' | 'large';
  mobileCardRender?: (record: any) => React.ReactNode;
}

export default function ResponsiveTable({
  columns,
  dataSource,
  rowKey = 'id',
  loading,
  pagination,
  empty,
  size = 'middle',
  mobileCardRender,
}: ResponsiveTableProps) {
  const { isMobile } = useMediaQuery();

  // 移动端卡片视图
  if (isMobile) {
    if (mobileCardRender) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {dataSource.map((record, index) => (
            <div key={record[rowKey] || index}>
              {mobileCardRender(record)}
            </div>
          ))}
          {dataSource.length === 0 && empty}
        </div>
      );
    }

    // 默认移动端卡片渲染
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {dataSource.map((record, index) => (
          <Card
            key={record[rowKey] || index}
            style={{ marginBottom: 8 }}
            bodyStyle={{ padding: 12 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {columns
                .filter((col) => !col.hideInMobile)
                .map((col) => (
                  <div
                    key={col.dataIndex}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text type="tertiary" style={{ fontSize: 12 }}>
                      {col.title}
                    </Text>
                    <div>
                      {col.render
                        ? col.render(record[col.dataIndex], record)
                        : record[col.dataIndex]}
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        ))}
        {dataSource.length === 0 && empty}
      </div>
    );
  }

  // 桌面端表格视图
  return (
    <Table
      columns={columns}
      dataSource={dataSource}
      rowKey={rowKey}
      loading={loading}
      pagination={pagination}
      empty={empty}
      size={size as any}
    />
  );
}
