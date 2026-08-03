'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';

/** Previous/Next controls that adjust the `page` search param in place. */
export function AdminPagination({
  page,
  hasNext,
  hasPrevious,
}: {
  page: number;
  hasNext: boolean;
  hasPrevious: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function goTo(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage <= 1) {
      params.delete('page');
    } else {
      params.set('page', String(nextPage));
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Button variant="outline" size="sm" disabled={!hasPrevious} onClick={() => goTo(page - 1)}>
        <ChevronLeft />
        Previous
      </Button>
      <Button variant="outline" size="sm" disabled={!hasNext} onClick={() => goTo(page + 1)}>
        Next
        <ChevronRight />
      </Button>
    </div>
  );
}
