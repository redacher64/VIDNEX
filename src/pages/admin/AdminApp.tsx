import React, { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Layers,
  Sliders,
  LogOut,
  ShieldAlert,
  ExternalLink,
  Sun,
  Moon,
  Users as UsersIcon,
  UserCircle,
  FileText,
  Globe,
  ChevronDown,
} from './AdminIcons';
import { VidnexLogoMark } from '../../components/icons/PlatformIcons';
import { Login, type AdminUserProfile } from './Login';
import { Dashboard } from './Dashboard';
import { ExtractionsView } from './extractions/ExtractionsView';
import { Visitors } from './Visitors';
import { Controls } from './Controls';
import { Blog } from './Blog';
import {
  BLOG_MODULE_ENABLED,
  type AdminTab,
  type ExtractionsSubTabId,
  getAuthorizedExtractionsSubTabs,
  getFirstAuthorizedTabForUser,
  isTabAuthorizedForUser,
  normalizeLegacyAdminTab,
} from './blogAdminLogic';
import type { AdminNavigationTarget } from './adminMetricsLogic';
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

function getExplicitUrlNavigation(): {
  tab: AdminTab | null;
  subTab?: ExtractionsSubTabId;
} {
  if (typeof window === 'undefined') return { tab: null };
  const params = new URLSearchParams(window.location.search);
  const rawTab = params.get('tab');
  const rawSub = params.get('sub');
  const validSub: ExtractionsSubTabId | undefined =
    rawSub === 'plateformes' || rawSub === 'erreurs' || rawSub === 'entonnoir'
      ? rawSub
      : undefined;

  if (
    rawTab === 'dashboard' ||
    rawTab === 'extractions' ||
    rawTab === 'visitors' ||
    rawTab === 'health' ||
    rawTab === 'controls' ||
    rawTab === 'activity' ||
    rawTab === 'blog' ||
    rawTab === 'users' ||
    rawTab === 'account'
  ) {
    const normalized = normalizeLegacyAdminTab(rawTab);
    return {
      tab: normalized.tab,
      subTab: validSub || normalized.subTab,
    };
  }
  return { tab: null };
}

