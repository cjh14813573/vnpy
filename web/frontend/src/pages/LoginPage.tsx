import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Input, Button, Checkbox, Typography, Toast } from '@douyinfe/semi-ui';
import { IconUser, IconLock } from '@douyinfe/semi-icons';
import { useAuthStore } from '../stores/authStore';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password, remember);
      navigate('/');
    } catch (err: any) {
      Toast.error(err.response?.data?.detail || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--semi-color-fill-0)',
    }}>
      <Card style={{ width: 400, borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Typography.Title heading={3}>vnpy Web 交易系统</Typography.Title>
          <Typography.Text type="tertiary">请登录以继续</Typography.Text>
        </div>

        <form onSubmit={handleSubmit}>
          <Input
            prefix={<IconUser />}
            placeholder="用户名"
            size="large"
            value={username}
            onChange={setUsername}
            style={{ marginBottom: 16 }}
          />
          <Input
            prefix={<IconLock />}
            placeholder="密码"
            type="password"
            size="large"
            value={password}
            onChange={setPassword}
            style={{ marginBottom: 8 }}
          />
          <Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked!)} style={{ marginBottom: 24 }}>
            记住登录（7天）
          </Checkbox>
          <Button
            theme="solid"
            type="primary"
            size="large"
            block
            loading={loading}
            htmlType="submit"
            style={{ borderRadius: 10 }}
          >
            登录
          </Button>
        </form>
      </Card>
    </div>
  );
}
