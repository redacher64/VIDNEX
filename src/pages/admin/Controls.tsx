import React, { useEffect, useState } from 'react';
import {
  ShieldBan,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertOctagon,
} from './AdminIcons';
import { fetchPublicConfig } from '../../services/adsenseService';

interface SystemSettings {
  maintenance: boolean;
  allow_third_party: boolean;
  platform_tiktok: boolean;
  platform_instagram: boolean;
  platform_x: boolean;
  platform_facebook: boolean;
  platform_linkedin: boolean;
  rate_limit_per_min: number;
  download_limit_per_min: number;
  ads_enabled: boolean;
  ads_adsterra_enabled: boolean;
  feature_stories: boolean;
  stories_provider_order: Array<'session' | 'relay' | 'paid'>;
  stories_list_rate_limit_per_hour: number;
  stories_global_hourly_cap: number;
}

const STORY_PROVIDER_LABELS: Record<
  'session' | 'relay' | 'paid',
  { title: string; hint: string }
> = {
  session: {
    title: 'Session Instagram (IG_SESSION_ID / IG_COOKIES)',
    hint: 'API authentifiée Instagram si une session serveur est configurée',
  },
  relay: {
    title: 'Relais interne (RELAY_URL)',
    hint: 'Service relais HTTP privé avec jeton optionnel RELAY_TOKEN',
  },
  paid: {
    title: 'Fournisseur payant (STORIES_PAID_API_URL)',
    hint: 'Adaptateur API externe authentifié côté serveur',
  },
};

function normalizeProviderOrder(raw: unknown): Array<'session' | 'relay' | 'paid'> {
  const valid: Array<'session' | 'relay' | 'paid'> = ['session', 'relay', 'paid'];
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
    ? raw.split(',')
    : [];
  const out: Array<'session' | 'relay' | 'paid'> = [];
  for (const item of list) {
    const clean = String(item || '').trim().toLowerCase() as
      | 'session'
      | 'relay'
      | 'paid';
    if (valid.includes(clean) && !out.includes(clean)) {
      out.push(clean);
    }
  }
  for (const p of valid) {
    if (!out.includes(p)) out.push(p);
  }
  return out;
}

interface BlocklistItem {
  id: number;
  type: 'ip_hash' | 'domain' | 'url';
  value: string;
  created_ts: number;
}

