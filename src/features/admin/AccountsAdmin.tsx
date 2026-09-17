import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { Button } from '../../ui/flat/Button'
import { Card } from '../../ui/flat/Card'
import { Badge } from '../../ui/flat/Badge'
import { Input } from '../../ui/flat/Input'
import { InitialsAvatar } from '../../ui/shared/InitialsAvatar'
import { SkeletonRows } from '../../ui/shared/Skeleton'
import { useToastStore } from '../../ui/overlays/toastStore'
import { confirmDialog } from '../../ui/overlays/confirmStore'
import { typedConfirmDialog } from '../../ui/overlays/typedConfirmStore'
import { useAuth, type Role } from '../auth/AuthContext'

interface AccountRow {
  id: string
  role: Role
  display_name: string
  avatar_url: string | null
  created_at: string
  linked_profile_id: string | null
}

const ROLE_LABEL: Record<Role, string> = { biker: 'Biker', photographer: 'Fotógrafo', admin: 'Admin' }
const ROLE_TONE: Record<Role, 'primary' | 'accent' | 'dark'> = { biker: 'primary', photographer: 'accent', admin: 'dark' }
const ROLE_TABS: { value: '' | Role; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'biker', label: 'Bikers' },
  { value: 'photographer', label: 'Fotógrafos' },
  { value: 'admin', label: 'Admins' },
]

async function fetchAccounts(): Promise<AccountRow[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, display_name, avatar_url, created_at, linked_profile_id')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as AccountRow[]) ?? []
}

