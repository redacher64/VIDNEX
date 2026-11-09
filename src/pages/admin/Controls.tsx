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

interface SystemSettings {
  maintenance: boolean;
  platform_tiktok: boolean;
  platform_instagram: boolean;
  rate_limit_per_min: number;
  ads_enabled: boolean;
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
    platform_tiktok: true,
    platform_instagram: true,
    rate_limit_per_min: 30,
    ads_enabled: true,
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

      if (settingsRes.ok && settingsJson.ok) {
        setSettings(settingsJson.settings);
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
        setSettings(data.settings);
        setStatusMessage('Paramètres enregistrés dans Cloudflare D1.');
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
          <h2 className="font-display text-xl font-bold text-white">
            Contrôles Opérationnels & Sécurité
          </h2>
          <p className="text-xs text-orange-200/65 font-mono">
            Modifications appliquées en temps réel sur /api/extract et /api/public-config
          </p>
        </div>
        {statusMessage && (
          <div className="px-3.5 py-2 rounded-xl bg-emerald-950/60 border border-emerald-700/60 text-emerald-200 text-xs font-mono flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* Interrupteurs globaux */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Maintenance */}
        <div className="bg-[#1c140e] border border-orange-900/50 rounded-2xl p-5 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-amber-400" />
              <h3 className="font-display text-sm font-bold text-white">
                Mode Maintenance Global
              </h3>
            </div>
            <p className="text-xs text-orange-200/65">
              Suspend toutes les extractions (/api/extract renvoie MAINTENANCE · 503) et affiche une bannière sur le site.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.maintenance}
            onClick={() =>
              persistSettings({ ...settings, maintenance: !settings.maintenance })
            }
            className={`w-12 h-7 rounded-full transition-colors p-1 shrink-0 cursor-pointer ${
              settings.maintenance ? 'bg-amber-500' : 'bg-[#120c08] border border-orange-900/80'
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                settings.maintenance ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* AdSense */}
        <div className="bg-[#1c140e] border border-orange-900/50 rounded-2xl p-5 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-orange-400" />
              <h3 className="font-display text-sm font-bold text-white">
                Monétisation Google AdSense
              </h3>
            </div>
            <p className="text-xs text-orange-200/65">
              Active ou masque instantanément les emplacements publicitaires via adsenseService.ts.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.ads_enabled}
            onClick={() =>
              persistSettings({ ...settings, ads_enabled: !settings.ads_enabled })
            }
            className={`w-12 h-7 rounded-full transition-colors p-1 shrink-0 cursor-pointer ${
              settings.ads_enabled ? 'bg-emerald-500' : 'bg-[#120c08] border border-orange-900/80'
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                settings.ads_enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* TikTok Toggle */}
        <div className="bg-[#1c140e] border border-orange-900/50 rounded-2xl p-5 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-display text-sm font-bold text-white">
              Extracteur TikTok
            </h3>
            <p className="text-xs text-orange-200/65">
              Désactive uniquement TikTok (renvoie PLATFORM_DISABLED et grise TikTok côté public).
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.platform_tiktok}
            onClick={() =>
              persistSettings({
                ...settings,
                platform_tiktok: !settings.platform_tiktok,
              })
            }
            className={`w-12 h-7 rounded-full transition-colors p-1 shrink-0 cursor-pointer ${
              settings.platform_tiktok
                ? 'bg-emerald-500'
                : 'bg-[#120c08] border border-orange-900/80'
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                settings.platform_tiktok ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Instagram Toggle */}
        <div className="bg-[#1c140e] border border-orange-900/50 rounded-2xl p-5 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-display text-sm font-bold text-white">
              Extracteur Instagram
            </h3>
            <p className="text-xs text-orange-200/65">
              Désactive uniquement Instagram (renvoie PLATFORM_DISABLED et grise Instagram côté public).
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.platform_instagram}
            onClick={() =>
              persistSettings({
                ...settings,
                platform_instagram: !settings.platform_instagram,
              })
            }
            className={`w-12 h-7 rounded-full transition-colors p-1 shrink-0 cursor-pointer ${
              settings.platform_instagram
                ? 'bg-emerald-500'
                : 'bg-[#120c08] border border-orange-900/80'
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                settings.platform_instagram ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Limite de requêtes / minute */}
      <div className="bg-[#1c140e] border border-orange-900/50 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-sm font-bold text-white">
              Limite de débit par IP (Rate Limit D1)
            </h3>
            <p className="text-xs text-orange-200/65">
              Nombre maximum d’extractions autorisées par minute et par IP hachée avant renvoi de RATE_LIMITED (429).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={600}
              value={settings.rate_limit_per_min}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  rate_limit_per_min: Math.max(1, parseInt(e.target.value || '1', 10)),
                })
              }
              className="w-24 px-3 py-2 rounded-xl bg-[#120c08] border border-orange-900/70 text-sm text-white font-mono text-center"
            />
            <span className="text-xs font-mono text-orange-200/70">req / min</span>
            <button
              type="button"
              disabled={saving}
              onClick={() => persistSettings(settings)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-display font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Enregistrer</span>
            </button>
          </div>
        </div>
      </div>

      {/* Liste de blocage (Blocklist D1) */}
      <div className="bg-[#1c140e] border border-orange-900/50 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldBan className="w-4 h-4 text-red-400" />
          <h3 className="font-display text-sm font-bold text-white">
            Liste de blocage (IP hachée, Domaine ou URL)
          </h3>
        </div>

        <form onSubmit={handleAddBlocklist} className="flex flex-col sm:flex-row gap-2">
          <select
            value={blockType}
            onChange={(e) => setBlockType(e.target.value as 'ip_hash' | 'domain' | 'url')}
            className="px-3.5 py-2.5 rounded-xl bg-[#120c08] border border-orange-900/70 text-xs text-white font-mono"
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
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#120c08] border border-orange-900/70 text-xs text-white placeholder-orange-200/35 font-mono"
          />

          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-display font-semibold text-xs flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Bloquer</span>
          </button>
        </form>

        {blocklist.length === 0 ? (
          <p className="text-xs font-mono text-orange-200/50 py-3 text-center">
            Aucune règle de blocage active dans D1.
          </p>
        ) : (
          <div className="divide-y divide-orange-950/60 border border-orange-950/80 rounded-xl overflow-hidden bg-[#120c08]">
            {blocklist.map((item) => (
              <div
                key={item.id}
                className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs font-mono"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="px-2 py-0.5 rounded bg-red-950/70 border border-red-800/60 text-red-300 uppercase text-[10px] shrink-0">
                    {item.type}
                  </span>
                  <span className="text-orange-100 truncate">{item.value}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteBlocklist(item.id)}
                  className="text-red-400 hover:text-red-300 p-1 shrink-0 cursor-pointer"
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
