
export interface UserProfile {
  id: string;
  email: string;
  role?: string;
}

export interface AuthState {
  session: any | null;
  user: UserProfile | null;
  loading: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  username: string; // Retorno direto da API (Flat)
  role?: string;
  created_at: string;
  last_sign_in_at?: string;
  banned_until?: string | null;
  expires_at?: string | null;
  user_metadata?: any; // Fallback para estruturas antigas ou aninhadas
}

export interface PaginatedResponse {
  data: AdminUser[];
  meta: {
    page: number;
    per_page: number;
    total: number;
  };
}

export interface SharedToken {
  id: string;
  provider_name: string;
  otp_secret: string;
  created_at?: string;
}