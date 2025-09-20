import { useState } from "react";
import { AccessLogin } from "@/components/AccessLogin";
import RiderPage from "./RiderPage";

export default function AccessPage() {
  const [hasAccess, setHasAccess] = useState(false);

  const handleAccessGranted = (method: string, value: string) => {
    // TODO: remove mock functionality - replace with real authentication
    console.log("Access granted via", method, "with value:", value);
    setHasAccess(true);
  };

  if (hasAccess) {
    return <RiderPage />;
  }

  return <AccessLogin onAccessGranted={handleAccessGranted} />;
}