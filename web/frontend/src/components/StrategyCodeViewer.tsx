import { useEffect, useState } from 'react';
import { Modal, Spin, Typography, Button, Space } from '@douyinfe/semi-ui';
import { IconCode, IconEdit } from '@douyinfe/semi-icons';
import Editor from '@monaco-editor/react';
import { editorApi } from '../api';

interface StrategyCodeViewerProps {
  className: string;
  visible: boolean;
  onClose: () => void;
  onEdit?: (className: string) => void;
}

export default function StrategyCodeViewer({
  className,
  visible,
  onClose,
  onEdit,
}: StrategyCodeViewerProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible && className) {
      loadCode();
    }
  }, [visible, className]);

  const loadCode = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await editorApi.getStrategyCode(className);
      setCode(res.data.code || '');
    } catch (err: any) {
      setError(err.response?.data?.detail || '加载源码失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    onClose();
    onEdit?.(className);
  };

  return (
    <Modal
      title={
        <Space>
          <IconCode />
          <span>策略源码 - {className}</span>
        </Space>
      }
      visible={visible}
      onCancel={onClose}
      width={1000}
      height={700}
      footer={
        <Space>
          <Button onClick={onClose}>关闭</Button>
          <Button type="primary" icon={<IconEdit />} onClick={handleEdit}>
            在编辑器中打开
          </Button>
        </Space>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 100 }}>
          <Spin size="large" />
          <Typography.Text type="tertiary" style={{ display: 'block', marginTop: 16 }}>
            加载源码中...
          </Typography.Text>
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Typography.Text type="danger">{error}</Typography.Text>
        </div>
      ) : (
        <Editor
          height={500}
          language="python"
          value={code}
          options={{
            readOnly: true,
            minimap: { enabled: true },
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            theme: 'vs-dark',
          }}
        />
      )}
    </Modal>
  );
}
