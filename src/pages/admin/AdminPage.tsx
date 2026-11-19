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
import { adminService } from '../../services';
import { PlatformMetrics, Report, User, AuditLog } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';

export const AdminPage: React.FC = () => {
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'reports' | 'audit'>('overview');
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchAdminData = async () => {
    setIsLoading(true);
    try {
      const [m, r, u, a] = await Promise.all([
        adminService.getMetrics(),
        adminService.getReports(),
        adminService.getUsers(),
        adminService.getAuditLogs(),
      ]);
      setMetrics(m);
      setReports(r);
      setUsers(u);
      setAuditLogs(a);
      setLoadError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load administration data';
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
      showToast(action === 'dismiss' ? 'Report dismissed' : 'Report marked as actioned');
      fetchAdminData();
    } catch {
      showToast('Could not resolve report', 'error');
    }
  };

  const handleToggleSuspension = async (userId: string, username: string) => {
    try {
      const isSuspended = await adminService.toggleUserSuspension(userId);
      showToast(isSuspended ? `@${username} has been suspended` : `@${username} suspension lifted`);
      fetchAdminData();
    } catch {
      showToast('Action failed', 'error');
    }
  };

  const handleToggleVerification = async (userId: string, username: string) => {
    try {
      const verified = await adminService.toggleUserVerification(userId);
      showToast(verified ? `@${username} verified badge awarded` : `@${username} verified badge removed`);
      fetchAdminData();
    } catch {
      showToast('Action failed', 'error');
    }
  };

  const tabs = [
    { id: 'overview', label: t('platformOverview'), icon: <Activity className="w-4 h-4" /> },
    { id: 'users', label: t('userManagement'), icon: <Users className="w-4 h-4" /> },
    { id: 'reports', label: t('contentModeration'), icon: <AlertTriangle className="w-4 h-4" /> },
    { id: 'audit', label: t('auditLogs'), icon: <FileText className="w-4 h-4" /> },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-violet-400" />
            <div>
              <h1 className="text-lg font-black text-white">{t('adminDashboard')}</h1>
              <span className="text-[11px] text-slate-400">Trust, Safety & Governance Console</span>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700 font-semibold">
            Health: {metrics?.serverHealth == null ? 'Not monitored' : `${metrics.serverHealth}%`}
          </span>
        </div>

        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={(tab) => {
            if (tab === 'overview' || tab === 'users' || tab === 'reports' || tab === 'audit') setActiveTab(tab);
          }}
        />
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6 space-y-6">
        {loadError && (
          <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {loadError}
          </div>
        )}
        {isLoading && !metrics && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-8 text-center text-sm text-slate-400">
            Loading administration data...
          </div>
        )}
        {/* Overview Tab */}
        {activeTab === 'overview' && metrics && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <span className="text-xs text-slate-400 font-medium block">{t('totalUsers')}</span>
                <span className="text-xl sm:text-2xl font-black text-white mt-1 block">
                  {metrics.totalUsers.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-500 mt-1 block">Registered accounts</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <span className="text-xs text-slate-400 font-medium block">{t('activeToday')}</span>
                <span className="text-xl sm:text-2xl font-black text-white mt-1 block">
                  {metrics.activeToday == null ? '—' : metrics.activeToday.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-500 mt-1 block">Activity tracking unavailable</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <span className="text-xs text-slate-400 font-medium block">{t('totalPostsCount')}</span>
                <span className="text-xl sm:text-2xl font-black text-white mt-1 block">
                  {metrics.totalPosts.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-500 mt-1 block">Published posts</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <span className="text-xs text-slate-400 font-medium block">{t('pendingReportsCount')}</span>
                <span className="text-xl sm:text-2xl font-black text-rose-400 mt-1 block">
                  {reports.filter((r) => r.status === 'pending').length}
                </span>
                <span className="text-[11px] text-slate-500 mt-1 block">Needs attention</span>
              </div>
            </div>

            {/* Quick Action Queue preview */}
            <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>Pending Moderation Items</span>
                </h3>
                <button
                  onClick={() => setActiveTab('reports')}
                  className="text-xs text-violet-400 hover:underline"
                >
                  View all reports
                </button>
              </div>

              <div className="space-y-2">
                {reports
                  .filter((r) => r.status === 'pending')
                  .slice(0, 2)
                  .map((rep) => (
                    <div
                      key={rep.id}
                      className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-rose-400 block">{rep.reason}</span>
                        <p className="text-slate-300 truncate mt-0.5 max-w-md">
                          "{rep.reportedItemSnippet}"
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleResolveReport(rep.id, 'dismiss')}
                          className="px-2.5 py-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={() => handleResolveReport(rep.id, 'actioned')}
                          className="px-2.5 py-1 rounded-lg bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30 font-semibold"
                        >
                          Mark Actioned
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Users Management Tab */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
              <table className="w-full text-start text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5 text-start">User</th>
                    <th className="p-3.5 text-start">Role</th>
                    <th className="p-3.5 text-start">Followers</th>
                    <th className="p-3.5 text-start">Status</th>
                    <th className="p-3.5 text-end">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-850/40">
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar src={u.avatar} alt={u.name} size="sm" />
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-white truncate">{u.name}</span>
                            <span className="text-[11px] text-slate-500">@{u.username}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="capitalize font-semibold text-violet-300">{u.role}</span>
                      </td>
                      <td className="p-3.5">{u.followersCount.toLocaleString()}</td>
                      <td className="p-3.5">
                        {u.isBlocked ? (
                          <span className="text-rose-400 font-semibold">Suspended</span>
                        ) : (
                          <span className="text-emerald-400 font-semibold">Active</span>
                        )}
                      </td>
                      <td className="p-3.5 text-end space-x-2">
                        <Button
                          onClick={() => handleToggleVerification(u.id, u.username)}
                          variant="outline"
                          size="sm"
                          className="text-[11px] py-1 px-2.5"
                        >
                          {u.verified ? 'Revoke Verified' : 'Grant Verified'}
                        </Button>
                        <Button
                          onClick={() => handleToggleSuspension(u.id, u.username)}
                          variant={u.isBlocked ? 'secondary' : 'danger'}
                          size="sm"
                          className="text-[11px] py-1 px-2.5"
                        >
                          {u.isBlocked ? t('unsuspendUser') : t('suspendUser')}
                        </Button>
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
              <p className="text-xs text-slate-500">No reports found.</p>
            ) : (
              <div className="space-y-3">
                {reports.map((rep) => (
                  <div
                    key={rep.id}
                    className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-rose-400">{rep.reason}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 capitalize">
                          {rep.status}
                        </span>
                        <span className="text-[10px] text-slate-500">{rep.createdAt}</span>
                      </div>
                      <p className="text-xs text-slate-200 italic bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                        "{rep.reportedItemSnippet}"
                      </p>
                      <span className="text-[11px] text-slate-400 block">
                        Reported by: @{rep.reportedByUser.username} · Details: {rep.details || 'None provided'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Audit Log Tab */}
        {activeTab === 'audit' && (
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white">System Audit & Governance Trail</h3>
            <div className="divide-y divide-slate-800/60">
              {auditLogs.map((log) => (
                <div key={log.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-white">{log.adminName}</span>
                    <span className="text-slate-400 mx-1.5">—</span>
                    <span className="text-slate-300">{log.action}</span>
                    <span className="text-violet-400 ms-1.5">({log.target})</span>
                  </div>
                  <span className="text-[10px] text-slate-500">{log.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
