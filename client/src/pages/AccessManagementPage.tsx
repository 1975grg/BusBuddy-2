import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AccessCodeGenerator } from "@/components/AccessCodeGenerator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, Shield, Trash2, RotateCcw, Bus, UserX, Car, Search, Filter, CalendarClock, Plus, UserCog, Mail, Phone, Key, Edit, Eye, EyeOff } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useRequireRole } from "@/contexts/UserContext";
import { apiRequest, apiFetch } from "@/lib/queryClient";
import type { Route, RiderProfile, User, UserRouteAssignment } from "@shared/schema";

interface RiderWithSubscription extends RiderProfile {
  subscriptionId: string;
  notificationMode: string;
}

interface StaffMember extends User {
  routeAssignments: UserRouteAssignment[];
}

interface RemovalDialogState {
  open: boolean;
  type: "rider" | "driver" | "admin" | null;
  id: string | null;
  name: string | null;
}

interface EditDialogState {
  open: boolean;
  staffMember: StaffMember | null;
}

export default function AccessManagementPage() {
  const { user, isLoading: authLoading, viewingOrgId } = useRequireRole("org_admin");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Determine if system admin is viewing an org (read-only mode)
  const isSystemAdminViewing = user?.role === 'system_admin' && viewingOrgId;
  const effectiveOrgId = viewingOrgId || user?.organizationId;
  
  const handleBackToSystem = () => {
    setLocation('/system');
  };

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  const { data: routes = [], isLoading } = useQuery<Route[]>({
    queryKey: ["/api/routes", effectiveOrgId],
    queryFn: async () => {
      const url = effectiveOrgId ? `/api/routes?organizationId=${effectiveOrgId}` : "/api/routes";
      const response = await apiFetch(url);
      if (!response.ok) throw new Error("Failed to fetch routes");
      return response.json();
    },
  });

  const activeRoutes = routes
    .filter(route => route.status === "active" && !route.archivedAt)
    .sort((a, b) => a.name.localeCompare(b.name));
  
  const [selectedRoute, setSelectedRoute] = useState<string>("");
  const [riderSearch, setRiderSearch] = useState("");
  const [notificationFilter, setNotificationFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "joined">("name");
  const [removalDialog, setRemovalDialog] = useState<RemovalDialogState>({
    open: false,
    type: null,
    id: null,
    name: null,
  });
  const [renewalDialog, setRenewalDialog] = useState(false);
  const [addDriverDialog, setAddDriverDialog] = useState(false);
  const [addAdminDialog, setAddAdminDialog] = useState(false);
  const [editDialog, setEditDialog] = useState<EditDialogState>({
    open: false,
    staffMember: null,
  });
  
  const [newDriverForm, setNewDriverForm] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
    routeId: "",
  });
  const [showDriverPassword, setShowDriverPassword] = useState(false);
  
  const [newAdminForm, setNewAdminForm] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
  });
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  
  const [editForm, setEditForm] = useState({
    name: "",
    phoneNumber: "",
    routeId: "",
  });
  
  useEffect(() => {
    if (!selectedRoute && activeRoutes.length > 0) {
      setSelectedRoute(activeRoutes[0].id);
    }
  }, [selectedRoute, activeRoutes]);
  
  const { data: orgSettings } = useQuery({
    queryKey: ["/api/org-settings", effectiveOrgId],
    queryFn: async () => {
      const url = effectiveOrgId 
        ? `/api/org-settings?organizationId=${effectiveOrgId}`
        : "/api/org-settings";
      const response = await apiFetch(url);
      if (!response.ok) throw new Error("Failed to fetch settings");
      return response.json();
    }
  });

  const { data: riders = [], isLoading: ridersLoading } = useQuery<RiderWithSubscription[]>({
    queryKey: ["/api/routes", selectedRoute, "riders", effectiveOrgId],
    queryFn: async () => {
      const url = `/api/routes/${selectedRoute}/riders${effectiveOrgId ? `?organizationId=${effectiveOrgId}` : ''}`;
      const response = await apiFetch(url);
      if (!response.ok) throw new Error("Failed to fetch riders");
      return response.json();
    },
    enabled: !!selectedRoute && !!effectiveOrgId,
  });

  const { data: staff = [], isLoading: staffLoading } = useQuery<StaffMember[]>({
    queryKey: ["/api/staff", effectiveOrgId],
    queryFn: async () => {
      const url = effectiveOrgId 
        ? `/api/staff?organizationId=${effectiveOrgId}`
        : "/api/staff";
      const response = await apiFetch(url);
      if (!response.ok) throw new Error("Failed to fetch staff");
      return response.json();
    },
    enabled: !!effectiveOrgId,
    refetchInterval: 15000, // Refresh every 15 seconds to pick up driver route changes
  });

  const drivers = staff.filter(s => s.role === "driver" && s.isActive);
  const admins = staff.filter(s => s.role === "org_admin" && s.isActive);

  const filteredRiders = riders
    .filter(rider => {
      const searchLower = riderSearch.toLowerCase();
      const matchesSearch = !riderSearch || 
        rider.name?.toLowerCase().includes(searchLower) ||
        rider.phoneNumber?.toLowerCase().includes(searchLower);
      const matchesNotification = notificationFilter === "all" || 
        rider.notificationMode === notificationFilter;
      return matchesSearch && matchesNotification;
    })
    .sort((a, b) => {
      if (sortBy === "name") {
        return (a.name || "").localeCompare(b.name || "");
      } else {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      }
    });

  const removeRiderMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (isSystemAdminViewing) throw new Error("Read-only mode");
      return await apiRequest("DELETE", `/api/routes/${selectedRoute}/riders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes", selectedRoute, "riders", effectiveOrgId] });
      setRemovalDialog({ open: false, type: null, id: null, name: null });
      toast({ title: "Rider removed", description: "Rider access has been revoked." });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove rider.",
        variant: "destructive",
      });
    },
  });

  const removeStaffMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (isSystemAdminViewing) throw new Error("Read-only mode");
      return await apiRequest("DELETE", `/api/staff/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff", effectiveOrgId] });
      setRemovalDialog({ open: false, type: null, id: null, name: null });
      toast({ title: "Staff removed", description: "Staff member has been deactivated." });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove staff member.",
        variant: "destructive",
      });
    },
  });

  const addDriverMutation = useMutation({
    mutationFn: async (data: typeof newDriverForm) => {
      if (isSystemAdminViewing) throw new Error("Read-only mode");
      const response = await apiRequest("POST", "/api/staff", {
        name: data.name,
        email: data.email,
        phoneNumber: data.phoneNumber,
        password: data.password,
        role: "driver",
        routeId: data.routeId && data.routeId !== "none" ? data.routeId : undefined,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff", effectiveOrgId] });
      setAddDriverDialog(false);
      setNewDriverForm({ name: "", email: "", phoneNumber: "", password: "", confirmPassword: "", routeId: "" });
      setShowDriverPassword(false);
      toast({ title: "Driver added", description: "New driver account created successfully." });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create driver account.",
        variant: "destructive",
      });
    },
  });

  const addAdminMutation = useMutation({
    mutationFn: async (data: typeof newAdminForm) => {
      if (isSystemAdminViewing) throw new Error("Read-only mode");
      const response = await apiRequest("POST", "/api/staff", {
        name: data.name,
        email: data.email,
        phoneNumber: data.phoneNumber,
        password: data.password,
        role: "org_admin",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff", effectiveOrgId] });
      setAddAdminDialog(false);
      setNewAdminForm({ name: "", email: "", phoneNumber: "", password: "", confirmPassword: "" });
      setShowAdminPassword(false);
      toast({ title: "Admin added", description: "New admin account created successfully." });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create admin account.",
        variant: "destructive",
      });
    },
  });

  const updateStaffMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof editForm }) => {
      if (isSystemAdminViewing) throw new Error("Read-only mode");
      const response = await apiRequest("PATCH", `/api/staff/${id}`, {
        name: data.name,
        phoneNumber: data.phoneNumber || null,
        routeId: data.routeId && data.routeId !== "none" ? data.routeId : null,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff", effectiveOrgId] });
      setEditDialog({ open: false, staffMember: null });
      toast({ title: "Staff updated", description: "Staff member has been updated successfully." });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update staff member.",
        variant: "destructive",
      });
    },
  });

  const renewPasswordsMutation = useMutation({
    mutationFn: async () => {
      if (isSystemAdminViewing) throw new Error("Read-only mode");
      if (!effectiveOrgId) {
        throw new Error("Organization ID not found");
      }
      const response = await apiRequest("POST", "/api/users/renew-all-rider-passwords", {
        organizationId: effectiveOrgId
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes", effectiveOrgId] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", effectiveOrgId] });
      toast({
        title: "Passwords Renewed",
        description: data.message || `Successfully renewed passwords for ${data.renewedCount} rider(s).`,
      });
      setRenewalDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to renew passwords.",
        variant: "destructive",
      });
    },
  });

  const handleRemove = () => {
    if (!removalDialog.id) return;
    
    if (removalDialog.type === "rider") {
      removeRiderMutation.mutate({ id: removalDialog.id });
    } else {
      removeStaffMutation.mutate({ id: removalDialog.id });
    }
  };

  const getRouteName = (routeId: string) => {
    const route = routes.find(r => r.id === routeId);
    return route?.name || "Unassigned";
  };

  const openEditDialog = (staffMember: StaffMember) => {
    // Find the default route assignment, or fall back to first assignment
    const defaultAssignment = staffMember.routeAssignments.find(a => a.isDefault) || staffMember.routeAssignments[0];
    setEditForm({
      name: staffMember.name || "",
      phoneNumber: staffMember.phoneNumber || "",
      routeId: defaultAssignment?.routeId || "",
    });
    setEditDialog({ open: true, staffMember });
  };

  const passwordsMatch = (password: string, confirmPassword: string) => {
    return password === confirmPassword;
  };

  const canSubmitDriver = () => {
    return (
      newDriverForm.name.trim() !== "" &&
      newDriverForm.email.trim() !== "" &&
      newDriverForm.password.length >= 6 &&
      passwordsMatch(newDriverForm.password, newDriverForm.confirmPassword) &&
      !addDriverMutation.isPending
    );
  };

  const canSubmitAdmin = () => {
    return (
      newAdminForm.name.trim() !== "" &&
      newAdminForm.email.trim() !== "" &&
      newAdminForm.password.length >= 6 &&
      passwordsMatch(newAdminForm.password, newAdminForm.confirmPassword) &&
      !addAdminMutation.isPending
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isSystemAdminViewing && (
        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-blue-800 dark:text-blue-200">
              Viewing <strong>{orgSettings?.name || 'Organization'}</strong> access as System Administrator (read-only)
            </span>
            <button 
              onClick={handleBackToSystem}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              data-testid="button-back-to-system"
            >
              Back to System Dashboard
            </button>
          </AlertDescription>
        </Alert>
      )}
      <div>
        <h1 className="text-2xl font-bold">Access Management</h1>
        <p className="text-muted-foreground">
          {isSystemAdminViewing ? "Viewing access (read-only)" : "Manage riders, drivers, and admin accounts"}
        </p>
      </div>

      <Tabs defaultValue="riders" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="riders" data-testid="tab-riders">
            <Users className="w-4 h-4 mr-2" />
            Riders
          </TabsTrigger>
          <TabsTrigger value="drivers" data-testid="tab-drivers">
            <Car className="w-4 h-4 mr-2" />
            Drivers
          </TabsTrigger>
          <TabsTrigger value="admins" data-testid="tab-admins">
            <UserCog className="w-4 h-4 mr-2" />
            Admins
          </TabsTrigger>
        </TabsList>

        <TabsContent value="riders" className="space-y-6 mt-6">
          {activeRoutes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No active routes found. Create and activate routes to manage rider access.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <Select value={selectedRoute} onValueChange={setSelectedRoute}>
                  <SelectTrigger className="w-64" data-testid="select-route">
                    <Bus className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Select route" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeRoutes.map((route) => (
                      <SelectItem key={route.id} value={route.id} data-testid={`option-route-${route.id}`}>
                        {route.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedRoute && (
                <div className="space-y-6">
                  {!isSystemAdminViewing && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <AccessCodeGenerator 
                        routeId={selectedRoute}
                        routeName={activeRoutes.find(r => r.id === selectedRoute)?.name || ""}
                        organizationName={orgSettings?.name || "Organization"}
                        organizationLogo={orgSettings?.logoUrl || ""}
                      />

                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Shield className="w-5 h-5" />
                            Access Control
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Button 
                              variant="outline" 
                              className="w-full"
                              onClick={() => setRenewalDialog(true)}
                              data-testid="button-renew-passwords"
                            >
                              <CalendarClock className="w-4 h-4 mr-2" />
                              Renew All Rider Passwords
                            </Button>
                            <p className="text-xs text-muted-foreground">
                              Reset all rider password expiration dates to next July 1st.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="w-5 h-5" />
                          Riders for {activeRoutes.find(r => r.id === selectedRoute)?.name}
                        </div>
                        <Badge variant="outline">{riders.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {ridersLoading ? (
                        <div className="flex justify-center py-8">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        </div>
                      ) : riders.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No riders assigned to this route yet. Share the QR code or link above to invite riders.
                        </p>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex gap-2 flex-wrap">
                            <div className="relative flex-1 min-w-[200px]">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input
                                placeholder="Search by name or phone..."
                                value={riderSearch}
                                onChange={(e) => setRiderSearch(e.target.value)}
                                className="pl-10"
                                data-testid="input-search-riders"
                              />
                            </div>
                            <Select value={notificationFilter} onValueChange={setNotificationFilter}>
                              <SelectTrigger className="w-40" data-testid="select-notification-filter">
                                <Filter className="w-4 h-4 mr-2" />
                                <SelectValue placeholder="Filter" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Modes</SelectItem>
                                <SelectItem value="sms">SMS</SelectItem>
                                <SelectItem value="push">Push</SelectItem>
                                <SelectItem value="email">Email</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {filteredRiders.map((rider) => (
                              <div 
                                key={rider.id} 
                                className="flex items-center justify-between p-3 border rounded-lg"
                              >
                                <div className="flex-1">
                                  <p className="font-medium">{rider.name || "Unnamed Rider"}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {rider.phoneNumber}
                                    {rider.notificationMode && (
                                      <Badge variant="outline" className="ml-2">
                                        {rider.notificationMode}
                                      </Badge>
                                    )}
                                  </p>
                                </div>
                                {!isSystemAdminViewing && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setRemovalDialog({
                                        open: true,
                                        type: "rider",
                                        id: rider.id,
                                        name: rider.name || "Unnamed Rider",
                                      })}
                                      data-testid={`button-remove-rider-${rider.id}`}
                                    >
                                      <UserX className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Remove rider access</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="drivers" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Car className="w-5 h-5" />
                    Drivers
                  </CardTitle>
                  <CardDescription>
                    {isSystemAdminViewing ? "Viewing drivers (read-only)" : "Manage driver accounts and route assignments"}
                  </CardDescription>
                </div>
                {!isSystemAdminViewing && (
                <Dialog open={addDriverDialog} onOpenChange={setAddDriverDialog}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-driver">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Driver
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Driver</DialogTitle>
                      <DialogDescription>
                        Create a new driver account. They will use these credentials to log in and manage their routes.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="driver-name">Full Name</Label>
                        <Input
                          id="driver-name"
                          placeholder="John Smith"
                          value={newDriverForm.name}
                          onChange={(e) => setNewDriverForm({ ...newDriverForm, name: e.target.value })}
                          data-testid="input-driver-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="driver-email">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="driver-email"
                            type="email"
                            placeholder="driver@example.com"
                            className="pl-10"
                            value={newDriverForm.email}
                            onChange={(e) => setNewDriverForm({ ...newDriverForm, email: e.target.value })}
                            data-testid="input-driver-email"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="driver-phone">Phone Number (optional)</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="driver-phone"
                            type="tel"
                            placeholder="+1 (555) 123-4567"
                            className="pl-10"
                            value={newDriverForm.phoneNumber}
                            onChange={(e) => setNewDriverForm({ ...newDriverForm, phoneNumber: e.target.value })}
                            data-testid="input-driver-phone"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="driver-password">Password</Label>
                        <div className="relative">
                          <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="driver-password"
                            type={showDriverPassword ? "text" : "password"}
                            placeholder="Minimum 6 characters"
                            className="pl-10 pr-10"
                            value={newDriverForm.password}
                            onChange={(e) => setNewDriverForm({ ...newDriverForm, password: e.target.value })}
                            data-testid="input-driver-password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                            onClick={() => setShowDriverPassword(!showDriverPassword)}
                            data-testid="button-toggle-driver-password"
                          >
                            {showDriverPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="driver-confirm-password">Confirm Password</Label>
                        <div className="relative">
                          <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="driver-confirm-password"
                            type={showDriverPassword ? "text" : "password"}
                            placeholder="Re-enter password"
                            className={`pl-10 ${newDriverForm.confirmPassword && !passwordsMatch(newDriverForm.password, newDriverForm.confirmPassword) ? 'border-destructive' : ''}`}
                            value={newDriverForm.confirmPassword}
                            onChange={(e) => setNewDriverForm({ ...newDriverForm, confirmPassword: e.target.value })}
                            data-testid="input-driver-confirm-password"
                          />
                        </div>
                        {newDriverForm.confirmPassword && !passwordsMatch(newDriverForm.password, newDriverForm.confirmPassword) && (
                          <p className="text-sm text-destructive">Passwords do not match</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="driver-route">Assign to Route (optional)</Label>
                        <Select 
                          value={newDriverForm.routeId} 
                          onValueChange={(value) => setNewDriverForm({ ...newDriverForm, routeId: value })}
                        >
                          <SelectTrigger data-testid="select-driver-route">
                            <Bus className="w-4 h-4 mr-2" />
                            <SelectValue placeholder="Select route" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No route assignment</SelectItem>
                            {activeRoutes.map((route) => (
                              <SelectItem key={route.id} value={route.id}>
                                {route.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => {
                        setAddDriverDialog(false);
                        setNewDriverForm({ name: "", email: "", phoneNumber: "", password: "", confirmPassword: "", routeId: "" });
                        setShowDriverPassword(false);
                      }}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={() => addDriverMutation.mutate(newDriverForm)}
                        disabled={!canSubmitDriver()}
                        data-testid="button-confirm-add-driver"
                      >
                        {addDriverMutation.isPending ? "Creating..." : "Create Driver"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {staffLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : drivers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No drivers added yet. Click "Add Driver" to create a driver account.
                </p>
              ) : (
                <div className="space-y-2">
                  {drivers.map((driver) => (
                    <div 
                      key={driver.id} 
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{driver.name || "Unnamed Driver"}</p>
                          {driver.id === user?.id && (
                            <Badge variant="secondary">You</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{driver.email}</p>
                        {driver.phoneNumber && (
                          <p className="text-sm text-muted-foreground">{driver.phoneNumber}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-medium">Assigned Route</p>
                          <p className="text-sm text-muted-foreground">
                            {driver.routeAssignments.length > 0 
                              ? getRouteName(
                                  (driver.routeAssignments.find(a => a.isDefault) || driver.routeAssignments[0]).routeId
                                )
                              : "Unassigned"}
                          </p>
                        </div>
                        {!isSystemAdminViewing && (
                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(driver)}
                                data-testid={`button-edit-driver-${driver.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Edit driver</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setRemovalDialog({
                                  open: true,
                                  type: "driver",
                                  id: driver.id,
                                  name: driver.name || "Unnamed Driver",
                                })}
                                disabled={driver.id === user?.id}
                                data-testid={`button-remove-driver-${driver.id}`}
                              >
                                <UserX className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{driver.id === user?.id ? "Cannot remove yourself" : "Remove driver"}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="admins" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <UserCog className="w-5 h-5" />
                    Administrators
                  </CardTitle>
                  <CardDescription>
                    {isSystemAdminViewing ? "Viewing admins (read-only)" : "Manage admin accounts who can configure routes and manage users"}
                  </CardDescription>
                </div>
                {!isSystemAdminViewing && (
                <Dialog open={addAdminDialog} onOpenChange={setAddAdminDialog}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-admin">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Admin
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Administrator</DialogTitle>
                      <DialogDescription>
                        Create a new admin account. Admins have full access to manage routes, users, and settings.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="admin-name">Full Name</Label>
                        <Input
                          id="admin-name"
                          placeholder="Jane Doe"
                          value={newAdminForm.name}
                          onChange={(e) => setNewAdminForm({ ...newAdminForm, name: e.target.value })}
                          data-testid="input-admin-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="admin-email">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="admin-email"
                            type="email"
                            placeholder="admin@example.com"
                            className="pl-10"
                            value={newAdminForm.email}
                            onChange={(e) => setNewAdminForm({ ...newAdminForm, email: e.target.value })}
                            data-testid="input-admin-email"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="admin-phone">Phone Number (optional)</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="admin-phone"
                            type="tel"
                            placeholder="+1 (555) 123-4567"
                            className="pl-10"
                            value={newAdminForm.phoneNumber}
                            onChange={(e) => setNewAdminForm({ ...newAdminForm, phoneNumber: e.target.value })}
                            data-testid="input-admin-phone"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="admin-password">Password</Label>
                        <div className="relative">
                          <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="admin-password"
                            type={showAdminPassword ? "text" : "password"}
                            placeholder="Minimum 6 characters"
                            className="pl-10 pr-10"
                            value={newAdminForm.password}
                            onChange={(e) => setNewAdminForm({ ...newAdminForm, password: e.target.value })}
                            data-testid="input-admin-password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                            onClick={() => setShowAdminPassword(!showAdminPassword)}
                            data-testid="button-toggle-admin-password"
                          >
                            {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="admin-confirm-password">Confirm Password</Label>
                        <div className="relative">
                          <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="admin-confirm-password"
                            type={showAdminPassword ? "text" : "password"}
                            placeholder="Re-enter password"
                            className={`pl-10 ${newAdminForm.confirmPassword && !passwordsMatch(newAdminForm.password, newAdminForm.confirmPassword) ? 'border-destructive' : ''}`}
                            value={newAdminForm.confirmPassword}
                            onChange={(e) => setNewAdminForm({ ...newAdminForm, confirmPassword: e.target.value })}
                            data-testid="input-admin-confirm-password"
                          />
                        </div>
                        {newAdminForm.confirmPassword && !passwordsMatch(newAdminForm.password, newAdminForm.confirmPassword) && (
                          <p className="text-sm text-destructive">Passwords do not match</p>
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => {
                        setAddAdminDialog(false);
                        setNewAdminForm({ name: "", email: "", phoneNumber: "", password: "", confirmPassword: "" });
                        setShowAdminPassword(false);
                      }}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={() => addAdminMutation.mutate(newAdminForm)}
                        disabled={!canSubmitAdmin()}
                        data-testid="button-confirm-add-admin"
                      >
                        {addAdminMutation.isPending ? "Creating..." : "Create Admin"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {staffLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : admins.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No other administrators. Click "Add Admin" to create another admin account.
                </p>
              ) : (
                <div className="space-y-2">
                  {admins.map((admin) => (
                    <div 
                      key={admin.id} 
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{admin.name || "Unnamed Admin"}</p>
                          {admin.id === user?.id && (
                            <Badge variant="secondary">You</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{admin.email}</p>
                        {admin.phoneNumber && (
                          <p className="text-sm text-muted-foreground">{admin.phoneNumber}</p>
                        )}
                      </div>
                      {!isSystemAdminViewing && (
                      <div className="flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(admin)}
                              data-testid={`button-edit-admin-${admin.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Edit admin</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setRemovalDialog({
                                open: true,
                                type: "admin",
                                id: admin.id,
                                name: admin.name || "Unnamed Admin",
                              })}
                              disabled={admin.id === user?.id}
                              data-testid={`button-remove-admin-${admin.id}`}
                            >
                              <UserX className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{admin.id === user?.id ? "Cannot remove yourself" : "Remove admin"}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={removalDialog.open} onOpenChange={(open) => {
        if (!open) {
          setRemovalDialog({ open: false, type: null, id: null, name: null });
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {removalDialog.type === "rider" ? "Rider" : removalDialog.type === "driver" ? "Driver" : "Admin"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <span className="font-semibold">{removalDialog.name}</span>?
              <br /><br />
              {removalDialog.type === "rider" 
                ? "This will deactivate their notifications and remove their access to track this route."
                : "This will deactivate their account and remove their access to the system."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={removeRiderMutation.isPending || removeStaffMutation.isPending}
              data-testid="button-cancel-removal"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={removeRiderMutation.isPending || removeStaffMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-removal"
            >
              {removeRiderMutation.isPending || removeStaffMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={renewalDialog} onOpenChange={setRenewalDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Renew All Rider Passwords?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset the password expiration date for <strong>all riders</strong> in your organization to July 1st of next year.
              <br /><br />
              Riders will be able to continue using their existing access codes, QR codes, and magic links without interruption.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={renewPasswordsMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => renewPasswordsMutation.mutate()}
              disabled={renewPasswordsMutation.isPending}
            >
              {renewPasswordsMutation.isPending ? "Renewing..." : "Renew All Passwords"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editDialog.open} onOpenChange={(open) => {
        if (!open) {
          setEditDialog({ open: false, staffMember: null });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit {editDialog.staffMember?.role === "driver" ? "Driver" : "Administrator"}
            </DialogTitle>
            <DialogDescription>
              Update details for {editDialog.staffMember?.name || "staff member"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                placeholder="Full name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                data-testid="input-edit-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="edit-email"
                  type="email"
                  value={editDialog.staffMember?.email || ""}
                  disabled
                  className="pl-10 bg-muted"
                  data-testid="input-edit-email"
                />
              </div>
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone Number (optional)</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="edit-phone"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  className="pl-10"
                  value={editForm.phoneNumber}
                  onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                  data-testid="input-edit-phone"
                />
              </div>
            </div>
            {editDialog.staffMember?.role === "driver" && (
              <div className="space-y-2">
                <Label htmlFor="edit-route">Assigned Route</Label>
                <Select 
                  value={editForm.routeId} 
                  onValueChange={(value) => setEditForm({ ...editForm, routeId: value })}
                >
                  <SelectTrigger data-testid="select-edit-route">
                    <Bus className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Select route" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No route assignment</SelectItem>
                    {activeRoutes.map((route) => (
                      <SelectItem key={route.id} value={route.id}>
                        {route.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false, staffMember: null })}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (editDialog.staffMember) {
                  updateStaffMutation.mutate({ id: editDialog.staffMember.id, data: editForm });
                }
              }}
              disabled={!editForm.name.trim() || updateStaffMutation.isPending}
              data-testid="button-confirm-edit"
            >
              {updateStaffMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
