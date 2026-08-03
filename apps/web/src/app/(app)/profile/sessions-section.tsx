'use client';

import { formatRelativeTime } from '@edt/shared';
import { Laptop, LogOut, Smartphone, Tablet } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { api, describeError } from '@/lib/api/client';

/** Mirrors `SessionSummary` from `apps/api/src/modules/auth/token.service.ts`. */
export interface SessionSummary {
  id: string;
  current: boolean;
  ip: string | null;
  userAgent: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  lastActiveAt: string;
  expiresAt: string;
  createdAt: string;
}

function deviceIcon(device: string | null) {
  const normalised = device?.toLowerCase() ?? '';
  if (normalised.includes('mobile') || normalised.includes('phone')) return Smartphone;
  if (normalised.includes('tablet')) return Tablet;
  return Laptop;
}

export function SessionsSection({ initialSessions }: { initialSessions: SessionSummary[] }) {
  const [sessions, setSessions] = React.useState(initialSessions);
  const [revokingId, setRevokingId] = React.useState<string | null>(null);
  const [signingOutAll, setSigningOutAll] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  async function revoke(sessionId: string) {
    setRevokingId(sessionId);
    try {
      await api(`/auth/sessions/${sessionId}`, { method: 'DELETE' });
      setSessions((prev) => prev.filter((session) => session.id !== sessionId));
      toast.success('Session revoked');
    } catch (error) {
      const { title, description } = describeError(error);
      toast.error(title, { description });
    } finally {
      setRevokingId(null);
    }
  }

  async function signOutEverywhere() {
    setSigningOutAll(true);
    try {
      await api('/auth/sessions', { method: 'DELETE' });
      setSessions((prev) => prev.filter((session) => session.current));
      toast.success('Signed out of every other session');
      setConfirmOpen(false);
    } catch (error) {
      const { title, description } = describeError(error);
      toast.error(title, { description });
    } finally {
      setSigningOutAll(false);
    }
  }

  const otherSessions = sessions.filter((session) => !session.current);

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs">
            {sessions.length} active {sessions.length === 1 ? 'session' : 'sessions'}
          </p>
          {otherSessions.length > 0 ? (
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <LogOut />
                  Sign out everywhere
                </Button>
              </DialogTrigger>
              <DialogContent size="sm">
                <DialogHeader>
                  <DialogTitle>Sign out of every other session?</DialogTitle>
                  <DialogDescription>
                    This revokes every session except the one you are using right now.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" loading={signingOutAll} onClick={signOutEverywhere}>
                    Sign out everywhere
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>

        <ul className="divide-border/60 divide-y">
          {sessions.map((session) => {
            const Icon = deviceIcon(session.device);
            return (
              <li key={session.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span className="bg-surface-muted text-muted-foreground mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">
                      {session.browser ?? 'Unknown browser'}
                      {session.os ? ` · ${session.os}` : ''}
                    </p>
                    {session.current ? <Badge variant="primary">This device</Badge> : null}
                  </div>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {session.ip ?? 'Unknown IP'} · active {formatRelativeTime(session.lastActiveAt)}
                  </p>
                </div>
                {!session.current ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={revokingId === session.id}
                    onClick={() => revoke(session.id)}
                  >
                    Revoke
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
