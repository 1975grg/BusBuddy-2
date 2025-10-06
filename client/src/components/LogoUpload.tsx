import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, X, Building, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ObjectUploader } from "@/components/ObjectUploader";

interface LogoUploadProps {
  currentLogo?: string;
  organizationName: string;
  onLogoUpdate?: (logoUrl: string) => void;
}

export function LogoUpload({ currentLogo, organizationName, onLogoUpdate }: LogoUploadProps) {
  const [uploadedLogo, setUploadedLogo] = useState<string | null>(currentLogo || null);
  const { toast } = useToast();

  const handleGetUploadParameters = async () => {
    const response = await fetch("/api/objects/upload", {
      method: "POST",
    });
    
    if (!response.ok) {
      throw new Error("Failed to get upload URL");
    }
    
    const { uploadURL, objectPath } = await response.json();
    
    return {
      method: "PUT" as const,
      url: uploadURL,
      objectPath,
    };
  };

  const handleComplete = (result: { successful: Array<{ uploadURL: string; objectPath: string }> }) => {
    if (result.successful && result.successful.length > 0) {
      const uploadedFile = result.successful[0];
      const objectPath = uploadedFile.objectPath;
      
      if (objectPath) {
        setUploadedLogo(objectPath);
        onLogoUpdate?.(objectPath);
        toast({
          title: "Logo uploaded successfully",
          description: "Your organization logo has been updated",
        });
      }
    }
  };

  const removeLogo = () => {
    setUploadedLogo(null);
    onLogoUpdate?.("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="w-5 h-5" />
          Organization Logo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Upload your organization's logo to personalize the Bus Buddy experience for your users.
        </div>

        {uploadedLogo ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Current Logo</Label>
              <Badge className="bg-bus-active text-white">
                <Check className="w-3 h-3 mr-1" />
                Active
              </Badge>
            </div>
            
            <div className="relative">
              <div className="w-32 h-32 border-2 border-dashed border-muted rounded-lg flex items-center justify-center bg-muted/20">
                <img
                  src={uploadedLogo}
                  alt={`${organizationName} logo`}
                  className="max-w-full max-h-full object-contain rounded"
                  data-testid="img-uploaded-logo"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      parent.innerHTML = '<div class="text-sm text-muted-foreground">Logo failed to load</div>';
                    }
                  }}
                />
              </div>
              <Button
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6"
                onClick={removeLogo}
                data-testid="button-remove-logo"
                title="Remove logo"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
            
            <div className="text-xs text-muted-foreground">
              This logo will appear in the sidebar, QR codes, and throughout the rider experience.
            </div>
          </div>
        ) : (
          <div className="border-2 border-dashed rounded-lg p-8 text-center border-muted-foreground/25">
            <div className="space-y-3">
              <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                <Upload className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No logo uploaded yet</p>
                <p className="text-sm text-muted-foreground">
                  Click the button below to upload
                </p>
              </div>
              <div className="text-xs text-muted-foreground">
                PNG, JPG, or SVG up to 5MB
              </div>
            </div>
          </div>
        )}

        <ObjectUploader
          maxNumberOfFiles={1}
          maxFileSize={5 * 1024 * 1024}
          onGetUploadParameters={handleGetUploadParameters}
          onComplete={handleComplete}
          buttonClassName="w-full"
        >
          <Upload className="w-4 h-4 mr-2" />
          {uploadedLogo ? "Change Logo" : "Upload Logo"}
        </ObjectUploader>
      </CardContent>
    </Card>
  );
}
