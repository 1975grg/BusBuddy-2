import { useState, useEffect } from "react";
import { AccessCodeGenerator } from "@/components/AccessCodeGenerator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Shield, Trash2, RotateCcw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Route } from "@shared/schema";

export default function AccessManagementPage() {
  // Fetch real routes from API
  const { data: routes = [], isLoading } = useQuery<Route[]>({
    queryKey: ["/api/routes"],
  });

  // Filter to only show active routes and sort alphabetically (same as Routes page default)
  const activeRoutes = routes
    .filter(route => route.status === "active")
    .sort((a, b) => a.name.localeCompare(b.name));
  
  const [selectedRoute, setSelectedRoute] = useState<string>("");
  
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

  const mockActiveTokens = [
    { id: "1", device: "iPhone 14", lastAccess: "2 hours ago", location: "Main Entrance" },
    { id: "2", device: "Samsung Galaxy", lastAccess: "5 minutes ago", location: "Library" },
    { id: "3", device: "iPad", lastAccess: "1 day ago", location: "Student Center" }
  ];

  const selectedRouteData = activeRoutes.find(r => r.id === selectedRoute);

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
      <div>
        <h1 className="text-2xl font-bold">Access Management</h1>
        <p className="text-muted-foreground">Generate access codes and manage rider permissions</p>
      </div>

      <Tabs value={selectedRoute} onValueChange={setSelectedRoute}>
        <TabsList className={`grid w-full ${activeRoutes.length === 1 ? 'grid-cols-1' : activeRoutes.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {activeRoutes.map((route) => (
            <TabsTrigger key={route.id} value={route.id} className="text-sm" data-testid={`tab-route-${route.id}`}>
              {route.name}
              <Badge variant="secondary" className="ml-2">0</Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {activeRoutes.map((route) => (
          <TabsContent key={route.id} value={route.id} className="space-y-6">
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

            {/* Active devices section - hidden when 0 tokens */}
            {false && (
              <Card>
                <CardHeader>
                  <CardTitle>Active Devices</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockActiveTokens.map((token) => (
                      <div key={token.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{token.device}</p>
                          <p className="text-sm text-muted-foreground">
                            Last seen: {token.lastAccess} at {token.location}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => console.log(`Revoke token ${token.id}`)}
                          data-testid={`button-revoke-${token.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
