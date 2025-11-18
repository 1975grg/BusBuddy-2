import { useState, useEffect } from "react";
import { AccessCodeGenerator } from "@/components/AccessCodeGenerator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Users, Shield, Trash2, RotateCcw, Bus, UserX, Car, Search, Filter } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useRequireRole } from "@/contexts/UserContext";
import { apiRequest } from "@/lib/queryClient";
import type { Route, RiderProfile } from "@shared/schema";

interface RiderWithSubscription extends RiderProfile {
  subscriptionId: string;
  notificationMode: string;
}

interface RemovalDialogState {
  open: boolean;
  type: "rider" | "driver" | null;
  id: string | null;
  name: string | null;
}

export default function AccessManagementPage() {
  const { user, isLoading: authLoading } = useRequireRole("org_admin");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }
  // Fetch real routes from API
  const { data: routes = [], isLoading } = useQuery<Route[]>({
    queryKey: ["/api/routes"],
  });

  // Filter to only show active routes and sort alphabetically (same as Routes page default)
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
  
  // Set first route as selected when routes load (useEffect to avoid render issues)
  useEffect(() => {
    if (!selectedRoute && activeRoutes.length > 0) {
      setSelectedRoute(activeRoutes[0].id);
    }
  }, [selectedRoute, activeRoutes]);
  
  // Fetch organization settings for branding
  const { data: orgSettings } = useQuery({
    queryKey: ["/api/org-settings"],
    queryFn: async () => {
      const response = await fetch("/api/org-settings");
      if (!response.ok) throw new Error("Failed to fetch settings");
      return response.json();
    }
  });

  // Fetch riders for selected route
  const { data: riders = [], isLoading: ridersLoading } = useQuery<RiderWithSubscription[]>({
    queryKey: ["/api/routes", selectedRoute, "riders"],
    queryFn: async () => {
      const response = await fetch(`/api/routes/${selectedRoute}/riders`);
      if (!response.ok) throw new Error("Failed to fetch riders");
      return response.json();
    },
    enabled: !!selectedRoute,
  });

  const selectedRouteData = activeRoutes.find(r => r.id === selectedRoute);

  // Filter and sort riders
  const filteredRiders = riders
    .filter(rider => {
      // Search filter - check name and phone
      const searchLower = riderSearch.toLowerCase();
      const matchesSearch = !riderSearch || 
        rider.name?.toLowerCase().includes(searchLower) ||
        rider.phoneNumber?.toLowerCase().includes(searchLower);
      
      // Notification mode filter
      const matchesNotification = notificationFilter === "all" || 
        rider.notificationMode === notificationFilter;
      
      return matchesSearch && matchesNotification;
    })
    .sort((a, b) => {
      if (sortBy === "name") {
        return (a.name || "").localeCompare(b.name || "");
      } else {
        // Sort by joined date (createdAt) - newest first
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      }
    });

  // Remove rider mutation
  const removeMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      return await apiRequest("DELETE", `/api/routes/${selectedRoute}/riders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes", selectedRoute, "riders"] });
      toast({
        title: "Access removed",
        description: "Rider has been removed from this route.",
      });
      setRemovalDialog({ open: false, type: null, id: null, name: null });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove access. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRemove = () => {
    if (removalDialog.id) {
      removeMutation.mutate({ id: removalDialog.id });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (activeRoutes.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Access Management</h1>
          <p className="text-muted-foreground">Generate access codes and manage rider permissions</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No active routes found. Create and activate routes to manage access.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Access Management</h1>
          <p className="text-muted-foreground">Generate access codes and manage rider permissions</p>
        </div>
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

      {activeRoutes.map((route) => (
        selectedRoute === route.id && (
          <div key={route.id} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AccessCodeGenerator 
                routeId={route.id}
                routeName={route.name}
                organizationName={orgSettings?.name || "Springfield University"}
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
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Active Tokens</p>
                      <p className="text-sm text-muted-foreground">
                        0 devices have remembered access
                      </p>
                    </div>
                    <Badge variant="outline">
                      <Users className="w-3 h-3 mr-1" />
                      0
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => console.log('Revoke all tokens')}
                      data-testid="button-revoke-all"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Revoke All Access Tokens
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      This will require all riders to re-authenticate using QR codes, links, or passwords.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Riders Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Riders
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
                    No riders assigned to this route yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {/* Search and Filter Controls */}
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
                      <Select value={sortBy} onValueChange={(value) => setSortBy(value as "name" | "joined")}>
                        <SelectTrigger className="w-36" data-testid="select-sort-riders">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="name">Sort by Name</SelectItem>
                          <SelectItem value="joined">Sort by Joined</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Results count */}
                    {riderSearch || notificationFilter !== "all" ? (
                      <p className="text-sm text-muted-foreground">
                        Showing {filteredRiders.length} of {riders.length} riders
                      </p>
                    ) : null}

                    {/* Riders List */}
                    {filteredRiders.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No riders match your filters.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-[500px] overflow-y-auto">
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
                      </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )
      ))}

      {/* Removal Confirmation Dialog */}
      <AlertDialog open={removalDialog.open} onOpenChange={(open) => {
        if (!open) {
          setRemovalDialog({ open: false, type: null, id: null, name: null });
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Rider Access?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <span className="font-semibold">{removalDialog.name}</span> from this route?
              <br /><br />
              This will deactivate their SMS subscription and remove their access to track this route.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={removeMutation.isPending}
              data-testid="button-cancel-removal"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={removeMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-removal"
            >
              {removeMutation.isPending ? "Removing..." : "Remove Access"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
