import { Suspense } from "react";
import ReportClient from "@/components/ReportClient";

export default function ReportPage() {
  return (
    <Suspense fallback={null}>
      <ReportClient />
    </Suspense>
  );
}
