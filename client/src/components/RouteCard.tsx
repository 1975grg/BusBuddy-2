import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, Users, Settings, MessageSquare, QrCode, Archive } from "lucide-react";

interface Stop {
  id: string;
  name: string;
  eta?: string;
}

interface RouteCardProps {
  id: string;
  name: string;
  type: "shuttle" | "bus";
  status: "active" | "inactive";
  vehicleNumber?: string;
  stops: Stop[];
  ridersCount?: number;
  isArchived?: boolean;
  onEdit?: () => void;
  onToggleStatus?: () => void;
  onSendAlert?: () => void;
  onShowQr?: () => void;
  onArchive?: () => void;
}

export function RouteCard({ 
  name, 
  type, 
  status, 
  vehicleNumber, 
  stops, 
  ridersCount,
  isArchived,
  onEdit,
  onToggleStatus,
  onSendAlert,
  onShowQr,
  onArchive
}: RouteCardProps) {
  return (
    <Card className="hover-elevate">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">{name}</CardTitle>
            <Badge variant={type === "shuttle" ? "secondary" : "outline"}>
              {type}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {isArchived ? (
              <Badge variant="secondary">Archived</Badge>
            ) : status === "active" ? (
              <Badge className="bg-bus-active text-white">Active</Badge>
            ) : (
              <Badge variant="secondary">Inactive</Badge>
            )}
            {!isArchived && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onEdit}
                title="Edit Route"
                data-testid={`button-edit-route-${name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Settings className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {vehicleNumber && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Vehicle: {vehicleNumber}</span>
          </div>
        )}
        
        <div className="space-y-2">
          <div className="flex items-center gap-1 text-sm font-medium">
            <MapPin className="w-4 h-4" />
            {stops.length} Stops
          </div>
          <div className="space-y-1">
            {stops.slice(0, 3).map((stop, index) => (
              <div key={stop.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {index + 1}. {stop.name}
                </span>
                {stop.eta && (
                  <Badge variant="outline" className="text-xs">
                    <Clock className="w-3 h-3 mr-1" />
                    {stop.eta}
                  </Badge>
                )}
              </div>
            ))}
            {stops.length > 3 && (
              <div className="text-xs text-muted-foreground">
                +{stops.length - 3} more stops
              </div>
            )}
          </div>
        </div>
        
        {ridersCount !== undefined && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            {ridersCount} riders tracking
          </div>
        )}
        
        {!isArchived ? (
          <div className="flex gap-2 pt-2 flex-wrap">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onShowQr}
              data-testid={`button-show-qr-${name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <QrCode className="w-4 h-4 mr-2" />
              QR Code
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onToggleStatus}
              data-testid={`button-toggle-status-${name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {status === "active" ? "Deactivate" : "Activate"}
            </Button>
            {status === "active" && onSendAlert && (
              <Button 
                variant="default" 
                size="sm" 
                onClick={onSendAlert}
                data-testid={`button-send-alert-${name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Send Alert
              </Button>
            )}
            {onArchive && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onArchive}
                data-testid={`button-archive-route-${name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Archive className="w-4 h-4 mr-2" />
                Archive
              </Button>
            )}
          </div>
        ) : (
          <div className="pt-2 text-sm text-muted-foreground">
            This route has been archived. Contact your administrator to restore it.
          </div>
        )}
      </CardContent>
    </Card>
  );
}