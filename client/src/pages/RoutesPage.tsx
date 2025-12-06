import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table as TableComponent, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Search, LayoutGrid, Table, Settings, MessageSquare, QrCode, Archive, RotateCcw, Eye } from "lucide-react";
import { RouteCard } from "@/components/RouteCard";
import { CreateRouteDialog } from "@/components/CreateRouteDialog";
import { EditRouteDialog } from "@/components/EditRouteDialog";
import { SendAlertDialog } from "@/components/SendAlertDialog";
import { QrCodeDialog } from "@/components/QrCodeDialog";
import { ArchiveRouteDialog } from "@/components/ArchiveRouteDialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useRequireRole } from "@/contexts/UserContext";
import { apiRequest } from "@/lib/queryClient";
import type { Route, RouteStop, Organization } from "@shared/schema";

interface RouteWithStops extends Route {
  stops: RouteStop[];
}

type StatusFilter = "all" | "active" | "inactive" | "archived";
type SortOption = "name-asc" | "name-desc" | "status";
type ViewMode = "cards" | "table";

export default function RoutesPage() {
  const { user, isLoading: authLoading, viewingOrgId } = useRequireRole("org_admin");
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [sortOption, setSortOption] = useState<SortOption>("name-asc");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [alertRoute, setAlertRoute] = useState<Route | null>(null);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [qrRoute, setQrRoute] = useState<{ id: string; name: string } | null>(null);
  const [archiveRoute, setArchiveRoute] = useState<Route | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Determine if system admin is viewing an org (read-only mode)
  const isSystemAdminViewing = user?.role === 'system_admin' && viewingOrgId;
  const effectiveOrgId = viewingOrgId || user?.organizationId;

  // Fetch organization settings for the banner
  const { data: orgSettings } = useQuery({
    queryKey: ["/api/org-settings", effectiveOrgId],
    queryFn: async () => {
      const url = effectiveOrgId 
        ? `/api/org-settings?organizationId=${effectiveOrgId}`
        : "/api/org-settings";
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch settings");
      return response.json();
    },
    enabled: !authLoading && !!isSystemAdminViewing,
  });

  // Get routes filtered by organization if viewing
  const { data: routes = [], isLoading, error } = useQuery<RouteWithStops[]>({
    queryKey: ["/api/routes", effectiveOrgId],
    queryFn: async () => {
      const url = effectiveOrgId ? `/api/routes?organizationId=${effectiveOrgId}` : "/api/routes";
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch routes");
      return response.json();
    },
  });

  // Fetch active sessions to show which routes have trips in progress
  interface ActiveSession {
    routeId: string;
    sessionId: string;
    status: string;
  }
  const { data: activeSessions = [] } = useQuery<ActiveSession[]>({
    queryKey: ["/api/route-sessions/all-active"],
    refetchInterval: 10000, // Refresh every 10 seconds
    enabled: !authLoading,
  });

  // Create a Set of route IDs that have active trips
  const routesWithActiveTrips = new Set(activeSessions.map(s => s.routeId));

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  const filteredAndSortedRoutes = routes
    .filter(route => {
      // Filter by search term
      const matchesSearch = searchTerm === "" || 
        route.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        route.vehicleNumber?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Filter by status
      let matchesStatus = false;
      if (statusFilter === "all") {
        matchesStatus = !route.archivedAt; // Exclude archived from "all"
      } else if (statusFilter === "archived") {
        matchesStatus = !!route.archivedAt;
      } else {
        matchesStatus = route.status === statusFilter && !route.archivedAt;
      }
      
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortOption) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "status":
          // Active routes first, then inactive
          if (a.status === b.status) {
            return a.name.localeCompare(b.name); // Then by name
          }
          return a.status === "active" ? -1 : 1;
        default:
          return 0;
      }
    });

  // Use the effective organization ID (from viewing param or user's org)
  const organizationId = effectiveOrgId || "";
  
  const handleBackToSystem = () => {
    setLocation('/system');
  };

  // Toggle route status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ routeId, newStatus }: { routeId: string; newStatus: "active" | "inactive" }) => {
      if (isSystemAdminViewing) throw new Error("Read-only mode");
      return await apiRequest("PUT", `/api/routes/${routeId}`, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes", effectiveOrgId] });
      toast({
        title: "Route updated",
        description: "Route status has been updated successfully.",
      });
    },
    onError: (error) => {
      console.error("Error updating route status:", error);
      toast({
        title: "Error",
        description: "Failed to update route status. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Restore archived route mutation
  const restoreRouteMutation = useMutation({
    mutationFn: async (routeId: string) => {
      if (isSystemAdminViewing) throw new Error("Read-only mode");
      return await apiRequest("POST", `/api/routes/${routeId}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes", effectiveOrgId] });
      toast({
        title: "Route restored",
        description: "Route has been restored and is now enabled.",
      });
    },
    onError: (error) => {
      console.error("Error restoring route:", error);
      toast({
        title: "Error",
        description: "Failed to restore route. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRestoreRoute = (routeId: string) => {
    restoreRouteMutation.mutate(routeId);
  };

  const handleSendAlert = (route: Route) => {
    setAlertRoute(route);
    setAlertDialogOpen(true);
  };

  const handleToggleStatus = (routeId: string, currentStatus: "active" | "inactive") => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    toggleStatusMutation.mutate({ routeId, newStatus });
  };

  const handleEditRoute = (routeId: string) => {
    const route = routes.find(r => r.id === routeId);
    if (route) {
      setEditingRoute(route);
      setEditDialogOpen(true);
    }
  };

  const handleShowQr = (routeId: string, routeName: string) => {
    setQrRoute({ id: routeId, name: routeName });
  };

  const handleArchiveRoute = (routeId: string) => {
    const route = routes.find(r => r.id === routeId);
    if (route) {
      setArchiveRoute(route);
      setArchiveDialogOpen(true);
    }
  };

  return (
    <div className="space-y-6">
      {isSystemAdminViewing && (
        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-blue-800 dark:text-blue-200">
              Viewing <strong>{orgSettings?.name || 'Organization'}</strong> routes as System Administrator (read-only)
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Routes</h1>
          <p className="text-muted-foreground">
            {isSystemAdminViewing ? "Viewing routes (read-only)" : "Manage your bus and shuttle routes"}
          </p>
        </div>
        {!isSystemAdminViewing && <CreateRouteDialog organizationId={organizationId} />}
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search routes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-routes"
          />
        </div>
        
        <ToggleGroup 
          type="single" 
          value={statusFilter} 
          onValueChange={(value) => {
            if (value) {
              setStatusFilter(value as StatusFilter);
            }
          }}
          data-testid="toggle-status-filter"
        >
          <ToggleGroupItem value="all" data-testid="toggle-all">
            All
          </ToggleGroupItem>
          <ToggleGroupItem value="active" data-testid="toggle-active">
            Enabled
          </ToggleGroupItem>
          <ToggleGroupItem value="inactive" data-testid="toggle-inactive">
            Disabled
          </ToggleGroupItem>
          <ToggleGroupItem value="archived" data-testid="toggle-archived">
            Archived
          </ToggleGroupItem>
        </ToggleGroup>

        <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
          <SelectTrigger className="w-40" data-testid="select-sort-routes">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">Name A-Z</SelectItem>
            <SelectItem value="name-desc">Name Z-A</SelectItem>
            <SelectItem value="status">Status</SelectItem>
          </SelectContent>
        </Select>

        <ToggleGroup 
          type="single" 
          value={viewMode} 
          onValueChange={(value) => {
            if (value) {
              setViewMode(value as ViewMode);
            }
          }}
          data-testid="toggle-view-mode"
        >
          <ToggleGroupItem value="cards" data-testid="toggle-cards">
            <LayoutGrid className="w-4 h-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="table" data-testid="toggle-table">
            <Table className="w-4 h-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-destructive">Error loading routes. Please try again.</p>
        </div>
      ) : (
        <>
          {viewMode === "cards" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredAndSortedRoutes.map((route) => {
                // Transform stops for RouteCard component
                const transformedStops = route.stops.map(stop => ({
                  id: stop.id,
                  name: stop.name,
                  eta: undefined, // ETA removed in favor of geofencing
                }));

                return (
                  <RouteCard
                    key={route.id}
                    id={route.id}
                    name={route.name}
                    type={route.type as "shuttle" | "bus"}
                    status={route.status as "active" | "inactive"}
                    vehicleNumber={route.vehicleNumber || undefined}
                    stops={transformedStops}
                    ridersCount={0} // TODO: Add riders count to API
                    isArchived={!!route.archivedAt}
                    hasTripInProgress={routesWithActiveTrips.has(route.id)}
                    onEdit={isSystemAdminViewing ? undefined : () => handleEditRoute(route.id)}
                    onToggleStatus={isSystemAdminViewing ? undefined : () => handleToggleStatus(route.id, route.status as "active" | "inactive")}
                    onSendAlert={isSystemAdminViewing ? undefined : () => handleSendAlert(route)}
                    onShowQr={() => handleShowQr(route.id, route.name)}
                    onArchive={isSystemAdminViewing ? undefined : () => handleArchiveRoute(route.id)}
                    onRestore={isSystemAdminViewing ? undefined : () => handleRestoreRoute(route.id)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="border rounded-lg">
              <TableComponent>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Stops</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedRoutes.map((route) => (
                    <TableRow key={route.id}>
                      <TableCell className="font-medium">{route.name}</TableCell>
                      <TableCell>
                        <Badge variant={route.type === "shuttle" ? "secondary" : "outline"}>
                          {route.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {route.status === "active" ? (
                            <Badge className="bg-bus-active text-white">Enabled</Badge>
                          ) : (
                            <Badge variant="secondary">Disabled</Badge>
                          )}
                          {routesWithActiveTrips.has(route.id) && (
                            <Badge className="bg-primary text-primary-foreground animate-pulse">
                              Trip Running
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{route.vehicleNumber || "—"}</TableCell>
                      <TableCell>{route.stops.length} stops</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!route.archivedAt ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleShowQr(route.id, route.name)}
                                title="Show QR Code"
                                data-testid={`button-show-qr-${route.name.toLowerCase().replace(/\s+/g, '-')}`}
                              >
                                <QrCode className="w-4 h-4" />
                              </Button>
                              {!isSystemAdminViewing && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEditRoute(route.id)}
                                    title="Edit Route"
                                    data-testid={`button-edit-route-${route.name.toLowerCase().replace(/\s+/g, '-')}`}
                                  >
                                    <Settings className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleSendAlert(route)}
                                    title="Send Alert"
                                    data-testid={`button-send-alert-${route.name.toLowerCase().replace(/\s+/g, '-')}`}
                                  >
                                    <MessageSquare className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleArchiveRoute(route.id)}
                                    title="Archive Route"
                                    data-testid={`button-archive-route-${route.name.toLowerCase().replace(/\s+/g, '-')}`}
                                  >
                                    <Archive className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                            </>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">Archived</Badge>
                              {!isSystemAdminViewing && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRestoreRoute(route.id)}
                                  data-testid={`button-restore-route-${route.name.toLowerCase().replace(/\s+/g, '-')}`}
                                >
                                  <RotateCcw className="w-3 h-3 mr-1" />
                                  Restore
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </TableComponent>
            </div>
          )}

          {filteredAndSortedRoutes.length === 0 && !isLoading && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {searchTerm ? "No routes found matching your search." : "No routes created yet."}
              </p>
              {!searchTerm && !isSystemAdminViewing && (
                <CreateRouteDialog 
                  organizationId={organizationId}
                  trigger={
                    <Button className="mt-4">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Route
                    </Button>
                  }
                />
              )}
            </div>
          )}
        </>
      )}
      
      {/* Edit Route Dialog */}
      {editingRoute && (
        <EditRouteDialog
          route={editingRoute}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={() => {
            setEditingRoute(null);
            setEditDialogOpen(false);
          }}
        />
      )}

      {/* Send Alert Dialog */}
      {alertRoute && (
        <SendAlertDialog
          route={alertRoute}
          open={alertDialogOpen}
          onOpenChange={(open) => {
            setAlertDialogOpen(open);
            if (!open) {
              setAlertRoute(null);
            }
          }}
        />
      )}

      {/* QR Code Dialog */}
      {qrRoute && (
        <QrCodeDialog
          routeId={qrRoute.id}
          routeName={qrRoute.name}
          open={!!qrRoute}
          onOpenChange={(open) => {
            if (!open) {
              setQrRoute(null);
            }
          }}
        />
      )}

      {/* Archive Route Dialog */}
      {archiveRoute && (
        <ArchiveRouteDialog
          route={archiveRoute}
          open={archiveDialogOpen}
          onOpenChange={(open) => {
            setArchiveDialogOpen(open);
            if (!open) {
              setArchiveRoute(null);
            }
          }}
          onSuccess={() => {
            setArchiveRoute(null);
            setArchiveDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}