import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, X, Building, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LogoUploadProps {
  currentLogo?: string;
  organizationName: string;
  onLogoUpdate?: (logoUrl: string) => void;
}

export function LogoUpload({ currentLogo, organizationName, onLogoUpdate }: LogoUploadProps) {
  const [uploadedLogo, setUploadedLogo] = useState<string | null>(currentLogo || null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (PNG, JPG, SVG)",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    
    try {
      // TODO: remove mock functionality - replace with real file upload to object storage
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setUploadedLogo(result);
        onLogoUpdate?.(result);
        toast({
          title: "Logo uploaded successfully",
          description: "Your organization logo has been updated",
        });
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Upload failed:", error);
      toast({
        title: "Upload failed",
        description: "There was an error uploading your logo. Please try again.",
        variant: "destructive"
      });
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const removeLogo = () => {
    setUploadedLogo(null);
    onLogoUpdate?.("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
                />
              </div>
              <Button
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6"
                onClick={removeLogo}
                data-testid="button-remove-logo"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
            
            <div className="text-xs text-muted-foreground">
              This logo will appear in the sidebar, QR codes, and throughout the rider experience.
            </div>
          </div>
        ) : (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive 
                ? "border-primary bg-primary/5" 
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <div className="space-y-3">
              <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                <Upload className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Drop your logo here</p>
                <p className="text-sm text-muted-foreground">
                  or click to browse files
                </p>
              </div>
              <div className="text-xs text-muted-foreground">
                PNG, JPG, or SVG up to 5MB
              </div>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileInputChange}
          className="hidden"
          data-testid="input-logo-file"
        />

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex-1"
            data-testid="button-browse-logo"
          >
            <Upload className="w-4 h-4 mr-2" />
            {isUploading ? "Uploading..." : uploadedLogo ? "Change Logo" : "Browse Files"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}