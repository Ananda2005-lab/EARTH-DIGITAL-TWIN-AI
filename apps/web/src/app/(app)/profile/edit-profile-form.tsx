'use client';

import type { UserProfile } from '@edt/shared';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { api, describeError } from '@/lib/api/client';

export function EditProfileForm({ profile }: { profile: UserProfile }) {
  const [name, setName] = React.useState(profile.name);
  const [organisation, setOrganisation] = React.useState(profile.organisation ?? '');
  const [jobTitle, setJobTitle] = React.useState(profile.jobTitle ?? '');
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await api<UserProfile>('/users/me', {
        method: 'PATCH',
        body: {
          name: name.trim() || undefined,
          organisation: organisation.trim() || null,
          jobTitle: jobTitle.trim() || null,
        },
      });
      toast.success('Profile updated');
    } catch (error) {
      const { title, description } = describeError(error);
      toast.error(title, { description });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <form onSubmit={handleSubmit} className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">Name</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-organisation">Organisation</Label>
            <Input
              id="profile-organisation"
              value={organisation}
              onChange={(event) => setOrganisation(event.target.value)}
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="profile-job-title">Job title</Label>
            <Input
              id="profile-job-title"
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
              maxLength={120}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" loading={saving}>
              Save changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
