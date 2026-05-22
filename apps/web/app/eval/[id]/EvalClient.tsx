"use client";

import { use } from "react";
import { TraceViewer } from "@/components/TraceViewer";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EvalClient({ params }: PageProps) {
  const { id } = use(params);
  return <TraceViewer evalId={id} />;
}
