import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, Link2, Key, Smartphone, LogIn } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, setStoredSessionToken, ApiError } from "@/lib/queryClient";

export function AccessLogin() {
  const [accessMethod, setAccessMethod] = useState<"password" | "link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [magicLinkInput, setMagicLinkInput] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Check for magic link token in URL on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      verifyMagicLinkMutation.mutate(token);
    }
  }, []);

  // Password login mutation
  const passwordLoginMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/password/login", {
        email,
        password,
      });
      return response.json();
    },
    onSuccess: async (data: any) => {
      console.log("[AUTH-LOGIN] Login successful, sessionToken:", data.sessionToken ? "received" : "missing");
      
      // Store session token for native app persistence
      // MUST await before redirect to ensure token is saved to Capacitor Preferences
      if (data.sessionToken) {
        await setStoredSessionToken(data.sessionToken);
        console.log("[AUTH-LOGIN] Token stored in Capacitor Preferences");
      }
      
      toast({
        title: "Welcome!",
        description: "You're now logged in.",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      
      // Redirect based on role
      if (data.user.role === "rider") {
        window.location.href = "/access";
      } else if (data.user.role === "driver") {
        window.location.href = "/driver";
      } else if (data.user.role === "org_admin") {
        window.location.href = "/admin";
      } else if (data.user.role === "system_admin") {
        window.location.href = "/system";
      } else {
        window.location.href = "/";
      }
    },
    onError: (error: ApiError | Error) => {
      const code = (error as ApiError).code;
      
      if (code === "PASSWORD_EXPIRED") {
        toast({
          variant: "destructive",
          title: "Access Expired",
          description: "Your access has expired. Please contact your school for a new access code.",
        });
      } else if (code === "NO_PASSWORD_SET") {
        toast({
          variant: "destructive",
          title: "No Password Set",
          description: "Please use the magic link option or contact your school administrator.",
        });
        setAccessMethod("link");
      } else {
        toast({
          variant: "destructive",
          title: "Login failed",
          description: "Invalid email or password. Please try again.",
        });
      }
    },
  });

  // Magic link verification mutation
  const verifyMagicLinkMutation = useMutation({
    mutationFn: async (token: string) => {
      const response = await apiRequest("POST", "/api/auth/magic-link/verify", { token });
      return response.json();
    },
    onSuccess: async (data: any) => {
      // Store session token for native app persistence
      // MUST await before redirect to ensure token is saved to Capacitor Preferences
      if (data.sessionToken) {
        await setStoredSessionToken(data.sessionToken);
      }
      
      toast({
        title: "Welcome!",
        description: "You're now logged in.",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      
      // Clear URL params and reload
      window.history.replaceState({}, document.title, "/access");
      window.location.href = "/access";
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Invalid link",
        description: "This link is expired or invalid. Please request a new one.",
      });
    },
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim() && password.trim()) {
      passwordLoginMutation.mutate();
    }
  };

  const handleMagicLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Extract token from pasted link
    try {
      const url = new URL(magicLinkInput);
      const token = url.searchParams.get('token');
      if (token) {
        verifyMagicLinkMutation.mutate(token);
      } else {
        toast({
          variant: "destructive",
          title: "Invalid link",
          description: "Please paste the complete link from your email/text.",
        });
      }
    } catch {
      // Maybe they just pasted the token directly
      if (magicLinkInput.length > 10) {
        verifyMagicLinkMutation.mutate(magicLinkInput);
      } else {
        toast({
          variant: "destructive",
          title: "Invalid link",
          description: "Please paste the complete link from your email/text.",
        });
      }
    }
  };

  const isLoading = passwordLoginMutation.isPending || verifyMagicLinkMutation.isPending;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 to-primary/10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-4">
            <Smartphone className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Student Access</CardTitle>
          <p className="text-muted-foreground">
            Sign in to track your bus
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={accessMethod === "password" ? "default" : "outline"}
              className="flex flex-col h-auto py-3"
              onClick={() => setAccessMethod("password")}
              data-testid="button-access-password"
            >
              <Key className="w-5 h-5 mb-1" />
              <span className="text-xs">Password</span>
            </Button>
            <Button
              variant={accessMethod === "link" ? "default" : "outline"}
              className="flex flex-col h-auto py-3"
              onClick={() => setAccessMethod("link")}
              data-testid="button-access-link"
            >
              <Link2 className="w-5 h-5 mb-1" />
              <span className="text-xs">Magic Link</span>
            </Button>
          </div>

          {accessMethod === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="input-email"
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="input-password"
                  disabled={isLoading}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                data-testid="button-submit-password"
                disabled={isLoading || !email.trim() || !password.trim()}
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          )}

          {accessMethod === "link" && (
            <form onSubmit={handleMagicLinkSubmit} className="space-y-4">
              <div>
                <Label htmlFor="magic-link">Magic Link</Label>
                <Input
                  id="magic-link"
                  placeholder="Paste the link from your email or text"
                  value={magicLinkInput}
                  onChange={(e) => setMagicLinkInput(e.target.value)}
                  data-testid="input-magic-link"
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Paste the complete link you received from your school
                </p>
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                data-testid="button-submit-link"
                disabled={isLoading || !magicLinkInput.trim()}
              >
                {isLoading ? "Verifying..." : "Access with Link"}
              </Button>
            </form>
          )}

          <div className="text-center text-xs text-muted-foreground">
            Don't have access? Contact your school's administrator.
          </div>
          
          <div className="text-center">
            <Button 
              variant="ghost" 
              className="text-sm"
              onClick={() => setLocation("/login")}
              data-testid="button-staff-login"
            >
              <LogIn className="w-4 h-4 mr-1" />
              Staff Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}