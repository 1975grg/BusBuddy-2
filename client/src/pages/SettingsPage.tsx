import { useState, useEffect } from "react";
import { LogoUpload } from "@/components/LogoUpload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Building, Palette, Shield, Save } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const [orgLogo, setOrgLogo] = useState<string>("");
  const [orgName, setOrgName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0080FF");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch current organization
  const { data: organization, isLoading } = useQuery({
    queryKey: ["/api/organization"],
    queryFn: async () => {
      const response = await fetch("/api/organization");
      if (!response.ok) throw new Error("Failed to fetch organization");
      return response.json();
    }
  });

  // Update local state when organization loads
  useEffect(() => {
    if (organization) {
      setOrgName(organization.name || "");
      setOrgLogo(organization.logoUrl || "");
      setPrimaryColor(organization.primaryColor || "#0080FF");
    }
  }, [organization]);
  
  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: { name: string; logoUrl: string; primaryColor: string }) => {
      if (!organization?.id) throw new Error("Organization ID not found");
      
      const response = await fetch(`/api/organization/${organization.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error("Failed to save settings");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization"] });
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
      logoUrl: orgLogo,
      primaryColor
    });
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
                    <img src={orgLogo} alt="Organization logo" className="w-8 h-8 object-contain" />
                  ) : (
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {orgName.split(' ').map(word => word[0]).join('').slice(0, 2)}
                    </div>
                  )}
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
        </div>
      </div>

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