import { User } from '../../types';

export interface AuthSession {
  user: User;
  token: string;
}

export interface IAuthService {
  getCurrentUser(): Promise<User | null>;
  signIn(email: string, password?: string): Promise<User>;
  signUp(email: string, password: string, name: string, username: string): Promise<User>;
  /** Verifies the signup email using the one-time code delivered by the email provider. */
  verifyEmailOtp(email: string, token: string): Promise<User>;
  requestPasswordReset(email: string): Promise<boolean>;
  resetPassword(password: string): Promise<boolean>;
  resendConfirmationEmail(email: string): Promise<boolean>;
  hasAdminRole(): Promise<boolean>;
  signOut(): Promise<void>;
  switchDemoRole(role: 'user' | 'admin'): Promise<User>;
}
