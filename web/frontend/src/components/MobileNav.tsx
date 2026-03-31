import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TabBar } from 'antd-mobile';
import {
  AppOutline,
  UnorderedListOutline,
  HistogramOutline,
  SetOutline,
  EditSOutline,
} from 'antd-mobile-icons';

export default function MobileNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeKey, setActiveKey] = useState(location.pathname);

  const tabs = [
    {
      key: '/',
      title: '首页',
      icon: <AppOutline />,
    },
    {
      key: '/market',
      title: '行情',
      icon: <UnorderedListOutline />,
    },
    {
      key: '/trading',
      title: '交易',
      icon: <EditSOutline />,
    },
    {
      key: '/analytics',
      title: '分析',
      icon: <HistogramOutline />,
    },
    {
      key: '/settings',
      title: '设置',
      icon: <SetOutline />,
    },
  ];

  return (
    <TabBar
      activeKey={activeKey}
      onChange={(key) => {
        setActiveKey(key);
        navigate(key);
      }}
    >
      {tabs.map((item) => (
        <TabBar.Item key={item.key} icon={item.icon} title={item.title} />
      ))}
    </TabBar>
  );
}
