import React, { useEffect, useState } from 'react';
import {
  Sliders,
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
    title: 'Fournisseur payant à l’usage (STORIES_PAID_API_URL)',
    hint: 'Adaptateur API externe authentifié côté serveur (STORIES_PAID_API_TOKEN)',
  },
};

function normalizeProviderOrder(
  raw: unknown
): Array<'session' | 'relay' | 'paid'> {
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
          ads_adsterra_enabled:
            data.settings.ads_adsterra_enabled !== false,
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-admin-text">
            Contrôles Opérationnels & Sécurité
          </h2>
          <p className="text-xs text-admin-text-muted">
            Modifications appliquées en temps réel sur <code className="font-mono">/api/extract</code>, <code className="font-mono">/api/download</code> et <code className="font-mono">/api/public-config</code>
          </p>
        </div>
        {statusMessage && (
          <div className="px-3.5 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* Interrupteurs globaux */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Maintenance */}
        <div className="bg-admin-surface border border-admin-border rounded-lg p-5 flex items-center justify-between gap-4 shadow-2xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-amber-700 dark:text-amber-400" />
              <h3 className="font-display text-sm font-bold text-admin-text">
                Mode Maintenance Global
              </h3>
            </div>
            <p className="text-xs text-admin-text-muted">
              Suspend toutes les extractions (<code className="font-mono">/api/extract</code> renvoie <code className="font-mono">MAINTENANCE · 503</code>) et affiche une bannière sur le site.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="Mode Maintenance Global"
            aria-checked={settings.maintenance}
            onClick={() =>
              persistSettings({ ...settings, maintenance: !settings.maintenance })
            }
            className={`w-12 h-7 rounded-full transition-colors p-1 shrink-0 cursor-pointer ${
              settings.maintenance
                ? 'bg-amber-600 dark:bg-amber-500'
                : 'bg-admin-muted border border-admin-border-strong'
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow-2xs transition-transform ${
                settings.maintenance ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Adsterra (ads_adsterra_enabled) */}
        <div className="bg-admin-surface border border-admin-border rounded-lg p-5 flex items-center justify-between gap-4 shadow-2xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-admin-text-muted" />
              <h3 className="font-display text-sm font-bold text-admin-text">
                Monétisation Adsterra (<code className="font-mono">ads_adsterra_enabled</code>)
              </h3>
            </div>
            <p className="text-xs text-admin-text-muted">
              Active ou masque les bannières iframe Adsterra, la Native Banner et la Social Bar sur les pages publiques.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="Monétisation Adsterra"
            aria-checked={settings.ads_adsterra_enabled}
            onClick={() =>
              persistSettings({
                ...settings,
                ads_adsterra_enabled: !settings.ads_adsterra_enabled,
              })
            }
            className={`w-12 h-7 rounded-full transition-colors p-1 shrink-0 cursor-pointer ${
              settings.ads_adsterra_enabled
                ? 'bg-emerald-600 dark:bg-emerald-500'
                : 'bg-admin-muted border border-admin-border-strong'
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow-2xs transition-transform ${
                settings.ads_adsterra_enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* AdSense (ads_enabled) */}
        <div className="bg-admin-surface border border-admin-border rounded-lg p-5 flex items-center justify-between gap-4 shadow-2xs md:col-span-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-admin-text-muted" />
              <h3 className="font-display text-sm font-bold text-admin-text">
                Monétisation Google AdSense (<code className="font-mono">ads_enabled</code>)
              </h3>
            </div>
            <p className="text-xs text-admin-text-muted">
              Active ou masque instantanément les emplacements publicitaires Google AdSense via <code className="font-mono">adsenseService.ts</code> (en attente d’approbation).
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="Monétisation Google AdSense"
            aria-checked={settings.ads_enabled}
            onClick={() =>
              persistSettings({ ...settings, ads_enabled: !settings.ads_enabled })
            }
            className={`w-12 h-7 rounded-full transition-colors p-1 shrink-0 cursor-pointer ${
              settings.ads_enabled
                ? 'bg-emerald-600 dark:bg-emerald-500'
                : 'bg-admin-muted border border-admin-border-strong'
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow-2xs transition-transform ${
                settings.ads_enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Services tiers (allow_third_party) */}
        <div className="bg-admin-surface border border-admin-border rounded-lg p-5 flex items-center justify-between gap-4 md:col-span-2 shadow-2xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-admin-text-muted" />
              <h3 className="font-display text-sm font-bold text-admin-text">
                Services tiers (<code className="font-mono">allow_third_party</code> : tikwm.com, vxinstagram.com, ddinstagram.com)
              </h3>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${
                  settings.allow_third_party !== false
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-300'
                    : 'bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-700/60 text-red-900 dark:text-red-300'
                }`}
              >
                {settings.allow_third_party !== false ? 'Actif' : 'Désactivé'}
              </span>
            </div>
            <p className="text-xs text-admin-text-muted">
              Désactivé, plus aucun appel vers tikwm.com, vxinstagram.com ou ddinstagram.com : seuls les niveaux directs sont utilisés et ces hôtes sont refusés dans l’allowlist de <code className="font-mono">/api/download</code> (sans redéploiement).
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="Services tiers (allow_third_party)"
            aria-checked={settings.allow_third_party !== false}
            onClick={() =>
              persistSettings({
                ...settings,
                allow_third_party: settings.allow_third_party === false ? true : false,
              })
            }
            className={`w-12 h-7 rounded-full transition-colors p-1 shrink-0 cursor-pointer ${
              settings.allow_third_party !== false
                ? 'bg-emerald-600 dark:bg-emerald-500'
                : 'bg-admin-muted border border-admin-border-strong'
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                settings.allow_third_party !== false ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* TikTok Toggle */}
        <div className="bg-admin-surface border border-admin-border rounded-lg p-5 flex items-center justify-between gap-4 shadow-2xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-bold text-admin-text">
                Extracteur TikTok
              </h3>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${
                  settings.platform_tiktok
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-300'
                    : 'bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-700/60 text-red-900 dark:text-red-300'
                }`}
              >
                {settings.platform_tiktok ? 'Actif' : 'Désactivé'}
              </span>
            </div>
            <p className="text-xs text-admin-text-muted">
              Désactive uniquement TikTok (renvoie <code className="font-mono">PLATFORM_DISABLED</code> et grise TikTok côté public).
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="Extracteur TikTok"
            aria-checked={settings.platform_tiktok}
            onClick={() =>
              persistSettings({
                ...settings,
                platform_tiktok: !settings.platform_tiktok,
              })
            }
            className={`w-12 h-7 rounded-full transition-colors p-1 shrink-0 cursor-pointer ${
              settings.platform_tiktok
                ? 'bg-emerald-600 dark:bg-emerald-500'
                : 'bg-admin-muted border border-admin-border-strong'
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow-2xs transition-transform ${
                settings.platform_tiktok ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Instagram Toggle */}
        <div className="bg-admin-surface border border-admin-border rounded-lg p-5 flex items-center justify-between gap-4 shadow-2xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-bold text-admin-text">
                Extracteur Instagram
              </h3>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${
                  settings.platform_instagram
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-300'
                    : 'bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-700/60 text-red-900 dark:text-red-300'
                }`}
              >
                {settings.platform_instagram ? 'Actif' : 'Désactivé'}
              </span>
            </div>
            <p className="text-xs text-admin-text-muted">
              Désactive uniquement Instagram (renvoie <code className="font-mono">PLATFORM_DISABLED</code> et grise Instagram côté public).
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="Extracteur Instagram"
            aria-checked={settings.platform_instagram}
            onClick={() =>
              persistSettings({
                ...settings,
                platform_instagram: !settings.platform_instagram,
              })
            }
            className={`w-12 h-7 rounded-full transition-colors p-1 shrink-0 cursor-pointer ${
              settings.platform_instagram
                ? 'bg-emerald-600 dark:bg-emerald-500'
                : 'bg-admin-muted border border-admin-border-strong'
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow-2xs transition-transform ${
                settings.platform_instagram ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* X (Twitter) Toggle */}
        <div className="bg-admin-surface border border-admin-border rounded-lg p-5 flex items-center justify-between gap-4 shadow-2xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-bold text-admin-text">
                Extracteur X (Twitter)
              </h3>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${
                  settings.platform_x !== false
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-300'
                    : 'bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-700/60 text-red-900 dark:text-red-300'
                }`}
              >
                {settings.platform_x !== false ? 'Actif' : 'Désactivé'}
              </span>
            </div>
            <p className="text-xs text-admin-text-muted">
              Désactive uniquement X (Twitter) (renvoie <code className="font-mono">PLATFORM_DISABLED</code> et grise X (Twitter) côté public).
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="Extracteur X (Twitter)"
            aria-checked={settings.platform_x !== false}
            onClick={() =>
              persistSettings({
                ...settings,
                platform_x: settings.platform_x === false ? true : false,
              })
            }
            className={`w-12 h-7 rounded-full transition-colors p-1 shrink-0 cursor-pointer ${
              settings.platform_x !== false
                ? 'bg-emerald-600 dark:bg-emerald-500'
                : 'bg-admin-muted border border-admin-border-strong'
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow-2xs transition-transform ${
                settings.platform_x !== false ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Facebook Toggle */}
        <div className="bg-admin-surface border border-admin-border rounded-lg p-5 flex items-center justify-between gap-4 shadow-2xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-bold text-admin-text">
                Extracteur Facebook
              </h3>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${
                  settings.platform_facebook !== false
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-300'
                    : 'bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-700/60 text-red-900 dark:text-red-300'
                }`}
              >
                {settings.platform_facebook !== false ? 'Actif' : 'Désactivé'}
              </span>
            </div>
            <p className="text-xs text-admin-text-muted">
              Désactive uniquement Facebook (renvoie <code className="font-mono">PLATFORM_DISABLED</code> et grise Facebook côté public).
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="Extracteur Facebook"
            aria-checked={settings.platform_facebook !== false}
            onClick={() =>
              persistSettings({
                ...settings,
                platform_facebook: settings.platform_facebook === false ? true : false,
              })
            }
            className={`w-12 h-7 rounded-full transition-colors p-1 shrink-0 cursor-pointer ${
              settings.platform_facebook !== false
                ? 'bg-emerald-600 dark:bg-emerald-500'
                : 'bg-admin-muted border border-admin-border-strong'
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow-2xs transition-transform ${
                settings.platform_facebook !== false ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* LinkedIn Toggle */}
        <div className="bg-admin-surface border border-admin-border rounded-lg p-5 flex items-center justify-between gap-4 shadow-2xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-bold text-admin-text">
                Extracteur LinkedIn (Photo de profil)
              </h3>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${
                  settings.platform_linkedin !== false
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-300'
                    : 'bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-700/60 text-red-900 dark:text-red-300'
                }`}
              >
                {settings.platform_linkedin !== false ? 'Actif' : 'Désactivé'}
              </span>
            </div>
            <p className="text-xs text-admin-text-muted">
              Active ou désactive l’extraction de la photo de profil publique LinkedIn (<code className="font-mono">/in/&#123;slug&#125;</code>).
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="Extracteur LinkedIn"
            aria-checked={settings.platform_linkedin !== false}
            onClick={() =>
              persistSettings({
                ...settings,
                platform_linkedin: settings.platform_linkedin === false ? true : false,
              })
            }
            className={`w-12 h-7 rounded-full transition-colors p-1 shrink-0 cursor-pointer ${
              settings.platform_linkedin !== false
                ? 'bg-emerald-600 dark:bg-emerald-500'
                : 'bg-admin-muted border border-admin-border-strong'
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow-2xs transition-transform ${
                settings.platform_linkedin !== false ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Stories Instagram (feature_stories, ordre des fournisseurs & plafonds horaires) */}
      <div className="bg-admin-surface border border-admin-border rounded-lg p-5 space-y-5 shadow-2xs">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Sliders className="w-4 h-4 text-admin-text-muted" />
              <h3 className="font-display text-sm font-bold text-admin-text">
                Stories Instagram (<code className="font-mono">feature_stories</code>)
              </h3>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${
                  settings.feature_stories
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-300'
                    : 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-300'
                }`}
              >
                {settings.feature_stories ? 'Actif' : 'Désactivé (défaut)'}
              </span>
            </div>
            <p className="text-xs text-admin-text-muted">
              Active la récupération d’une story publique et le listage de toutes les stories actives d’un compte (<code className="font-mono">/api/stories</code>). Désactivé par défaut : renvoie « Les stories sont temporairement indisponibles. ».
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="Stories Instagram (feature_stories)"
            aria-checked={settings.feature_stories}
            onClick={() =>
              persistSettings({
                ...settings,
                feature_stories: !settings.feature_stories,
              })
            }
            className={`w-12 h-7 rounded-full transition-colors p-1 shrink-0 cursor-pointer ${
              settings.feature_stories
                ? 'bg-emerald-600 dark:bg-emerald-500'
                : 'bg-admin-muted border border-admin-border-strong'
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow-2xs transition-transform ${
                settings.feature_stories ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="border-t border-admin-border pt-4 space-y-2.5">
          <div>
            <h4 className="font-display text-xs font-bold text-admin-text">
              Ordre de priorité des fournisseurs (<code className="font-mono">stories_provider_order</code>)
            </h4>
            <p className="text-xs text-admin-text-muted">
              Essayés dans cet ordre ; seuls les fournisseurs configurés côté serveur sont appelés. Les comptes privés ou introuvables stoppent immédiatement le repli.
            </p>
          </div>
          <div className="space-y-2">
            {settings.stories_provider_order.map((providerId, idx) => {
              const info = STORY_PROVIDER_LABELS[providerId];
              const moveProvider = (direction: -1 | 1) => {
                const target = idx + direction;
                if (target < 0 || target >= settings.stories_provider_order.length) {
                  return;
                }
                const nextOrder = [...settings.stories_provider_order];
                const [moved] = nextOrder.splice(idx, 1);
                nextOrder.splice(target, 0, moved);
                persistSettings({
                  ...settings,
                  stories_provider_order: nextOrder,
                });
              };
              return (
                <div
                  key={providerId}
                  className="px-3.5 py-2.5 rounded-lg border border-admin-border bg-admin-muted/40 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-md bg-admin-surface border border-admin-border text-xs font-mono font-bold text-admin-text flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-admin-text truncate">
                        {info.title}
                      </div>
                      <div className="text-xs text-admin-text-muted truncate">
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
                      className="px-2 py-1 rounded-md border border-admin-border-strong bg-admin-surface text-xs font-mono text-admin-text disabled:opacity-40 cursor-pointer hover:bg-admin-hover"
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
                      className="px-2 py-1 rounded-md border border-admin-border-strong bg-admin-surface text-xs font-mono text-admin-text disabled:opacity-40 cursor-pointer hover:bg-admin-hover"
                    >
                      ↓
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-admin-border pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="font-display text-xs font-bold text-admin-text">
                Liste complète par IP (<code className="font-mono">stories_list_rate_limit_per_hour</code>)
              </h4>
              <p className="text-xs text-admin-text-muted">
                Appels « Voir toutes les stories » par IP hachée et par heure (défaut : 5).
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <input
                type="number"
                min={1}
                max={200}
                aria-label="Limite horaire de listage des stories par IP"
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
                className="w-20 px-2.5 py-2 rounded-lg bg-admin-muted border border-admin-border-strong text-sm text-admin-text font-mono text-center focus:outline-none focus:border-orange-600"
              />
              <span className="text-xs font-mono text-admin-text-secondary">/ h</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="font-display text-xs font-bold text-admin-text">
                Plafond global horaire (<code className="font-mono">stories_global_hourly_cap</code>)
              </h4>
              <p className="text-xs text-admin-text-muted">
                Appels fournisseur maximum par heure pour contrôler les coûts (défaut : 200).
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <input
                type="number"
                min={1}
                max={50000}
                aria-label="Plafond global horaire des stories"
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
                className="w-24 px-2.5 py-2 rounded-lg bg-admin-muted border border-admin-border-strong text-sm text-admin-text font-mono text-center focus:outline-none focus:border-orange-600"
              />
              <span className="text-xs font-mono text-admin-text-secondary">/ h</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={() => persistSettings(settings)}
            className="px-4 py-2 rounded-md bg-admin-accent hover:opacity-90 text-white font-display font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Enregistrer les réglages Stories</span>
          </button>
        </div>
      </div>

      {/* Limite de requêtes / minute (Extractions & Téléchargements) */}
      <div className="bg-admin-surface border border-admin-border rounded-lg p-5 space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-sm font-bold text-admin-text">
              Limite d’extractions par IP (`rate_limit_per_min`)
            </h3>
            <p className="text-xs text-admin-text-muted">
              Nombre maximum d’appels `/api/extract` par minute et par IP hachée avant renvoi de 429 + Retry-After.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={600}
              aria-label="Limite d'extractions par minute"
              value={settings.rate_limit_per_min}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  rate_limit_per_min: Math.max(1, parseInt(e.target.value || '1', 10)),
                })
              }
              className="w-24 px-3 py-2 rounded-lg bg-admin-muted border border-admin-border-strong text-sm text-admin-text font-mono text-center focus:outline-none focus:border-orange-600"
            />
            <span className="text-xs font-mono text-admin-text-secondary">req / min</span>
          </div>
        </div>

        <div className="border-t border-admin-border pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-sm font-bold text-admin-text">
              Limite de téléchargements par IP (`download_limit_per_min`)
            </h3>
            <p className="text-xs text-admin-text-muted">
              Nombre maximum de fichiers `/api/download` par minute et par IP hachée (1 comptage par fichier/min, requêtes Range comprises).
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="number"
              min={1}
              max={1000}
              aria-label="Limite de téléchargements par minute"
              value={settings.download_limit_per_min}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  download_limit_per_min: Math.max(1, parseInt(e.target.value || '1', 10)),
                })
              }
              className="w-24 px-3 py-2 rounded-lg bg-admin-muted border border-admin-border-strong text-sm text-admin-text font-mono text-center focus:outline-none focus:border-orange-600"
            />
            <span className="text-xs font-mono text-admin-text-secondary">fichiers / min</span>
            <button
              type="button"
              disabled={saving}
              onClick={() => persistSettings(settings)}
              className="px-4 py-2 rounded-md bg-admin-accent hover:opacity-90 text-white font-display font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Enregistrer</span>
            </button>
          </div>
        </div>
      </div>

      {/* Liste de blocage (Blocklist D1) */}
      <div className="bg-admin-surface border border-admin-border rounded-lg p-5 space-y-4 shadow-2xs">
        <div className="flex items-center gap-2">
          <ShieldBan className="w-4 h-4 text-red-700 dark:text-red-400" />
          <h3 className="font-display text-sm font-bold text-admin-text">
            Liste de blocage (IP hachée, Domaine ou URL)
          </h3>
        </div>

        <form onSubmit={handleAddBlocklist} className="flex flex-col sm:flex-row gap-2">
          <select
            value={blockType}
            onChange={(e) => setBlockType(e.target.value as 'ip_hash' | 'domain' | 'url')}
            className="px-3.5 py-2.5 rounded-lg bg-admin-muted border border-admin-border-strong text-xs text-admin-text focus:outline-none focus:border-orange-600"
          >
            <option value="domain">Domaine (ex: example.com)</option>
            <option value="url">URL ou fragment d’URL</option>
            <option value="ip_hash">Empreinte IP (ip_hash SHA-256)</option>
          </select>

          <input
            type="text"
            value={blockValue}
            onChange={(e) => setBlockValue(e.target.value)}
            placeholder="Valeur à bloquer…"
            className="flex-1 px-3.5 py-2.5 rounded-lg bg-admin-muted border border-admin-border-strong text-xs text-admin-text placeholder-admin-text-muted/70 font-mono focus:outline-none focus:border-orange-600"
          />

          <button
            type="submit"
            className="px-4 py-2.5 rounded-md bg-red-700 hover:bg-red-800 text-white font-display font-semibold text-xs flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Bloquer</span>
          </button>
        </form>

        {blocklist.length === 0 ? (
          <p className="text-xs text-admin-text-muted py-3 text-center">
            Aucune règle de blocage active dans D1.
          </p>
        ) : (
          <div className="divide-y divide-admin-border border border-admin-border rounded-lg overflow-hidden">
            {blocklist.map((item) => (
              <div
                key={item.id}
                className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs font-mono"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-950/70 border border-red-300 dark:border-red-800/60 text-red-900 dark:text-red-300 font-semibold text-xs shrink-0">
                    {item.type}
                  </span>
                  <span className="text-admin-text truncate">{item.value}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteBlocklist(item.id)}
                  className="text-red-700 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 p-1 shrink-0 cursor-pointer"
                  title="Supprimer cette règle"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
