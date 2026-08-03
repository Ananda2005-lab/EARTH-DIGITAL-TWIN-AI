'use client';

import { Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { Input } from '@/components/ui/input';

/**
 * Updates the URL's `q` search param on submit. Resets `page` back to 1 since
 * a new search invalidates the current page of results.
 */
export function AdminSearchBar({ placeholder = 'Search…' }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = React.useState(searchParams.get('q') ?? '');

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim() === '') {
      params.delete('q');
    } else {
      params.set('q', value.trim());
    }
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm">
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        leading={<Search />}
        placeholder={placeholder}
        aria-label="Search"
      />
    </form>
  );
}
