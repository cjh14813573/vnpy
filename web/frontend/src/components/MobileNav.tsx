import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import {
  IconHome,
  IconLineChartStroked,
  IconSort,
  IconHistogram,
  IconFolder,
  IconBulb,
  IconSafe,
  IconSetting,
  IconEdit,
  IconDesktop,
} from '@douyinfe/semi-icons';

interface NavItem {
  key: string;
  title: string;
  icon: React.ReactNode;
}

const mainTabs: NavItem[] = [
  { key: '/', title: '首页', icon: <IconHome /> },
  { key: '/market', title: '行情', icon: <IconLineChartStroked /> },
  { key: '/trading', title: '交易', icon: <IconSort /> },
  { key: '/strategy', title: '策略', icon: <IconBulb /> },
];

const moreTabs: NavItem[] = [
  { key: '/backtest', title: '回测', icon: <IconHistogram /> },
  { key: '/editor', title: '编辑器', icon: <IconEdit /> },
  { key: '/analytics', title: '分析', icon: <IconHistogram /> },
  { key: '/risk', title: '风控', icon: <IconSafe /> },
  { key: '/ml', title: 'ML', icon: <IconBulb /> },
  { key: '/algo', title: '算法', icon: <IconDesktop /> },
  { key: '/contracts', title: '合约', icon: <IconFolder /> },
  { key: '/settings', title: '设置', icon: <IconSetting /> },
];

export default function MobileNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeKey, setActiveKey] = useState(location.pathname);
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveKey(location.pathname);
  }, [location.pathname]);

  // 点击外部关闭更多菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setShowMore(false);
      }
    };
    if (showMore) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMore]);

  const handleNav = (key: string) => {
    setActiveKey(key);
    navigate(key);
    setShowMore(false);
  };

  const isActive = (key: string) => {
    if (key === '/') return activeKey === '/';
    return activeKey === key || activeKey.startsWith(key + '/');
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {/* 主导航 */}
      <div style={{ display: 'flex', flex: 1, justifyContent: 'space-around' }}>
        {mainTabs.map((item) => (
          <div
            key={item.key}
            onClick={() => handleNav(item.key)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '8px 12px',
              cursor: 'pointer',
              color: isActive(item.key)
                ? 'var(--semi-color-primary)'
                : 'var(--semi-color-text-2)',
              transition: 'color 0.3s',
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 2 }}>{item.icon}</div>
            <span style={{ fontSize: 12 }}>{item.title}</span>
          </div>
        ))}
      </div>

      {/* 更多按钮 */}
      <div ref={moreRef} style={{ position: 'relative' }}>
        <div
          onClick={() => setShowMore(!showMore)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '8px 16px',
            cursor: 'pointer',
            color: showMore
              ? 'var(--semi-color-primary)'
              : 'var(--semi-color-text-2)',
            borderLeft: '1px solid var(--semi-color-border)',
          }}
        >
          <div
            style={{
              fontSize: 20,
              marginBottom: 2,
              transform: showMore ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}
          >
            ⋮
          </div>
          <span style={{ fontSize: 12 }}>更多</span>
        </div>

        {/* 更多菜单弹窗 */}
        {showMore && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              right: 0,
              marginBottom: 8,
              background: 'var(--semi-color-bg-1)',
              borderRadius: 12,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              padding: 12,
              minWidth: 200,
              zIndex: 1000,
              border: '1px solid var(--semi-color-border)',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 12,
              }}
            >
              {moreTabs.map((item) => (
                <div
                  key={item.key}
                  onClick={() => handleNav(item.key)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '8px 4px',
                    cursor: 'pointer',
                    borderRadius: 8,
                    background: isActive(item.key)
                      ? 'var(--semi-color-primary-light-default)'
                      : 'transparent',
                    color: isActive(item.key)
                      ? 'var(--semi-color-primary)'
                      : 'var(--semi-color-text-2)',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ fontSize: 20, marginBottom: 4 }}>
                    {item.icon}
                  </div>
                  <span style={{ fontSize: 11 }}>{item.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
