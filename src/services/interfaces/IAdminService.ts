import { PlatformMetrics, Report, User, AuditLog } from '../../types';

export interface IAdminService {
  /**
   * Fetches real-time platform overview metrics.
   */
  getMetrics(): Promise<PlatformMetrics>;

  /**
   * Fetches moderation reports.
   */
  getReports(status?: 'all' | 'pending' | 'reviewed'): Promise<Report[]>;

  /**
   * Takes action on a report (dismiss or remove content).
   */
  resolveReport(reportId: string, action: 'dismiss' | 'actioned'): Promise<void>;

  /**
   * Fetches all registered users for administration.
   */
  getUsers(): Promise<User[]>;

  /**
   * Suspends or unsuspends a user account.
   */
  toggleUserSuspension(userId: string): Promise<boolean>;

  /**
   * Verifies or un-verifies a user.
   */
  toggleUserVerification(userId: string): Promise<boolean>;

  /**
   * Fetches audit activity log entries.
   */
  getAuditLogs(): Promise<AuditLog[]>;

  /**
   * Submits a new content/user report from the regular UI.
   */
  submitReport(
    itemType: 'post' | 'user' | 'comment' | 'community',
    itemId: string,
    itemSnippet: string,
    reason: string,
    details?: string
  ): Promise<Report>;
}
