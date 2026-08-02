import { PageContainer } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** Route-level fallback while a server component tree resolves. */
export default function AppLoading() {
  return (
    <PageContainer>
      <div className="mb-6 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} className="p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-4 h-7 w-20" />
            <Skeleton className="mt-3 h-3 w-32" />
          </Card>
        ))}
      </div>
      <Card className="p-6">
        <Skeleton className="h-5 w-40" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      </Card>
    </PageContainer>
  );
}
