import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSectionSkeleton({ height = 320 }: { height?: number }) {
  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="space-y-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="w-full" style={{ height }} />
      </CardContent>
    </Card>
  );
}

export function DashboardLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-lg border bg-card p-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-9 w-14" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="border-none shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-3 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DashboardSectionSkeleton height={320} />
        </div>
        <div className="space-y-6">
          <DashboardSectionSkeleton height={280} />
          <DashboardSectionSkeleton height={280} />
        </div>
      </div>

      <DashboardSectionSkeleton height={360} />
      <DashboardSectionSkeleton height={420} />
    </div>
  );
}

export function DashboardErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card className="border-none shadow-sm">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Erro ao carregar dados</h2>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <button
          onClick={onRetry}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Tentar novamente
        </button>
      </CardContent>
    </Card>
  );
}