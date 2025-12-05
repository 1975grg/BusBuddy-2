import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useUser } from "@/contexts/UserContext";
import { Eye, EyeOff, Lock, CheckCircle } from "lucide-react";

export default function SetNewPasswordPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user, isLoading: userLoading } = useUser();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);

  const setPasswordMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/password/set", {
        password,
      });
      return response.json();
    },
    onSuccess: () => {
      setResetComplete(true);
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      toast({
        title: "Password set successfully!",
        description: "You can now access your account.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to set password",
        description: error.message || "Please try again.",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password) {
      toast({
        variant: "destructive",
        title: "Password required",
        description: "Please enter a new password.",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "Password too short",
        description: "Password must be at least 6 characters.",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Passwords don't match",
        description: "Please make sure your passwords match.",
      });
      return;
    }

    setPasswordMutation.mutate();
  };

  const goToDashboard = () => {
    if (user) {
      if (user.role === "system_admin") {
        window.location.href = "/system";
      } else if (user.role === "org_admin") {
        window.location.href = "/admin";
      } else if (user.role === "driver") {
        window.location.href = "/driver";
      } else if (user.role === "rider") {
        window.location.href = "/rider";
      }
    }
  };

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    setLocation("/login");
    return null;
  }

  if (resetComplete) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-600" />
            <h2 className="text-xl font-semibold mb-2">Password Set!</h2>
            <p className="text-muted-foreground mb-6">
              Your new password has been set successfully. You're all set to start using Bus Buddy.
            </p>
            <Button 
              className="w-full" 
              onClick={goToDashboard}
              data-testid="button-continue-to-dashboard"
            >
              Continue to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>Set Your Password</CardTitle>
          <CardDescription>
            Welcome, {user.name}! Please create a new password to secure your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10"
                  data-testid="input-new-password"
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
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className={`pr-10 ${confirmPassword && password !== confirmPassword ? 'border-destructive' : ''}`}
                  data-testid="input-confirm-password"
                />
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-sm text-destructive">Passwords do not match</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={setPasswordMutation.isPending || !password || password !== confirmPassword}
              data-testid="button-set-password"
            >
              {setPasswordMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Setting Password...
                </>
              ) : (
                "Set Password"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
