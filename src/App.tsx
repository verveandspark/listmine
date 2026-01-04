import SharedListView from "@/components/list/SharedListView";
import InviteAccept from "@/components/invite/InviteAccept";
import { DashboardSkeleton } from "@/components/ui/DashboardSkeleton";
import { Suspense, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContextProvider";
import { ListProvider } from "./contexts/ListContext";
import { AccountProvider } from "./contexts/AccountContext";
import { useAuth } from "./contexts/useAuthHook";
import { Toaster } from "./components/ui/toaster";
import { GlobalBannerProvider } from "./components/ui/GlobalErrorBanner";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import AuthPage from "./components/auth/AuthPage";
import ResetPassword from "./components/auth/ResetPassword";
import Dashboard from "./components/dashboard/Dashboard";
import ListDetail from "./components/list/ListDetail";
import ImportExport from "./components/import-export/ImportExport";
import Profile from "./components/profile/Profile";
import Upgrade from "./components/upgrade/Upgrade";
import Templates from "./components/templates/Templates";
import AdminPanel from "./components/admin/AdminPanel";

// Auth callback handler for magic link and password reset redirects
function AuthCallback() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  useEffect(() => {
    // Check for recovery flow in URL hash (Supabase appends type=recovery)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const isRecoveryFlow = hashParams.get('type') === 'recovery';
    
    if (!loading) {
      if (isRecoveryFlow) {
        // Password recovery flow - redirect to reset password page
        navigate('/auth/reset-password', { replace: true });
      } else if (isAuthenticated) {
        // Check if this was an impersonation redirect
        const impersonated = searchParams.get('impersonated');
        if (impersonated === 'true') {
          navigate('/dashboard?impersonated=true', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      } else {
        // If not authenticated after callback, redirect to auth page
        navigate('/', { replace: true });
      }
    }
  }, [isAuthenticated, loading, navigate, searchParams]);
  
  return <DashboardSkeleton />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <DashboardSkeleton />;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const openDialogs = document.querySelectorAll('[role="dialog"]');
        if (openDialogs.length > 0) {
          const topDialog = openDialogs[openDialogs.length - 1];
          const closeButton = topDialog.querySelector('[aria-label="Close"]');
          if (closeButton instanceof HTMLElement) {
            closeButton.click();
          }
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Determine where to redirect based on saved view mode
  const getRedirectPath = () => {
    const viewMode = localStorage.getItem("dashboardViewMode");
    if (viewMode === "list") {
      const lastListId = localStorage.getItem("last_list_id");
      if (lastListId) {
        return `/list/${lastListId}`;
      }
    }
    return "/dashboard";
  };

  return (
    <Routes>
      <Route 
        path="/" 
        element={isAuthenticated ? <Navigate to={getRedirectPath()} replace /> : <AuthPage />} 
      />
      <Route path="/auth" element={<Navigate to="/" replace />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/auth/reset-password" element={<ResetPassword />} />
      <Route path="/invite" element={<ErrorBoundary><InviteAccept /></ErrorBoundary>} />
      <Route path="/shared/:shareId" element={<ErrorBoundary><SharedListView /></ErrorBoundary>} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <ErrorBoundary>
              <Dashboard />
            </ErrorBoundary>
          </ProtectedRoute>
        }
      />
      <Route
        path="/templates"
        element={
          <ProtectedRoute>
            <ErrorBoundary>
              <Templates />
            </ErrorBoundary>
          </ProtectedRoute>
        }
      />
      <Route
        path="/list/:id"
        element={
          <ProtectedRoute>
            <ErrorBoundary>
              <ListDetail />
            </ErrorBoundary>
          </ProtectedRoute>
        }
      />
      <Route
        path="/import-export"
        element={
          <ProtectedRoute>
            <ErrorBoundary>
              <ImportExport />
            </ErrorBoundary>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ErrorBoundary>
              <Profile />
            </ErrorBoundary>
          </ProtectedRoute>
        }
      />
      <Route
        path="/upgrade"
        element={
          <ProtectedRoute>
            <ErrorBoundary>
              <Upgrade />
            </ErrorBoundary>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute>
            <ErrorBoundary>
              <AdminPanel />
            </ErrorBoundary>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function AuthenticatedApp() {
  const { loading, user } = useAuth();

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <GlobalBannerProvider>
      <AccountProvider>
        <ListProvider>
          <ErrorBoundary>
            <Suspense fallback={<DashboardSkeleton />}>
              <AppRoutes />
              <Toaster />
            </Suspense>
          </ErrorBoundary>
        </ListProvider>
      </AccountProvider>
    </GlobalBannerProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;