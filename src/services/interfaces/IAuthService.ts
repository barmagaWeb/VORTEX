import { User } from '../../types';

export interface AuthSession {
  user: User;
  token: string;
}

export interface IAuthService {
  /** Returns the current authenticated profile, or null when no session exists. */
  getCurrentUser(): Promise<User | null>;

  /** Signs in using the configured authentication provider. */
  signIn(email: string, password?: string): Promise<User>;

  /** Creates an account. Supabase accounts may remain unverified until email confirmation. */
  signUp(email: string, password: string, name: string, username: string): Promise<User>;

  /** Sends a password reset email. */
  requestPasswordReset(email: string): Promise<boolean>;

  /** Updates the password for a validated recovery session. */
  resetPassword(password: string): Promise<boolean>;

  /** Resends the signup confirmation email. */
  resendConfirmationEmail(email: string): Promise<boolean>;

  /** Checks the current user's role against the persistent data store. */
  hasAdminRole(): Promise<boolean>;

  /** Ends the current session. */
  signOut(): Promise<void>;

  /** Switches demo personas only when the app is using Mock services. */
  switchDemoRole(role: 'user' | 'admin'): Promise<User>;
}
