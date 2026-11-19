import { IAdminService } from '../interfaces/IAdminService';
import { PlatformMetrics, Report, User, AuditLog } from '../../types';
import { MOCK_REPORTS, MOCK_USERS, MOCK_AUDIT_LOGS, CURRENT_USER } from '../../constants/mockData';
import { storage } from './storage';

const STORAGE_KEY_REPORTS = 'vortex_reports_store';
const STORAGE_KEY_AUDIT = 'vortex_audit_store';

export class MockAdminService implements IAdminService {
  private getReportsStore(): Report[] {
    return storage.get<Report[]>(STORAGE_KEY_REPORTS, MOCK_REPORTS);
  }

  private saveReportsStore(reports: Report[]): void {
    storage.set(STORAGE_KEY_REPORTS, reports);
  }

  private getAuditStore(): AuditLog[] {
    return storage.get<AuditLog[]>(STORAGE_KEY_AUDIT, MOCK_AUDIT_LOGS);
  }

  private saveAuditStore(logs: AuditLog[]): void {
    storage.set(STORAGE_KEY_AUDIT, logs);
  }

  async getMetrics(): Promise<PlatformMetrics> {
    const reports = this.getReportsStore();
    const pending = reports.filter((r) => r.status === 'pending').length;

    return {
      totalUsers: 142850,
      activeToday: 28410,
      totalPosts: 894200,
      totalCommunities: 1420,
      pendingReports: pending,
      serverHealth: 99.98,
    };
  }

  async getReports(status: 'all' | 'pending' | 'reviewed' = 'all'): Promise<Report[]> {
    const list = this.getReportsStore();
    if (status === 'all') return list;
    return list.filter((r) => r.status === status);
  }

  async resolveReport(reportId: string, action: 'dismiss' | 'actioned'): Promise<void> {
    const reports = this.getReportsStore();
    const report = reports.find((r) => r.id === reportId);
    if (report) {
      report.status = action === 'dismiss' ? 'dismissed' : 'actioned';
      this.saveReportsStore(reports);

      // Log audit
      const auditLogs = this.getAuditStore();
      auditLogs.unshift({
        id: `audit_${Date.now()}`,
        adminName: 'Elena Rostova',
        action: action === 'dismiss' ? 'Dismissed Report' : 'Content Taken Down & Warned',
        target: `${report.reportedItemType}: ${report.reportedItemId}`,
        timestamp: 'Just now',
        status: action === 'dismiss' ? 'warning' : 'danger',
      });
      this.saveAuditStore(auditLogs);
    }
  }

  async getUsers(): Promise<User[]> {
    return storage.get<User[]>('vortex_users_store', MOCK_USERS);
  }

  async toggleUserSuspension(userId: string): Promise<boolean> {
    const users = storage.get<User[]>('vortex_users_store', MOCK_USERS);
    const user = users.find((u) => u.id === userId);
    if (!user) return false;

    user.isBlocked = !user.isBlocked;
    storage.set('vortex_users_store', users);

    const auditLogs = this.getAuditStore();
    auditLogs.unshift({
      id: `audit_${Date.now()}`,
      adminName: 'Elena Rostova',
      action: user.isBlocked ? 'Suspended User' : 'Unsuspended User',
      target: `@${user.username}`,
      timestamp: 'Just now',
      status: user.isBlocked ? 'danger' : 'success',
    });
    this.saveAuditStore(auditLogs);

    return !!user.isBlocked;
  }

  async toggleUserVerification(userId: string): Promise<boolean> {
    const users = storage.get<User[]>('vortex_users_store', MOCK_USERS);
    const user = users.find((u) => u.id === userId);
    if (!user) return false;

    user.verified = !user.verified;
    storage.set('vortex_users_store', users);

    const auditLogs = this.getAuditStore();
    auditLogs.unshift({
      id: `audit_${Date.now()}`,
      adminName: 'Elena Rostova',
      action: user.verified ? 'Verified Badge Granted' : 'Verified Badge Revoked',
      target: `@${user.username}`,
      timestamp: 'Just now',
      status: user.verified ? 'success' : 'warning',
    });
    this.saveAuditStore(auditLogs);

    return !!user.verified;
  }

  async getAuditLogs(): Promise<AuditLog[]> {
    return this.getAuditStore();
  }

  async submitReport(
    itemType: 'post' | 'user' | 'comment' | 'community',
    itemId: string,
    itemSnippet: string,
    reason: string,
    details?: string
  ): Promise<Report> {
    const reports = this.getReportsStore();
    const newReport: Report = {
      id: `rep_${Date.now()}`,
      reportedItemType: itemType,
      reportedItemId: itemId,
      reportedItemSnippet: itemSnippet,
      reportedByUser: CURRENT_USER,
      reason,
      details,
      status: 'pending',
      createdAt: 'Just now',
    };
    reports.unshift(newReport);
    this.saveReportsStore(reports);
    return newReport;
  }
}
