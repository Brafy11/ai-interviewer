import { Suspense } from "react";
import InterviewClient from "@/components/InterviewClient";

// useSearchParams (read inside InterviewClient) must sit under a Suspense boundary
// for the static export to prerender this route.
export default function InterviewPage() {
  return (
    <Suspense fallback={null}>
      <InterviewClient />
    </Suspense>
  );
}
