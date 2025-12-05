import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mail, Construction } from "lucide-react";
import { useRequireRole } from "@/contexts/UserContext";

export default function SystemInboxPage() {
  const { isLoading } = useRequireRole("system_admin");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">System Inbox</h1>
          <p className="text-muted-foreground">Messages from organization administrators</p>
        </div>
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-system-inbox-title">System Inbox</h1>
        <p className="text-muted-foreground">Messages from organization administrators</p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="flex items-center gap-3 mb-4">
            <Mail className="w-12 h-12 text-muted-foreground" />
            <Construction className="w-8 h-8 text-muted-foreground" />
          </div>
          <CardTitle className="mb-2">Coming Soon</CardTitle>
          <CardDescription className="text-center max-w-md">
            This feature will allow organization administrators to send you questions and requests. 
            You'll be able to view and respond to messages from all your organizations in one place.
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}
