import { lazy, Suspense } from "react";
import { DashboardSectionSkeleton } from "@/components/dashboard/DashboardStates";

const LazyStatusBySupplierChart = lazy(() =>
  import("@/components/StatusBySupplierChart").then((module) => ({ default: module.StatusBySupplierChart })),
);

const LazyFornecedorPieChart = lazy(() =>
  import("@/components/FornecedorPieChart").then((module) => ({ default: module.FornecedorPieChart })),
);

const LazyShipmentTypeChart = lazy(() =>
  import("@/components/ShipmentTypeChart").then((module) => ({ default: module.ShipmentTypeChart })),
);

const LazySalesVsPurchasesChart = lazy(() =>
  import("@/components/SalesVsPurchasesChart").then((module) => ({ default: module.SalesVsPurchasesChart })),
);

const LazySmartAlerts = lazy(() =>
  import("@/components/SmartAlerts").then((module) => ({ default: module.SmartAlerts })),
);

const LazyCodeLookupTable = lazy(() =>
  import("@/components/CodeLookupTable").then((module) => ({ default: module.CodeLookupTable })),
);

export function DashboardChartsSection({
  data,
  activeStatus,
  onStatusClick,
}: {
  data: any[];
  activeStatus: string | null;
  onStatusClick: (status: string) => void;
}) {
  return (
    <>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Suspense fallback={<DashboardSectionSkeleton height={320} />}>
            <LazyStatusBySupplierChart data={data} onStatusClick={onStatusClick} activeStatus={activeStatus} />
          </Suspense>
        </div>

        <Suspense fallback={<DashboardSectionSkeleton height={280} />}>
          <LazyFornecedorPieChart data={data} />
        </Suspense>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<DashboardSectionSkeleton height={320} />}>
          <LazyShipmentTypeChart data={data} />
        </Suspense>

        <Suspense fallback={<DashboardSectionSkeleton height={320} />}>
          <LazySalesVsPurchasesChart data={data} />
        </Suspense>
      </div>
    </>
  );
}

export function DashboardInsightsSection({
  data,
  activePo,
  onPoSelect,
}: {
  data: any[];
  activePo?: string | null;
  onPoSelect: (po: string) => void;
}) {
  return (
    <>
      <Suspense fallback={<DashboardSectionSkeleton height={420} />}>
        <LazySmartAlerts data={data} activePo={activePo} />
      </Suspense>

      <Suspense fallback={<DashboardSectionSkeleton height={360} />}>
        <LazyCodeLookupTable data={data} onPoSelect={onPoSelect} />
      </Suspense>
    </>
  );
}