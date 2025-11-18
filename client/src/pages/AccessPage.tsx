import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AccessLogin } from "@/components/AccessLogin";
import { useUser } from "@/contexts/UserContext";
import RiderPage from "./RiderPage";

export default function AccessPage() {
  const [hasAccess, setHasAccess] = useState(false);
  const { user, isLoading } = useUser();
  const [, setLocation] = useLocation();

  // Redirect authenticated org_admin users to their dashboard
  useEffect(() => {
    if (!isLoading && user?.role === "org_admin") {
      setLocation("/admin");
    }
  }, [user, isLoading, setLocation]);

  const handleAccessGranted = (method: string, value: string) => {
    console.log("Access granted via", method, "with value:", value);
    setHasAccess(true);
  };

  // Show loading while checking authentication
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  // Don't show AccessLogin to org_admin users (they'll be redirected)
  if (user?.role === "org_admin") {
    return null;
  }

  if (hasAccess) {
    return <RiderPage />;
  }

  return <AccessLogin onAccessGranted={handleAccessGranted} />;
}