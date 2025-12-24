import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, apiFetch } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Trash2, Users, Loader2 } from "lucide-react";
import type { Route } from "@shared/schema";

interface ArchiveRouteDialogProps {
  route: Route;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface RiderInfo {
  id: string;
  subscriptionId: string;
}

interface DriverInfo {
  id: string;
}

interface ArchiveResult {
  message: string;
  affectedRiders: number;
  affectedDrivers: number;
}

export function ArchiveRouteDialog({ route, open, onOpenChange, onSuccess }: ArchiveRouteDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: riders = [], isLoading: loadingRiders, isError: ridersError } = useQuery<RiderInfo[]>({
    queryKey: ["/api/routes", route.id, "riders"],
    enabled: open && !!route.id,
    retry: false,
    staleTime: 0,
  });

  const { data: drivers = [], isLoading: loadingDrivers, isError: driversError } = useQuery<DriverInfo[]>({
    queryKey: ["/api/routes", route.id, "drivers"],
    enabled: open && !!route.id,
    retry: false,
    staleTime: 0,
  });

  const isLoading = loadingRiders || loadingDrivers;
  const hasDataError = ridersError || driversError;
  const totalAffected = riders.length + drivers.length;

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/routes/${route.id}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to archive route");
      }
      
      return response.json() as Promise<ArchiveResult>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/routes", route.id] });
      
      const affectedMessage = [];
      if (data.affectedRiders > 0) {
        affectedMessage.push(`${data.affectedRiders} rider${data.affectedRiders > 1 ? 's' : ''}`);
      }
      if (data.affectedDrivers > 0) {
        affectedMessage.push(`${data.affectedDrivers} driver${data.affectedDrivers > 1 ? 's' : ''}`);
      }
      
      toast({
        title: "Route archived",
        description: affectedMessage.length > 0 
          ? `Route archived successfully. ${affectedMessage.join(' and ')} had their access removed.`
          : "Route archived successfully.",
      });
      
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      setErrorMessage(error.message);
      toast({
        title: "Error archiving route",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleArchive = () => {
    setErrorMessage(null);
    archiveMutation.mutate();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-destructive" />
            Archive Route?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to archive <span className="font-semibold">{route.name}</span>?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading affected users...
            </div>
          ) : hasDataError ? (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                Unable to load affected users. Please try again or contact support if the problem persists.
              </AlertDescription>
            </Alert>
          ) : totalAffected > 0 ? (
            <Alert>
              <Users className="w-4 h-4" />
              <AlertDescription>
                <span className="font-semibold">{totalAffected} {totalAffected === 1 ? 'person' : 'people'}</span> will be affected:
                {riders.length > 0 && <span className="ml-1">{riders.length} rider{riders.length > 1 ? 's' : ''}</span>}
                {riders.length > 0 && drivers.length > 0 && <span>, </span>}
                {drivers.length > 0 && <span>{drivers.length} driver{drivers.length > 1 ? 's' : ''}</span>}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertDescription>
                No riders or drivers are currently assigned to this route.
              </AlertDescription>
            </Alert>
          )}
          
          <div className="text-sm text-muted-foreground">
            Archiving will temporarily deactivate this route without deleting any data:
            <ul className="mt-2 space-y-1 list-disc list-inside ml-2">
              <li>All riders and drivers will lose access to this route</li>
              <li>SMS subscriptions and alerts will be deactivated</li>
              <li>Route stops will be deactivated</li>
            </ul>
          </div>
          
          <p className="text-sm font-medium text-muted-foreground">
            You can restore this route later to resume service.
          </p>
        </div>

        {errorMessage && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel 
            disabled={archiveMutation.isPending || isLoading}
            data-testid="button-cancel-archive"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleArchive}
            disabled={archiveMutation.isPending || isLoading || hasDataError}
            className="bg-destructive hover:bg-destructive/90"
            data-testid="button-confirm-archive"
          >
            {archiveMutation.isPending ? "Archiving..." : "Archive Route"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
