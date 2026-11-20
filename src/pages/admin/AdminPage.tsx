import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Users,
  AlertTriangle,
  FileText,
  Activity,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { Tabs } from '../../components/ui/Tabs';
import { adminService, supabase } from '../../services';
import { PlatformMetrics, Report, User, AuditLog } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';

export const AdminPage: React.FC = () => {
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'reports' | 'audit' | 'admins'>('overview');
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [selectedAdminPermissions, setSelectedAdminPermissions] = useState<string[]>([]);
  const [isSavingAdmin, setIsSavingAdmin] = useState(false);
  const can = (...keys: string[]) => isSuperAdmin || keys.some((key) => permissions.includes(key));

  const fetchAdminData = async () => {
    setIsLoading(true);
    try {
      const [{ data: superAdmin, error: superAdminError }, { data: granted, error: permissionsError }] = await Promise.all([
        supabase.rpc('is_admin'),
        supabase.rpc('get_my_admin_permissions'),
      ]);
      if (superAdminError) throw superAdminError;
      if (permissionsError) throw permissionsError;

      const nextIsSuperAdmin = superAdmin === true;
      const nextPermissions = Array.isArray(granted) ? granted.filter((item): item is string => typeof item === 'string') : [];
      setIsSuperAdmin(nextIsSuperAdmin);
      setPermissions(nextPermissions);
      const has = (...keys: string[]) => nextIsSuperAdmin || keys.some((key) => nextPermissions.includes(key));

      const [m, r, u, a] = await Promise.all([
        has('dashboard.view') ? adminService.getMetrics() : Promise.resolve(null),
        has('reports.view', 'reports.manage') ? adminService.getReports() : Promise.resolve([]),
        has('users.view', 'users.manage', 'users.verify', 'users.suspend') ? adminService.getUsers() : Promise.resolve([]),
        has('audit.view') ? adminService.getAuditLogs() : Promise.resolve([]),
      ]);
      setMetrics(m);
      setReports(r);
      setUsers(u);
      setAuditLogs(a);
      const availableTabs = [
        has('dashboard.view') ? 'overview' : null,
        has('users.view', 'users.manage', 'users.verify', 'users.suspend') ? 'users' : null,
        has('reports.view', 'reports.manage') ? 'reports' : null,
        has('audit.view') ? 'audit' : null,
        nextIsSuperAdmin ? 'admins' : null,
      ].filter((tab): tab is 'overview' | 'users' | 'reports' | 'audit' | 'admins' => tab !== null);
      setActiveTab((current) => availableTabs.includes(current) ? current : (availableTabs[0] || 'overview'));
      setLoadError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('adminLoadFailed');
      setLoadError(message);
      showToast(message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleResolveReport = async (reportId: string, action: 'dismiss' | 'actioned') => {
    try {
      await adminService.resolveReport(reportId, action);
      showToast(action === 'dismiss' ? t('toastReportDismissed') : t('toastReportActioned'));
      fetchAdminData();
    } catch {
      showToast(t('toastReportResolveFailed'), 'error');
    }
  };

  const handleToggleSuspension = async (userId: string, username: string) => {
    try {
      const isSuspended = await adminService.toggleUserSuspension(userId);
      showToast(isSuspended ? `@${username} has been suspended` : `@${username} suspension lifted`);
      fetchAdminData();
    } catch {
      showToast(t('toastActionFailed'), 'error');
    }
  };

  const handleToggleVerification = async (userId: string, username: string) => {
    try {
      const verified = await adminService.toggleUserVerification(userId);
      showToast(verified ? `@${username} verified badge awarded` : `@${username} verified badge removed`);
      fetchAdminData();
    } catch {
      showToast(t('toastActionFailed'), 'error');
    }
  };

  const handleSaveAdminAccess = async () => {
    if (!adminEmail.trim()) {
      showToast(t('adminAccountEmail'), 'error');
      return;
    }
    setIsSavingAdmin(true);
    try {
      const { error } = await supabase.rpc('set_admin_permissions_by_email', {
        target_email: adminEmail.trim(),
        permission_keys: selectedAdminPermissions,
      });
      if (error) throw error;
      showToast(selectedAdminPermissions.length ? t('adminAccessSaved') : t('adminAccessRevoked'));
      setAdminEmail('');
      setSelectedAdminPermissions([]);
      await fetchAdminData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('toastActionFailed'), 'error');
    } finally {
      setIsSavingAdmin(false);
    }
  };

  const permissionOptions = [
    ['dashboard.view', t('permissionDashboard')],
    ['users.view', t('permissionUsersView')],
    ['users.manage', t('permissionUsersManage')],
    ['users.verify', t('permissionUsersVerify')],
    ['users.suspend', t('permissionUsersSuspend')],
    ['content.view_private', t('permissionPrivateContent')],
    ['content.moderate', t('permissionContentModerate')],
    ['reports.view', t('permissionReportsView')],
    ['reports.manage', t('permissionReportsManage')],
    ['communities.manage', t('permissionCommunitiesManage')],
    ['stories.manage', t('permissionStoriesManage')],
    ['audit.view', t('permissionAuditView')],
  ];

  const tabs = [
    ...(can('dashboard.view') ? [{ id: 'overview', label: t('platformOverview'), icon: <Activity className="w-4 h-4" /> }] : []),
    ...(can('users.view', 'users.manage', 'users.verify', 'users.suspend') ? [{ id: 'users', label: t('userManagement'), icon: <Users className="w-4 h-4" /> }] : []),
    ...(can('reports.view', 'reports.manage') ? [{ id: 'reports', label: t('contentModeration'), icon: <AlertTriangle className="w-4 h-4" /> }] : []),
    ...(can('audit.view') ? [{ id: 'audit', label: t('auditLogs'), icon: <FileText className="w-4 h-4" /> }] : []),
    ...(isSuperAdmin ? [{ id: 'admins', label: t('adminAccess'), icon: <ShieldCheck className="w-4 h-4" /> }] : []),
  ];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col min-h-[100dvh]">
      {/* Header */}
      <div className="sticky top-0 z-20 min-w-0 bg-surface/95 backdrop-blur-md border-b border-border px-3 py-3 sm:px-6 sm:py-4 lg:px-8 space-y-3 sm:space-y-4">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-lg font-black text-fg">{t('adminDashboard')}</h1>
              <span className="text-[11px] text-fg-muted">{t('adminConsoleSubtitle')}</span>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-surface-hover text-fg-muted border border-border font-semibold">
            {t('adminHealth', { value: metrics?.serverHealth == null ? t('adminHealthNotMonitored') : `${metrics.serverHealth}%` })}
          </span>
        </div>

        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={(tab) => {
            if (tab === 'overview' || tab === 'users' || tab === 'reports' || tab === 'audit' || tab === 'admins') setActiveTab(tab);
          }}
        />
      </div>

      {/* Content */}
      <div className="min-w-0 px-3 py-4 sm:px-6 sm:py-6 lg:px-8 space-y-5 sm:space-y-7 [&_*]:[overflow-wrap:anywhere]">
        {loadError && (
          <div role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-red-700 dark:text-danger">
            {loadError}
          </div>
        )}
        {isLoading && !metrics && (
          <div className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-sm text-fg-muted">
            {t('loadingAdminData')}
          </div>
        )}
        {/* Overview Tab */}
        {activeTab === 'overview' && metrics && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-4">
              <div className="min-w-0 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-surface border border-border">
                <span className="text-xs text-fg-muted font-medium block">{t('totalUsers')}</span>
                <span className="text-lg sm:text-xl lg:text-2xl font-black leading-tight text-fg mt-1.5 block tabular-nums">
                  {metrics.totalUsers.toLocaleString()}
                </span>
                <span className="text-[11px] text-fg-subtle mt-1 block">{t('adminRegisteredAccounts')}</span>
              </div>

              <div className="min-w-0 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-surface border border-border">
                <span className="text-xs text-fg-muted font-medium block">{t('activeToday')}</span>
                <span className="text-xl sm:text-2xl font-black text-fg mt-1 block">
                  {metrics.activeToday == null ? '—' : metrics.activeToday.toLocaleString()}
                </span>
                <span className="text-[11px] text-fg-subtle mt-1 block">{t('adminActivityUnavailable')}</span>
              </div>

              <div className="p-4 rounded-2xl bg-surface border border-border">
                <span className="text-xs text-fg-muted font-medium block">{t('totalPostsCount')}</span>
                <span className="text-xl sm:text-2xl font-black text-fg mt-1 block">
                  {metrics.totalPosts.toLocaleString()}
                </span>
                <span className="text-[11px] text-fg-subtle mt-1 block">{t('adminPublishedPosts')}</span>
              </div>

              <div className="p-4 rounded-2xl bg-surface border border-border">
                <span className="text-xs text-fg-muted font-medium block">{t('pendingReportsCount')}</span>
                <span className="text-lg sm:text-xl lg:text-2xl font-black leading-tight text-danger-text mt-1.5 block tabular-nums">
                  {reports.filter((r) => r.status === 'pending').length}
                </span>
                <span className="text-[11px] text-fg-subtle mt-1 block">{t('adminNeedsAttention')}</span>
              </div>
            </div>

            {/* Quick Action Queue preview */}
            <div className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-surface border border-border space-y-3 sm:space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-fg flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-warning" />
                  <span>{t('adminPendingItems')}</span>
                </h3>
                {can('reports.view', 'reports.manage') && (
                  <button onClick={() => setActiveTab('reports')} className="text-xs text-primary-text hover:underline">
                    {t('viewAllReports')}
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {reports
                  .filter((r) => r.status === 'pending')
                  .slice(0, 2)
                  .map((rep) => (
                    <div
                      key={rep.id}
                      className="min-w-0 p-3.5 rounded-xl bg-bg border border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-danger-text block">{rep.reason}</span>
                        <p className="text-fg-muted truncate mt-0.5 max-w-md">
                          "{rep.reportedItemSnippet}"
                        </p>
                      </div>
                      {can('reports.manage') && <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleResolveReport(rep.id, 'dismiss')}
                          className="px-2.5 py-1 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-hover"
                        >
                          {t('dismissReport')}
                        </button>
                        <button
                          onClick={() => handleResolveReport(rep.id, 'actioned')}
                          className="px-2.5 py-1 rounded-lg bg-danger/10 text-danger-text border border-danger/30 hover:bg-danger/20 font-semibold"
                        >
                          {t('markActioned')}
                        </button>
                      </div>}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Users Management Tab */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
              <table className="w-full min-w-[620px] text-start text-xs text-fg-muted">
                <thead className="bg-bg text-fg-muted border-b border-border uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5 text-start">{t('colUser')}</th>
                    <th className="p-3.5 text-start">{t('colRole')}</th>
                    <th className="p-3.5 text-start">{t('followers')}</th>
                    <th className="p-3.5 text-start">{t('status')}</th>
                    <th className="p-3.5 text-end">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-surface-hover/60">
                      <td className="p-3.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Avatar src={u.avatar} alt={u.name} size="sm" />
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-fg truncate">{u.name}</span>
                            <span className="text-[11px] text-fg-subtle">@{u.username}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="capitalize font-semibold text-primary-text">{u.role}</span>
                      </td>
                      <td className="p-3.5">{u.followersCount.toLocaleString()}</td>
                      <td className="p-3.5">
                        {u.isBlocked ? (
                          <span className="text-danger-text font-semibold">{t('suspendedStatus')}</span>
                        ) : (
                          <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{t('activeStatus')}</span>
                        )}
                      </td>
                      <td className="p-3.5 text-end">\n                        <div className="flex flex-wrap justify-end gap-2">
                        {can('users.verify') && <Button
                          onClick={() => handleToggleVerification(u.id, u.username)}
                          variant="outline"
                          size="sm"
                          className="text-[11px] py-1 px-2.5"
                        >
                          {u.verified ? t('revokeVerified') : t('grantVerified')}
                        </Button>}
                        {can('users.suspend') && <Button
                          onClick={() => handleToggleSuspension(u.id, u.username)}
                          variant={u.isBlocked ? 'secondary' : 'danger'}
                          size="sm"
                          className="text-[11px] py-1 px-2.5"
                        >
                          {u.isBlocked ? t('unsuspendUser') : t('suspendUser')}
                        </Button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Reports / Moderation Tab */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            {reports.length === 0 ? (
              <p className="text-xs text-fg-subtle">{t('noReportsFound')}</p>
            ) : (
              <div className="space-y-3">
                {reports.map((rep) => (
                  <div
                    key={rep.id}
                    className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-surface border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4"
                  >
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-xs font-bold text-danger-text">{rep.reason}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-hover text-fg-muted capitalize">
                          {rep.status}
                        </span>
                        <span className="text-[10px] text-fg-subtle">{rep.createdAt}</span>
                      </div>
                      <p className="min-w-0 whitespace-pre-wrap break-words text-xs text-fg italic bg-bg p-2.5 rounded-xl border border-border">
                        "{rep.reportedItemSnippet}"
                      </p>
                      <span className="text-[11px] text-fg-muted block break-words">
                        Reported by: @{rep.reportedByUser.username} · Details: {rep.details || 'None provided'}
                      </span>
                    </div>

                    {can('reports.manage') && <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Button
                        onClick={() => handleResolveReport(rep.id, 'dismiss')}
                        variant="secondary"
                        size="sm"
                        disabled={rep.status !== 'pending'}
                        className="text-xs"
                      >
                        {t('dismissReport')}
                      </Button>
                      <Button
                        onClick={() => handleResolveReport(rep.id, 'actioned')}
                        variant="danger"
                        size="sm"
                        disabled={rep.status !== 'pending'}
                        className="text-xs"
                      >
                        {t('takeDownContent')}
                      </Button>
                    </div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'admins' && isSuperAdmin && (
          <section className="w-full max-w-3xl rounded-xl sm:rounded-2xl border border-border bg-surface p-4 sm:p-6 space-y-4 sm:space-y-5">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-fg">{t('adminAccess')}</h2>
              <p className="text-sm text-fg-muted">{t('adminAccessDescription')}</p>
            </div>
            <label className="block space-y-2">
              <span className="text-xs font-semibold text-fg-muted">{t('adminAccountEmail')}</span>
              <input
                type="email"
                value={adminEmail}
                onChange={(event) => setAdminEmail(event.target.value)}
                placeholder="person@example.com"
                autoComplete="email"
                className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-fg outline-none focus:border-primary"
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {permissionOptions.map(([permission, label]) => (
                <label key={permission} className="flex min-w-0 items-start gap-2.5 rounded-xl border border-border p-3 text-sm text-fg">
                  <input
                    type="checkbox"
                    checked={selectedAdminPermissions.includes(permission)}
                    onChange={(event) => setSelectedAdminPermissions((current) => event.target.checked
                      ? [...current, permission]
                      : current.filter((item) => item !== permission))}
                    className="mt-0.5 accent-current"
                  />
                  <span className="min-w-0 break-words">{label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-fg-muted">{t('revokeAdminAccessHint')}</p>
            <div className="flex justify-end">
              <Button onClick={handleSaveAdminAccess} disabled={isSavingAdmin || !adminEmail.trim()}>
                {isSavingAdmin ? t('loading') : t('saveAdminAccess')}
              </Button>
            </div>
          </section>
        )}

        {/* Audit Log Tab */}
        {activeTab === 'audit' && (
          <div className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-surface border border-border space-y-3 sm:space-y-4">
            <h3 className="text-sm font-bold text-fg">{t('adminAuditTitle')}</h3>
            <div className="divide-y divide-border">
              {auditLogs.map((log) => (
                <div key={log.id} className="min-w-0 py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 text-xs">
                  <div className="min-w-0 break-words">
                    <span className="font-bold text-fg">{log.adminName}</span>
                    <span className="text-fg-muted mx-1.5">—</span>
                    <span className="text-fg-muted">{log.action}</span>
                    <span className="text-primary-text ms-1.5">({log.target})</span>
                  </div>
                  <span className="shrink-0 text-[10px] text-fg-subtle break-words">{log.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
