import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Nav, Avatar, Dropdown, Typography } from '@douyinfe/semi-ui';
import {
  IconHome, IconLineChartStroked, IconSort, IconBulb,
  IconHistogram, IconFolder, IconSetting, IconSafe,
  IconHistory, IconBolt, IconDesktop, IconEdit, IconLink,
  IconAlertCircle
} from '@douyinfe/semi-icons';
import { useAuthStore } from '../stores/authStore';
import { useLayoutPreference } from '../hooks/useLayoutPreference';
import { useMediaQuery } from '../hooks/useMediaQuery';
import ThemeToggle from './ThemeToggle';
import MobileNav from './MobileNav';

const { Sider, Header, Content } = Layout;

const menuItems = [
  { itemKey: '/', text: '总览', icon: <IconHome /> },
  { itemKey: '/market', text: '行情中心', icon: <IconLineChartStroked /> },
  { itemKey: '/contracts', text: '合约管理', icon: <IconFolder /> },
  { itemKey: '/trading', text: '交易面板', icon: <IconSort /> },
  { itemKey: '/stop-orders', text: '条件单监控', icon: <IconAlertCircle /> },
  { itemKey: '/analytics', text: '数据分析', icon: <IconHistogram /> },
  { itemKey: '/strategy', text: '策略管理', icon: <IconBulb /> },
  { itemKey: '/editor', text: '策略编辑器', icon: <IconEdit /> },
  { itemKey: '/backtest', text: '回测中心', icon: <IconHistogram /> },
  { itemKey: '/data', text: '数据管理', icon: <IconFolder /> },
  {
    itemKey: '/risk',
    text: '风控管理',
    icon: <IconSafe />,
    items: [
      { itemKey: '/risk', text: '风控规则' },
      { itemKey: '/risk/exposure', text: '风险敞口' },
    ],
  },
  { itemKey: '/algo', text: '算法交易', icon: <IconDesktop /> },
  {
    itemKey: '/ml',
    text: '机器学习',
    icon: <IconBulb />,
    items: [
      { itemKey: '/ml', text: '模型管理' },
      { itemKey: '/ml/features', text: '特征工程' },
      { itemKey: '/ml/signals', text: '信号监控' },
      { itemKey: '/ml/compare', text: '模型对比' },
    ],
  },
  { itemKey: '/paper', text: '模拟交易', icon: <IconBolt /> },
  { itemKey: '/gateway', text: '网关管理', icon: <IconLink /> },
  { itemKey: '/logs', text: '操作日志', icon: <IconHistory /> },
  { itemKey: '/system-logs', text: '系统日志', icon: <IconHistory /> },
  { itemKey: '/settings', text: '系统设置', icon: <IconSetting /> },
];

export default function AppLayout() {
  const { username, role, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarCollapsed, setSidebarCollapsed, loaded } = useLayoutPreference();
  const { isMobile } = useMediaQuery();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // 处理侧边栏折叠变化
  const handleCollapseChange = (isCollapsed: boolean) => {
    setSidebarCollapsed(isCollapsed);
  };

  // 等待偏好设置加载完成
  if (!loaded) {
    return null;
  }

  // 移动端布局
  if (isMobile) {
    return (
      <Layout style={{ minHeight: '100vh', paddingBottom: 60 }}>
        <Header style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          height: 56,
          background: 'var(--semi-color-bg-1)',
          borderBottom: '1px solid var(--semi-color-border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
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
            <Typography.Title heading={6} style={{ margin: 0, fontWeight: 600 }}>
              vnpy Web
            </Typography.Title>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
            </Dropdown>
          </div>
        </Header>
        <Content style={{
          marginTop: 56,
          padding: 16,
          background: 'var(--semi-color-bg-0)',
          minHeight: 'calc(100vh - 116px)',
        }}>
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </Content>
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: 'var(--semi-color-bg-1)',
          borderTop: '1px solid var(--semi-color-border)',
        }}>
          <MobileNav />
        </div>
      </Layout>
    );
  }

  // 桌面端布局
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        style={{ background: 'var(--semi-color-bg-1)' }}
      >
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
          isCollapsed={sidebarCollapsed}
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
