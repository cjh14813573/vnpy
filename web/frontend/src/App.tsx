import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from '@douyinfe/semi-ui';
import AppLayout from './components/AppLayout';
import AuthGuard from './components/AuthGuard';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MarketPage from './pages/MarketPage';
import ContractManagerPage from './pages/ContractManagerPage';
import TradingPage from './pages/TradingPage';
import StrategyPage from './pages/StrategyPage';
import StrategyDetailPage from './pages/StrategyDetailPage';
import BacktestPage from './pages/BacktestPage';
import DataPage from './pages/DataPage';
import RiskPage from './pages/RiskPage';
import SettingsPage from './pages/SettingsPage';
import LogsPage from './pages/LogsPage';
import AlgoPage from './pages/AlgoPage';
import PaperPage from './pages/PaperPage';
import GatewayPage from './pages/GatewayPage';
import EditorPage from './pages/EditorPage';
import MLPage from './pages/MLPage';
import { useThemeStore } from './stores/themeStore';

function AppContent() {
  const { mode } = useThemeStore();
  // Theme mode is used to trigger re-render when theme changes
  // CSS variables handle the actual styling
  document.body.setAttribute('data-theme', mode);

  return (
    <ConfigProvider>
      <div style={{
        minHeight: '100vh',
        background: 'var(--semi-color-bg-0)',
      }}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<AuthGuard><AppLayout /></AuthGuard>}>
              <Route index element={<DashboardPage />} />
              <Route path="market" element={<MarketPage />} />
              <Route path="contracts" element={<ContractManagerPage />} />
              <Route path="trading" element={<TradingPage />} />
              <Route path="strategy" element={<StrategyPage />} />
              <Route path="strategy/:name" element={<StrategyDetailPage />} />
              <Route path="backtest" element={<BacktestPage />} />
              <Route path="data" element={<DataPage />} />
              <Route path="risk" element={<RiskPage />} />
              <Route path="logs" element={<LogsPage />} />
              <Route path="algo" element={<AlgoPage />} />
              <Route path="paper" element={<PaperPage />} />
              <Route path="gateway" element={<GatewayPage />} />
              <Route path="editor" element={<EditorPage />} />
              <Route path="editor/:className" element={<EditorPage />} />
              <Route path="ml" element={<MLPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </BrowserRouter>
      </div>
    </ConfigProvider>
  );
}

export default function App() {
  return <AppContent />;
}
