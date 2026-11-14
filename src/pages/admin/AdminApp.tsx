import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  HeartPulse,
  Sliders,
  ListOrdered,
  LogOut,
  Shield,
  ShieldAlert,
  ExternalLink,
  Sun,
  Moon,
  Users as UsersIcon,
  UserCircle,
  FileText,
} from './AdminIcons';
import { Login, type AdminUserProfile } from './Login';
import { Dashboard } from './Dashboard';
import { Health } from './Health';
import { Controls } from './Controls';
import { Activity } from './Activity';
import { Blog } from './Blog';
import {
  BLOG_MODULE_ENABLED,
  type AdminTab,
  getFirstAuthorizedTabForUser,
  isTabAuthorizedForUser,
} from './blogAdminLogic';
import { Users } from './Users';
import { Account } from './Account';
import {
  ADMIN_THEME_STORAGE_KEY,
  AdminTheme,
  applyAdminThemeToDocument,
  resolveInitialAdminTheme,
} from './adminTheme';

export {
  BLOG_MODULE_ENABLED,
  type AdminTab,
  getFirstAuthorizedTabForUser,
  isTabAuthorizedForUser,
};

function getExplicitUrlTab(): AdminTab | null {
  if (typeof window === 'undefined') return null;
  const tab = new URLSearchParams(window.location.search).get('tab');
  if (
    tab === 'dashboard' ||
    tab === 'health' ||
    tab === 'controls' ||
    tab === 'activity' ||
    tab === 'blog' ||
    tab === 'users' ||
    tab === 'account'
  ) {
    return tab;
  }
  return null;
}

