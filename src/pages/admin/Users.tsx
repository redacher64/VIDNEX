import React, { useEffect, useState } from 'react';
import {
  Users as UsersIcon,
  Plus,
  Copy,
  Check,
  Trash2,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Edit3,
  RotateCcw,
  Save,
} from './AdminIcons';
import { type AdminPermission } from './Login';

interface ManagedUser {
  id: number;
  login: string;
  display_name: string;
  role_label: string;
  must_change_password: boolean;
  active: boolean;
  permissions: AdminPermission[];
  session_version: number;
  failed_attempts: number;
  locked_until: number | null;
  created_at: number;
  last_login_at: number | null;
}

interface AuditEntry {
  id: number;
  actor: string;
  action: string;
  target: string;
  created_at: number;
}

const ALL_ASSIGNABLE_PERMISSIONS: Array<{
  id: AdminPermission;
  label: string;
  group: 'Console' | 'Blog (pré-enregistré)';
}> = [
  {
    id: 'dashboard.view',
    label: 'Dashboard (vue d’ensemble)',
    group: 'Console',
  },
  {
    id: 'health.view',
    label: 'Santé des moteurs (lecture seule)',
    group: 'Console',
  },
  {
    id: 'activity.view',
    label: 'Activité / Journal des erreurs (lecture)',
    group: 'Console',
  },
  {
    id: 'blog.write',
    label: 'Rédiger des articles (blog.write)',
    group: 'Blog (pré-enregistré)',
  },
  {
    id: 'blog.edit_all',
    label: 'Modifier tous les articles (blog.edit_all)',
    group: 'Blog (pré-enregistré)',
  },
  {
    id: 'blog.delete',
    label: 'Supprimer des articles (blog.delete)',
    group: 'Blog (pré-enregistré)',
  },
  {
    id: 'blog.publish',
    label: 'Publier des articles (blog.publish)',
    group: 'Blog (pré-enregistré)',
  },
];

const ROLE_PRESET_BUTTONS: Array<{
  id: string;
  label: string;
  permissions: AdminPermission[];
}> = [
  {
    id: 'redacteur_blog',
    label: 'Rédacteur blog',
    permissions: ['blog.write'],
  },
  {
    id: 'editeur_blog',
    label: 'Éditeur blog',
    permissions: ['blog.write', 'blog.edit_all', 'blog.delete'],
  },
  {
    id: 'observateur',
    label: 'Observateur',
    permissions: ['dashboard.view', 'health.view', 'activity.view'],
  },
];

function generateClientTempPassword(length = 16): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*+-=?';
  const all = upper + lower + digits + symbols;
  const rnd = new Uint32Array(length);
  crypto.getRandomValues(rnd);
  const chars = [
    upper[rnd[0] % upper.length],
    lower[rnd[1] % lower.length],
    digits[rnd[2] % digits.length],
    symbols[rnd[3] % symbols.length],
  ];
  for (let i = 4; i < length; i++) {
    chars.push(all[rnd[i] % all.length]);
  }
  return chars.join('');
}

