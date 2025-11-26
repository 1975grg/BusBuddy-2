import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { UserProvider, useUser } from "@/contexts/UserContext";

// Pages
import AdminDashboardPage from "@/pages/AdminDashboardPage";
import SupportCenterPage from "@/pages/SupportCenterPage";
import SystemAdminDashboard from "@/pages/SystemAdminDashboard";
import RoutesPage from "@/pages/RoutesPage";
import AccessManagementPage from "@/pages/AccessManagementPage";
import DriverPage from "@/pages/DriverPage";
import RiderPage from "@/pages/RiderPage";
import RiderOnboardingPage from "@/pages/RiderOnboardingPage";
import AccessPage from "@/pages/AccessPage";
import SettingsPage from "@/pages/SettingsPage";
import LoginPage from "@/pages/LoginPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import LandingPage from "@/pages/LandingPage";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      {/* System Admin Routes */}
      <Route path="/system" component={SystemAdminDashboard} />
      <Route path="/system/organizations" component={SystemAdminDashboard} />
      
      {/* Admin Routes */}
      <Route path="/admin" component={AdminDashboardPage} />
      <Route path="/admin/routes" component={RoutesPage} />
      <Route path="/admin/access" component={AccessManagementPage} />
      <Route path="/admin/support" component={SupportCenterPage} />
      <Route path="/admin/messages" component={SupportCenterPage} />
      <Route path="/admin/settings" component={SettingsPage} />
      
      {/* Driver Routes */}
      <Route path="/driver" component={DriverPage} />
      <Route path="/driver/control" component={DriverPage} />
      
      {/* Rider Routes */}
      <Route path="/rider" component={RiderPage} />
      <Route path="/track" component={RiderPage} />
      <Route path="/track/routes" component={RiderPage} />
      
      {/* Public Rider Onboarding (QR Code Access) */}
      <Route path="/ride/:organizationId/:routeId" component={RiderOnboardingPage} />
      <Route path="/access" component={AccessPage} />
      
      {/* Authentication */}
      <Route path="/login" component={LoginPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/auth/verify" component={LoginPage} />
      <Route path="/auth/invite/:token" component={LoginPage} />
      
      {/* Landing Page */}
      <Route path="/" component={LandingPage} />
      
      {/* Fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { user } = useUser();
  const [location] = useLocation();
  
  // Public pages that should not show sidebar/header
  const isPublicPage = location === "/" || location === "/access" || location.startsWith("/login") || location.startsWith("/auth/") || location.startsWith("/forgot-password") || location.startsWith("/reset-password") || location.startsWith("/ride/");
  
  // Rider pages should have minimal UI (no sidebar)
  const isRiderPage = location.startsWith("/rider") || location.startsWith("/track");
  
  if (isPublicPage) {
    return (
      <main className="w-full h-screen overflow-auto" key={user?.id || 'anonymous'}>
        <Router />
      </main>
    );
  }
  
  // Riders get a simplified layout without sidebar - NO SidebarProvider
  if (isRiderPage) {
    return (
      <div className="flex flex-col h-screen w-full bg-background">
        <header className="flex items-center justify-between p-4 border-b bg-background">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white text-xs font-bold">
              BB
            </div>
            <span className="font-bold">Bus Buddy</span>
          </div>
          <div className="flex items-center gap-2">
            <UserMenu />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-auto" key={user?.id || 'anonymous'}>
          <Router />
        </main>
      </div>
    );
  }
  
  // Admin/Driver pages get the full sidebar layout
  const sidebarStyle = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };
  
  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              <UserMenu />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6" key={user?.id || 'anonymous'}>
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <ThemeProvider>
          <TooltipProvider>
            <AppContent />
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </UserProvider>
    </QueryClientProvider>
  );
}