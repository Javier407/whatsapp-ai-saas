import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Shell } from "@/components/layout/Shell";
import { LoginPage } from "@/pages/login/LoginPage";
import { FlowsPage } from "@/pages/flows/FlowsPage";
import { KbPage } from "@/pages/kb/KbPage";
import { ConversationsPage } from "@/pages/conversations/ConversationsPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import { type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Shell>
              <Routes>
                <Route index element={<Navigate to="/flows" replace />} />
                <Route path="flows" element={<FlowsPage />} />
                <Route path="kb" element={<KbPage />} />
                <Route path="conversations" element={<ConversationsPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Routes>
            </Shell>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
