'use client';

import { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

interface DirectoryEntry {
  userId: string;
  name: string;
  email: string;
  extension: string | null;
  cellPhone: string | null;
  title: string | null;
  directLine: string | null;
}

async function getAuthToken(): Promise<string | null> {
  try {
    const response = await fetch('/api/auth/token');
    if (!response.ok) return null;
    const data = await response.json();
    return data.token;
  } catch {
    return null;
  }
}

export default function TeamDirectory() {
  const { data: session } = authClient.useSession();
  const isAdmin = (session?.user as any)?.role === 'admin';

  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<DirectoryEntry | null>(null);
  const [formExtension, setFormExtension] = useState('');
  const [formCellPhone, setFormCellPhone] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDirectLine, setFormDirectLine] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function fetchDirectory() {
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Authentication required. Please sign in again.');

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/team-directory`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Failed to load team directory');
      setEntries(data.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session) fetchDirectory();
  }, [session]);

  function openEdit(entry: DirectoryEntry) {
    setFormExtension(entry.extension || '');
    setFormCellPhone(entry.cellPhone || '');
    setFormTitle(entry.title || '');
    setFormDirectLine(entry.directLine || '');
    setFormError(null);
    setEditTarget(entry);
  }

  function closeEdit() {
    setEditTarget(null);
    setFormError(null);
  }

  async function handleSave() {
    if (!editTarget) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Authentication required. Please sign in again.');

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/team-directory/${editTarget.userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          extension: formExtension,
          cellPhone: formCellPhone,
          title: formTitle,
          directLine: formDirectLine,
        }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Failed to save');
      closeEdit();
      fetchDirectory();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Team Directory</h1>
          <p className="text-gray-400 mt-1">Extensions, cell phones, and titles for the team</p>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-900/50 border border-red-700 px-4 py-3 text-red-300">
            {error}
          </div>
        )}

        <div className="rounded-lg border border-gray-700 bg-gray-800 overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-700 hover:bg-transparent">
                <TableHead className="text-gray-400">Name</TableHead>
                <TableHead className="text-gray-400">Email</TableHead>
                <TableHead className="text-gray-400">Title / Department</TableHead>
                <TableHead className="text-gray-400">Extension</TableHead>
                <TableHead className="text-gray-400">Direct Line</TableHead>
                <TableHead className="text-gray-400">Cell Phone</TableHead>
                {isAdmin && <TableHead className="text-gray-400 w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 7 : 6} className="text-center text-gray-500 py-12">
                    Loading team directory…
                  </TableCell>
                </TableRow>
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 7 : 6} className="text-center text-gray-500 py-12">
                    No team members found
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => (
                  <TableRow key={entry.userId} className="border-gray-700 hover:bg-gray-700/50">
                    <TableCell className="font-medium">{entry.name}</TableCell>
                    <TableCell className="text-gray-300">{entry.email}</TableCell>
                    <TableCell className="text-gray-300">{entry.title || '—'}</TableCell>
                    <TableCell className="text-gray-300">{entry.extension || '—'}</TableCell>
                    <TableCell className="text-gray-300">{entry.directLine || '—'}</TableCell>
                    <TableCell className="text-gray-300">{entry.cellPhone || '—'}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(entry)}>
                          Edit
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <p className="mt-4 text-sm text-gray-500">
          {entries.length} team member{entries.length !== 1 ? 's' : ''}
        </p>
      </div>

      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) closeEdit(); }}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Edit {editTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Title / Department</Label>
              <Input
                className="bg-gray-900 border-gray-600 text-white"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Tax Preparer"
              />
            </div>
            <div className="space-y-1">
              <Label>Extension</Label>
              <Input
                className="bg-gray-900 border-gray-600 text-white"
                value={formExtension}
                onChange={(e) => setFormExtension(e.target.value)}
                placeholder="e.g. x104"
              />
            </div>
            <div className="space-y-1">
              <Label>Direct Line</Label>
              <Input
                className="bg-gray-900 border-gray-600 text-white"
                value={formDirectLine}
                onChange={(e) => setFormDirectLine(e.target.value)}
                placeholder="e.g. (555) 123-4567"
              />
            </div>
            <div className="space-y-1">
              <Label>Cell Phone</Label>
              <Input
                className="bg-gray-900 border-gray-600 text-white"
                value={formCellPhone}
                onChange={(e) => setFormCellPhone(e.target.value)}
                placeholder="e.g. (555) 987-6543"
              />
            </div>
            {formError && <p className="text-sm text-red-400">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeEdit} disabled={submitting}>Cancel</Button>
            <Button onClick={handleSave} disabled={submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
