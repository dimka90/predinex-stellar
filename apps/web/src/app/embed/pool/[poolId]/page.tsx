// apps/web/src/app/embed/pool/[poolId]/page.tsx
// Embeddable pool widget route – renders a standalone pool card
// that can be placed inside an <iframe> on any external site.
import { Suspense } from 'react';
import { PoolEmbedWidget } from '@/components/PoolEmbedWidget';

interface EmbedPageProps {
  params: { poolId: string };
  searchParams: Record<string, string | undefined>;
}

export default function EmbedPoolPage({ params, searchParams }: EmbedPageProps) {
  const theme = {
    primary: searchParams.primary ?? '#6366f1',
    bg: searchParams.bg ?? '#ffffff',
    text: searchParams.text ?? '#111827',
    fontSize: searchParams.fontSize ?? '14',
  };

  return (
    <Suspense fallback={<div className="p-4 text-center text-sm">Loading pool…</div>}>
      <PoolEmbedWidget poolId={params.poolId} theme={theme} />
    </Suspense>
  );
}
