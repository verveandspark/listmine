import { Suspense, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContextProvider";
import { ListProvider } from "./contexts/ListContext";
import { useAuth } from "./contexts/useAuthHook";
import { Toaster } from "./components/ui/toaster";
import AuthPage from "./components/auth/AuthPage";
import Dashboard from "./components/dashboard/Dashboard";
import ListDetail from "./components/list/ListDetail";
import ImportExport from "./components/import-export/ImportExport";
import Profile from "./components/profile/Profile";
import Upgrade from "./components/upgrade/Upgrade";
import Templates from "./components/templates/Templates";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
}

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <AuthPage />
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/templates"
        element={
          <ProtectedRoute>
            <Templates />
          </ProtectedRoute>
        }
      />
      <Route
        path="/list/:id"
        element={
          <ProtectedRoute>
            <ListDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/import-export"
        element={
          <ProtectedRoute>
            <ImportExport />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/upgrade"
        element={
          <ProtectedRoute>
            <Upgrade />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <ListProvider>
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-gray-600">Loading...</p>
              </div>
            </div>
          }
        >
          <AppRoutes />
          <Toaster />
        </Suspense>
      </ListProvider>
    </AuthProvider>
  );
}

export default App;
