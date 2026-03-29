import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Nav, Avatar, Dropdown, Typography } from '@douyinfe/semi-ui';
import {
  IconHome, IconLineChartStroked, IconSort, IconBulb,
  IconHistogram, IconFolder, IconSetting, IconSafe,
} from '@douyinfe/semi-icons';
import { useAuthStore } from '../stores/authStore';

const { Sider, Header, Content } = Layout;

const menuItems = [
  { itemKey: '/', text: '总览', icon: <IconHome /> },
  { itemKey: '/market', text: '行情中心', icon: <IconLineChartStroked /> },
  { itemKey: '/trading', text: '交易面板', icon: <IconSort /> },
  { itemKey: '/strategy', text: '策略管理', icon: <IconBulb /> },
  { itemKey: '/backtest', text: '回测中心', icon: <IconHistogram /> },
  { itemKey: '/data', text: '数据管理', icon: <IconFolder /> },
  { itemKey: '/risk', text: '风控设置', icon: <IconSafe /> },
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
      <Sider>
        <Nav
          items={menuItems}
          header={{ text: 'vnpy Web', logo: <IconBulb size="large" /> }}
          selectedKeys={[location.pathname]}
          onSelect={({ itemKey }) => navigate(itemKey as string)}
          style={{ height: '100%' }}
        />
      </Sider>
      <Layout>
        <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: '1px solid var(--semi-color-border)' }}>
          <Typography.Title heading={5} style={{ margin: 0 }}>vnpy Web 交易系统</Typography.Title>
          <Dropdown
            position="bottomRight"
            render={
              <Dropdown.Menu>
                <Dropdown.Item disabled>{username}（{role}）</Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item onClick={handleLogout}>退出登录</Dropdown.Item>
              </Dropdown.Menu>
            }
          >
            <Avatar size="small" style={{ cursor: 'pointer' }}>
              {username[0]?.toUpperCase() || 'U'}
            </Avatar>
          </Dropdown>
        </Header>
        <Content style={{ padding: 20, background: 'var(--semi-color-fill-0)', minHeight: 'calc(100vh - 60px)' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
