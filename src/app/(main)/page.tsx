import { Suspense } from "react";
import { HomeContent } from "@/components/home/HomeContent";

export default function HomePage() {
  return (
    <Suspense fallback={<HomeLoadingSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}

function HomeLoadingSkeleton() {
  return (
    <div className="min-h-dvh bg-[#0b0d12]">
      <div className="h-dvh max-h-[900px] skeleton" />
    </div>
  );
}
