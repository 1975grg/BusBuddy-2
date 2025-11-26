import { useEffect } from "react";
import { useLocation } from "wouter";
import { AccessLogin } from "@/components/AccessLogin";
import { useUser } from "@/contexts/UserContext";
import RiderPage from "./RiderPage";

export default function AccessPage() {
  const { user, isLoading } = useUser();
  const [, setLocation] = useLocation();

  // Redirect authenticated users to their appropriate dashboard
  useEffect(() => {
    if (!isLoading && user) {
      if (user.role === "org_admin") {
        setLocation("/admin");
      } else if (user.role === "driver") {
        setLocation("/driver");
      }
      // Riders stay on this page and see RiderPage directly
    }
  }, [user, isLoading, setLocation]);

  // Show loading while checking authentication
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  // If user is already logged in as a rider, show RiderPage directly
  // This ensures riders stay logged in without having to re-authenticate
  if (user?.role === "rider") {
    return <RiderPage />;
  }

  // Don't show AccessLogin to users being redirected
  if (user?.role === "org_admin" || user?.role === "driver") {
    return null;
  }

  // Show login for unauthenticated users - redirect to proper login page
  return <AccessLogin />;
}