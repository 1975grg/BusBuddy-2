import { useState } from "react";
import { AccessCodeGenerator } from "@/components/AccessCodeGenerator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Shield, Trash2, RotateCcw } from "lucide-react";

export default function AccessManagementPage() {
  const [selectedRoute, setSelectedRoute] = useState("main-campus-loop");
  
  // TODO: remove mock functionality - replace with real data
  const mockRoutes = [
    { id: "main-campus-loop", name: "Main Campus Loop", activeTokens: 23 },
    { id: "west-campus", name: "West Campus Express", activeTokens: 41 },
    { id: "hospital-shuttle", name: "Hospital Shuttle", activeTokens: 0 }
  ];

  const mockActiveTokens = [
    { id: "1", device: "iPhone 14", lastAccess: "2 hours ago", location: "Main Entrance" },
    { id: "2", device: "Samsung Galaxy", lastAccess: "5 minutes ago", location: "Library" },
    { id: "3", device: "iPad", lastAccess: "1 day ago", location: "Student Center" }
  ];

  const selectedRouteData = mockRoutes.find(r => r.id === selectedRoute);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Access Management</h1>
        <p className="text-muted-foreground">Generate access codes and manage rider permissions</p>
      </div>

      <Tabs value={selectedRoute} onValueChange={setSelectedRoute}>
        <TabsList className="grid w-full grid-cols-3">
          {mockRoutes.map((route) => (
            <TabsTrigger key={route.id} value={route.id} className="text-sm">
              {route.name}
              <Badge variant="secondary" className="ml-2">{route.activeTokens}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {mockRoutes.map((route) => (
          <TabsContent key={route.id} value={route.id} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AccessCodeGenerator 
                routeName={route.name}
                organizationName="Springfield University"
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
                        {route.activeTokens} devices have remembered access
                      </p>
                    </div>
                    <Badge variant="outline">
                      <Users className="w-3 h-3 mr-1" />
                      {route.activeTokens}
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

            {route.activeTokens > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Active Devices</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockActiveTokens.slice(0, route.activeTokens).map((token) => (
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