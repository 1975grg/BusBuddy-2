import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Building, Plus, Users, Activity, Settings } from "lucide-react";
import type { Organization, OrganizationType } from "@shared/schema";

export default function SystemAdminDashboard() {
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgType, setNewOrgType] = useState<OrganizationType>("university");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Fetch all organizations
  const { data: organizations, isLoading } = useQuery({
    queryKey: ["/api/system/organizations"],
    queryFn: async () => {
      const response = await fetch("/api/system/organizations");
      if (!response.ok) throw new Error("Failed to fetch organizations");
      return response.json() as Promise<Organization[]>;
    }
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

  if (isLoading) {
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
                    
                    <Separator />
                    
                    <div className="flex justify-between text-sm">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          localStorage.setItem("selected_org_id", org.id);
                          setLocation("/admin");
                        }}
                        data-testid={`button-manage-${org.id}`}
                      >
                        <Users className="w-3 h-3 mr-1" />
                        Manage
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          localStorage.setItem("selected_org_id", org.id);
                          setLocation("/admin/settings");
                        }}
                        data-testid={`button-settings-${org.id}`}
                      >
                        <Settings className="w-3 h-3 mr-1" />
                        Settings
                      </Button>
                    </div>
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
    </div>
  );
}