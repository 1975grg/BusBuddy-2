import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { MapPin, Clock, Smartphone, MessageSquare, QrCode, CheckCircle, Eye, EyeOff, LogIn } from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Route, RouteStop, Organization, User } from "@shared/schema";
import { SmartAppBanner } from "@/components/SmartAppBanner";

interface RouteWithStops extends Route {
  stops: RouteStop[];
}

export default function RiderOnboardingPage() {
  const { organizationId, routeId } = useParams();
  const [, setLocation] = useLocation();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedStops, setSelectedStops] = useState<Set<string>>(new Set());
  const [notificationMode, setNotificationMode] = useState<"always" | "manual">("always");
  const [smsConsent, setSmsConsent] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check if user is already logged in (silent - don't error for unauthenticated)
  const { data: currentUser, isLoading: userLoading } = useQuery<User | null>({
    queryKey: ["/api/me"],
    retry: false,
    staleTime: 0,
    queryFn: async () => {
      try {
        const response = await fetch("/api/me", { credentials: "include" });
        if (!response.ok) return null;
        return response.json();
      } catch {
        return null;
      }
    },
  });

  // Redirect authenticated riders to their dashboard
  useEffect(() => {
    if (currentUser && currentUser.role === "rider") {
      setLocation("/rider");
    }
  }, [currentUser, setLocation]);

  // Get route information
  const { data: route, isLoading: routeLoading } = useQuery<RouteWithStops>({
    queryKey: [`/api/routes/${routeId}`],
    enabled: !!routeId,
  });

  // Auto-select all stops when route loads
  useEffect(() => {
    if (route?.stops && route.stops.length > 0 && selectedStops.size === 0) {
      const allStopIds = new Set(route.stops.map(stop => stop.id));
      setSelectedStops(allStopIds);
    }
  }, [route]);

  // Get organization information
  const { data: organizations } = useQuery<Organization[]>({
    queryKey: [`/api/system/organizations`],
    enabled: !!organizationId,
  });
  
  const organization = organizations?.find(org => org.id === organizationId);

  // Subscribe to route mutation - now creates user account with password
  const subscribeToRouteMutation = useMutation({
    mutationFn: async () => {
      const cleanPhoneNumber = phoneNumber.replace(/\D/g, "");

      // Create rider account with password using the new onboarding endpoint
      const response = await apiRequest("POST", "/api/rider-onboard", {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        phoneNumber: cleanPhoneNumber,
        organizationId,
        routeId,
        selectedStopIds: Array.from(selectedStops),
        notificationMode,
        smsConsent,
      });

      if (!response.ok) {
        const error = await response.json();
        // Attach the error code to the thrown error for better handling
        const err = new Error(error.error || "Registration failed");
        (err as any).code = error.code;
        throw err;
      }

      return await response.json();
    },
    onSuccess: () => {
      setIsSubscribed(true);
      toast({
        title: "Account created!",
        description: `You can now log in with your email and password to track the ${route?.name} route.`,
      });
    },
    onError: (error: Error & { code?: string }) => {
      console.error("Error creating rider account:", error);
      
      // Check if this is a duplicate account error using structured error code
      const isAccountExists = error.code === "EMAIL_IN_USE" || error.code === "PHONE_IN_USE";
      
      if (isAccountExists) {
        toast({
          title: "Account already exists",
          description: "You already have an account. Redirecting to login...",
          variant: "default",
        });
        // Redirect to login after a brief delay
        setTimeout(() => {
          setLocation("/login");
        }, 1500);
      } else {
        toast({
          title: "Registration failed",
          description: error.message || "Please check your information and try again.",
          variant: "destructive",
        });
      }
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
    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your name.",
        variant: "destructive",
      });
      return;
    }

    if (!email.trim()) {
      toast({
        title: "Email required",
        description: "Please enter your email address to create an account.",
        variant: "destructive",
      });
      return;
    }

    if (!password) {
      toast({
        title: "Password required",
        description: "Please create a password for your account.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match.",
        variant: "destructive",
      });
      return;
    }

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

  if (routeLoading || userLoading) {
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
      {/* Smart App Banner for Mobile */}
      <SmartAppBanner />

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

        {/* Already Registered - Login Card */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-full">
                <LogIn className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Already have an account?</p>
                <p className="text-sm text-muted-foreground">Log in to track your bus</p>
              </div>
              <Link href="/login">
                <Button data-testid="button-login-existing">
                  Log In
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Account Creation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Smartphone className="w-5 h-5" />
              Create Your Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Your Name *</Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="input-rider-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="input-rider-email"
              />
              <p className="text-xs text-muted-foreground">
                You'll use this to log in
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Create Password *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  data-testid="input-rider-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password *</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pr-10"
                  data-testid="input-rider-confirm-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  data-testid="button-toggle-confirm-password"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
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
            disabled={subscribeToRouteMutation.isPending || !name.trim() || !email.trim() || !password || password !== confirmPassword || !phoneNumber.trim() || !smsConsent || selectedStops.size === 0}
            className="w-full py-6 text-lg"
            data-testid="button-subscribe"
          >
            {subscribeToRouteMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating Account...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                Create Account & Subscribe
              </>
            )}
          </Button>
        </div>

        {/* Already have an account link */}
        <div className="text-center pb-4">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link 
              href="/login" 
              className="text-primary font-medium hover:underline"
              data-testid="link-login"
            >
              Log in
            </Link>
          </p>
        </div>

        {/* Info Footer */}
        <div className="text-center text-xs text-muted-foreground pb-8">
          <p>Standard SMS rates apply. You can unsubscribe at any time.</p>
        </div>
      </div>
    </div>
  );
}