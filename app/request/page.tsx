import { Suspense } from "react";
import RequestClient from "./request-client";

export default function RequestPage() {
  return (
    <Suspense fallback={<div className="p-8 text-ink-muted">Loading…</div>}>
      <RequestClient />
    </Suspense>
  );
}
