import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, Link2, Key, Smartphone } from "lucide-react";

interface AccessLoginProps {
  onAccessGranted: (method: string, value: string) => void;
}

export function AccessLogin({ onAccessGranted }: AccessLoginProps) {
  const [accessMethod, setAccessMethod] = useState<"qr" | "link" | "password">("qr");
  const [inputValue, setInputValue] = useState("");
  const [isScanning, setIsScanning] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onAccessGranted(accessMethod, inputValue.trim());
      console.log(`Access granted via ${accessMethod}:`, inputValue);
    }
  };

  const startQRScan = () => {
    setIsScanning(true);
    // TODO: remove mock functionality - replace with real QR scanner
    setTimeout(() => {
      setIsScanning(false);
      onAccessGranted("qr", "mock-qr-code-data");
    }, 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 to-primary/10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-4">
            <Smartphone className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Access Bus Tracker</CardTitle>
          <p className="text-muted-foreground">
            Choose how you'd like to access the tracking system
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant={accessMethod === "qr" ? "default" : "outline"}
              className="flex flex-col h-auto py-3"
              onClick={() => setAccessMethod("qr")}
              data-testid="button-access-qr"
            >
              <QrCode className="w-5 h-5 mb-1" />
              <span className="text-xs">QR Code</span>
            </Button>
            <Button
              variant={accessMethod === "link" ? "default" : "outline"}
              className="flex flex-col h-auto py-3"
              onClick={() => setAccessMethod("link")}
              data-testid="button-access-link"
            >
              <Link2 className="w-5 h-5 mb-1" />
              <span className="text-xs">Link</span>
            </Button>
            <Button
              variant={accessMethod === "password" ? "default" : "outline"}
              className="flex flex-col h-auto py-3"
              onClick={() => setAccessMethod("password")}
              data-testid="button-access-password"
            >
              <Key className="w-5 h-5 mb-1" />
              <span className="text-xs">Password</span>
            </Button>
          </div>

          {accessMethod === "qr" && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-48 h-48 mx-auto bg-muted rounded-lg flex items-center justify-center mb-4">
                  {isScanning ? (
                    <div className="text-center">
                      <div className="animate-pulse text-primary">
                        <QrCode className="w-16 h-16 mx-auto mb-2" />
                      </div>
                      <p className="text-sm">Scanning...</p>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <QrCode className="w-16 h-16 mx-auto mb-2" />
                      <p className="text-sm">Tap to scan QR code</p>
                    </div>
                  )}
                </div>
                <Button 
                  onClick={startQRScan} 
                  disabled={isScanning}
                  className="w-full"
                  data-testid="button-scan-qr"
                >
                  {isScanning ? "Scanning..." : "Start QR Scanner"}
                </Button>
              </div>
            </div>
          )}

          {accessMethod === "link" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="magic-link">Magic Link</Label>
                <Input
                  id="magic-link"
                  placeholder="Paste your tracking link here"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  data-testid="input-magic-link"
                />
              </div>
              <Button type="submit" className="w-full" data-testid="button-submit-link">
                Access with Link
              </Button>
            </form>
          )}

          {accessMethod === "password" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="access-password">Access Password</Label>
                <Input
                  id="access-password"
                  type="password"
                  placeholder="Enter access password"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  data-testid="input-access-password"
                />
              </div>
              <Button type="submit" className="w-full" data-testid="button-submit-password">
                Access with Password
              </Button>
            </form>
          )}

          <div className="text-center text-xs text-muted-foreground">
            Don't have access? Contact your organization's administrator.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}