import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";

// Pages
import AdminDashboardPage from "@/pages/AdminDashboardPage";
import RoutesPage from "@/pages/RoutesPage";
import AccessManagementPage from "@/pages/AccessManagementPage";
import DriverPage from "@/pages/DriverPage";
import RiderPage from "@/pages/RiderPage";
import AccessPage from "@/pages/AccessPage";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      {/* Admin Routes */}
      <Route path="/admin" component={AdminDashboardPage} />
      <Route path="/admin/routes" component={RoutesPage} />
      <Route path="/admin/access" component={AccessManagementPage} />
      <Route path="/admin/settings" component={SettingsPage} />
      
      {/* Driver Routes */}
      <Route path="/driver" component={DriverPage} />
      <Route path="/driver/control" component={DriverPage} />
      
      {/* Rider Routes */}
      <Route path="/track" component={RiderPage} />
      <Route path="/track/routes" component={RiderPage} />
      
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
      <ThemeProvider>
        <TooltipProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1">
                <header className="flex items-center justify-between p-4 border-b">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <ThemeToggle />
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
    </QueryClientProvider>
  );
}