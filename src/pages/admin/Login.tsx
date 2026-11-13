import React, { useState } from 'react';
import {
  Lock,
  ShieldAlert,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  UserCircle,
  Sun,
  Moon,
} from './AdminIcons';
import { AdminTheme } from './adminTheme';

export type AdminPermission =
  | 'dashboard.view'
  | 'health.view'
  | 'activity.view'
  | 'blog.write'
  | 'blog.edit_all'
  | 'blog.delete'
  | 'blog.publish';

export interface AdminUserProfile {
  id: number | null;
  login: string;
  displayName: string;
  roleLabel: string;
  isOwner: boolean;
  permissions: AdminPermission[];
  mustChangePassword: boolean;
  firstAuthorizedTab?:
    | 'dashboard'
    | 'health'
    | 'controls'
    | 'activity'
    | 'users'
    | 'account';
}

interface LoginProps {
  onLoginSuccess: (user?: AdminUserProfile) => void;
  theme?: AdminTheme;
  onToggleTheme?: () => void;
}

export const Login: React.FC<LoginProps> = ({
  onLoginSuccess,
  theme = 'dark',
  onToggleTheme,
}) => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockedSeconds, setLockedSeconds] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login.trim() || !password.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          login: login.trim(),
          password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        setPassword('');
        onLoginSuccess(data.user);
        return;
      }

      if (res.status === 429 || data.errorCode === 'BRUTE_FORCE_LOCKED') {
        setLockedSeconds(Number(data.retryAfterSec) || 900);
        setError(
          data.message ||
            'Trop de tentatives échouées (5 max). Connexion temporairement bloquée pendant 15 minutes.'
        );
        return;
      }

      setError('Identifiant ou mot de passe incorrect.');
    } catch {
      setError('Impossible de contacter le serveur d’authentification.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-admin-bg text-admin-text px-4 py-12 relative overflow-hidden transition-colors duration-150">
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[360px] bg-gradient-to-b from-orange-500/15 via-amber-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-admin-surface border border-admin-border rounded-2xl p-6 sm:p-8 shadow-xl">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-admin-border gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#c2410c] flex items-center justify-center text-white shadow-md shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="font-display text-lg font-bold tracking-tight text-admin-text truncate">
                  VIDNEX · Console Admin
                </h1>
                <p className="text-xs text-admin-text-muted font-mono truncate">
                  Cloudflare D1 · Session HMAC-SHA256
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
              <a
                href="/"
                className="text-xs font-mono font-medium text-admin-accent hover:underline transition-colors"
              >
                ← Site public
              </a>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800/70 text-red-900 dark:text-red-200 text-xs flex items-start gap-2.5"
            >
              <ShieldAlert className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium leading-relaxed">{error}</p>
                {lockedSeconds !== null && (
                  <p className="font-mono text-[11px] text-red-800 dark:text-red-300">
                    Protection anti-brute-force active (fenêtre 15 min après 5 échecs).
                  </p>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="admin-login-input"
                className="block text-xs font-mono font-semibold uppercase tracking-wider text-admin-text-secondary mb-2"
              >
                Identifiant
              </label>
              <div className="relative">
                <UserCircle className="w-4 h-4 text-admin-accent absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="admin-login-input"
                  type="text"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="admin ou votre identifiant…"
                  autoComplete="username"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-admin-muted border border-admin-border-strong text-sm text-admin-text placeholder-admin-text-muted/70 focus:outline-none focus:border-orange-600 transition-colors font-mono"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="admin-password-input"
                className="block text-xs font-mono font-semibold uppercase tracking-wider text-admin-text-secondary mb-2"
              >
                Mot de passe
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-admin-accent absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="admin-password-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Saisissez votre mot de passe…"
                  autoComplete="current-password"
                  required
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-admin-muted border border-admin-border-strong text-sm text-admin-text placeholder-admin-text-muted/70 focus:outline-none focus:border-orange-600 transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-admin-text-muted hover:text-admin-text p-1 cursor-pointer"
                  aria-label="Afficher ou masquer le mot de passe"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !login.trim() || !password.trim()}
              className="w-full py-3 px-4 rounded-xl bg-[#c2410c] hover:bg-[#9a3412] disabled:opacity-50 text-white font-display font-semibold text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <span>{loading ? 'Vérification cryptographique…' : 'Se connecter'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-admin-border flex items-center justify-between text-[11px] text-admin-text-muted font-mono">
            <span>Cookie HttpOnly · SameSite=Strict</span>
            <span>Expiration 12h</span>
          </div>
        </div>
      </div>
    </div>
  );
};
