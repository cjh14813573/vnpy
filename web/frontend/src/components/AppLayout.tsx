import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Nav, Avatar, Dropdown, Typography } from '@douyinfe/semi-ui';
import {
  IconHome, IconLineChartStroked, IconSort, IconBulb,
  IconHistogram, IconFolder, IconSetting, IconSafe,
  IconHistory, IconBolt, IconDesktop, IconEdit, IconLink
} from '@douyinfe/semi-icons';
import { useAuthStore } from '../stores/authStore';
import ThemeToggle from './ThemeToggle';

const { Sider, Header, Content } = Layout;

const menuItems = [
  { itemKey: '/', text: '总览', icon: <IconHome /> },
  { itemKey: '/market', text: '行情中心', icon: <IconLineChartStroked /> },
  { itemKey: '/contracts', text: '合约管理', icon: <IconFolder /> },
  { itemKey: '/trading', text: '交易面板', icon: <IconSort /> },
  { itemKey: '/strategy', text: '策略管理', icon: <IconBulb /> },
  { itemKey: '/editor', text: '策略编辑器', icon: <IconEdit /> },
  { itemKey: '/backtest', text: '回测中心', icon: <IconHistogram /> },
  { itemKey: '/data', text: '数据管理', icon: <IconFolder /> },
  { itemKey: '/risk', text: '风控设置', icon: <IconSafe /> },
  { itemKey: '/algo', text: '算法交易', icon: <IconDesktop /> },
  { itemKey: '/ml', text: '机器学习', icon: <IconBulb /> },
  { itemKey: '/paper', text: '模拟交易', icon: <IconBolt /> },
  { itemKey: '/gateway', text: '网关管理', icon: <IconLink /> },
  { itemKey: '/logs', text: '操作日志', icon: <IconHistory /> },
  { itemKey: '/settings', text: '系统设置', icon: <IconSetting /> },
];

export default function AppLayout() {
  const { username, role, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider style={{ background: 'var(--semi-color-bg-1)' }}>
        <Nav
          items={menuItems}
          header={{
            text: 'vnpy Web',
            logo: <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, var(--semi-color-primary), var(--semi-color-success))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 'bold',
              fontSize: 14,
            }}>V</div>
          }}
          selectedKeys={[location.pathname]}
          onSelect={({ itemKey }) => navigate(itemKey as string)}
          style={{ height: '100%' }}
          footer={{
            collapseButton: true,
          }}
        />
      </Sider>
      <Layout>
        <Header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          background: 'var(--semi-color-bg-1)',
          borderBottom: '1px solid var(--semi-color-border)',
        }}>
          <Typography.Title heading={5} style={{ margin: 0, fontWeight: 600 }}>
            量化交易系统
          </Typography.Title>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <ThemeToggle />
            <Dropdown
              position="bottomRight"
              render={
                <Dropdown.Menu>
                  <Dropdown.Item disabled>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontWeight: 600 }}>{username}</span>
                      <span style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>角色: {role}</span>
                    </div>
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item onClick={handleLogout}>退出登录</Dropdown.Item>
                </Dropdown.Menu>
              }
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <Avatar
                  size="small"
                  style={{
                    background: 'linear-gradient(135deg, var(--semi-color-primary), var(--semi-color-success))',
                    color: '#fff',
                    fontWeight: 600,
                  }}
                >
                  {username[0]?.toUpperCase() || 'U'}
                </Avatar>
                <Typography.Text style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {username}
                  <span style={{ fontSize: 12, color: 'var(--semi-color-text-2)', padding: '2px 8px', background: 'var(--semi-color-fill-0)', borderRadius: 4 }}>
                    {role}
                  </span>
                </Typography.Text>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content style={{
          padding: 24,
          background: 'var(--semi-color-bg-0)',
          minHeight: 'calc(100vh - 60px)',
        }}>
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
