import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useRequireRole } from "@/contexts/UserContext";
import { Building, Plus, Users, Activity, Settings, UserPlus, Copy, Check, Eye, EyeOff, Mail, Send } from "lucide-react";
import type { Organization, OrganizationType, User } from "@shared/schema";

function generateTempPassword(): string {
  const adjectives = ["Happy", "Swift", "Bright", "Cool", "Smart"];
  const nouns = ["Bus", "Route", "Trip", "Rider", "Driver"];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 900) + 100;
  return `${adjective}${noun}${number}!`;
}

interface OrgWithAdmin extends Organization {
  admin?: User | null;
}

export default function SystemAdminDashboard() {
  const { user, isLoading: authLoading } = useRequireRole("system_admin");
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgType, setNewOrgType] = useState<OrganizationType>("university");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [createAdminDialog, setCreateAdminDialog] = useState<{ open: boolean; org: Organization | null }>({ open: false, org: null });
  const [newAdminForm, setNewAdminForm] = useState({ name: "", email: "" });
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [showPassword, setShowPassword] = useState(true);
  const [copied, setCopied] = useState(false);
  const [successDialog, setSuccessDialog] = useState<{ open: boolean; email: string; password: string; orgName: string }>({ open: false, email: "", password: "", orgName: "" });
  const [viewOrgDialog, setViewOrgDialog] = useState<{ open: boolean; org: OrgWithAdmin | null }>({ open: false, org: null });

  // ALL HOOKS MUST BE BEFORE EARLY RETURNS
  // Fetch all organizations with their admins
  const { data: organizations, isLoading } = useQuery({
    queryKey: ["/api/system/organizations"],
    queryFn: async () => {
      const response = await fetch("/api/system/organizations?includeAdmins=true");
      if (!response.ok) throw new Error("Failed to fetch organizations");
      return response.json() as Promise<OrgWithAdmin[]>;
    },
    enabled: !authLoading,
  });

  // Create organization mutation
  const createOrgMutation = useMutation({
    mutationFn: async (data: { name: string; type: OrganizationType }) => {
      const response = await fetch("/api/system/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error("Failed to create organization");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system/organizations"] });
      setNewOrgName("");
      setNewOrgType("university");
      setIsDialogOpen(false);
      toast({
        title: "Organization created",
        description: "New organization has been added successfully"
      });
    },
    onError: () => {
      toast({
        title: "Creation failed",
        description: "There was an error creating the organization. Please try again.",
        variant: "destructive"
      });
    }
  });

  const createAdminMutation = useMutation({
    mutationFn: async (data: { organizationId: string; name: string; email: string; password: string }) => {
      const response = await fetch("/api/system/organizations/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create admin");
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/system/organizations"] });
      setSuccessDialog({ 
        open: true, 
        email: variables.email, 
        password: variables.password,
        orgName: createAdminDialog.org?.name || ""
      });
      setCreateAdminDialog({ open: false, org: null });
      setNewAdminForm({ name: "", email: "" });
      setGeneratedPassword("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create admin",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const openCreateAdminDialog = (org: Organization) => {
    const password = generateTempPassword();
    setGeneratedPassword(password);
    setNewAdminForm({ name: "", email: "" });
    setShowPassword(true);
    setCopied(false);
    setCreateAdminDialog({ open: true, org });
  };

  const handleCreateAdmin = () => {
    if (!createAdminDialog.org || !newAdminForm.name.trim() || !newAdminForm.email.trim()) return;
    
    createAdminMutation.mutate({
      organizationId: createAdminDialog.org.id,
      name: newAdminForm.name.trim(),
      email: newAdminForm.email.trim().toLowerCase(),
      password: generatedPassword
    });
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(successDialog.password || generatedPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateOrganization = () => {
    if (!newOrgName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter an organization name",
        variant: "destructive"
      });
      return;
    }
    
    createOrgMutation.mutate({
      name: newOrgName.trim(),
      type: newOrgType
    });
  };

  const getOrgTypeLabel = (type: OrganizationType) => {
    const labels = {
      university: "University",
      school: "School",
      hospital: "Hospital", 
      airport: "Airport",
      hotel: "Hotel"
    };
    return labels[type];
  };

  const getOrgTypeColor = (type: OrganizationType) => {
    const colors: Record<OrganizationType, string> = {
      university: "bg-blue-100 text-blue-800",
      school: "bg-green-100 text-green-800",
      hospital: "bg-red-100 text-red-800",
      airport: "bg-purple-100 text-purple-800", 
      hotel: "bg-orange-100 text-orange-800"
    };
    return colors[type];
  };

  // Early returns AFTER all hooks
  if (authLoading || isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">System Administration</h1>
          <p className="text-muted-foreground">Manage organizations and system-wide settings</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">System Administration</h1>
          <p className="text-muted-foreground">Manage organizations and system-wide settings</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-organization">
              <Plus className="w-4 h-4 mr-2" />
              Add Organization
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Organization</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="org-name">Organization Name</Label>
                <Input
                  id="org-name"
                  placeholder="e.g., Springfield University"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  data-testid="input-org-name"
                />
              </div>
              
              <div>
                <Label htmlFor="org-type">Organization Type</Label>
                <Select value={newOrgType} onValueChange={(value) => setNewOrgType(value as OrganizationType)}>
                  <SelectTrigger data-testid="select-org-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="university">University</SelectItem>
                    <SelectItem value="school">School</SelectItem>
                    <SelectItem value="hospital">Hospital</SelectItem>
                    <SelectItem value="airport">Airport</SelectItem>
                    <SelectItem value="hotel">Hotel</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <p className="text-sm text-muted-foreground">
                Organizations start with minimal setup. Administrators can customize branding, routes, and users after creation.
              </p>
              
              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateOrganization}
                  disabled={createOrgMutation.isPending}
                  data-testid="button-create-org"
                >
                  {createOrgMutation.isPending ? "Creating..." : "Create Organization"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Organizations Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-orgs">{organizations?.length || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Organizations</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-orgs">
              {organizations?.filter(org => org.isActive).length || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Universities</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-universities">
              {organizations?.filter(org => org.type === "university").length || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Other Types</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-other-types">
              {organizations?.filter(org => org.type !== "university").length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Organizations Grid */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Organizations</h2>
        {organizations && organizations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {organizations.map((org) => (
              <Card key={org.id} className="hover-elevate" data-testid={`card-org-${org.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{org.name}</CardTitle>
                    <Badge className={getOrgTypeColor(org.type)}>
                      {getOrgTypeLabel(org.type)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: org.primaryColor }}
                        />
                        <span className="text-sm text-muted-foreground">
                          {org.primaryColor}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Created {org.createdAt ? new Date(org.createdAt).toLocaleDateString() : "Unknown"}
                      </span>
                      <Badge variant={org.isActive ? "default" : "secondary"}>
                        {org.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    {org.admin ? (
                      <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-md p-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{org.admin.name}</p>
                          <p className="text-xs text-muted-foreground">{org.admin.email}</p>
                        </div>
                      </div>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => openCreateAdminDialog(org)}
                        data-testid={`button-create-admin-${org.id}`}
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Create First Admin
                      </Button>
                    )}
                    
                    <Separator />
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="w-full"
                      onClick={() => setViewOrgDialog({ open: true, org })}
                      data-testid={`button-view-details-${org.id}`}
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No organizations yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first organization to get started with Bus Buddy
              </p>
              <Button onClick={() => setIsDialogOpen(true)} data-testid="button-create-first-org">
                <Plus className="w-4 h-4 mr-2" />
                Create Organization
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={createAdminDialog.open} onOpenChange={(open) => {
        if (!open) setCreateAdminDialog({ open: false, org: null });
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Organization Admin</DialogTitle>
            <DialogDescription>
              Create the first administrator for {createAdminDialog.org?.name}. They will receive a temporary password and be required to set a new one on first login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="admin-name">Admin Name</Label>
              <Input
                id="admin-name"
                placeholder="Full name"
                value={newAdminForm.name}
                onChange={(e) => setNewAdminForm({ ...newAdminForm, name: e.target.value })}
                data-testid="input-new-admin-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="admin@organization.com"
                  className="pl-10"
                  value={newAdminForm.email}
                  onChange={(e) => setNewAdminForm({ ...newAdminForm, email: e.target.value })}
                  data-testid="input-new-admin-email"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Temporary Password</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={generatedPassword}
                    readOnly
                    className="pr-10 font-mono"
                    data-testid="input-temp-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedPassword);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  data-testid="button-copy-password"
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                This password will be required on first login. The admin will be prompted to create a new password.
              </p>
            </div>
            <div className="p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <Send className="w-4 h-4" />
                <span className="font-medium">Magic Link</span>
                <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
              </p>
              <p className="mt-1 text-xs">Email magic links will be available once SendGrid is configured.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateAdminDialog({ open: false, org: null })}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateAdmin}
              disabled={!newAdminForm.name.trim() || !newAdminForm.email.trim() || createAdminMutation.isPending}
              data-testid="button-confirm-create-admin"
            >
              {createAdminMutation.isPending ? "Creating..." : "Create Admin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={successDialog.open} onOpenChange={(open) => {
        if (!open) setSuccessDialog({ open: false, email: "", password: "", orgName: "" });
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" />
              Admin Created Successfully
            </DialogTitle>
            <DialogDescription>
              The administrator account for {successDialog.orgName} has been created.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{successDialog.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Temporary Password</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-muted px-3 py-2 rounded-md font-mono text-sm">
                      {successDialog.password}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={copyPassword}
                      data-testid="button-copy-success-password"
                    >
                      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            <p className="text-sm text-muted-foreground">
              Share these credentials with the organization admin. They will be required to set a new password on their first login.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setSuccessDialog({ open: false, email: "", password: "", orgName: "" })}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOrgDialog.open} onOpenChange={(open) => {
        if (!open) setViewOrgDialog({ open: false, org: null });
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="w-5 h-5" />
              {viewOrgDialog.org?.name}
            </DialogTitle>
            <DialogDescription>
              Organization details and statistics
            </DialogDescription>
          </DialogHeader>
          {viewOrgDialog.org && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium capitalize">{viewOrgDialog.org.type.replace("_", " ")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={viewOrgDialog.org.isActive ? "default" : "secondary"}>
                    {viewOrgDialog.org.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">{viewOrgDialog.org.createdAt ? new Date(viewOrgDialog.org.createdAt).toLocaleDateString() : "Unknown"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Primary Color</p>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded-full border"
                      style={{ backgroundColor: viewOrgDialog.org.primaryColor }}
                    />
                    <span className="text-sm">{viewOrgDialog.org.primaryColor}</span>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <p className="text-sm font-medium mb-2">Administrator</p>
                {viewOrgDialog.org.admin ? (
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{viewOrgDialog.org.admin.name}</p>
                          <p className="text-sm text-muted-foreground">{viewOrgDialog.org.admin.email}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="pt-4 text-center text-muted-foreground">
                      <p>No administrator assigned</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2"
                        onClick={() => {
                          setViewOrgDialog({ open: false, org: null });
                          openCreateAdminDialog(viewOrgDialog.org!);
                        }}
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Create Admin
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
              
              <Separator />
              
              <div className="text-sm text-muted-foreground">
                <p>More details like routes, drivers, and riders count will be available in a future update.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOrgDialog({ open: false, org: null })}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}