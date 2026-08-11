'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Label } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

/** Toggles the `flaggedOnly` search param so admins can filter AI logs. */
export function AiLogsFlaggedToggle({ checked }: { checked: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function toggle(next: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set('flaggedOnly', 'true');
    else params.delete('flaggedOnly');
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <label className="flex items-center gap-2">
      <Switch checked={checked} onCheckedChange={toggle} aria-label="Only flagged interactions" />
      <Label className="text-muted-foreground text-xs font-normal">Flagged only</Label>
    </label>
  );
}
