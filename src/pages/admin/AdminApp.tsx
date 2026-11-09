import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  HeartPulse,
  Sliders,
  ListOrdered,
  LogOut,
  Shield,
  ExternalLink,
} from './AdminIcons';
import { Login } from './Login';
import { Dashboard } from './Dashboard';
import { Health } from './Health';
import { Controls } from './Controls';
import { Activity } from './Activity';

type AdminTab = 'dashboard' | 'health' | 'controls' | 'activity';

export const AdminApp: React.FC = () => {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

  // Inject <meta name="robots" content="noindex, nofollow"> on /admin mount
  useEffect(() => {
    document.title = 'VIDNEX · Administration D1';
    let robotsMeta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    const previousContent = robotsMeta?.content || null;

    if (!robotsMeta) {
      robotsMeta = document.createElement('meta');
      robotsMeta.name = 'robots';
      document.head.appendChild(robotsMeta);
    }
    robotsMeta.content = 'noindex, nofollow';

    return () => {
      if (robotsMeta && previousContent !== null) {
        robotsMeta.content = previousContent;
      }
    };
  }, []);

  const checkSession = async () => {
    setCheckingAuth(true);
    try {
      const res = await fetch('/api/admin/login', {
        headers: { Accept: 'application/json' },
      });
      const data = await res.json();
      setAuthenticated(Boolean(res.ok && data.authenticated));
    } catch {
      setAuthenticated(false);
    } finally {
      setCheckingAuth(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const handleLogout = async () => {
    await fetch('/api/admin/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({}),
    }).catch(() => {});
    setAuthenticated(false);
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#140e0a] text-orange-200 font-mono text-xs">
        Vérification de la session administrateur…
      </div>
    );
  }

  if (!authenticated) {
    return <Login onLoginSuccess={() => setAuthenticated(true)} />;
  }

  const tabs: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'health',
      label: 'Santé des moteurs',
      icon: <HeartPulse className="w-4 h-4" />,
    },
    {
      id: 'controls',
      label: 'Contrôles',
      icon: <Sliders className="w-4 h-4" />,
    },
    {
      id: 'activity',
      label: 'Activité',
      icon: <ListOrdered className="w-4 h-4" />,
    },
  ];

  return (
    <div className="min-h-screen bg-[#140e0a] text-[#fffaf5] flex flex-col">
      {/* Top bar */}
      <header className="border-b border-orange-900/50 bg-[#1c140e]/95 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white shadow">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-base text-white">
                  VIDNEX Admin
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-orange-950 border border-orange-800/70 text-orange-300">
                  D1 Native
                </span>
              </div>
              <p className="text-[11px] font-mono text-orange-200/55 hidden sm:block">
                100 % gratuit · Sans API tierce · Stockage Cloudflare D1
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/"
              className="px-3 py-1.5 rounded-xl bg-[#241811] hover:bg-[#2f2016] border border-orange-900/60 text-xs font-mono text-orange-200 flex items-center gap-1.5 transition-colors"
            >
              <span>Site public</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900/70 border border-red-800/60 text-xs font-mono text-red-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Déconnexion</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto pb-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-display font-semibold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow'
                    : 'text-orange-200/70 hover:text-white hover:bg-orange-950/40'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'health' && <Health />}
        {activeTab === 'controls' && <Controls />}
        {activeTab === 'activity' && <Activity />}
      </main>
    </div>
  );
};

export default AdminApp;
