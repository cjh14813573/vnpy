import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Typography, Card, Button, Select, Row, Col, Toast, Space,
  SplitButtonGroup, Dropdown, Modal, Input, Tabs, Badge
} from '@douyinfe/semi-ui';
import {
  IconSave, IconPlay, IconPlus, IconChevronDown
} from '@douyinfe/semi-icons';
import Editor from '@monaco-editor/react';
import { strategyApi } from '../api';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

// 编辑器配置
const editorOptions = {
  minimap: { enabled: true },
  fontSize: 14,
  lineNumbers: 'on',
  roundedSelection: false,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 4,
  insertSpaces: false,
  folding: true,
  foldingStrategy: 'indentation',
  showFoldingControls: 'always',
  matchBrackets: 'always',
  autoIndent: 'full',
  formatOnPaste: true,
  formatOnType: true,
};

interface StrategyTemplate {
  name: string;
  display_name: string;
  description: string;
  code: string;
}

export default function EditorPage() {
  const navigate = useNavigate();
  const { className: urlClassName } = useParams();

  // 编辑器状态
  const [code, setCode] = useState('');
  const [originalCode, setOriginalCode] = useState('');
  const [className, setClassName] = useState('');
  const [templates, setTemplates] = useState<StrategyTemplate[]>([]);
  const [classes, setClasses] = useState<string[]>([]);

  // UI 状态
  const [, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newStrategyName, setNewStrategyName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');

  // 回测配置
  const [backtestConfig, setBacktestConfig] = useState({
    vt_symbol: 'rb2410.SHFE',
    interval: '1m',
    start: '2024-01-01',
    end: '2024-06-30',
  });

  // 加载模板和策略类
  useEffect(() => {
    loadTemplates();
    loadClasses();
  }, []);

  // 加载指定策略代码
  useEffect(() => {
    if (urlClassName) {
      loadStrategyCode(urlClassName);
    }
  }, [urlClassName]);

  const loadTemplates = async () => {
    try {
      const res = await fetch('/api/editor/templates', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (err) {
      console.error('加载模板失败:', err);
    }
  };

  const loadClasses = async () => {
    try {
      const res = await strategyApi.classes();
      setClasses(res.data);
    } catch { /* ignore */ }
  };

  const loadStrategyCode = async (name: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/editor/strategy/${name}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCode(data.code);
        setOriginalCode(data.code);
        setClassName(data.class_name);
        setHasChanges(false);
      } else {
        Toast.error('加载策略代码失败');
      }
    } catch (err) {
      Toast.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCode(value);
      setHasChanges(value !== originalCode);
    }
  };

  const handleSave = async () => {
    if (!className) {
      Toast.error('请先选择或创建一个策略');
      return;
    }

    try {
      const res = await fetch(`/api/editor/strategy/${className}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ class_name: className, content: code })
      });

      if (res.ok) {
        setOriginalCode(code);
        setHasChanges(false);
        Toast.success('保存成功');
        loadClasses(); // 刷新策略列表
      } else {
        Toast.error('保存失败');
      }
    } catch (err) {
      Toast.error('保存失败');
    }
  };

  const handleRunBacktest = async () => {
    if (hasChanges) {
      Toast.warning('请先保存代码再运行回测');
      return;
    }

    try {
      const res = await fetch(`/api/editor/strategy/${className}/run-backtest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(backtestConfig)
      });

      if (res.ok) {
        const data = await res.json();
        Toast.success(`回测任务已创建: ${data.task_id}`);
        // 跳转到回测页面
        navigate('/backtest');
      } else {
        Toast.error('创建回测任务失败');
      }
    } catch (err) {
      Toast.error('运行回测失败');
    }
  };

  const handleCreateNew = () => {
    if (!newStrategyName || !selectedTemplate) {
      Toast.error('请填写策略名称并选择模板');
      return;
    }

    const template = templates.find(t => t.name === selectedTemplate);
    if (template) {
      // 替换模板中的类名
      const newCode = template.code.replace(
        new RegExp(`class ${template.name}`, 'g'),
        `class ${newStrategyName}`
      );
      setCode(newCode);
      setOriginalCode('');
      setClassName(newStrategyName);
      setHasChanges(true);
      setShowNewModal(false);
      setNewStrategyName('');
      setSelectedTemplate('');

      // 自动保存
      setTimeout(() => handleSave(), 100);
    }
  };

  const handleEditorWillMount = (monaco: any) => {
    // 配置 Python 语言支持
    monaco.languages.registerCompletionItemProvider('python', {
      provideCompletionItems: () => ({
        suggestions: [
          {
            label: 'CtaTemplate',
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: 'CtaTemplate',
            documentation: 'CTA策略基类'
          },
          {
            label: 'on_bar',
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: 'def on_bar(self, bar: BarData):\n    pass',
            documentation: 'K线回调函数'
          },
          {
            label: 'buy',
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: 'buy(price, volume, stop=False, lock=False)',
            documentation: '买入开仓'
          },
          {
            label: 'sell',
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: 'sell(price, volume, stop=False, lock=False)',
            documentation: '卖出平仓'
          },
          {
            label: 'short',
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: 'short(price, volume, stop=False, lock=False)',
            documentation: '卖出开仓'
          },
          {
            label: 'cover',
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: 'cover(price, volume, stop=False, lock=False)',
            documentation: '买入平仓'
          },
          {
            label: 'cancel_all',
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: 'cancel_all()',
            documentation: '撤销所有委托'
          },
          {
            label: 'put_event',
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: 'put_event()',
            documentation: '更新UI事件'
          },
        ]
      })
    });
  };

  return (
    <div style={{ height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
      {/* 工具栏 */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Title heading={4} style={{ margin: 0 }}>
            策略编辑器
            {hasChanges && <Badge count="未保存" style={{ marginLeft: 8 }} />}
          </Title>

          <Select
            value={className || undefined}
            placeholder="选择策略"
            style={{ width: 200 }}
            onChange={(v) => navigate(`/editor/${v}`)}
            optionList={classes.map(c => ({ value: c, label: c }))}
          />
        </div>

        <Space>
          <Button icon={<IconPlus />} onClick={() => setShowNewModal(true)}>
            新建策略
          </Button>

          <SplitButtonGroup>
            <Button
              theme="solid"
              icon={<IconSave />}
              onClick={handleSave}
              disabled={!hasChanges}
            >
              保存
            </Button>
            <Dropdown
              trigger="click"
              position="bottomRight"
              render={
                <Dropdown.Menu>
                  <Dropdown.Item onClick={handleSave}>保存</Dropdown.Item>
                  <Dropdown.Item onClick={() => loadStrategyCode(className)}>放弃修改</Dropdown.Item>
                </Dropdown.Menu>
              }
            >
              <Button theme="solid" icon={<IconChevronDown />} style={{ padding: '0 4px' }} />
            </Dropdown>
          </SplitButtonGroup>

          <Button
            theme="solid"
            type="primary"
            icon={<IconPlay />}
            onClick={handleRunBacktest}
            disabled={!className || hasChanges}
          >
            运行回测
          </Button>
        </Space>
      </div>

      {/* 主编辑区 */}
      <Row gutter={16} style={{ flex: 1, overflow: 'hidden' }}>
        <Col span={18} style={{ height: '100%' }}>
          <Card
            bodyStyle={{ padding: 0, height: '100%' }}
            style={{ height: '100%', borderRadius: 12 }}
          >
            <Editor
              height="100%"
              language="python"
              value={code}
              options={editorOptions as any}
              onChange={handleEditorChange}
              beforeMount={handleEditorWillMount}
              theme="vs-dark"
              loading={<Text type="tertiary">正在加载编辑器...</Text>}
            />
          </Card>
        </Col>

        <Col span={6} style={{ height: '100%' }}>
          <Tabs type="card" style={{ height: '100%' }}>
            <TabPane tab="回测配置" itemKey="backtest">
              <Card style={{ borderRadius: 12 }}>
                <div style={{ marginBottom: 16 }}>
                  <Text strong>合约</Text>
                  <Input
                    value={backtestConfig.vt_symbol}
                    onChange={(v) => setBacktestConfig({ ...backtestConfig, vt_symbol: v })}
                    style={{ marginTop: 8 }}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <Text strong>周期</Text>
                  <Select
                    value={backtestConfig.interval}
                    onChange={(v) => setBacktestConfig({ ...backtestConfig, interval: v as string })}
                    style={{ width: '100%', marginTop: 8 }}
                    optionList={[
                      { value: '1m', label: '1分钟' },
                      { value: '1h', label: '1小时' },
                      { value: 'd', label: '日线' },
                    ]}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <Text strong>开始日期</Text>
                  <Input
                    type="date"
                    value={backtestConfig.start}
                    onChange={(v) => setBacktestConfig({ ...backtestConfig, start: v })}
                    style={{ marginTop: 8 }}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <Text strong>结束日期</Text>
                  <Input
                    type="date"
                    value={backtestConfig.end}
                    onChange={(v) => setBacktestConfig({ ...backtestConfig, end: v })}
                    style={{ marginTop: 8 }}
                  />
                </div>
              </Card>
            </TabPane>

            <TabPane tab="模板" itemKey="templates">
              <Space vertical style={{ width: '100%' }}>
                {templates.map((tpl) => (
                  <div key={tpl.name} onClick={() => {
                    setSelectedTemplate(tpl.name);
                    setNewStrategyName(`My${tpl.name}`);
                    setShowNewModal(true);
                  }}>
                    <Card style={{ borderRadius: 8, cursor: 'pointer' }}>
                      <Text strong>{tpl.display_name}</Text>
                      <br />
                      <Text type="tertiary" size="small">{tpl.description}</Text>
                    </Card>
                  </div>
                ))}
              </Space>
            </TabPane>
          </Tabs>
        </Col>
      </Row>

      {/* 新建策略对话框 */}
      <Modal
        title="新建策略"
        visible={showNewModal}
        onCancel={() => setShowNewModal(false)}
        footer={null}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong>策略名称</Text>
          <Input
            value={newStrategyName}
            onChange={setNewStrategyName}
            placeholder="MyStrategy"
            style={{ marginTop: 8 }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <Text strong>选择模板</Text>
          <Select
            value={selectedTemplate}
            onChange={(v) => setSelectedTemplate(v as string)}
            style={{ width: '100%', marginTop: 8 }}
            placeholder="选择模板"
            optionList={templates.map(t => ({
              value: t.name,
              label: `${t.display_name} - ${t.description}`
            }))}
          />
        </div>

        <Button theme="solid" block onClick={handleCreateNew} disabled={!newStrategyName || !selectedTemplate}>
          创建
        </Button>
      </Modal>
    </div>
  );
}