export const Users: React.FC = () => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formulaire de création
  const [displayName, setDisplayName] = useState('');
  const [login, setLogin] = useState('');
  const [roleLabel, setRoleLabel] = useState('Observateur');
  const [selectedPermissions, setSelectedPermissions] = useState<
    AdminPermission[]
  >(['dashboard.view', 'health.view', 'activity.view']);
  const [tempPasswordInput, setTempPasswordInput] = useState('');
  const [creating, setCreating] = useState(false);

  // Mot de passe temporaire affiché UNE SEULE FOIS après création ou réinitialisation
  const [oneTimeCredentials, setOneTimeCredentials] = useState<{
    login: string;
    displayName: string;
    password: string;
    context: 'created' | 'reset';
  } | null>(null);
  const [copiedOneTime, setCopiedOneTime] = useState(false);

  // Édition d'un compte existant
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editRoleLabel, setEditRoleLabel] = useState('');
  const [editPermissions, setEditPermissions] = useState<AdminPermission[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  // Confirmation de suppression
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Accept: 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(
          data.message || 'Impossible de charger les utilisateurs.'
        );
      }
      setUsers(data.users || []);
      setAuditLog(data.auditLog || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const applyPresetToCreate = (preset: {
    label: string;
    permissions: AdminPermission[];
  }) => {
    setRoleLabel(preset.label);
    setSelectedPermissions([...preset.permissions]);
  };

  const toggleCreatePermission = (perm: AdminPermission) => {
    setSelectedPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login.trim() || !displayName.trim() || creating) return;

    setCreating(true);
    setError(null);
    setOneTimeCredentials(null);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          action: 'create',
          login: login.trim().toLowerCase(),
          display_name: displayName.trim(),
          role_label: roleLabel.trim() || 'Membre',
          permissions: selectedPermissions,
          temporaryPassword: tempPasswordInput.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.message || 'Erreur lors de la création du compte.');
        return;
      }

      setUsers(data.users || []);
      setAuditLog(data.auditLog || []);
      if (data.temporaryPassword) {
        setOneTimeCredentials({
          login: login.trim().toLowerCase(),
          displayName: displayName.trim(),
          password: data.temporaryPassword,
          context: 'created',
        });
        setCopiedOneTime(false);
      }
      setDisplayName('');
      setLogin('');
      setTempPasswordInput('');
    } catch {
      setError('Erreur réseau lors de la création du compte.');
    } finally {
      setCreating(false);
    }
  };

  const startEditingUser = (u: ManagedUser) => {
    setEditingUserId(u.id);
    setEditDisplayName(u.display_name);
    setEditRoleLabel(u.role_label);
    setEditPermissions([...u.permissions]);
  };

  const toggleEditPermission = (perm: AdminPermission) => {
    setEditPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleSaveEdit = async (userId: number) => {
    setSavingEdit(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          action: 'update_permissions',
          userId,
          display_name: editDisplayName.trim(),
          role_label: editRoleLabel.trim() || 'Membre',
          permissions: editPermissions,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.message || 'Impossible de modifier les droits.');
        return;
      }
      setUsers(data.users || []);
      setAuditLog(data.auditLog || []);
      setEditingUserId(null);
    } catch {
      setError('Erreur réseau lors de la mise à jour des droits.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleResetPassword = async (u: ManagedUser) => {
    setBusyUserId(u.id);
    setError(null);
    setOneTimeCredentials(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          action: 'reset_password',
          userId: u.id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.message || 'Échec de la réinitialisation du mot de passe.');
        return;
      }
      setUsers(data.users || []);
      setAuditLog(data.auditLog || []);
      if (data.temporaryPassword) {
        setOneTimeCredentials({
          login: u.login,
          displayName: u.display_name,
          password: data.temporaryPassword,
          context: 'reset',
        });
        setCopiedOneTime(false);
      }
    } catch {
      setError('Erreur réseau lors de la réinitialisation du mot de passe.');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleToggleActive = async (u: ManagedUser) => {
    setBusyUserId(u.id);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          action: 'toggle_active',
          userId: u.id,
          active: !u.active,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.message || 'Impossible de modifier le statut du compte.');
        return;
      }
      setUsers(data.users || []);
      setAuditLog(data.auditLog || []);
    } catch {
      setError('Erreur réseau.');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    setBusyUserId(userId);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          action: 'delete',
          userId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.message || 'Impossible de supprimer ce compte.');
        return;
      }
      setUsers(data.users || []);
      setAuditLog(data.auditLog || []);
      setConfirmDeleteId(null);
    } catch {
      setError('Erreur réseau lors de la suppression.');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleCopyOneTimePassword = async () => {
    if (!oneTimeCredentials) return;
    try {
      await navigator.clipboard.writeText(oneTimeCredentials.password);
      setCopiedOneTime(true);
      setTimeout(() => setCopiedOneTime(false), 2500);
    } catch {
      // Fallback
    }
  };

  const formatDate = (ts: number | null | undefined) => {
    if (!ts) return 'Jamais';
    return new Date(ts).toLocaleString('fr-FR');
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-admin-text">
            Comptes & Droits par personne
          </h2>
          <p className="text-xs text-admin-text-muted font-mono">
            Gestion RBAC 100 % native Cloudflare D1 · PBKDF2-SHA256 (100 000 itérations) · Journal d’audit
          </p>
        </div>
        <button
          type="button"
          onClick={loadUsers}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-admin-muted hover:bg-admin-hover border border-admin-border-strong text-xs font-mono font-medium text-admin-text flex items-center gap-2 transition-colors cursor-pointer"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-admin-accent ${loading ? 'animate-spin' : ''}`}
          />
          <span>Actualiser</span>
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800/70 text-red-900 dark:text-red-200 text-xs flex items-start gap-2.5"
        >
          <ShieldAlert className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Bannière d'affichage UNIQUE du mot de passe temporaire */}
      {oneTimeCredentials && (
        <div
          data-testid="one-time-password-banner"
          className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 border-2 border-emerald-400 dark:border-emerald-700 text-emerald-950 dark:text-emerald-100 space-y-3 shadow-md"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              <h3 className="font-display text-sm font-bold">
                {oneTimeCredentials.context === 'created'
                  ? `Compte « ${oneTimeCredentials.displayName} » (${oneTimeCredentials.login}) créé`
                  : `Mot de passe temporaire réinitialisé pour « ${oneTimeCredentials.login} »`}
              </h3>
            </div>
            <span className="text-[11px] font-mono font-semibold uppercase px-2.5 py-0.5 rounded bg-emerald-200/80 dark:bg-emerald-900 text-emerald-950 dark:text-emerald-200">
              Affiché une seule fois
            </span>
          </div>

          <p className="text-xs font-mono leading-relaxed">
            Copiez et transmettez ce mot de passe temporaire à la personne. Il ne
            sera <strong>plus jamais affiché</strong>. À sa première connexion,
            elle devra obligatoirement choisir un nouveau mot de passe d’au
            moins 12 caractères.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <code
              data-testid="generated-temp-password"
              className="px-4 py-2.5 rounded-xl bg-white dark:bg-[#120c08] border border-emerald-400 dark:border-emerald-700 font-mono text-sm font-bold tracking-wider text-emerald-950 dark:text-emerald-200 select-all"
            >
              {oneTimeCredentials.password}
            </code>

            <button
              type="button"
              onClick={handleCopyOneTimePassword}
              className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              {copiedOneTime ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copié !</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copier</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setOneTimeCredentials(null)}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/70 dark:hover:bg-emerald-800 text-xs font-mono text-emerald-950 dark:text-emerald-200 cursor-pointer"
            >
              Fermer définitivement
            </button>
          </div>
        </div>
      )}

      {/* Formulaire de création d'un utilisateur */}
      <div className="bg-admin-surface border border-admin-border rounded-2xl p-6 space-y-5 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <Plus className="w-4 h-4 text-admin-accent" />
          <h3 className="font-display text-base font-bold text-admin-text">
            Créer un nouveau compte
          </h3>
        </div>

        <form onSubmit={handleCreateUser} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="new-user-display-name"
                className="block text-xs font-mono font-semibold text-admin-text-secondary mb-1.5"
              >
                Nom affiché (display_name)
              </label>
              <input
                id="new-user-display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="ex. Sarah Martin"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-admin-muted border border-admin-border-strong text-xs text-admin-text font-mono focus:outline-none focus:border-orange-600"
              />
            </div>

            <div>
              <label
                htmlFor="new-user-login"
                className="block text-xs font-mono font-semibold text-admin-text-secondary mb-1.5"
              >
                Identifiant (login)
              </label>
              <input
                id="new-user-login"
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="ex. sarah"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-admin-muted border border-admin-border-strong text-xs text-admin-text font-mono focus:outline-none focus:border-orange-600"
              />
            </div>

            <div>
              <label
                htmlFor="new-user-role-label"
                className="block text-xs font-mono font-semibold text-admin-text-secondary mb-1.5"
              >
                Intitulé du rôle (role_label)
              </label>
              <input
                id="new-user-role-label"
                type="text"
                value={roleLabel}
                onChange={(e) => setRoleLabel(e.target.value)}
                placeholder="ex. Rédacteur blog, Observateur…"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-admin-muted border border-admin-border-strong text-xs text-admin-text font-mono focus:outline-none focus:border-orange-600"
              />
            </div>
          </div>

          {/* Modèles de rôles (Presets) */}
          <div className="space-y-2">
            <span className="block text-xs font-mono font-semibold text-admin-text-secondary">
              Modèles rapides de droits (ou cochez au choix ci-dessous) :
            </span>
            <div className="flex flex-wrap gap-2">
              {ROLE_PRESET_BUTTONS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPresetToCreate(preset)}
                  className="px-3.5 py-1.5 rounded-xl bg-admin-muted hover:bg-admin-hover border border-admin-border-strong text-xs font-mono font-medium text-admin-text transition-colors cursor-pointer"
                >
                  Modèle « {preset.label} » ({preset.permissions.join(', ')})
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelectedPermissions([])}
                className="px-3 py-1.5 rounded-xl bg-admin-muted hover:bg-admin-hover border border-admin-border text-xs font-mono text-admin-text-muted cursor-pointer"
              >
                Tout décocher
              </button>
            </div>
          </div>

          {/* Cases à cocher des droits assignables */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-admin-muted border border-admin-border">
            {ALL_ASSIGNABLE_PERMISSIONS.map((perm) => {
              const checked = selectedPermissions.includes(perm.id);
              return (
                <label
                  key={perm.id}
                  className="flex items-start gap-2.5 text-xs font-mono text-admin-text cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCreatePermission(perm.id)}
                    className="mt-0.5 accent-[#c2410c] rounded cursor-pointer"
                  />
                  <div>
                    <span className="font-semibold block">{perm.label}</span>
                    <span className="text-[10px] text-admin-text-muted">
                      {perm.id} · {perm.group}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>

          {/* Mot de passe temporaire */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label
                htmlFor="new-user-temp-password"
                className="block text-xs font-mono font-semibold text-admin-text-secondary mb-1.5"
              >
                Mot de passe temporaire (laisser vide pour générer 16 caractères automatiquement)
              </label>
              <div className="flex gap-2">
                <input
                  id="new-user-temp-password"
                  type="text"
                  value={tempPasswordInput}
                  onChange={(e) => setTempPasswordInput(e.target.value)}
                  placeholder="Généré automatiquement (16 car.) si laissé vide…"
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-admin-muted border border-admin-border-strong text-xs text-admin-text font-mono focus:outline-none focus:border-orange-600"
                />
                <button
                  type="button"
                  onClick={() =>
                    setTempPasswordInput(generateClientTempPassword(16))
                  }
                  className="px-3.5 py-2.5 rounded-xl bg-admin-muted hover:bg-admin-hover border border-admin-border-strong text-xs font-mono font-medium text-admin-text whitespace-nowrap cursor-pointer"
                >
                  Générer 16 car.
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={creating || !login.trim() || !displayName.trim()}
              className="px-5 py-2.5 rounded-xl bg-[#c2410c] hover:bg-[#9a3412] disabled:opacity-50 text-white font-display font-semibold text-xs flex items-center justify-center gap-2 shadow cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{creating ? 'Création…' : 'Créer le compte'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Liste des utilisateurs */}
      <div className="bg-admin-surface border border-admin-border rounded-2xl p-6 space-y-4 shadow-2xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <UsersIcon className="w-4 h-4 text-admin-accent" />
            <h3 className="font-display text-base font-bold text-admin-text">
              Comptes enregistrés ({users.length + 1})
            </h3>
          </div>
          <span className="text-[11px] font-mono text-admin-text-muted">
            Réservés au propriétaire : Contrôles, Utilisateurs, Réglages, Services tiers, Secrets, Audit
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-admin-border text-[11px] text-admin-text-secondary uppercase">
                <th className="py-3 pr-4">Utilisateur</th>
                <th className="py-3 px-3">Rôle</th>
                <th className="py-3 px-3">Droits</th>
                <th className="py-3 px-3">Statut</th>
                <th className="py-3 px-3">Dernière connexion</th>
                <th className="py-3 pl-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {/* Ligne Propriétaire permanente (non supprimable / non désactivable) */}
              <tr className="bg-admin-accent-bg/30">
                <td className="py-3.5 pr-4">
                  <div className="font-display font-bold text-admin-text">
                    Propriétaire
                  </div>
                  <div className="text-[11px] text-admin-text-muted">
                    login : <strong>admin</strong> (ADMIN_PASSWORD)
                  </div>
                </td>
                <td className="py-3.5 px-3">
                  <span className="px-2.5 py-0.5 rounded-md bg-admin-accent-bg border border-admin-accent-border text-admin-accent font-semibold">
                    Propriétaire
                  </span>
                </td>
                <td className="py-3.5 px-3">
                  <span className="text-emerald-800 dark:text-emerald-300 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>Tous les droits (intégral)</span>
                  </span>
                </td>
                <td className="py-3.5 px-3">
                  <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-300">
                    Actif permanent
                  </span>
                </td>
                <td className="py-3.5 px-3 text-admin-text-muted">—</td>
                <td className="py-3.5 pl-3 text-right text-[11px] text-admin-text-muted">
                  Protégé
                </td>
              </tr>

              {users.map((u) => {
                const isEditing = editingUserId === u.id;
                const isBusy = busyUserId === u.id;
                return (
                  <React.Fragment key={u.id}>
                    <tr data-testid={`user-row-${u.login}`}>
                      <td className="py-3.5 pr-4">
                        <div className="font-display font-bold text-admin-text">
                          {u.display_name}
                        </div>
                        <div className="text-[11px] text-admin-text-muted">
                          login : <strong>{u.login}</strong> · v{u.session_version}
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="px-2.5 py-0.5 rounded-md bg-admin-muted border border-admin-border-strong text-admin-text">
                          {u.role_label}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        {u.permissions.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {u.permissions.map((p) => (
                              <span
                                key={p}
                                className="px-2 py-0.5 rounded bg-admin-muted border border-admin-border text-[11px] text-admin-text"
                              >
                                {p}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-admin-text-muted">Aucun droit</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${
                              u.active
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-300'
                                : 'bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-700/60 text-red-900 dark:text-red-300'
                            }`}
                          >
                            {u.active ? 'Actif' : 'Désactivé'}
                          </span>
                          {u.must_change_password && (
                            <span className="text-[10px] text-amber-800 dark:text-amber-300">
                              MDP temporaire à changer
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-admin-text-secondary whitespace-nowrap">
                        {formatDate(u.last_login_at)}
                      </td>
                      <td className="py-3.5 pl-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() =>
                              isEditing
                                ? setEditingUserId(null)
                                : startEditingUser(u)
                            }
                            disabled={isBusy}
                            className="px-2.5 py-1.5 rounded-lg bg-admin-muted hover:bg-admin-hover border border-admin-border-strong text-admin-text flex items-center gap-1 cursor-pointer"
                            title="Modifier les droits et le rôle"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Droits</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleResetPassword(u)}
                            disabled={isBusy}
                            className="px-2.5 py-1.5 rounded-lg bg-admin-muted hover:bg-admin-hover border border-admin-border-strong text-admin-text flex items-center gap-1 cursor-pointer"
                            title="Réinitialiser le mot de passe temporaire"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Réinit. MDP</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleActive(u)}
                            disabled={isBusy}
                            className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                              u.active
                                ? 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                                : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                            }`}
                          >
                            {u.active ? 'Désactiver' : 'Réactiver'}
                          </button>

                          {confirmDeleteId === u.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u.id)}
                                disabled={isBusy}
                                className="px-2.5 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white font-semibold cursor-pointer"
                              >
                                Confirmer
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1.5 rounded-lg bg-admin-muted border border-admin-border text-admin-text-secondary cursor-pointer"
                              >
                                Annuler
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(u.id)}
                              disabled={isBusy}
                              className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/60 dark:hover:bg-red-900/60 border border-red-300 dark:border-red-800/70 text-red-800 dark:text-red-300 cursor-pointer"
                              aria-label={`Supprimer ${u.login}`}
                              title="Supprimer ce compte"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {isEditing && (
                      <tr className="bg-admin-muted/70">
                        <td colSpan={6} className="p-4">
                          <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h4 className="font-display text-xs font-bold text-admin-text">
                                Modifier le compte « {u.login} » (invalidera sa session en cours)
                              </h4>
                              <div className="flex flex-wrap gap-1.5">
                                {ROLE_PRESET_BUTTONS.map((preset) => (
                                  <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => {
                                      setEditRoleLabel(preset.label);
                                      setEditPermissions([
                                        ...preset.permissions,
                                      ]);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-admin-surface border border-admin-border-strong text-[11px] text-admin-text cursor-pointer"
                                  >
                                    Modèle « {preset.label} »
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] text-admin-text-secondary mb-1">
                                  Nom affiché
                                </label>
                                <input
                                  type="text"
                                  value={editDisplayName}
                                  onChange={(e) =>
                                    setEditDisplayName(e.target.value)
                                  }
                                  className="w-full px-3 py-2 rounded-lg bg-admin-surface border border-admin-border-strong text-xs text-admin-text"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] text-admin-text-secondary mb-1">
                                  Intitulé du rôle
                                </label>
                                <input
                                  type="text"
                                  value={editRoleLabel}
                                  onChange={(e) =>
                                    setEditRoleLabel(e.target.value)
                                  }
                                  className="w-full px-3 py-2 rounded-lg bg-admin-surface border border-admin-border-strong text-xs text-admin-text"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-xl bg-admin-surface border border-admin-border">
                              {ALL_ASSIGNABLE_PERMISSIONS.map((perm) => (
                                <label
                                  key={perm.id}
                                  className="flex items-center gap-2 text-xs text-admin-text cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={editPermissions.includes(perm.id)}
                                    onChange={() =>
                                      toggleEditPermission(perm.id)
                                    }
                                    className="accent-[#c2410c] cursor-pointer"
                                  />
                                  <span>{perm.label}</span>
                                </label>
                              ))}
                            </div>

                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingUserId(null)}
                                className="px-3.5 py-2 rounded-xl bg-admin-surface border border-admin-border text-xs text-admin-text-secondary cursor-pointer"
                              >
                                Annuler
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(u.id)}
                                disabled={savingEdit}
                                className="px-4 py-2 rounded-xl bg-[#c2410c] hover:bg-[#9a3412] text-white font-display font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                              >
                                <Save className="w-3.5 h-3.5" />
                                <span>
                                  {savingEdit
                                    ? 'Enregistrement…'
                                    : 'Enregistrer les droits'}
                                </span>
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Journal d'audit D1 (audit_log) */}
      <div className="bg-admin-surface border border-admin-border rounded-2xl p-6 space-y-4 shadow-2xs">
        <div>
          <h3 className="font-display text-base font-bold text-admin-text">
            Journal d’audit des comptes et connexions (audit_log)
          </h3>
          <p className="text-xs text-admin-text-muted font-mono">
            Historique immuable des connexions réussies/échouées, créations, modifications de droits, réinitialisations et suppressions
          </p>
        </div>

        {auditLog.length === 0 ? (
          <p className="text-xs font-mono text-admin-text-muted py-4">
            Aucune entrée dans le journal d’audit pour le moment.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-admin-border text-[11px] text-admin-text-secondary uppercase">
                  <th className="py-2.5 pr-4">Date</th>
                  <th className="py-2.5 px-3">Qui (actor)</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 pl-3">Cible / Détail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-border">
                {auditLog.map((entry) => (
                  <tr key={entry.id}>
                    <td className="py-2.5 pr-4 whitespace-nowrap text-admin-text-secondary">
                      {formatDate(entry.created_at)}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-admin-text">
                      {entry.actor}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-admin-muted border border-admin-border-strong text-admin-accent">
                        {entry.action}
                      </span>
                    </td>
                    <td className="py-2.5 pl-3 text-admin-text-secondary">
                      {entry.target}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
