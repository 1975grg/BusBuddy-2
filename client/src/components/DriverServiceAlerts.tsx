import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Info, Bus, Clock, Bell } from "lucide-react";
import { format } from "date-fns";
import type { ServiceAlert } from "@shared/schema";

interface DriverServiceAlertsProps {
  routeId: string;
}

export function DriverServiceAlerts({ routeId }: DriverServiceAlertsProps) {
  const { data: alerts = [], isLoading } = useQuery<ServiceAlert[]>({
    queryKey: ["/api/service-alerts", routeId],
    queryFn: async () => {
      const response = await fetch(`/api/service-alerts?route_id=${routeId}`);
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error("Failed to fetch service alerts");
      }
      return response.json();
    },
    refetchInterval: 30000,
  });

  const activeAlerts = alerts.filter(alert => alert.isActive);

  const getAlertTypeInfo = (type: ServiceAlert['type']) => {
    switch (type) {
      case 'delayed':
        return {
          icon: Clock,
          bgColor: 'bg-yellow-50 dark:bg-yellow-950/20',
          borderColor: 'border-yellow-200 dark:border-yellow-800',
          textColor: 'text-yellow-800 dark:text-yellow-200',
          iconColor: 'text-yellow-600 dark:text-yellow-400',
        };
      case 'bus_change':
        return {
          icon: Bus,
          bgColor: 'bg-blue-50 dark:bg-blue-950/20',
          borderColor: 'border-blue-200 dark:border-blue-800',
          textColor: 'text-blue-800 dark:text-blue-200',
          iconColor: 'text-blue-600 dark:text-blue-400',
        };
      case 'cancelled':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-red-50 dark:bg-red-950/20',
          borderColor: 'border-red-200 dark:border-red-800',
          textColor: 'text-red-800 dark:text-red-200',
          iconColor: 'text-red-600 dark:text-red-400',
        };
      case 'general':
      default:
        return {
          icon: Info,
          bgColor: 'bg-blue-50 dark:bg-blue-950/20',
          borderColor: 'border-blue-200 dark:border-blue-800',
          textColor: 'text-blue-800 dark:text-blue-200',
          iconColor: 'text-blue-600 dark:text-blue-400',
        };
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Service Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading alerts...</p>
        </CardContent>
      </Card>
    );
  }

  if (activeAlerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Service Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No active alerts for this route.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Service Alerts
          <Badge variant="destructive" className="ml-auto">
            {activeAlerts.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {activeAlerts.map((alert) => {
          const alertInfo = getAlertTypeInfo(alert.type);
          const AlertIcon = alertInfo.icon;

          return (
            <Alert
              key={alert.id}
              className={`${alertInfo.bgColor} ${alertInfo.borderColor} border-l-4`}
              data-testid={`alert-${alert.id}`}
            >
              <AlertIcon className={`h-4 w-4 ${alertInfo.iconColor}`} />
              <AlertDescription>
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className={`font-semibold ${alertInfo.textColor}`}>
                        {alert.title}
                      </p>
                      <p className={`text-sm mt-1 ${alertInfo.textColor}`}>
                        {alert.message}
                      </p>
                    </div>
                    <Badge
                      variant={alert.severity === "critical" ? "destructive" : alert.severity === "warning" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {alert.severity}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Posted {format(new Date(alert.createdAt!), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          );
        })}
      </CardContent>
    </Card>
  );
}
