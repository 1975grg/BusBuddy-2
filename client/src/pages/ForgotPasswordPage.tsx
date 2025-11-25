import { useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Mail, CheckCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  const requestResetMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/password/reset-request", {
        email: email.trim().toLowerCase(),
      });
      return response.json();
    },
    onSuccess: () => {
      setEmailSent(true);
      toast({
        title: "Reset email sent!",
        description: "Check your inbox for the password reset link.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to send reset email. Please try again.",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({
        variant: "destructive",
        title: "Email required",
        description: "Please enter your email address.",
      });
      return;
    }
    requestResetMutation.mutate();
  };

  if (emailSent) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-600" />
            <h2 className="text-xl font-semibold mb-2">Check your email</h2>
            <p className="text-muted-foreground mb-4">
              We've sent a password reset link to <strong>{email}</strong>
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              The link will expire in 1 hour. If you don't see the email, check your spam folder.
            </p>
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setEmailSent(false);
                  requestResetMutation.reset();
                }}
                data-testid="button-try-again"
              >
                Try a different email
              </Button>
              <Link href="/login">
                <Button variant="ghost" className="w-full" data-testid="link-back-to-login">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to login
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Forgot Password</CardTitle>
          <CardDescription>
            Enter your email address and we'll send you a link to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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

            <Button
              type="submit"
              className="w-full"
              disabled={requestResetMutation.isPending}
              data-testid="button-send-reset"
            >
              {requestResetMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Reset Link
                </>
              )}
            </Button>

            <Link href="/login">
              <Button variant="ghost" className="w-full" data-testid="link-back-to-login">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to login
              </Button>
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
