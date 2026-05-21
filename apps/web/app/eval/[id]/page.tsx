import { TraceViewer } from "@/components/TraceViewer";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EvalPage({ params }: PageProps) {
  const { id } = await params;
  return <TraceViewer evalId={id} />;
}