export const AdminApp: React.FC = () => {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<AdminUserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>(
    () => getExplicitUrlTab() || 'dashboard'
  );
  const [theme, setTheme] = useState<AdminTheme>(() =>
    resolveInitialAdminTheme()
  );

  useEffect(() => {
    applyAdminThemeToDocument(theme, document, window.localStorage, false);
  }, [theme]);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    )
      return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      try {
        const stored = window.localStorage.getItem(ADMIN_THEME_STORAGE_KEY);
        if (stored === 'dark' || stored === 'light') return;
      } catch {
        // Ignore storage errors
      }
      const nextTheme: AdminTheme = e.matches ? 'dark' : 'light';
      setTheme(nextTheme);
      applyAdminThemeToDocument(nextTheme, document, window.localStorage, false);
    };
    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () =>
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, []);

  const handleToggleTheme = () => {
    setTheme((prev) => {
      const next: AdminTheme = prev === 'dark' ? 'light' : 'dark';
      applyAdminThemeToDocument(next, document, window.localStorage, true);
      return next;
    });
  };

  // Inject <meta name="robots" content="noindex, nofollow"> on /admin mount
  useEffect(() => {
    document.title = 'VIDNEX · Administration D1';
    let robotsMeta = document.querySelector(
      'meta[name="robots"]'
    ) as HTMLMetaElement | null;
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

  const applyAuthenticatedUser = (
    incomingUser: AdminUserProfile | null,
    _fromLoginAction = false
  ) => {
    const resolvedUser: AdminUserProfile = incomingUser || {
      id: null,
      login: 'admin',
      displayName: 'Propriétaire',
      roleLabel: 'Propriétaire',
      isOwner: true,
      permissions: [
        'dashboard.view',
        'health.view',
        'activity.view',
        'blog.write',
        'blog.edit_all',
        'blog.delete',
        'blog.publish',
      ],
      mustChangePassword: false,
      firstAuthorizedTab: 'dashboard',
    };
    setUser(resolvedUser);
    setAuthenticated(true);

    const explicitUrlTab = getExplicitUrlTab();
    if (explicitUrlTab && isTabAuthorizedForUser(explicitUrlTab, resolvedUser)) {
      setActiveTab(explicitUrlTab);
    } else {
      setActiveTab(
        resolvedUser.firstAuthorizedTab ||
          getFirstAuthorizedTabForUser(resolvedUser)
      );
    }
  };

  const checkSession = async () => {
    setCheckingAuth(true);
    try {
      const res = await fetch('/api/admin/login', {
        headers: { Accept: 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.authenticated) {
        applyAuthenticatedUser(data.user || null, false);
      } else {
        setAuthenticated(false);
        setUser(null);
      }
    } catch {
      setAuthenticated(false);
      setUser(null);
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
    setUser(null);
  };

  const handleSelectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set('tab', tab);
      window.history.replaceState({}, '', nextUrl.toString());
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-admin-bg text-admin-text-muted font-mono text-xs">
        Vérification de la session administrateur…
      </div>
    );
  }

  if (!authenticated || !user) {
    return (
      <Login
        onLoginSuccess={(loggedUser) =>
          applyAuthenticatedUser(loggedUser || null, true)
        }
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />
    );
  }

  // Écran obligatoire de changement de mot de passe avant tout accès
  if (user.mustChangePassword) {
    return (
      <Account
        user={user}
        forcedMode={true}
        onPasswordChanged={(updatedUser) => {
          setUser(updatedUser);
          setActiveTab(
            updatedUser.firstAuthorizedTab ||
              getFirstAuthorizedTabForUser(updatedUser)
          );
        }}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />
    );
  }

  const allTabs: Array<{
    id: AdminTab;
    label: string;
    icon: React.ReactNode;
    visible: boolean;
  }> = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
      visible: isTabAuthorizedForUser('dashboard', user),
    },
    {
      id: 'health',
      label: 'Santé des moteurs',
      icon: <HeartPulse className="w-4 h-4" />,
      visible: isTabAuthorizedForUser('health', user),
    },
    {
      id: 'controls',
      label: 'Contrôles',
      icon: <Sliders className="w-4 h-4" />,
      visible: user.isOwner,
    },
    {
      id: 'activity',
      label: 'Activité',
      icon: <ListOrdered className="w-4 h-4" />,
      visible: isTabAuthorizedForUser('activity', user),
    },
    {
      id: 'blog',
      label: 'Blog',
      icon: <FileText className="w-4 h-4" />,
      visible: BLOG_MODULE_ENABLED && isTabAuthorizedForUser('blog', user),
    },
    {
      id: 'users',
      label: 'Utilisateurs',
      icon: <UsersIcon className="w-4 h-4" />,
      visible: user.isOwner,
    },
    {
      id: 'account',
      label: 'Mon compte',
      icon: <UserCircle className="w-4 h-4" />,
      visible: true,
    },
  ];

  const authorizedTabs = allTabs.filter((t) => t.visible);
  const isCurrentTabAuthorized = isTabAuthorizedForUser(activeTab, user);
  const fallbackTab = getFirstAuthorizedTabForUser(user);

  return (
    <div className="min-h-screen bg-admin-bg text-admin-text flex flex-col transition-colors duration-150">
      {/* Top bar */}
      <header className="border-b border-admin-border bg-admin-surface/95 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#c2410c] flex items-center justify-center text-white shadow shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-base text-admin-text whitespace-nowrap">
                  VIDNEX Admin
                </span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-admin-accent-bg border border-admin-accent-border text-admin-accent shrink-0 hidden sm:inline-block">
                  {user.isOwner ? 'Propriétaire' : user.roleLabel}
                </span>
              </div>
              <p className="text-[11px] font-mono text-admin-text-muted hidden sm:block truncate">
                {user.displayName} ({user.login}) · Stockage Cloudflare D1
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleToggleTheme}
              aria-label={
                theme === 'dark'
                  ? 'Passer en mode clair'
                  : 'Passer en mode sombre'
              }
              title={
                theme === 'dark'
                  ? 'Passer en mode clair'
                  : 'Passer en mode sombre'
              }
              className="p-2 rounded-xl bg-admin-muted hover:bg-admin-hover border border-admin-border-strong text-admin-text flex items-center justify-center transition-colors cursor-pointer"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-[#c2410c]" />
              )}
            </button>

            <a
              href="/"
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-admin-muted hover:bg-admin-hover border border-admin-border-strong text-xs font-mono text-admin-text flex items-center gap-1.5 transition-colors"
            >
              <span className="hidden xs:inline sm:inline">Site public</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              type="button"
              onClick={handleLogout}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-red-100 hover:bg-red-200 dark:bg-red-950/80 dark:hover:bg-red-900/80 border border-red-300 dark:border-red-800/70 text-xs font-mono font-medium text-red-900 dark:text-red-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs (uniquement les sections autorisées) */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto pb-2 no-scrollbar">
          {authorizedTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectTab(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-display font-semibold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-[#c2410c] text-white shadow'
                    : 'text-admin-text-secondary hover:text-admin-text hover:bg-admin-hover'
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
        {!isCurrentTabAuthorized ? (
          <div
            data-testid="admin-access-denied"
            className="max-w-lg mx-auto bg-admin-surface border border-red-300 dark:border-red-800/70 rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-md"
          >
            <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/70 border border-red-300 dark:border-red-800/70 text-red-700 dark:text-red-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h2 className="font-display text-lg font-bold text-admin-text">
              Accès refusé
            </h2>
            <p className="text-xs font-mono text-admin-text-secondary leading-relaxed">
              Votre compte ({user.login}) ne dispose pas des droits nécessaires
              pour consulter cette section.
            </p>
            <button
              type="button"
              onClick={() => handleSelectTab(fallbackTab)}
              className="px-4 py-2.5 rounded-xl bg-[#c2410c] hover:bg-[#9a3412] text-white font-display font-semibold text-xs cursor-pointer transition-colors"
            >
              Retourner à mon espace autorisé
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <Dashboard
                onNavigateTab={(t) => {
                  if (isTabAuthorizedForUser(t, user)) {
                    handleSelectTab(t);
                  }
                }}
              />
            )}
            {activeTab === 'health' && <Health readOnly={!user.isOwner} />}
            {activeTab === 'controls' && user.isOwner && <Controls />}
            {activeTab === 'activity' && <Activity />}
            {activeTab === 'blog' && <Blog user={user} />}
            {activeTab === 'users' && user.isOwner && <Users />}
            {activeTab === 'account' && (
              <Account
                user={user}
                forcedMode={false}
                onPasswordChanged={(updatedUser) => setUser(updatedUser)}
                onLogout={handleLogout}
                theme={theme}
                onToggleTheme={handleToggleTheme}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default AdminApp;
