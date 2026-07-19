import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/AppLayout';
import { Navigate } from 'react-router-dom';
import Landing from '@/pages/Landing';
import Dashboard from '@/pages/Dashboard';
import Profile from '@/pages/Profile';
import CreateLoad from '@/pages/CreateLoad';
import EditLoad from '@/pages/EditLoad';
import Loads from '@/pages/Loads';
import Claims from '@/pages/Claims';
import ClaimDetail from '@/pages/ClaimDetail';
import FollowUps from '@/pages/FollowUps';
import BrokerIntelligence from '@/pages/BrokerIntelligence';
import RecoveryInbox from '@/pages/RecoveryInbox';
import CaseLeads from '@/pages/CaseLeads';
import Settings from '@/pages/Settings';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import { SidePanelProvider } from '@/components/panels/SidePanelContext';
import SidePanel from '@/components/panels/SidePanel';
import DispatchDashboard from '@/pages/DispatchDashboard';
import DriverMode from '@/pages/DriverMode';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<Landing />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/loads" element={<Loads />} />
          <Route path="/loads/new" element={<CreateLoad />} />
          <Route path="/loads/:id/edit" element={<EditLoad />} />
          <Route path="/claims" element={<Claims />} />
          <Route path="/claims/:id" element={<ClaimDetail />} />
          <Route path="/followups" element={<FollowUps />} />
          <Route path="/brokers" element={<BrokerIntelligence />} />
          <Route path="/recovery" element={<RecoveryInbox />} />
          <Route path="/leads" element={<CaseLeads />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
            <Route path="/dispatch" element={<DispatchDashboard />} />
          </Route>
          <Route path="/driver" element={<DriverMode />} />
          </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <SidePanelProvider>
          <Router>
            <ScrollToTop />
            <AuthenticatedApp />
            <SidePanel />
          </Router>
          <Toaster />
        </SidePanelProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App