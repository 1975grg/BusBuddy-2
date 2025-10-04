import { useState, useRef } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Upload } from "lucide-react";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters: () => Promise<{
    method: "PUT";
    url: string;
    objectPath: string;
  }>;
  onComplete?: (result: { successful: Array<{ uploadURL: string; objectPath: string }> }) => void;
  buttonClassName?: string;
  children: ReactNode;
  acceptedFileTypes?: string;
}

export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 10485760,
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
  acceptedFileTypes = "image/*",
}: ObjectUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    if (file.size > maxFileSize) {
      alert(`File too large. Maximum size is ${maxFileSize / (1024 * 1024)}MB`);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const { url, objectPath } = await onGetUploadParameters();
      
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100;
          setUploadProgress(progress);
        }
      });

      xhr.addEventListener('load', async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const aclResponse = await fetch('/api/objects/acl', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ objectPath })
            });
            
            if (!aclResponse.ok) {
              throw new Error('Failed to set ACL policy');
            }

            const { objectPath: finalPath } = await aclResponse.json();
            
            onComplete?.({
              successful: [{ uploadURL: url, objectPath: finalPath }]
            });
            setShowModal(false);
            setIsUploading(false);
            setUploadProgress(0);
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
          } catch (error) {
            console.error('ACL setup error:', error);
            alert('Upload succeeded but ACL setup failed. Please try again.');
            setIsUploading(false);
          }
        } else {
          alert('Upload failed. Please try again.');
          setIsUploading(false);
        }
      });

      xhr.addEventListener('error', () => {
        alert('Upload failed. Please try again.');
        setIsUploading(false);
      });

      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);

    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed. Please try again.');
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setShowModal(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div>
      <Button 
        onClick={() => setShowModal(true)} 
        className={buttonClassName} 
        data-testid="button-upload"
      >
        {children}
      </Button>

      <Dialog open={showModal} onOpenChange={handleClose}>
        <DialogContent data-testid="dialog-upload">
          <DialogHeader>
            <DialogTitle>Upload File</DialogTitle>
            <DialogDescription>
              Select a file to upload (max {maxFileSize / (1024 * 1024)}MB)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <input
                ref={fileInputRef}
                type="file"
                accept={acceptedFileTypes}
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-file"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                data-testid="button-browse"
              >
                {isUploading ? 'Uploading...' : 'Browse Files'}
              </Button>
            </div>
            
            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Uploading...</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
