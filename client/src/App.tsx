import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { UserProvider } from "@/contexts/UserContext";

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
      
      {/* Authentication */}
      <Route path="/login" component={LoginPage} />
      <Route path="/auth/verify" component={LoginPage} />
      <Route path="/auth/invite/:token" component={LoginPage} />
      
      {/* Public Access */}
      <Route path="/" component={AccessPage} />
      
      {/* Fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <ThemeProvider>
          <TooltipProvider>
            <SidebarProvider style={style as React.CSSProperties}>
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
                  <main className="flex-1 overflow-auto p-6">
                    <Router />
                  </main>
                </div>
              </div>
            </SidebarProvider>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </UserProvider>
    </QueryClientProvider>
  );
}