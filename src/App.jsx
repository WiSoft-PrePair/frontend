import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AppProvider, useAppState } from './context/AppStateContext'
import LandingPage from './pages/Landing'
import AuthPage from './pages/Auth'
import InterviewPage from './pages/Interview'
import SettingsPage from './pages/Settings'
import RewardsOverview from './pages/rewards/RewardsOverview'
import RewardShop from './pages/rewards/RewardShop'
import PurchaseComplete from './pages/rewards/PurchaseComplete'
import PurchaseHistory from './pages/rewards/PurchaseHistory'
import AppLayout from './layouts/AppLayout'
import './index.css'

function ProtectedRoute({ children }) {
  const { user, isLoggingOut } = useAppState()
  const location = useLocation()

  if (!user) {
    // 로그아웃 중이면 랜딩 페이지로, 아니면 로그인 페이지로
    if (isLoggingOut) {
      return <Navigate to="/" replace />
    }
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />
  }

  return children
}

function ProtectedOutlet() {
  return (
    <ProtectedRoute>
      <Outlet />
    </ProtectedRoute>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="auth" element={<AuthPage />} />
        <Route
          path="interview"
          element={
            <ProtectedRoute>
              <InterviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route path="mypage" element={<ProtectedOutlet />}>
          <Route index element={<RewardsOverview />} />
        </Route>
        <Route path="reward" element={<ProtectedOutlet />}>
          <Route index element={<RewardShop />} />
          <Route path="complete" element={<PurchaseComplete />} />
          <Route path="history" element={<PurchaseHistory />} />
        </Route>
        {/* Redirect old rewards path to mypage */}
        <Route path="rewards/*" element={<Navigate to="/mypage" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  )
}
