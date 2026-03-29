import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from '@douyinfe/semi-ui';
import AppLayout from './components/AppLayout';
import AuthGuard from './components/AuthGuard';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MarketPage from './pages/MarketPage';
import TradingPage from './pages/TradingPage';
import StrategyPage from './pages/StrategyPage';
import StrategyDetailPage from './pages/StrategyDetailPage';
import BacktestPage from './pages/BacktestPage';
import DataPage from './pages/DataPage';
import RiskPage from './pages/RiskPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <ConfigProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AuthGuard><AppLayout /></AuthGuard>}>
            <Route index element={<DashboardPage />} />
            <Route path="market" element={<MarketPage />} />
            <Route path="trading" element={<TradingPage />} />
            <Route path="strategy" element={<StrategyPage />} />
            <Route path="strategy/:name" element={<StrategyDetailPage />} />
            <Route path="backtest" element={<BacktestPage />} />
            <Route path="data" element={<DataPage />} />
            <Route path="risk" element={<RiskPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