interface ToggleSwitchProps {
  checked: boolean;
  label: string;
  onChange: () => void;
  tone?: 'emerald' | 'amber';
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  label,
  onChange,
  tone = 'emerald',
}) => {
  const activeBg =
    tone === 'amber'
      ? 'bg-amber-600 dark:bg-amber-500'
      : 'bg-emerald-600 dark:bg-emerald-500';
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={onChange}
      className={`w-11 h-6 rounded-full transition-colors p-0.5 shrink-0 cursor-pointer ${
        checked ? activeBg : 'bg-admin-muted border border-admin-border-strong'
      }`}
    >
      <span
        className={`block w-5 h-5 rounded-full bg-white shadow-2xs transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
};

export const Controls: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings>({
    maintenance: false,
    allow_third_party: true,
    platform_tiktok: true,
    platform_instagram: true,
    platform_x: true,
    platform_facebook: true,
    platform_linkedin: true,
    rate_limit_per_min: 30,
    download_limit_per_min: 60,
    ads_enabled: true,
    ads_adsterra_enabled: true,
    feature_stories: false,
    stories_provider_order: ['session', 'relay', 'paid'],
    stories_list_rate_limit_per_hour: 5,
    stories_global_hourly_cap: 200,
  });
  const [blocklist, setBlocklist] = useState<BlocklistItem[]>([]);
  const [blockType, setBlockType] = useState<'ip_hash' | 'domain' | 'url'>('domain');
  const [blockValue, setBlockValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [settingsRes, blockRes] = await Promise.all([
        fetch('/api/admin/settings', { headers: { Accept: 'application/json' } }),
        fetch('/api/admin/blocklist', { headers: { Accept: 'application/json' } }),
      ]);
      const settingsJson = await settingsRes.json();
      const blockJson = await blockRes.json();

      if (settingsRes.ok && settingsJson.ok && settingsJson.settings) {
        setSettings({
          maintenance: Boolean(settingsJson.settings.maintenance),
          allow_third_party: settingsJson.settings.allow_third_party !== false,
          platform_tiktok: settingsJson.settings.platform_tiktok !== false,
          platform_instagram: settingsJson.settings.platform_instagram !== false,
          platform_x: settingsJson.settings.platform_x !== false,
          platform_facebook: settingsJson.settings.platform_facebook !== false,
          platform_linkedin: settingsJson.settings.platform_linkedin !== false,
          rate_limit_per_min: Number(settingsJson.settings.rate_limit_per_min) || 30,
          download_limit_per_min: Number(settingsJson.settings.download_limit_per_min) || 60,
          ads_enabled: settingsJson.settings.ads_enabled !== false,
          ads_adsterra_enabled:
            settingsJson.settings.ads_adsterra_enabled !== false,
          feature_stories: Boolean(settingsJson.settings.feature_stories),
          stories_provider_order: normalizeProviderOrder(
            settingsJson.settings.stories_provider_order
          ),
          stories_list_rate_limit_per_hour:
            Number(settingsJson.settings.stories_list_rate_limit_per_hour) || 5,
          stories_global_hourly_cap:
            Number(settingsJson.settings.stories_global_hourly_cap) || 200,
        });
      }
      if (blockRes.ok && blockJson.ok) {
        setBlocklist(blockJson.items || []);
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const persistSettings = async (next: SystemSettings) => {
    setSettings(next);
    setSaving(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(next),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSettings({
          maintenance: Boolean(data.settings.maintenance),
          allow_third_party: data.settings.allow_third_party !== false,
          platform_tiktok: data.settings.platform_tiktok !== false,
          platform_instagram: data.settings.platform_instagram !== false,
          platform_x: data.settings.platform_x !== false,
          platform_facebook: data.settings.platform_facebook !== false,
          platform_linkedin: data.settings.platform_linkedin !== false,
          rate_limit_per_min: Number(data.settings.rate_limit_per_min) || 30,
          download_limit_per_min: Number(data.settings.download_limit_per_min) || 60,
          ads_enabled: data.settings.ads_enabled !== false,
          ads_adsterra_enabled: data.settings.ads_adsterra_enabled !== false,
          feature_stories: Boolean(data.settings.feature_stories),
          stories_provider_order: normalizeProviderOrder(
            data.settings.stories_provider_order
          ),
          stories_list_rate_limit_per_hour:
            Number(data.settings.stories_list_rate_limit_per_hour) || 5,
          stories_global_hourly_cap:
            Number(data.settings.stories_global_hourly_cap) || 200,
        });
        setStatusMessage('Paramètres enregistrés dans Cloudflare D1.');
        await fetchPublicConfig();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAddBlocklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockValue.trim()) return;

    const res = await fetch('/api/admin/blocklist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        type: blockType,
        value: blockValue.trim(),
      }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      setBlocklist(data.items || []);
      setBlockValue('');
      setStatusMessage('Entrée ajoutée à la liste de blocage.');
    }
  };

  const handleDeleteBlocklist = async (id: number) => {
    const res = await fetch('/api/admin/blocklist', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      setBlocklist(data.items || []);
      setStatusMessage('Entrée retirée de la liste de blocage.');
    }
  };

  const platformSwitches: Array<{
    key:
      | 'platform_tiktok'
      | 'platform_instagram'
      | 'platform_x'
      | 'platform_facebook'
      | 'platform_linkedin';
    title: string;
    desc: string;
    checked: boolean;
  }> = [
    {
      key: 'platform_tiktok',
      title: 'TikTok',
      desc: 'Extraction vidéo & audio TikTok',
      checked: settings.platform_tiktok,
    },
    {
      key: 'platform_instagram',
      title: 'Instagram',
      desc: 'Reels, posts, carrousels et photo de profil',
      checked: settings.platform_instagram,
    },
    {
      key: 'platform_x',
      title: 'X (Twitter)',
      desc: 'Vidéos et médias publics X',
      checked: settings.platform_x !== false,
    },
    {
      key: 'platform_facebook',
      title: 'Facebook',
      desc: 'Vidéos et Reels publics Facebook',
      checked: settings.platform_facebook !== false,
    },
    {
      key: 'platform_linkedin',
      title: 'LinkedIn',
      desc: 'Photo de profil publique (/in/{slug})',
      checked: settings.platform_linkedin !== false,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-admin-border">
        <div>
          <h1 className="font-display text-lg sm:text-xl font-bold text-admin-text tracking-tight">
            Contrôles
          </h1>
          <p className="text-xs text-admin-text-muted mt-0.5">
            Modifications appliquées en direct sur les API et la configuration publique
          </p>
        </div>
        {statusMessage && (
          <div className="px-3 py-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* 1. BLOC SITE */}
      <section aria-label="Contrôles du site" className="space-y-2.5">
        <h2 className="font-display text-xs font-bold uppercase tracking-wider text-admin-text-secondary">
          1. Site
        </h2>
        <div className="bg-admin-surface border border-admin-border rounded-lg p-4 sm:p-5 flex items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
              <h3 className="font-display text-sm font-bold text-admin-text">
                Mode Maintenance Global
              </h3>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                  settings.maintenance
                    ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-300'
                    : 'bg-admin-muted border-admin-border text-admin-text-muted'
                }`}
              >
                {settings.maintenance ? 'Actif (503)' : 'Inactif'}
              </span>
            </div>
            <p className="text-xs text-admin-text-muted">
              Suspend toutes les extractions (<code className="font-mono">MAINTENANCE · 503</code>) et affiche une bannière sur le site public.
            </p>
          </div>
          <ToggleSwitch
            label="Mode Maintenance Global"
            checked={settings.maintenance}
            tone="amber"
            onChange={() =>
              persistSettings({ ...settings, maintenance: !settings.maintenance })
            }
          />
        </div>
      </section>

      {/* 2. BLOC PLATEFORMES */}
      <section aria-label="Contrôles des plateformes" className="space-y-2.5">
        <h2 className="font-display text-xs font-bold uppercase tracking-wider text-admin-text-secondary">
          2. Plateformes
        </h2>

        <div className="bg-admin-surface border border-admin-border rounded-lg divide-y divide-admin-border">
          {/* 5 Extractors */}
          <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {platformSwitches.map((item) => (
              <div
                key={item.key}
                className="p-3.5 rounded-md border border-admin-border flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-sm font-bold text-admin-text">
                      {item.title}
                    </h3>
                    <span
                      className={`text-[11px] font-semibold px-1.5 py-0.5 rounded border ${
                        item.checked
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-300'
                          : 'bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-700/60 text-red-900 dark:text-red-300'
                      }`}
                    >
                      {item.checked ? 'Actif' : 'Désactivé'}
                    </span>
                  </div>
                  <p className="text-xs text-admin-text-muted mt-0.5">{item.desc}</p>
                </div>
                <ToggleSwitch
                  label={`Extracteur ${item.title}`}
                  checked={item.checked}
                  onChange={() =>
                    persistSettings({ ...settings, [item.key]: !item.checked })
                  }
                />
              </div>
            ))}

            {/* Services tiers */}
            <div className="p-3.5 rounded-md border border-admin-border flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-sm font-bold text-admin-text">
                    Services tiers
                  </h3>
                  <span
                    className={`text-[11px] font-semibold px-1.5 py-0.5 rounded border ${
                      settings.allow_third_party !== false
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-300'
                        : 'bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-700/60 text-red-900 dark:text-red-300'
                    }`}
                  >
                    {settings.allow_third_party !== false ? 'Actif' : 'Désactivé'}
                  </span>
                </div>
                <p className="text-xs text-admin-text-muted mt-0.5">
                  Repli tikwm / vxinstagram / ddinstagram (<code className="font-mono">allow_third_party</code>)
                </p>
              </div>
              <ToggleSwitch
                label="Services tiers (allow_third_party)"
                checked={settings.allow_third_party !== false}
                onChange={() =>
                  persistSettings({
                    ...settings,
                    allow_third_party: settings.allow_third_party === false,
                  })
                }
              />
            </div>
          </div>

          {/* Stories Instagram */}
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-sm font-bold text-admin-text">
                    Stories Instagram (<code className="font-mono text-xs">feature_stories</code>)
                  </h3>
                  <span
                    className={`text-[11px] font-semibold px-1.5 py-0.5 rounded border ${
                      settings.feature_stories
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-300'
                        : 'bg-admin-muted border-admin-border text-admin-text-muted'
                    }`}
                  >
                    {settings.feature_stories ? 'Actif' : 'Désactivé'}
                  </span>
                </div>
                <p className="text-xs text-admin-text-muted mt-0.5">
                  Récupération et listage des stories publiques via <code className="font-mono">/api/stories</code>
                </p>
              </div>
              <ToggleSwitch
                label="Stories Instagram (feature_stories)"
                checked={settings.feature_stories}
                onChange={() =>
                  persistSettings({
                    ...settings,
                    feature_stories: !settings.feature_stories,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-admin-text-secondary block">
                Ordre de priorité des fournisseurs
              </span>
              {settings.stories_provider_order.map((providerId, idx) => {
                const info = STORY_PROVIDER_LABELS[providerId];
                const moveProvider = (direction: -1 | 1) => {
                  const target = idx + direction;
                  if (target < 0 || target >= settings.stories_provider_order.length) return;
                  const nextOrder = [...settings.stories_provider_order];
                  const [moved] = nextOrder.splice(idx, 1);
                  nextOrder.splice(target, 0, moved);
                  persistSettings({ ...settings, stories_provider_order: nextOrder });
                };
                return (
                  <div
                    key={providerId}
                    className="px-3 py-2 rounded-md border border-admin-border bg-admin-muted/40 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded bg-admin-surface border border-admin-border text-xs font-mono font-bold text-admin-text flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-admin-text truncate">
                          {info.title}
                        </div>
                        <div className="text-[11px] text-admin-text-muted truncate">
                          {info.hint}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={saving || idx === 0}
                        onClick={() => moveProvider(-1)}
                        aria-label={`Monter ${providerId}`}
                        className="px-2 py-1 rounded border border-admin-border-strong bg-admin-surface text-xs font-mono text-admin-text disabled:opacity-40 cursor-pointer hover:bg-admin-hover"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={
                          saving || idx === settings.stories_provider_order.length - 1
                        }
                        onClick={() => moveProvider(1)}
                        aria-label={`Descendre ${providerId}`}
                        className="px-2 py-1 rounded border border-admin-border-strong bg-admin-surface text-xs font-mono text-admin-text disabled:opacity-40 cursor-pointer hover:bg-admin-hover"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="flex items-center justify-between gap-3 p-3 rounded-md border border-admin-border">
                <label
                  htmlFor="stories-ip-limit"
                  className="text-xs text-admin-text-secondary"
                >
                  Listes / IP / heure
                </label>
                <input
                  id="stories-ip-limit"
                  type="number"
                  min={1}
                  max={200}
                  value={settings.stories_list_rate_limit_per_hour}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      stories_list_rate_limit_per_hour: Math.max(
                        1,
                        parseInt(e.target.value || '1', 10)
                      ),
                    })
                  }
                  className="w-20 px-2 py-1.5 rounded bg-admin-muted border border-admin-border-strong text-xs font-mono text-admin-text text-center"
                />
              </div>

              <div className="flex items-center justify-between gap-3 p-3 rounded-md border border-admin-border">
                <label
                  htmlFor="stories-global-cap"
                  className="text-xs text-admin-text-secondary"
                >
                  Plafond global / heure
                </label>
                <input
                  id="stories-global-cap"
                  type="number"
                  min={1}
                  max={50000}
                  value={settings.stories_global_hourly_cap}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      stories_global_hourly_cap: Math.max(
                        1,
                        parseInt(e.target.value || '1', 10)
                      ),
                    })
                  }
                  className="w-24 px-2 py-1.5 rounded bg-admin-muted border border-admin-border-strong text-xs font-mono text-admin-text text-center"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={saving}
                onClick={() => persistSettings(settings)}
                className="px-3.5 py-2 rounded-md bg-admin-accent hover:opacity-90 text-white font-display font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Enregistrer les réglages Stories</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 3. BLOC LIMITES */}
      <section aria-label="Limites et blocage" className="space-y-2.5">
        <h2 className="font-display text-xs font-bold uppercase tracking-wider text-admin-text-secondary">
          3. Limites
        </h2>

        <div className="bg-admin-surface border border-admin-border rounded-lg divide-y divide-admin-border">
          {/* Rate limits */}
          <div className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between gap-3 p-3.5 rounded-md border border-admin-border">
                <div>
                  <label
                    htmlFor="rate-limit-extract"
                    className="font-display text-sm font-bold text-admin-text block"
                  >
                    Extractions / IP
                  </label>
                  <span className="text-xs text-admin-text-muted">
                    <code className="font-mono">rate_limit_per_min</code> (429 au-delà)
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    id="rate-limit-extract"
                    type="number"
                    min={1}
                    max={600}
                    value={settings.rate_limit_per_min}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        rate_limit_per_min: Math.max(
                          1,
                          parseInt(e.target.value || '1', 10)
                        ),
                      })
                    }
                    className="w-20 px-2.5 py-1.5 rounded bg-admin-muted border border-admin-border-strong text-xs font-mono text-admin-text text-center"
                  />
                  <span className="text-xs font-mono text-admin-text-muted">/ min</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 p-3.5 rounded-md border border-admin-border">
                <div>
                  <label
                    htmlFor="rate-limit-download"
                    className="font-display text-sm font-bold text-admin-text block"
                  >
                    Téléchargements / IP
                  </label>
                  <span className="text-xs text-admin-text-muted">
                    <code className="font-mono">download_limit_per_min</code>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    id="rate-limit-download"
                    type="number"
                    min={1}
                    max={1000}
                    value={settings.download_limit_per_min}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        download_limit_per_min: Math.max(
                          1,
                          parseInt(e.target.value || '1', 10)
                        ),
                      })
                    }
                    className="w-20 px-2.5 py-1.5 rounded bg-admin-muted border border-admin-border-strong text-xs font-mono text-admin-text text-center"
                  />
                  <span className="text-xs font-mono text-admin-text-muted">/ min</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={saving}
                onClick={() => persistSettings(settings)}
                className="px-3.5 py-2 rounded-md bg-admin-accent hover:opacity-90 text-white font-display font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Enregistrer les limites</span>
              </button>
            </div>
          </div>

          {/* Blocklist D1 */}
          <div className="p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center gap-2">
              <ShieldBan className="w-4 h-4 text-red-700 dark:text-red-400" />
              <h3 className="font-display text-sm font-bold text-admin-text">
                Liste de blocage (Blocklist D1)
              </h3>
            </div>

            <form onSubmit={handleAddBlocklist} className="flex flex-col md:flex-row gap-2">
              <select
                aria-label="Type d'entrée à bloquer"
                value={blockType}
                onChange={(e) =>
                  setBlockType(e.target.value as 'ip_hash' | 'domain' | 'url')
                }
                className="px-3 py-2 rounded-md bg-admin-muted border border-admin-border-strong text-xs text-admin-text focus:outline-none focus:border-admin-accent"
              >
                <option value="domain">Domaine (ex: example.com)</option>
                <option value="url">URL ou fragment</option>
                <option value="ip_hash">Empreinte IP (SHA-256)</option>
              </select>

              <input
                type="text"
                aria-label="Valeur à bloquer"
                value={blockValue}
                onChange={(e) => setBlockValue(e.target.value)}
                placeholder="Valeur à bloquer…"
                className="flex-1 px-3 py-2 rounded-md bg-admin-muted border border-admin-border-strong text-xs text-admin-text placeholder-admin-text-muted font-mono focus:outline-none focus:border-admin-accent"
              />

              <button
                type="submit"
                className="px-4 py-2 rounded-md bg-red-700 hover:bg-red-800 text-white font-display font-semibold text-xs inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Bloquer</span>
              </button>
            </form>

            {blocklist.length === 0 ? (
              <p className="text-xs text-admin-text-muted py-2 text-center">
                Aucune règle de blocage active dans D1.
              </p>
            ) : (
              <div className="divide-y divide-admin-border border border-admin-border rounded-md overflow-hidden">
                {blocklist.map((item) => (
                  <div
                    key={item.id}
                    className="px-3.5 py-2 flex items-center justify-between gap-3 text-xs font-mono"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-2 py-0.5 rounded bg-red-50 dark:bg-red-950/70 border border-red-300 dark:border-red-800/60 text-red-900 dark:text-red-300 font-semibold shrink-0">
                        {item.type}
                      </span>
                      <span className="text-admin-text truncate">{item.value}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteBlocklist(item.id)}
                      aria-label={`Supprimer la règle ${item.value}`}
                      className="text-red-700 dark:text-red-400 hover:text-red-900 p-1 shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. BLOC MONÉTISATION */}
      <section aria-label="Monétisation" className="space-y-2.5">
        <h2 className="font-display text-xs font-bold uppercase tracking-wider text-admin-text-secondary">
          4. Monétisation
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div className="bg-admin-surface border border-admin-border rounded-lg p-4 sm:p-5 flex items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <h3 className="font-display text-sm font-bold text-admin-text">
                Adsterra (<code className="font-mono text-xs">ads_adsterra_enabled</code>)
              </h3>
              <p className="text-xs text-admin-text-muted">
                Bannières iframe, Native Banner et Social Bar sur les pages publiques (après consentement).
              </p>
            </div>
            <ToggleSwitch
              label="Monétisation Adsterra"
              checked={settings.ads_adsterra_enabled}
              onChange={() =>
                persistSettings({
                  ...settings,
                  ads_adsterra_enabled: !settings.ads_adsterra_enabled,
                })
              }
            />
          </div>

          <div className="bg-admin-surface border border-admin-border rounded-lg p-4 sm:p-5 flex items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <h3 className="font-display text-sm font-bold text-admin-text">
                Google AdSense (<code className="font-mono text-xs">ads_enabled</code>)
              </h3>
              <p className="text-xs text-admin-text-muted">
                Active ou masque les emplacements AdSense via <code className="font-mono">adsenseService.ts</code>.
              </p>
            </div>
            <ToggleSwitch
              label="Monétisation Google AdSense"
              checked={settings.ads_enabled}
              onChange={() =>
                persistSettings({ ...settings, ads_enabled: !settings.ads_enabled })
              }
            />
          </div>
        </div>
      </section>
    </div>
  );
};
