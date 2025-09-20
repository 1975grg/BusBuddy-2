import { useState } from "react";
import QRCode from "react-qr-code";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, Download, QrCode, Link2, Key } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AccessMethod {
  type: "qr" | "link" | "password";
  value: string;
  label: string;
}

interface AccessCodeGeneratorProps {
  routeName: string;
  organizationName: string;
  organizationLogo?: string;
}

export function AccessCodeGenerator({ routeName, organizationName, organizationLogo }: AccessCodeGeneratorProps) {
  const { toast } = useToast();
  const [selectedMethod, setSelectedMethod] = useState<"qr" | "link" | "password">("qr");
  
  // TODO: remove mock functionality - replace with real access code generation
  const mockAccessMethods: AccessMethod[] = [
    {
      type: "qr",
      value: `https://busbuddy.app/track/${routeName.toLowerCase().replace(/\s+/g, '-')}?org=${organizationName}`,
      label: "QR Code"
    },
    {
      type: "link",
      value: `https://busbuddy.app/track/${routeName.toLowerCase().replace(/\s+/g, '-')}?org=${organizationName}`,
      label: "Magic Link"
    },
    {
      type: "password",
      value: "SCHOOL123",
      label: "Access Password"
    }
  ];

  const currentMethod = mockAccessMethods.find(m => m.type === selectedMethod)!;

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
    const svg = document.querySelector("#qr-code svg");
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        const link = document.createElement("a");
        link.download = `${routeName}-qr-code.png`;
        link.href = canvas.toDataURL();
        link.click();
      };
      
      img.src = "data:image/svg+xml;base64," + btoa(svgData);
    }
  };

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
              data-testid="button-method-password"
            >
              <Key className="w-4 h-4 mr-1" />
              Password
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">{currentMethod.label}</Label>
            <Badge variant="outline">{routeName}</Badge>
          </div>

          {selectedMethod === "qr" && (
            <div className="flex flex-col items-center space-y-3">
              <div id="qr-code" className="bg-white p-4 rounded-lg relative">
                <QRCode value={currentMethod.value} size={200} />
                {organizationLogo && (
                  <div className="absolute bottom-2 right-2 w-8 h-8 bg-white rounded p-1 shadow-sm">
                    <img 
                      src={organizationLogo} 
                      alt={organizationName}
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(currentMethod.value)}
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
                value={currentMethod.value}
                readOnly
                className="font-mono text-sm"
                data-testid="input-magic-link"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(currentMethod.value)}
                className="w-full"
                data-testid="button-copy-link"
              >
                <Copy className="w-4 h-4 mr-1" />
                Copy Link
              </Button>
            </div>
          )}

          {selectedMethod === "password" && (
            <div className="space-y-2">
              <Input
                value={currentMethod.value}
                readOnly
                className="font-mono text-lg text-center"
                data-testid="input-access-password"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(currentMethod.value)}
                className="w-full"
                data-testid="button-copy-password"
              >
                <Copy className="w-4 h-4 mr-1" />
                Copy Password
              </Button>
            </div>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          Share this {currentMethod.label.toLowerCase()} with riders to give them access to track the {routeName} route.
        </div>
      </CardContent>
    </Card>
  );
}