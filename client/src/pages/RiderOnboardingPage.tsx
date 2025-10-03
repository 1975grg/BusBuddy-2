import { useState } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { MapPin, Clock, Smartphone, MessageSquare, QrCode, CheckCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Route, RouteStop, Organization } from "@shared/schema";

interface RouteWithStops extends Route {
  stops: RouteStop[];
}

export default function RiderOnboardingPage() {
  const { organizationId, routeId } = useParams();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [name, setName] = useState("");
  const [selectedStops, setSelectedStops] = useState<Set<string>>(new Set());
  const [notificationMode, setNotificationMode] = useState<"always" | "manual">("always");
  const [smsConsent, setSmsConsent] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get route information
  const { data: route, isLoading: routeLoading } = useQuery<RouteWithStops>({
    queryKey: [`/api/routes/${routeId}`],
    enabled: !!routeId,
  });

  // Get organization information
  const { data: organizations } = useQuery<Organization[]>({
    queryKey: [`/api/system/organizations`],
    enabled: !!organizationId,
  });
  
  const organization = organizations?.find(org => org.id === organizationId);

  // Subscribe to route mutation
  const subscribeToRouteMutation = useMutation({
    mutationFn: async () => {
      // Ensure phone number is sent as string (remove non-digits but keep as string)
      const cleanPhoneNumber = phoneNumber.replace(/\D/g, "");

      // Create rider profile
      const riderProfileResponse = await apiRequest("POST", "/api/rider-profiles", {
        phoneNumber: cleanPhoneNumber, // Send as string, not number
        name: name || undefined,
        organizationId,
        notificationMethod: "sms",
        smsConsent: smsConsent,
        // smsConsentDate will be set automatically on backend when smsConsent is true
      });

      const riderProfile = await riderProfileResponse.json();

      // Create route subscription

      const subscriptionResponse = await apiRequest("POST", "/api/route-subscriptions", {
        routeId,
        riderProfileId: riderProfile.id,
        notificationMode,
      });

      const subscription = await subscriptionResponse.json();

      // Create stop preferences for selected stops
      if (selectedStops.size > 0) {
        await Promise.all(
          Array.from(selectedStops).map(async (stopId) => {
            const preferenceResponse = await apiRequest("POST", "/api/stop-preferences", {
              subscriptionId: subscription.id,
              stopId,
              notifyOnApproaching: true,
              notifyOnArrival: true,
            });
            return await preferenceResponse.json();
          })
        );
      }

      return { riderProfile, subscription };
    },
    onSuccess: () => {
      setIsSubscribed(true);
      toast({
        title: "Successfully subscribed!",
        description: `You'll receive SMS notifications for the ${route?.name} route.`,
      });
    },
    onError: (error) => {
      console.error("Error subscribing to route:", error);
      toast({
        title: "Subscription failed",
        description: "Please check your phone number and try again.",
        variant: "destructive",
      });
    },
  });

  const handleStopToggle = (stopId: string) => {
    const newSelectedStops = new Set(selectedStops);
    if (newSelectedStops.has(stopId)) {
      newSelectedStops.delete(stopId);
    } else {
      newSelectedStops.add(stopId);
    }
    setSelectedStops(newSelectedStops);
  };

  const handleSubscribe = () => {
    if (!phoneNumber.trim()) {
      toast({
        title: "Phone number required",
        description: "Please enter your phone number to receive notifications.",
        variant: "destructive",
      });
      return;
    }

    if (!smsConsent) {
      toast({
        title: "SMS consent required",
        description: "Please agree to receive SMS notifications to continue.",
        variant: "destructive",
      });
      return;
    }

    if (selectedStops.size === 0) {
      toast({
        title: "Select at least one stop",
        description: "Choose which stops you'd like to be notified about.",
        variant: "destructive",
      });
      return;
    }

    subscribeToRouteMutation.mutate();
  };

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length >= 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    } else if (digits.length >= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length >= 3) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    }
    return digits;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  if (routeLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!route) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <QrCode className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Route Not Found</h2>
            <p className="text-muted-foreground">
              The route you're looking for doesn't exist or may have been disabled.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSubscribed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-600" />
            <h2 className="text-xl font-semibold mb-2">All Set!</h2>
            <p className="text-muted-foreground mb-4">
              You're now subscribed to notifications for the <strong>{route.name}</strong> route.
            </p>
            <p className="text-sm text-muted-foreground">
              You'll receive SMS notifications at <strong>{phoneNumber}</strong> when your selected stops are approaching.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4">
        <div className="max-w-md mx-auto">
          <h1 className="text-lg font-semibold">{organization?.name || "Bus Buddy"}</h1>
          <p className="text-sm opacity-90">Real-time bus notifications</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto p-4 space-y-6">
        {/* Route Info */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{route.name}</CardTitle>
              <Badge variant={route.type === "shuttle" ? "secondary" : "outline"}>
                {route.type}
              </Badge>
              {route.status === "active" ? (
                <Badge className="bg-green-600 text-white">Active</Badge>
              ) : (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {route.vehicleNumber && (
              <p className="text-sm text-muted-foreground mb-3">
                Vehicle: {route.vehicleNumber}
              </p>
            )}
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span>{route.stops.length} stops on this route</span>
            </div>
          </CardContent>
        </Card>

        {/* Notification Setup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Smartphone className="w-5 h-5" />
              Get Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={phoneNumber}
                onChange={handlePhoneChange}
                maxLength={14}
                data-testid="input-phone-number"
              />
              <p className="text-xs text-muted-foreground">
                We'll send SMS notifications to this number
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name (Optional)</Label>
              <Input
                id="name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="input-rider-name"
              />
            </div>

            <div className="space-y-3">
              <Label>Notification Mode</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="always"
                    checked={notificationMode === "always"}
                    onCheckedChange={(checked) => {
                      setNotificationMode(checked ? "always" : "manual");
                    }}
                  />
                  <Label htmlFor="always" className="text-sm">
                    <strong>Always notify</strong> - Get notifications every time this route runs
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="manual"
                    checked={notificationMode === "manual"}
                    onCheckedChange={(checked) => {
                      setNotificationMode(checked ? "manual" : "always");
                    }}
                  />
                  <Label htmlFor="manual" className="text-sm">
                    <strong>Manual only</strong> - Only get notifications when you request them
                  </Label>
                </div>
              </div>
            </div>

            {/* SMS Consent Checkbox */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="sms-consent"
                  checked={smsConsent}
                  onCheckedChange={(checked) => setSmsConsent(checked as boolean)}
                  data-testid="checkbox-sms-consent"
                />
                <Label htmlFor="sms-consent" className="text-sm leading-relaxed cursor-pointer">
                  I consent to receive SMS notifications about my bus route. Message and data rates may apply. Reply STOP to unsubscribe at any time.
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stop Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Your Stops</CardTitle>
            <p className="text-sm text-muted-foreground">
              Choose which stops you want to be notified about
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {route.stops.map((stop, index) => (
                <div
                  key={stop.id}
                  className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                  onClick={() => handleStopToggle(stop.id)}
                  data-testid={`stop-option-${stop.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <Checkbox
                    checked={selectedStops.has(stop.id)}
                    onCheckedChange={() => handleStopToggle(stop.id)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                        {index + 1}
                      </span>
                      <span className="font-medium">{stop.name}</span>
                    </div>
                    {stop.address && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {stop.address}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Subscribe Button */}
        <div className="sticky bottom-4">
          <Button
            onClick={handleSubscribe}
            disabled={subscribeToRouteMutation.isPending || !phoneNumber.trim() || !smsConsent || selectedStops.size === 0}
            className="w-full py-6 text-lg"
            data-testid="button-subscribe"
          >
            {subscribeToRouteMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Subscribing...
              </>
            ) : (
              <>
                <MessageSquare className="w-5 h-5 mr-2" />
                Get SMS Notifications
              </>
            )}
          </Button>
        </div>

        {/* Info Footer */}
        <div className="text-center text-xs text-muted-foreground pb-8">
          <p>Standard SMS rates apply. You can unsubscribe at any time.</p>
        </div>
      </div>
    </div>
  );
}