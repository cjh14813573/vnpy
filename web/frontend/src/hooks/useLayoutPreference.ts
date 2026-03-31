import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'vnpy_web_layout_preferences';

export interface LayoutPreferences {
  sidebarCollapsed: boolean;
  pageTabs: Record<string, string>;
  tablePageSizes: Record<string, number>;
  columnWidths: Record<string, Record<string, number>>;
}

const defaultPreferences: LayoutPreferences = {
  sidebarCollapsed: false,
  pageTabs: {},
  tablePageSizes: {},
  columnWidths: {},
};

export function useLayoutPreference() {
  const [preferences, setPreferences] = useState<LayoutPreferences>(defaultPreferences);
  const [loaded, setLoaded] = useState(false);

  // 从 localStorage 加载偏好设置
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPreferences({ ...defaultPreferences, ...parsed });
      }
    } catch (e) {
      console.error('Failed to load layout preferences:', e);
    }
    setLoaded(true);
  }, []);

  // 保存到 localStorage
  const savePreferences = useCallback((newPrefs: Partial<LayoutPreferences>) => {
    setPreferences(prev => {
      const updated = { ...prev, ...newPrefs };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save layout preferences:', e);
      }
      return updated;
    });
  }, []);

  // 侧边栏折叠状态
  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    savePreferences({ sidebarCollapsed: collapsed });
  }, [savePreferences]);

  // 页面 Tab 状态
  const setPageTab = useCallback((page: string, tab: string) => {
    setPreferences(prev => {
      const updated = {
        ...prev,
        pageTabs: { ...prev.pageTabs, [page]: tab },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const getPageTab = useCallback((page: string, defaultTab: string): string => {
    return preferences.pageTabs[page] || defaultTab;
  }, [preferences.pageTabs]);

  // 表格分页大小
  const setTablePageSize = useCallback((tableId: string, pageSize: number) => {
    setPreferences(prev => {
      const updated = {
        ...prev,
        tablePageSizes: { ...prev.tablePageSizes, [tableId]: pageSize },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const getTablePageSize = useCallback((tableId: string, defaultSize: number = 20): number => {
    return preferences.tablePageSizes[tableId] || defaultSize;
  }, [preferences.tablePageSizes]);

  // 重置所有偏好设置
  const resetPreferences = useCallback(() => {
    setPreferences(defaultPreferences);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    preferences,
    loaded,
    sidebarCollapsed: preferences.sidebarCollapsed,
    setSidebarCollapsed,
    setPageTab,
    getPageTab,
    setTablePageSize,
    getTablePageSize,
    resetPreferences,
  };
}

export default useLayoutPreference;
