import React, { useState } from 'react';
import { Lock, ShieldAlert, ArrowRight, Eye, EyeOff, KeyRound } from './AdminIcons';

interface LoginProps {
  onLoginSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockedSeconds, setLockedSeconds] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        setPassword('');
        onLoginSuccess();
        return;
      }

      if (res.status === 429 || data.errorCode === 'BRUTE_FORCE_LOCKED') {
        setLockedSeconds(Number(data.retryAfterSec) || 900);
      }

      setError(
        data.message || 'Authentification refusée. Vérifiez le mot de passe administrateur.'
      );
    } catch {
      setError('Impossible de contacter le serveur d’authentification.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#140e0a] text-[#fffaf5] px-4 py-12 relative overflow-hidden">
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[360px] bg-gradient-to-b from-orange-500/15 via-amber-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-[#1c140e] border border-orange-900/60 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-orange-900/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-md">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-display text-lg font-bold tracking-tight text-white">
                  VIDNEX · Console Admin
                </h1>
                <p className="text-xs text-orange-200/65 font-mono">
                  Cloudflare D1 · Session HMAC-SHA256
                </p>
              </div>
            </div>
            <a
              href="/"
              className="text-xs font-mono text-orange-300/70 hover:text-orange-300 transition-colors"
            >
              ← Site public
            </a>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-xl bg-red-950/60 border border-red-800/70 text-red-200 text-xs flex items-start gap-2.5"
            >
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium leading-relaxed">{error}</p>
                {lockedSeconds !== null && (
                  <p className="font-mono text-[11px] text-red-300/80">
                    Protection anti-brute-force active (fenêtre 15 min après 5 échecs).
                  </p>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="admin-password-input"
                className="block text-xs font-mono uppercase tracking-wider text-orange-200/80 mb-2"
              >
                Mot de passe Administrateur (ADMIN_PASSWORD)
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-orange-400/70 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="admin-password-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Saisissez le secret ADMIN_PASSWORD…"
                  autoComplete="current-password"
                  required
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-[#120c08] border border-orange-900/70 text-sm text-white placeholder-orange-200/35 focus:outline-none focus:border-orange-500 transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-300/60 hover:text-orange-200 p-1"
                  aria-label="Afficher ou masquer le mot de passe"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 text-white font-display font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-600/20 transition-all cursor-pointer"
            >
              <span>{loading ? 'Vérification cryptographique…' : 'Déverrouiller la console'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-orange-900/30 flex items-center justify-between text-[11px] text-orange-200/50 font-mono">
            <span>Cookie HttpOnly · SameSite=Strict</span>
            <span>Expiration 12h</span>
          </div>
        </div>
      </div>
    </div>
  );
};
