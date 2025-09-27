import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Download, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface QrCodeDialogProps {
  routeId: string;
  routeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QrCodeDialog({ routeId, routeName, open, onOpenChange }: QrCodeDialogProps) {
  const { toast } = useToast();
  const [copiedUrl, setCopiedUrl] = useState(false);

  const { data: qrData, isLoading, error } = useQuery({
    queryKey: [`/api/routes/${routeId}/qr`],
    enabled: open && !!routeId,
  });

  const handleCopyUrl = async () => {
    if (!qrData?.url) return;
    
    try {
      await navigator.clipboard.writeText(qrData.url);
      setCopiedUrl(true);
      toast({
        title: "URL copied!",
        description: "The route URL has been copied to your clipboard.",
      });
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Could not copy URL to clipboard.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadQr = () => {
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

  const handleOpenUrl = () => {
    if (!qrData?.url) return;
    window.open(qrData.url, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            QR Code for {routeName}
            <Badge variant="outline">Rider Access</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {isLoading && (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}
          
          {error && (
            <div className="text-center text-destructive">
              Failed to generate QR code. Please try again.
            </div>
          )}
          
          {qrData && (
            <div className="space-y-6">
              {/* QR Code Image */}
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-lg border">
                  <img 
                    src={qrData.qrCodeDataUrl} 
                    alt={`QR code for ${routeName}`}
                    className="w-48 h-48"
                  />
                </div>
              </div>

              {/* Route URL */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Route URL:</label>
                <div className="flex items-center gap-2 p-2 bg-muted rounded border">
                  <code className="flex-1 text-xs break-all">{qrData.url}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopyUrl}
                    className="shrink-0"
                    data-testid="button-copy-url"
                  >
                    <Copy className={`w-4 h-4 ${copiedUrl ? 'text-green-600' : ''}`} />
                  </Button>
                </div>
              </div>

              {/* Instructions */}
              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                <p className="font-medium mb-1">For riders:</p>
                <p>Scan this QR code or visit the URL to access the {routeName} route dashboard and receive real-time notifications.</p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleDownloadQr}
                  className="flex-1"
                  data-testid="button-download-qr"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download QR
                </Button>
                <Button
                  variant="outline"
                  onClick={handleOpenUrl}
                  className="flex-1"
                  data-testid="button-open-url"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open URL
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}