function getUserInitials(user: AdminUserProfile): string {
  const source = (user.displayName || user.login || 'A').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export const AdminApp: React.FC = () => {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<AdminUserProfile | null>(null);

  const initialNav = getExplicitUrlNavigation();
  const [activeTab, setActiveTab] = useState<AdminTab>(initialNav.tab || 'dashboard');
  const [extractionsSubTab, setExtractionsSubTab] = useState<ExtractionsSubTabId>(
    initialNav.subTab || 'plateformes'
  );
  const [extractionsFilter, setExtractionsFilter] = useState<{
    platform: string;
    errorCode: string;
  }>({ platform: '', errorCode: '' });

  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement | null>(null);

  const [theme, setTheme] = useState<AdminTheme>(() => resolveInitialAdminTheme());

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
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, []);

  // Close avatar dropdown on outside click or Escape
  useEffect(() => {
    if (!avatarMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setAvatarMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAvatarMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [avatarMenuOpen]);

  const handleToggleTheme = () => {
    setTheme((prev) => {
      const next: AdminTheme = prev === 'dark' ? 'light' : 'dark';
      applyAdminThemeToDocument(next, document, window.localStorage, true);
      return next;
    });
  };

  // Inject <meta name="robots" content="noindex, nofollow"> on /admin mount
  useEffect(() => {
    document.title = 'VIDNEX · Administration';
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

  const syncUrlParams = (tab: AdminTab, subTab?: ExtractionsSubTabId) => {
    if (typeof window === 'undefined') return;
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('tab', tab);
    if (tab === 'extractions' && subTab) {
      nextUrl.searchParams.set('sub', subTab);
    } else {
      nextUrl.searchParams.delete('sub');
    }
    window.history.replaceState({}, '', nextUrl.toString());
  };

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

    const explicitNav = getExplicitUrlNavigation();
    if (explicitNav.tab && isTabAuthorizedForUser(explicitNav.tab, resolvedUser)) {
      setActiveTab(explicitNav.tab);
      if (explicitNav.subTab) {
        setExtractionsSubTab(explicitNav.subTab);
      }
    } else {
      const firstRaw =
        resolvedUser.firstAuthorizedTab || getFirstAuthorizedTabForUser(resolvedUser);
      const normalized = normalizeLegacyAdminTab(firstRaw);
      setActiveTab(normalized.tab);
      if (normalized.subTab) {
        setExtractionsSubTab(normalized.subTab);
      }
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
    setAvatarMenuOpen(false);
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

  const handleSelectTab = (tab: AdminTab, subTab?: ExtractionsSubTabId) => {
    const normalized = normalizeLegacyAdminTab(tab);
    const resolvedTab = normalized.tab;
    const resolvedSub = subTab || normalized.subTab;
    setActiveTab(resolvedTab);
    if (resolvedTab === 'extractions' && resolvedSub) {
      setExtractionsSubTab(resolvedSub);
    }
    setAvatarMenuOpen(false);
    syncUrlParams(
      resolvedTab,
      resolvedTab === 'extractions' ? resolvedSub || extractionsSubTab : undefined
    );
  };

  const handleNavigate = (target: AdminNavigationTarget) => {
    if (!user) return;
    if (!isTabAuthorizedForUser(target.tab, user)) return;
    if (target.tab === 'extractions') {
      const allowedSubTabs = getAuthorizedExtractionsSubTabs(user);
      const desiredSub =
        target.subTab && allowedSubTabs.includes(target.subTab)
          ? target.subTab
          : allowedSubTabs[0] || 'plateformes';
      setExtractionsFilter({
        platform: target.platform || '',
        errorCode: target.errorCode || '',
      });
      handleSelectTab('extractions', desiredSub);
      return;
    }
    handleSelectTab(target.tab);
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-admin-bg text-admin-text-muted text-xs">
        <div className="flex items-center gap-2">
          <VidnexLogoMark className="w-8 h-8 rounded-lg" />
          <span className="font-display font-bold text-base text-admin-text">
            VIDNEX
          </span>
        </div>
        <span>Vérification de la session administrateur…</span>
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

  if (user.mustChangePassword) {
    return (
      <Account
        user={user}
        forcedMode={true}
        onPasswordChanged={(updatedUser) => {
          setUser(updatedUser);
          const first = normalizeLegacyAdminTab(
            updatedUser.firstAuthorizedTab ||
              getFirstAuthorizedTabForUser(updatedUser)
          );
          setActiveTab(first.tab);
          if (first.subTab) setExtractionsSubTab(first.subTab);
        }}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />
    );
  }

  // Strictly 6 top-level navigation tabs
  const primaryTabs: Array<{
    id: AdminTab;
    label: string;
    icon: React.ReactNode;
    visible: boolean;
  }> = [
    {
      id: 'dashboard',
      label: "Vue d'ensemble",
      icon: <LayoutDashboard className="w-4 h-4" />,
      visible: isTabAuthorizedForUser('dashboard', user),
    },
    {
      id: 'extractions',
      label: 'Extractions',
      icon: <Layers className="w-4 h-4" />,
      visible: isTabAuthorizedForUser('extractions', user),
    },
    {
      id: 'visitors',
      label: 'Audience',
      icon: <Globe className="w-4 h-4" />,
      visible: user.isOwner,
    },
    {
      id: 'blog',
      label: 'Blog',
      icon: <FileText className="w-4 h-4" />,
      visible: BLOG_MODULE_ENABLED && isTabAuthorizedForUser('blog', user),
    },
    {
      id: 'controls',
      label: 'Contrôles',
      icon: <Sliders className="w-4 h-4" />,
      visible: user.isOwner,
    },
    {
      id: 'users',
      label: 'Utilisateurs',
      icon: <UsersIcon className="w-4 h-4" />,
      visible: user.isOwner,
    },
  ];

  const authorizedTabs = primaryTabs.filter((t) => t.visible);
  const authorizedExtractionsSubTabs = getAuthorizedExtractionsSubTabs(user);
  const isCurrentTabAuthorized = isTabAuthorizedForUser(activeTab, user);
  const fallbackTab = normalizeLegacyAdminTab(getFirstAuthorizedTabForUser(user)).tab;
  const userInitials = getUserInitials(user);

  return (
    <div className="min-h-screen bg-admin-bg text-admin-text flex flex-col transition-colors duration-150">
      {/* Top Bar */}
      <header className="border-b border-admin-border bg-admin-surface/95 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2.5 min-w-0">
            <VidnexLogoMark className="w-8 h-8 rounded-lg shrink-0" />
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-display font-bold text-sm sm:text-base text-admin-text whitespace-nowrap">
                VIDNEX Admin
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-admin-accent-bg border border-admin-accent-border text-admin-accent shrink-0 hidden md:inline-block">
                {user.isOwner ? 'Propriétaire' : user.roleLabel}
              </span>
            </div>
          </div>

          {/* Right Controls: Theme + Site public + Avatar Menu */}
          <div className="flex items-center gap-2 shrink-0">
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
              className="w-8 h-8 rounded-md bg-admin-muted hover:bg-admin-hover border border-admin-border-strong text-admin-text flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-admin-accent" />
              )}
            </button>

            <a
              href="/"
              aria-label="Site public"
              title="Ouvrir le site public"
              className="h-8 px-2.5 rounded-md bg-admin-muted hover:bg-admin-hover border border-admin-border-strong text-xs font-medium text-admin-text flex items-center justify-center gap-1.5 transition-colors shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Site public</span>
            </a>

            {/* Avatar Menu ("Mon compte" + "Déconnexion") */}
            <div ref={avatarMenuRef} className="relative">
              <button
                type="button"
                aria-label="Menu du compte"
                aria-haspopup="menu"
                aria-expanded={avatarMenuOpen}
                onClick={() => setAvatarMenuOpen((prev) => !prev)}
                className={`h-8 pl-1 pr-2 rounded-md border flex items-center gap-2 transition-colors cursor-pointer ${
                  activeTab === 'account' || avatarMenuOpen
                    ? 'bg-admin-hover border-admin-accent'
                    : 'bg-admin-muted hover:bg-admin-hover border-admin-border-strong'
                }`}
              >
                <span className="w-6 h-6 rounded bg-admin-accent text-white font-display font-bold text-[11px] flex items-center justify-center shrink-0">
                  {userInitials}
                </span>
                <span className="text-xs font-semibold text-admin-text hidden sm:inline max-w-[110px] truncate">
                  {user.displayName}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-admin-text-muted shrink-0" />
              </button>

              {avatarMenuOpen && (
                <div
                  role="menu"
                  aria-label="Options du compte"
                  className="absolute right-0 mt-1.5 w-56 rounded-lg bg-admin-surface border border-admin-border-strong shadow-lg py-1.5 z-40"
                >
                  <div className="px-3 py-2 border-b border-admin-border">
                    <div className="text-xs font-display font-bold text-admin-text truncate">
                      {user.displayName}
                    </div>
                    <div className="text-[11px] font-mono text-admin-text-muted truncate">
                      {user.login} · {user.isOwner ? 'Propriétaire' : user.roleLabel}
                    </div>
                  </div>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleSelectTab('account')}
                    className="w-full px-3 py-2 text-left text-xs font-medium text-admin-text hover:bg-admin-hover flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <UserCircle className="w-4 h-4 text-admin-text-muted" />
                    <span>Mon compte</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="w-full px-3 py-2 text-left text-xs font-medium text-red-700 dark:text-red-400 hover:bg-admin-hover flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Déconnexion</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 6 Primary Navigation Tabs */}
        <nav
          aria-label="Navigation administration"
          className="max-w-6xl mx-auto px-2 sm:px-6 flex items-center gap-1 overflow-x-auto pb-2 no-scrollbar"
        >
          {authorizedTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectTab(tab.id)}
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
                title={tab.label}
                className={`px-3 py-1.5 rounded-md text-xs font-display font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-admin-accent text-white'
                    : 'text-admin-text-secondary hover:text-admin-text hover:bg-admin-hover'
                }`}
              >
                <span className="shrink-0">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 py-6">
        {!isCurrentTabAuthorized ? (
          <div
            data-testid="admin-access-denied"
            className="max-w-lg mx-auto bg-admin-surface border border-red-300 dark:border-red-800/70 rounded-lg p-6 text-center space-y-4"
          >
            <div className="w-12 h-12 rounded-lg bg-red-100 dark:bg-red-950/70 border border-red-300 dark:border-red-800/70 text-red-700 dark:text-red-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h2 className="font-display text-lg font-bold text-admin-text">
              Accès refusé
            </h2>
            <p className="text-xs text-admin-text-secondary leading-relaxed">
              Votre compte (<span className="font-mono">{user.login}</span>) ne dispose pas des droits nécessaires
              pour consulter cette section.
            </p>
            <button
              type="button"
              onClick={() => handleSelectTab(fallbackTab)}
              className="px-4 py-2 rounded-md bg-admin-accent hover:opacity-90 text-white font-display font-semibold text-xs cursor-pointer transition-colors"
            >
              Retourner à mon espace autorisé
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <Dashboard
                canViewHealth={
                  user.isOwner || user.permissions.includes('health.view')
                }
                onNavigate={handleNavigate}
              />
            )}

            {activeTab === 'extractions' && (
              <ExtractionsView
                authorizedSubTabs={authorizedExtractionsSubTabs}
                activeSubTab={extractionsSubTab}
                onSelectSubTab={(sub) => {
                  setExtractionsSubTab(sub);
                  syncUrlParams('extractions', sub);
                }}
                isOwner={user.isOwner}
                canViewStats={
                  user.isOwner || user.permissions.includes('dashboard.view')
                }
                canViewHealth={
                  user.isOwner || user.permissions.includes('health.view')
                }
                canViewActivity={
                  user.isOwner || user.permissions.includes('activity.view')
                }
                initialPlatformFilter={extractionsFilter.platform}
                initialErrorCodeFilter={extractionsFilter.errorCode}
              />
            )}

            {activeTab === 'visitors' && user.isOwner && <Visitors />}
            {activeTab === 'blog' && <Blog user={user} />}
            {activeTab === 'controls' && user.isOwner && <Controls />}
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
