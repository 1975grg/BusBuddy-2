import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useUser } from "@/contexts/UserContext";
import { HelpCircle } from "lucide-react";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { refetchUser } = useUser();
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [usePhone, setUsePhone] = useState(false);

  // Request magic link mutation
  const requestMagicLinkMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/magic-link/request", {
        email: usePhone ? undefined : email,
        phoneNumber: usePhone ? phoneNumber : undefined,
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      // In development, auto-login with the token
      if (data.magicLink) {
        const url = new URL(data.magicLink);
        const token = url.searchParams.get('token');
        
        toast({
          title: "🔗 Development Mode",
          description: "Logging you in automatically...",
          duration: 3000,
        });
        
        // Auto-login after a short delay
        if (token) {
          setTimeout(() => {
            verifyTokenMutation.mutate(token);
          }, 500);
        }
      } else {
        toast({
          title: "Magic link sent!",
          description: data.message || "Check your email/SMS for the login link",
        });
      }
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to send magic link",
      });
    },
  });

  // Verify magic link token from URL
  const verifyTokenMutation = useMutation({
    mutationFn: async (token: string) => {
      const response = await apiRequest("POST", "/api/auth/magic-link/verify", { token });
      return response.json();
    },
    onSuccess: (data: any) => {
      // Session is now stored in HTTP-only cookie
      toast({
        title: "Login successful!",
        description: "Welcome back",
      });

      // Invalidate and refetch user data to clear old cache
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      
      // Redirect based on role - use window.location to force full page reload
      const role = data.user.role;
      if (role === "system_admin") {
        window.location.href = "/system";
      } else if (role === "org_admin") {
        window.location.href = "/admin";
      } else if (role === "driver") {
        window.location.href = "/driver";
      } else if (role === "rider") {
        window.location.href = "/rider";
      }
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message || "Invalid or expired token",
      });
    },
  });

  // Check for token in URL on mount - use useEffect to avoid double execution
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      verifyTokenMutation.mutate(token);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    requestMagicLinkMutation.mutate();
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Login</CardTitle>
          <CardDescription>
            Enter your email or phone number to receive a magic link
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-4 mb-4">
              <Button
                type="button"
                variant={!usePhone ? "default" : "outline"}
                onClick={() => setUsePhone(false)}
                data-testid="button-email-login"
              >
                Email
              </Button>
              <Button
                type="button"
                variant={usePhone ? "default" : "outline"}
                onClick={() => setUsePhone(true)}
                data-testid="button-phone-login"
              >
                Phone
              </Button>
            </div>

            {!usePhone ? (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-email"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 234 567 8900"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  data-testid="input-phone"
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={requestMagicLinkMutation.isPending}
              data-testid="button-submit-login"
            >
              {requestMagicLinkMutation.isPending
                ? "Sending..."
                : "Send Magic Link"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Development Mode: Magic links will be shown in toast notifications</p>
          </div>

          <div className="mt-6 p-4 bg-muted/50 rounded-lg border">
            <div className="flex items-start gap-3">
              <HelpCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="text-sm font-medium">Need access?</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Access is provided by your school, hospital, or transportation provider. You'll receive either:
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span><strong>QR code</strong> - Scan it to get instant access</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span><strong>Magic link</strong> - Click the link sent via email or SMS</span>
                  </li>
                </ul>
                <p className="text-xs text-muted-foreground">
                  Contact your administrator if you haven't received your access code yet.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
