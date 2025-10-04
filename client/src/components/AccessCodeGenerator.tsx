import { useState } from "react";
import QRCode from "react-qr-code";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, Download, QrCode, Link2, Key } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface AccessCodeGeneratorProps {
  routeId: string;
  routeName: string;
  organizationName: string;
  organizationLogo?: string;
}

export function AccessCodeGenerator({ routeId, routeName, organizationName, organizationLogo }: AccessCodeGeneratorProps) {
  const { toast } = useToast();
  const [selectedMethod, setSelectedMethod] = useState<"qr" | "link" | "password">("qr");
  
  // Fetch real QR code data from API (same as QrCodeDialog)
  const { data: qrData, isLoading } = useQuery({
    queryKey: [`/api/routes/${routeId}/qr`],
    enabled: !!routeId,
  });

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: "Access code copied to clipboard",
      });
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const downloadQR = () => {
    if (!qrData?.qrCodeDataUrl) return;

    const link = document.createElement('a');
    link.href = qrData.qrCodeDataUrl;
    link.download = `${routeName.toLowerCase().replace(/\s+/g, '-')}-qr-code.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "QR code downloaded!",
      description: "The QR code image has been saved to your downloads.",
    });
  };

  const currentValue = qrData?.url || '';

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            Access Code Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="w-5 h-5" />
          Access Code Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Access Method</Label>
          <div className="flex gap-2 mt-2">
            <Button
              variant={selectedMethod === "qr" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedMethod("qr")}
              data-testid="button-method-qr"
            >
              <QrCode className="w-4 h-4 mr-1" />
              QR Code
            </Button>
            <Button
              variant={selectedMethod === "link" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedMethod("link")}
              data-testid="button-method-link"
            >
              <Link2 className="w-4 h-4 mr-1" />
              Link
            </Button>
            <Button
              variant={selectedMethod === "password" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedMethod("password")}
              disabled
              data-testid="button-method-password"
            >
              <Key className="w-4 h-4 mr-1" />
              Password
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              {selectedMethod === "qr" ? "QR Code" : selectedMethod === "link" ? "Magic Link" : "Access Password"}
            </Label>
            <Badge variant="outline">{routeName}</Badge>
          </div>

          {selectedMethod === "qr" && qrData?.qrCodeDataUrl && (
            <div className="flex flex-col items-center space-y-3">
              <div className="bg-white p-4 rounded-lg border">
                <img 
                  src={qrData.qrCodeDataUrl} 
                  alt={`QR code for ${routeName}`}
                  className="w-48 h-48"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(currentValue)}
                  data-testid="button-copy-qr"
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Copy URL
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadQR}
                  data-testid="button-download-qr"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </Button>
              </div>
            </div>
          )}

          {selectedMethod === "link" && (
            <div className="space-y-2">
              <Input
                value={currentValue}
                readOnly
                className="font-mono text-sm"
                data-testid="input-magic-link"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(currentValue)}
                className="w-full"
                data-testid="button-copy-link"
              >
                <Copy className="w-4 h-4 mr-1" />
                Copy Link
              </Button>
            </div>
          )}

          {selectedMethod === "password" && (
            <div className="space-y-2 opacity-50">
              <p className="text-sm text-muted-foreground text-center py-4">
                Password access coming soon
              </p>
            </div>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          Share this {selectedMethod === "qr" ? "QR code" : selectedMethod === "link" ? "link" : "password"} with riders to give them access to track the {routeName} route.
        </div>
      </CardContent>
    </Card>
  );
}
