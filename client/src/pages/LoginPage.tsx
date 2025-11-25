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
import { HelpCircle, KeyRound, Mail, Eye, EyeOff } from "lucide-react";
import { Link } from "wouter";
import { SmartAppBanner } from "@/components/SmartAppBanner";

type LoginMethod = "magic-link" | "password";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { refetchUser } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [usePhone, setUsePhone] = useState(false);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("password");
  const [showPassword, setShowPassword] = useState(false);

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
      if (data.magicLink) {
        const url = new URL(data.magicLink);
        const token = url.searchParams.get('token');
        
        toast({
          title: "Development Mode",
          description: "Logging you in automatically...",
          duration: 3000,
        });
        
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

  // Password login mutation
  const passwordLoginMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/password/login", {
        email,
        password,
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Login successful!",
        description: "Welcome back",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      
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
      if (error.code === "PASSWORD_EXPIRED") {
        toast({
          variant: "destructive",
          title: "Access Expired",
          description: "Your access has expired. Please contact your administrator for a new access code.",
        });
        setLocation("/access");
      } else if (error.code === "NO_PASSWORD_SET") {
        toast({
          variant: "destructive",
          title: "Password Not Set",
          description: "Please use magic link login or contact your administrator.",
        });
        setLoginMethod("magic-link");
      } else {
        toast({
          variant: "destructive",
          title: "Login failed",
          description: error.message || "Invalid email or password",
        });
      }
    },
  });

  // Verify magic link token from URL
  const verifyTokenMutation = useMutation({
    mutationFn: async (token: string) => {
      const response = await apiRequest("POST", "/api/auth/magic-link/verify", { token });
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Login successful!",
        description: "Welcome back",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      verifyTokenMutation.mutate(token);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginMethod === "password") {
      passwordLoginMutation.mutate();
    } else {
      requestMagicLinkMutation.mutate();
    }
  };

  const isLoading = requestMagicLinkMutation.isPending || passwordLoginMutation.isPending || verifyTokenMutation.isPending;

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <SmartAppBanner />
      
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Login</CardTitle>
          <CardDescription>
            {loginMethod === "password" 
              ? "Enter your email and password" 
              : "Enter your email or phone to receive a magic link"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4 p-1 bg-muted rounded-lg">
            <Button
              type="button"
              variant={loginMethod === "password" ? "default" : "ghost"}
              size="sm"
              className="flex-1"
              onClick={() => setLoginMethod("password")}
              data-testid="button-password-method"
            >
              <KeyRound className="w-4 h-4 mr-2" />
              Password
            </Button>
            <Button
              type="button"
              variant={loginMethod === "magic-link" ? "default" : "ghost"}
              size="sm"
              className="flex-1"
              onClick={() => setLoginMethod("magic-link")}
              data-testid="button-magiclink-method"
            >
              <Mail className="w-4 h-4 mr-2" />
              Magic Link
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {loginMethod === "magic-link" && (
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
            )}

            {loginMethod === "password" ? (
              <>
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
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link 
                      href="/forgot-password" 
                      className="text-xs text-primary hover:underline"
                      data-testid="link-forgot-password"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pr-10"
                      data-testid="input-password"
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
              </>
            ) : !usePhone ? (
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
              disabled={isLoading}
              data-testid="button-submit-login"
            >
              {isLoading
                ? "Signing in..."
                : loginMethod === "password" 
                  ? "Sign In" 
                  : "Send Magic Link"}
            </Button>
          </form>

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
                    <span className="text-primary mt-0.5">-</span>
                    <span><strong>Password</strong> - Log in with your email and password</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">-</span>
                    <span><strong>QR code</strong> - Scan it to get instant access</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">-</span>
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
