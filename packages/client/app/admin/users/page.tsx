'use client'

import { useEffect, useState } from 'react'
import { useRequireRole } from '@/hooks/useAuth'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type User = {
  id: string
  name: string
  email: string
  role: string
  emailVerified: boolean
  createdAt: string
}

type DialogMode = 'create' | 'edit' | 'reset-password' | null

const roleBadgeVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  admin: 'destructive',
  staff: 'default',
  user: 'secondary',
}

export default function UsersPage() {
  const { session, isPending } = useRequireRole('admin')
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [dialogMode, setDialogMode] = useState<DialogMode>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)

  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formRole, setFormRole] = useState('user')
  const [formPassword, setFormPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function fetchUsers() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) throw new Error('Failed to load users')
      const data = await res.json()
      setUsers(data.users)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session) fetchUsers()
  }, [session])

  function openCreate() {
    setFormName('')
    setFormEmail('')
    setFormRole('user')
    setFormPassword('')
    setFormError(null)
    setSelectedUser(null)
    setDialogMode('create')
  }

  function openEdit(user: User) {
    setFormName(user.name)
    setFormEmail(user.email)
    setFormRole(user.role)
    setFormPassword('')
    setFormError(null)
    setSelectedUser(user)
    setDialogMode('edit')
  }

  function openResetPassword(user: User) {
    setFormPassword('')
    setFormError(null)
    setSelectedUser(user)
    setDialogMode('reset-password')
  }

  function closeDialog() {
    setDialogMode(null)
    setSelectedUser(null)
    setFormError(null)
  }

  async function handleCreate() {
    setSubmitting(true)
    setFormError(null)
    try {
      const res = await fetch('/api/auth/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName, email: formEmail, password: formPassword, role: formRole }),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error); return }
      closeDialog()
      fetchUsers()
    } catch {
      setFormError('Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEdit() {
    if (!selectedUser) return
    setSubmitting(true)
    setFormError(null)
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName, role: formRole }),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error); return }
      closeDialog()
      fetchUsers()
    } catch {
      setFormError('Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResetPassword() {
    if (!selectedUser) return
    setSubmitting(true)
    setFormError(null)
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: formPassword }),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error); return }
      closeDialog()
    } catch {
      setFormError('Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await fetch(`/api/admin/users/${deleteTarget.id}`, { method: 'DELETE' })
      setDeleteTarget(null)
      fetchUsers()
    } catch {
      // silently fail — user can retry
    }
  }

  if (isPending) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>
  }
  if (!session) return null

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">User Management</h1>
            <p className="text-gray-400 mt-1">Manage accounts, roles, and passwords</p>
          </div>
          <Button onClick={openCreate}>+ New User</Button>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-900/50 border border-red-700 px-4 py-3 text-red-300">
            {error}
          </div>
        )}

        <div className="rounded-lg border border-gray-700 bg-gray-800 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-700 hover:bg-transparent">
                <TableHead className="text-gray-400">Name</TableHead>
                <TableHead className="text-gray-400">Email</TableHead>
                <TableHead className="text-gray-400">Role</TableHead>
                <TableHead className="text-gray-400">Created</TableHead>
                <TableHead className="text-gray-400 w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500 py-12">
                    Loading users…
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500 py-12">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} className="border-gray-700 hover:bg-gray-700/50">
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="text-gray-300">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={roleBadgeVariant[user.role] ?? 'outline'}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-400 text-sm">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-white">
                              ···
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700 text-white">
                          <DropdownMenuItem
                            className="hover:bg-gray-700 cursor-pointer"
                            onClick={() => openEdit(user)}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="hover:bg-gray-700 cursor-pointer"
                            onClick={() => openResetPassword(user)}
                          >
                            Reset Password
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-gray-700" />
                          <DropdownMenuItem
                            className="hover:bg-red-900/50 text-red-400 cursor-pointer"
                            onClick={() => setDeleteTarget(user)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <p className="mt-4 text-sm text-gray-500">{users.length} user{users.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogMode === 'create' || dialogMode === 'edit'} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>{dialogMode === 'create' ? 'Create User' : 'Edit User'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                className="bg-gray-900 border-gray-600 text-white"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            {dialogMode === 'create' && (
              <div className="space-y-1">
                <Label>Email</Label>
                <Input
                  type="email"
                  className="bg-gray-900 border-gray-600 text-white"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
            )}
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={formRole} onValueChange={(v) => v && setFormRole(v)}>
                <SelectTrigger className="bg-gray-900 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {dialogMode === 'create' && (
              <div className="space-y-1">
                <Label>Password</Label>
                <Input
                  type="password"
                  className="bg-gray-900 border-gray-600 text-white"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                />
              </div>
            )}
            {formError && <p className="text-sm text-red-400">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog} disabled={submitting}>Cancel</Button>
            <Button onClick={dialogMode === 'create' ? handleCreate : handleEdit} disabled={submitting}>
              {submitting ? 'Saving…' : dialogMode === 'create' ? 'Create' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={dialogMode === 'reset-password'} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-400">
              Setting new password for <span className="text-white font-medium">{selectedUser?.name}</span>
            </p>
            <div className="space-y-1">
              <Label>New Password</Label>
              <Input
                type="password"
                className="bg-gray-900 border-gray-600 text-white"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder="Min. 8 characters"
              />
            </div>
            {formError && <p className="text-sm text-red-400">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog} disabled={submitting}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={submitting}>
              {submitting ? 'Saving…' : 'Reset Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent className="bg-gray-800 border-gray-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This will permanently delete <span className="text-white font-medium">{deleteTarget?.name}</span> and all
              their sessions. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-700 hover:bg-red-600 text-white"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
