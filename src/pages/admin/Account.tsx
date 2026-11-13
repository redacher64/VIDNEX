import React, { useState } from 'react';
import {
  KeyRound,
  Lock,
  LogOut,
  ShieldAlert,
  CheckCircle2,
  Eye,
  EyeOff,
  UserCircle,
  ShieldCheck,
  Sun,
  Moon,
} from './AdminIcons';
import { type AdminUserProfile } from './Login';
import { type AdminTheme } from './adminTheme';

const PERMISSION_LABELS: Record<string, string> = {
  'dashboard.view': 'Dashboard (lecture)',
  'health.view': 'Santé des moteurs (lecture)',
  'activity.view': 'Activité / Journal (lecture)',
  'blog.write': 'Blog : rédiger des articles',
  'blog.edit_all': 'Blog : modifier tous les articles',
  'blog.delete': 'Blog : supprimer des articles',
  'blog.publish': 'Blog : publier des articles',
};

interface AccountProps {
  user: AdminUserProfile;
  forcedMode?: boolean;
  onPasswordChanged: (updatedUser: AdminUserProfile) => void;
  onLogout: () => void;
  theme?: AdminTheme;
  onToggleTheme?: () => void;
}

export const Account: React.FC<AccountProps> = ({
  user,
  forcedMode = false,
  onPasswordChanged,
  onLogout,
  theme = 'dark',
  onToggleTheme,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!currentPassword) {
      setError('Veuillez saisir votre mot de passe actuel ou temporaire.');
      return;
    }
    if (newPassword.length < 12) {
      setError('Le nouveau mot de passe doit contenir au moins 12 caractères.');
      return;
    }
    if (newPassword === currentPassword) {
      setError(
        'Le nouveau mot de passe doit être différent du mot de passe temporaire ou actuel.'
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('La confirmation du nouveau mot de passe ne correspond pas.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.message || 'Échec de la mise à jour du mot de passe.');
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMsg(
        data.message || 'Votre mot de passe a été modifié avec succès.'
      );
      if (data.user) {
        onPasswordChanged(data.user);
      }
    } catch {
      setError('Erreur réseau lors du changement de mot de passe.');
    } finally {
      setLoading(false);
    }
  };

  if (forcedMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-admin-bg text-admin-text px-4 py-12 relative overflow-hidden transition-colors duration-150">
        <div className="w-full max-w-lg relative z-10">
          <div className="bg-admin-surface border border-admin-border rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-admin-border">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#c2410c] flex items-center justify-center text-white shadow shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h1 className="font-display text-lg font-bold text-admin-text truncate">
                    Changement de mot de passe obligatoire
                  </h1>
                  <p className="text-xs font-mono text-admin-text-muted truncate">
                    Compte : {user.displayName} ({user.login}) · {user.roleLabel}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {onToggleTheme && (
                  <button
                    type="button"
                    onClick={onToggleTheme}
                    aria-label={
                      theme === 'dark'
                        ? 'Passer en mode clair'
                        : 'Passer en mode sombre'
                    }
                    className="p-2 rounded-xl bg-admin-muted hover:bg-admin-hover border border-admin-border-strong text-admin-text transition-colors cursor-pointer"
                  >
                    {theme === 'dark' ? (
                      <Sun className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Moon className="w-4 h-4 text-[#c2410c]" />
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onLogout}
                  className="px-3 py-1.5 rounded-xl bg-red-100 hover:bg-red-200 dark:bg-red-950/80 dark:hover:bg-red-900/80 border border-red-300 dark:border-red-800/70 text-xs font-mono font-medium text-red-900 dark:text-red-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Déconnexion</span>
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800/70 text-amber-950 dark:text-amber-200 text-xs leading-relaxed">
              Pour votre sécurité, vous devez définir un mot de passe personnel
              (<strong>12 caractères minimum</strong>, différent du mot de passe
              temporaire) avant d’accéder à votre espace.
            </div>

            {error && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800/70 text-red-900 dark:text-red-200 text-xs flex items-start gap-2.5"
              >
                <ShieldAlert className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="forced-current-password"
                  className="block text-xs font-mono font-semibold text-admin-text-secondary mb-1.5"
                >
                  Mot de passe temporaire actuel
                </label>
                <input
                  id="forced-current-password"
                  type={showPasswords ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Saisissez le mot de passe temporaire reçu…"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-admin-muted border border-admin-border-strong text-sm text-admin-text font-mono focus:outline-none focus:border-orange-600"
                />
              </div>

              <div>
                <label
                  htmlFor="forced-new-password"
                  className="block text-xs font-mono font-semibold text-admin-text-secondary mb-1.5"
                >
                  Nouveau mot de passe (12 caractères min., différent du temporaire)
                </label>
                <input
                  id="forced-new-password"
                  type={showPasswords ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={12}
                  autoComplete="new-password"
                  placeholder="Minimum 12 caractères…"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-admin-muted border border-admin-border-strong text-sm text-admin-text font-mono focus:outline-none focus:border-orange-600"
                />
              </div>

              <div>
                <label
                  htmlFor="forced-confirm-password"
                  className="block text-xs font-mono font-semibold text-admin-text-secondary mb-1.5"
                >
                  Confirmer le nouveau mot de passe
                </label>
                <input
                  id="forced-confirm-password"
                  type={showPasswords ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={12}
                  autoComplete="new-password"
                  placeholder="Répétez votre nouveau mot de passe…"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-admin-muted border border-admin-border-strong text-sm text-admin-text font-mono focus:outline-none focus:border-orange-600"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setShowPasswords((v) => !v)}
                  className="text-xs font-mono text-admin-text-secondary hover:text-admin-text flex items-center gap-1.5 cursor-pointer"
                >
                  {showPasswords ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {showPasswords
                      ? 'Masquer les mots de passe'
                      : 'Afficher les mots de passe'}
                  </span>
                </button>
                <span className="text-[11px] font-mono text-admin-text-muted">
                  {newPassword.length}/12 caractères min.
                </span>
              </div>

              <button
                type="submit"
                disabled={
                  loading ||
                  !currentPassword ||
                  newPassword.length < 12 ||
                  !confirmPassword
                }
                className="w-full py-3 px-4 rounded-xl bg-[#c2410c] hover:bg-[#9a3412] disabled:opacity-50 text-white font-display font-semibold text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>
                  {loading
                    ? 'Enregistrement sécurisé PBKDF2-SHA256…'
                    : 'Valider mon nouveau mot de passe'}
                </span>
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-admin-text">
            Mon compte
          </h2>
          <p className="text-xs text-admin-text-muted font-mono">
            Profil, droits attribués et sécurité de votre session
          </p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="px-4 py-2 rounded-xl bg-red-100 hover:bg-red-200 dark:bg-red-950/80 dark:hover:bg-red-900/80 border border-red-300 dark:border-red-800/70 text-xs font-mono font-semibold text-red-900 dark:text-red-200 flex items-center gap-2 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Se déconnecter</span>
        </button>
      </div>

      {/* Résumé du profil */}
      <div className="bg-admin-surface border border-admin-border rounded-2xl p-6 space-y-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-admin-accent-bg border border-admin-accent-border flex items-center justify-center text-admin-accent">
              <UserCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-admin-text">
                {user.displayName}
              </h3>
              <p className="text-xs font-mono text-admin-text-muted">
                Identifiant : <strong className="text-admin-text">{user.login}</strong> · Rôle :{' '}
                <strong className="text-admin-accent">{user.roleLabel}</strong>
              </p>
            </div>
          </div>

          <span className="text-xs font-mono font-semibold px-3 py-1 rounded-lg bg-admin-accent-bg border border-admin-accent-border text-admin-accent">
            {user.isOwner ? 'PROPRIÉTAIRE (TOUS LES DROITS)' : user.roleLabel}
          </span>
        </div>

        <div className="pt-3 border-t border-admin-border">
          <span className="block text-[11px] font-mono font-semibold uppercase text-admin-text-secondary mb-2">
            Droits actifs sur ce compte
          </span>
          {user.isOwner ? (
            <p className="text-xs font-mono text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>
                Accès intégral propriétaire (Dashboard, Santé, Contrôles,
                Utilisateurs, Activité, Blog, Secrets & Audit).
              </span>
            </p>
          ) : user.permissions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {user.permissions.map((perm) => (
                <span
                  key={perm}
                  className="text-xs font-mono px-2.5 py-1 rounded-md bg-admin-muted border border-admin-border-strong text-admin-text"
                >
                  {PERMISSION_LABELS[perm] || perm}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs font-mono text-admin-text-muted">
              Aucun droit spécifique attribué. Contactez le propriétaire.
            </p>
          )}
        </div>
      </div>

      {/* Changement de mot de passe */}
      <div className="bg-admin-surface border border-admin-border rounded-2xl p-6 space-y-4 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <KeyRound className="w-4 h-4 text-admin-accent" />
          <h3 className="font-display text-base font-bold text-admin-text">
            Changer mon mot de passe
          </h3>
        </div>

        {user.isOwner ? (
          <div className="p-4 rounded-xl bg-admin-muted border border-admin-border text-xs text-admin-text-secondary font-mono leading-relaxed">
            Le compte propriétaire principal utilise le secret d’environnement
            Cloudflare{' '}
            <code className="text-admin-accent font-semibold">
              ADMIN_PASSWORD
            </code>
            . Pour le modifier en production, exécutez{' '}
            <code className="text-admin-accent font-semibold">
              npx wrangler pages secret put ADMIN_PASSWORD --project-name=vidnex
            </code>
            .
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800/70 text-red-900 dark:text-red-200 text-xs flex items-start gap-2.5"
              >
                <ShieldAlert className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800/70 text-emerald-900 dark:text-emerald-200 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="account-current-password"
                className="block text-xs font-mono font-semibold text-admin-text-secondary mb-1.5"
              >
                Mot de passe actuel
              </label>
              <input
                id="account-current-password"
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-3.5 py-2.5 rounded-xl bg-admin-muted border border-admin-border-strong text-sm text-admin-text font-mono focus:outline-none focus:border-orange-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="account-new-password"
                  className="block text-xs font-mono font-semibold text-admin-text-secondary mb-1.5"
                >
                  Nouveau mot de passe (12 car. min.)
                </label>
                <input
                  id="account-new-password"
                  type={showPasswords ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={12}
                  autoComplete="new-password"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-admin-muted border border-admin-border-strong text-sm text-admin-text font-mono focus:outline-none focus:border-orange-600"
                />
              </div>

              <div>
                <label
                  htmlFor="account-confirm-password"
                  className="block text-xs font-mono font-semibold text-admin-text-secondary mb-1.5"
                >
                  Confirmer le nouveau mot de passe
                </label>
                <input
                  id="account-confirm-password"
                  type={showPasswords ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={12}
                  autoComplete="new-password"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-admin-muted border border-admin-border-strong text-sm text-admin-text font-mono focus:outline-none focus:border-orange-600"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowPasswords((v) => !v)}
                className="text-xs font-mono text-admin-text-secondary hover:text-admin-text flex items-center gap-1.5 cursor-pointer"
              >
                {showPasswords ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
                <span>
                  {showPasswords
                    ? 'Masquer les mots de passe'
                    : 'Afficher les mots de passe'}
                </span>
              </button>

              <button
                type="submit"
                disabled={
                  loading ||
                  !currentPassword ||
                  newPassword.length < 12 ||
                  !confirmPassword
                }
                className="px-5 py-2.5 rounded-xl bg-[#c2410c] hover:bg-[#9a3412] disabled:opacity-50 text-white font-display font-semibold text-xs flex items-center gap-2 shadow transition-colors cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>
                  {loading
                    ? 'Mise à jour…'
                    : 'Mettre à jour mon mot de passe'}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