export function AccountsAdmin() {
  const { profile: me } = useAuth()
  const push = useToastStore((s) => s.push)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'' | Role>('')
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const [linkQuery, setLinkQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({ queryKey: ['admin_accounts'], queryFn: fetchAccounts })

  const accountsById = useMemo(() => new Map((data ?? []).map((a) => [a.id, a])), [data])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data ?? []).filter((a) => {
      if (roleFilter && a.role !== roleFilter) return false
      if (q && !a.display_name.toLowerCase().includes(q)) return false
      return true
    })
  }, [data, query, roleFilter])

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ['admin_accounts'] })
  }

  async function changeRole(account: AccountRow, newRole: Role) {
    if (newRole === account.role) return
    const ok = await confirmDialog.ask({
      title: `¿Convertir a "${account.display_name}" en ${ROLE_LABEL[newRole]}?`,
      description: 'La cuenta conserva su historial, pero a partir de ahora entra y funciona como ' + ROLE_LABEL[newRole].toLowerCase() + '.',
    })
    if (!ok) return
    setBusyId(account.id)
    const { error } = await supabase.rpc('admin_set_role', { target_id: account.id, new_role: newRole })
    setBusyId(null)
    if (error) {
      push({ type: 'error', title: 'No se pudo cambiar el rol', description: error.message })
      return
    }
    push({ type: 'success', title: 'Rol actualizado' })
    refetch()
  }

  async function linkTo(account: AccountRow, other: AccountRow) {
    setBusyId(account.id)
    const { error } = await supabase.rpc('admin_link_profiles', { profile_a: account.id, profile_b: other.id })
    setBusyId(null)
    setLinkingId(null)
    setLinkQuery('')
    if (error) {
      push({ type: 'error', title: 'No se pudo vincular', description: error.message })
      return
    }
    push({ type: 'success', title: `Vinculado con ${other.display_name}` })
    refetch()
  }

  async function unlink(account: AccountRow) {
    setBusyId(account.id)
    const { error } = await supabase.rpc('admin_unlink_profile', { target_id: account.id })
    setBusyId(null)
    if (error) {
      push({ type: 'error', title: 'No se pudo desvincular', description: error.message })
      return
    }
    push({ type: 'success', title: 'Cuentas desvinculadas' })
    refetch()
  }

  async function deleteAccount(account: AccountRow) {
    const ok = await confirmDialog.ask({
      title: `¿Eliminar la cuenta de "${account.display_name}"?`,
      description: 'Borra su perfil, eventos, fotos y pedidos según corresponda. No se puede deshacer.',
      tone: 'danger',
    })
    if (!ok) return
    const { confirmed } = await typedConfirmDialog.ask({
      title: 'Última confirmación',
      description: 'Esta acción es irreversible.',
      matchText: account.display_name,
      matchLabel: 'Escribe el nombre de la cuenta para confirmar',
      confirmLabel: 'Eliminar cuenta',
    })
    if (!confirmed) return
    setBusyId(account.id)
    const { error } = await supabase.functions.invoke('admin-delete-account', { body: { targetId: account.id } })
    setBusyId(null)
    if (error) {
      push({ type: 'error', title: 'No se pudo eliminar la cuenta', description: error.message })
      return
    }
    push({ type: 'success', title: 'Cuenta eliminada' })
    refetch()
  }

  const linkCandidates =
    linkingId && linkQuery.trim()
      ? (data ?? [])
          .filter((a) => a.id !== linkingId && a.display_name.toLowerCase().includes(linkQuery.trim().toLowerCase()))
          .slice(0, 6)
      : []

  return (
    <div className="mx-auto max-w-4xl px-6 py-16 font-flat">
      <h1 className="mb-2 text-3xl font-bold tracking-tight">Cuentas</h1>
      <p className="mb-8 text-muted-foreground">
        Todas las cuentas de la plataforma — identifica bikers y fotógrafos, vincula cuentas de una misma persona, cambia su rol o elimínalas.
      </p>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-full bg-muted p-1 text-sm font-medium">
          {ROLE_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setRoleFilter(tab.value)}
              className={
                'rounded-full px-4 py-2 text-xs uppercase tracking-wide transition-colors ' +
                (roleFilter === tab.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Input placeholder="Buscar por nombre…" value={query} onChange={(e) => setQuery(e.target.value)} className="sm:max-w-xs" />
      </div>

      {isLoading && <SkeletonRows count={5} />}
      {error && <p className="text-red-600">No se pudo cargar la lista.</p>}

      <div className="flex flex-col gap-3">
        {filtered.map((account) => {
          const linked = account.linked_profile_id ? accountsById.get(account.linked_profile_id) : null
          const busy = busyId === account.id
          const otherRole: Role = account.role === 'photographer' ? 'biker' : 'photographer'

          return (
            <Card key={account.id} className="cursor-default hover:scale-100">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <InitialsAvatar name={account.display_name || '?'} className="h-11 w-11 shrink-0 rounded-full bg-foreground text-sm text-background" />
                  <div>
                    <p className="font-bold">{account.display_name || 'Sin nombre'}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge tone={ROLE_TONE[account.role]}>{ROLE_LABEL[account.role]}</Badge>
                      {linked && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                          🔗 Vinculada con {linked.display_name}
                          <button onClick={() => unlink(account)} disabled={busy} className="font-semibold text-foreground hover:underline">
                            Quitar
                          </button>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {account.role !== 'admin' && (
                    <Button size="sm" variant="secondary" loading={busy} onClick={() => changeRole(account, otherRole)}>
                      Convertir en {ROLE_LABEL[otherRole]}
                    </Button>
                  )}
                  {!linked && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setLinkingId(linkingId === account.id ? null : account.id)
                        setLinkQuery('')
                      }}
                    >
                      Vincular cuenta
                    </Button>
                  )}
                  {account.id !== me?.id && (
                    <Button size="sm" variant="secondary" loading={busy} className="text-red-600 hover:bg-red-50" onClick={() => deleteAccount(account)}>
                      Eliminar
                    </Button>
                  )}
                </div>
              </div>

              {linkingId === account.id && (
                <div className="mt-4 border-t border-border pt-4">
                  <Input
                    autoFocus
                    placeholder="Busca por nombre la otra cuenta de esta persona…"
                    value={linkQuery}
                    onChange={(e) => setLinkQuery(e.target.value)}
                  />
                  {linkQuery.trim() && (
                    <div className="mt-2 flex flex-col gap-1">
                      {linkCandidates.length === 0 && <p className="px-2 py-1 text-sm text-muted-foreground">Sin resultados.</p>}
                      {linkCandidates.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => linkTo(account, c)}
                          className="flex items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          <span>
                            {c.display_name} <span className="text-muted-foreground">· {ROLE_LABEL[c.role]}</span>
                          </span>
                          <span className="font-semibold text-primary">Vincular</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          )
        })}
        {!isLoading && filtered.length === 0 && <p className="text-muted-foreground">No hay cuentas que coincidan.</p>}
      </div>
    </div>
  )
}
