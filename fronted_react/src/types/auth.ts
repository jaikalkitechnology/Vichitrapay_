export type UserRole = 'merchant' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  merchantId?: string;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}