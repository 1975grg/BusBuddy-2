import { useState, useEffect } from "react";
import { LogoUpload } from "@/components/LogoUpload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building, Palette, Shield, Save, MessageSquareOff, MessageSquare } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useRequireRole } from "@/contexts/UserContext";
import { apiFetch, apiRequest } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { OrganizationType } from "@shared/schema";

export default function SettingsPage() {
  const { user, isLoading: authLoading } = useRequireRole("org_admin");

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }
  const [orgLogo, setOrgLogo] = useState<string>("");
  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState<OrganizationType>("school");
  const [primaryColor, setPrimaryColor] = useState("#0080FF");
  const [showMessagingConfirm, setShowMessagingConfirm] = useState(false);
  const [pendingMessagingState, setPendingMessagingState] = useState<boolean | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch current organization
  const { data: organization, isLoading } = useQuery({
    queryKey: ["/api/organization"],
    queryFn: async () => {
      const response = await apiFetch("/api/organization");
      if (!response.ok) throw new Error("Failed to fetch organization");
      return response.json();
    }
  });

  // Fetch organization settings (messaging toggle)
  const { data: orgSettings } = useQuery<{ messagingEnabled: boolean }>({
    queryKey: ["/api/organization-settings"],
    queryFn: async () => {
      const response = await apiFetch("/api/organization-settings");
      if (!response.ok) throw new Error("Failed to fetch settings");
      return response.json();
    }
  });

  // Toggle messaging mutation
  const toggleMessagingMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return await apiRequest("PATCH", "/api/organization-settings/messaging", { enabled });
    },
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization-settings"] });
      toast({
        title: enabled ? "Communications enabled" : "Communications disabled",
        description: enabled 
          ? "All messaging and notifications are now active" 
          : "All messaging and notifications are now disabled for regulatory compliance"
      });
    },
    onError: () => {
      toast({
        title: "Failed to update messaging settings",
        variant: "destructive"
      });
    }
  });

  // Update local state when organization loads
  useEffect(() => {
    if (organization) {
      setOrgName(organization.name || "");
      setOrgLogo(organization.logoUrl || "");
      setOrgType(organization.type || "school");
      setPrimaryColor(organization.primaryColor || "#0080FF");
    }
  }, [organization]);
  
  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: { name: string; type: OrganizationType; logoUrl: string; primaryColor: string }) => {
      if (!organization?.id) throw new Error("Organization ID not found");
      
      const response = await apiRequest("PUT", `/api/organization/${organization.id}`, data);
      if (!response.ok) throw new Error("Failed to save settings");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization"] });
      queryClient.invalidateQueries({ queryKey: ["/api/system/organizations"] });
      toast({
        title: "Settings saved",
        description: "Organization settings have been updated successfully"
      });
    },
    onError: () => {
      toast({
        title: "Save failed",
        description: "There was an error saving your settings. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  const handleSaveSettings = () => {
    saveSettingsMutation.mutate({
      name: orgName,
      type: orgType,
      logoUrl: orgLogo,
      primaryColor
    });
  };

  const getOrgTypeLabel = (type: OrganizationType) => {
    const labels: Record<OrganizationType, string> = {
      university: "University",
      school: "School",
      hospital: "Hospital",
      airport: "Airport",
      hotel: "Hotel"
    };
    return labels[type];
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Organization Settings</h1>
        <p className="text-muted-foreground">Customize Bus Buddy for your organization</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <LogoUpload
            currentLogo={orgLogo}
            organizationName={orgName}
            onLogoUpdate={setOrgLogo}
          />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="w-5 h-5" />
                Organization Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="org-name">Organization Name</Label>
                <Input
                  id="org-name"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Enter organization name"
                  data-testid="input-org-name"
                />
              </div>
              
              <div>
                <Label htmlFor="org-type">Organization Type</Label>
                <Select value={orgType} onValueChange={(value) => setOrgType(value as OrganizationType)}>
                  <SelectTrigger id="org-type" data-testid="select-org-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="school">School</SelectItem>
                    <SelectItem value="university">University</SelectItem>
                    <SelectItem value="hospital">Hospital</SelectItem>
                    <SelectItem value="airport">Airport</SelectItem>
                    <SelectItem value="hotel">Hotel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="primary-color">Primary Brand Color</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="primary-color"
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-20 h-10"
                    data-testid="input-primary-color"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#0080FF"
                    className="flex-1"
                    data-testid="input-color-hex"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Branding Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border rounded-lg" style={{ borderColor: primaryColor + "40" }}>
                <div className="flex items-center gap-3 mb-4">
                  {orgLogo ? (
                    <img 
                      src={orgLogo} 
                      alt="Organization logo" 
                      className="w-8 h-8 object-contain" 
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div 
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold ${orgLogo ? 'hidden' : ''}`}
                    style={{ backgroundColor: primaryColor }}
                  >
                    {(() => {
                      const words = orgName.trim().split(/\s+/);
                      if (words.length === 1) {
                        return words[0].slice(0, 3).toUpperCase();
                      }
                      return words.slice(0, 3).map(word => word[0]).join('').toUpperCase();
                    })()}
                  </div>
                  <div>
                    <p className="font-bold">Bus Buddy</p>
                    <p className="text-sm text-muted-foreground">{orgName}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: primaryColor }}
                    />
                    <span className="text-sm">Sample notification badge</span>
                  </div>
                  <Badge style={{ backgroundColor: primaryColor }} className="text-white">
                    Route Active
                  </Badge>
                </div>
              </div>
              
              <div className="text-xs text-muted-foreground">
                This preview shows how your branding will appear to users throughout the app.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Access Tokens</p>
                  <p className="text-sm text-muted-foreground">Active device sessions</p>
                </div>
                <Badge variant="outline">67 Active</Badge>
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">QR Code Validity</p>
                  <p className="text-sm text-muted-foreground">How long QR codes remain valid</p>
                </div>
                <Badge variant="secondary">30 Days</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {orgSettings?.messagingEnabled !== false ? (
                  <MessageSquare className="w-5 h-5" />
                ) : (
                  <MessageSquareOff className="w-5 h-5 text-destructive" />
                )}
                Communications Compliance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 pr-4">
                  <p className="font-medium">Enable All Communications</p>
                  <p className="text-sm text-muted-foreground">
                    When disabled, all messaging and notifications between riders, drivers, and administrators will be blocked for regulatory compliance.
                  </p>
                </div>
                <Switch
                  checked={orgSettings?.messagingEnabled !== false}
                  onCheckedChange={(checked) => {
                    setPendingMessagingState(checked);
                    setShowMessagingConfirm(true);
                  }}
                  disabled={toggleMessagingMutation.isPending}
                  data-testid="switch-messaging-enabled"
                />
              </div>
              
              {orgSettings?.messagingEnabled === false && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive font-medium">
                    Communications are currently disabled
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    No messages, alerts, or push notifications will be sent until enabled.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={showMessagingConfirm} onOpenChange={setShowMessagingConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingMessagingState ? "Enable Communications?" : "Disable All Communications?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingMessagingState 
                ? "This will allow messaging and notifications between all users (riders, drivers, administrators)."
                : "This will block ALL communications including messages between riders and admins, drivers and admins, push notifications, and service alerts. Use this for regulatory compliance if your organization cannot use messaging features."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingMessagingState(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingMessagingState !== null) {
                  toggleMessagingMutation.mutate(pendingMessagingState);
                }
                setShowMessagingConfirm(false);
                setPendingMessagingState(null);
              }}
              className={!pendingMessagingState ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {pendingMessagingState ? "Enable Communications" : "Disable Communications"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex justify-end">
        <Button 
          onClick={handleSaveSettings} 
          disabled={saveSettingsMutation.isPending || isLoading}
          data-testid="button-save-settings"
        >
          <Save className="w-4 h-4 mr-2" />
          {saveSettingsMutation.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}