import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { UserProvider, useUser } from "@/contexts/UserContext";

// Generate abbreviation from organization name (up to 3 characters)
function getOrgAbbreviation(orgName: string | undefined): string {
  if (!orgName) return "BB";
  
  const words = orgName.trim().split(/\s+/);
  
  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }
  
  return words.slice(0, 3).map(word => word[0]).join('').toUpperCase() || "BB";
}

// Pages
import AdminDashboardPage from "@/pages/AdminDashboardPage";
import SupportCenterPage from "@/pages/SupportCenterPage";
import SystemAdminDashboard from "@/pages/SystemAdminDashboard";
import SystemInboxPage from "@/pages/SystemInboxPage";
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
import SetNewPasswordPage from "@/pages/SetNewPasswordPage";
import LandingPage from "@/pages/LandingPage";
import AboutPage from "@/pages/AboutPage";
import ContactPage from "@/pages/ContactPage";
import GetStartedPage from "@/pages/GetStartedPage";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      {/* System Admin Routes */}
      <Route path="/system" component={SystemAdminDashboard} />
      <Route path="/system/organizations" component={SystemAdminDashboard} />
      <Route path="/system/inbox" component={SystemInboxPage} />
      
      {/* Admin Routes */}
      <Route path="/admin" component={AdminDashboardPage} />
      <Route path="/admin/routes" component={RoutesPage} />
      <Route path="/admin/access" component={AccessManagementPage} />
      <Route path="/admin/support" component={SupportCenterPage} />
      <Route path="/admin/messages" component={SupportCenterPage} />
      <Route path="/admin/settings" component={SettingsPage} />
      
      {/* Driver Routes - single page experience */}
      <Route path="/driver" component={DriverPage} />
      
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
      <Route path="/set-new-password" component={SetNewPasswordPage} />
      <Route path="/auth/verify" component={LoginPage} />
      <Route path="/auth/invite/:token" component={LoginPage} />
      
      {/* Public Pages */}
      <Route path="/" component={LandingPage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/contact" component={ContactPage} />
      <Route path="/get-started" component={GetStartedPage} />
      
      {/* Fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { user } = useUser();
  const [location] = useLocation();
  
  // Debug logging
  console.log("AppContent DEBUG:", { location, userRole: user?.role });
  
  // Fetch organization data for branding
  const { data: orgSettings } = useQuery({
    queryKey: ["/api/organization"],
    queryFn: async () => {
      const response = await fetch("/api/organization");
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!user, // Only fetch when user is logged in
  });
  
  // Public pages that should not show sidebar/header
  const isPublicPage = location === "/" || location === "/about" || location === "/contact" || location === "/get-started" || location === "/access" || location.startsWith("/login") || location.startsWith("/auth/") || location.startsWith("/forgot-password") || location.startsWith("/reset-password") || location.startsWith("/set-new-password") || location.startsWith("/ride/");
  
  // Rider pages should have minimal UI (no sidebar)
  const isRiderPage = location.startsWith("/rider") || location.startsWith("/track");
  
  // Driver pages should have minimal UI (no sidebar) - single page experience
  const isDriverPage = location.startsWith("/driver");
  
  console.log("AppContent isRiderPage:", isRiderPage, "isDriverPage:", isDriverPage, "isPublicPage:", isPublicPage);
  
  if (isPublicPage) {
    return (
      <main className="w-full h-screen overflow-auto" key={user?.id || 'anonymous'}>
        <Router />
      </main>
    );
  }
  
  // Riders get a simplified layout without sidebar - NO SidebarProvider
  if (isRiderPage) {
    const orgColor = orgSettings?.primaryColor || "#0080FF";
    const orgAbbreviation = getOrgAbbreviation(orgSettings?.name);
    
    return (
      <div className="flex flex-col h-screen w-full bg-background">
        <header className="flex items-center justify-between p-4 border-b bg-background">
          <div className="flex items-center gap-3">
            {orgSettings?.logoUrl ? (
              <img 
                src={orgSettings.logoUrl} 
                alt={orgSettings?.name || "Organization"} 
                className="w-8 h-8 rounded-lg object-cover"
              />
            ) : (
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: orgColor }}
              >
                {orgAbbreviation}
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-bold leading-tight">Bus Buddy</span>
              {orgSettings?.name && (
                <span className="text-xs text-muted-foreground leading-tight">{orgSettings.name}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <UserMenu />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4" key={user?.id || 'anonymous'}>
          <Router />
        </main>
      </div>
    );
  }
  
  // Drivers get a simplified layout without sidebar - single page experience
  if (isDriverPage) {
    const orgColor = orgSettings?.primaryColor || "#0080FF";
    const orgAbbreviation = getOrgAbbreviation(orgSettings?.name);
    
    return (
      <div className="flex flex-col h-screen w-full bg-background">
        <header className="flex items-center justify-between p-4 border-b bg-background">
          <div className="flex items-center gap-3">
            {orgSettings?.logoUrl ? (
              <img 
                src={orgSettings.logoUrl} 
                alt={orgSettings?.name || "Organization"} 
                className="w-8 h-8 rounded-lg object-cover"
              />
            ) : (
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: orgColor }}
              >
                {orgAbbreviation}
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-bold leading-tight">Bus Buddy</span>
              {orgSettings?.name && (
                <span className="text-xs text-muted-foreground leading-tight">{orgSettings.name}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <UserMenu />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4" key={user?.id || 'anonymous'}>
          <Router />
        </main>
      </div>
    );
  }
  
  // Admin pages get the full sidebar layout
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