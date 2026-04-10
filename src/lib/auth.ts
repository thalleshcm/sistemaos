// Auth helpers – JWT é gerado pelo server.ts (/api/auth/login)
// O token é armazenado em sessionStorage e enviado pelo api.ts em cada request.

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  level: 'Admin' | 'Operador';
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export async function loginWithCredentials(identifier: string, password: string): Promise<LoginResponse> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Usuário ou senha incorretos.');
  }

  const data: LoginResponse = await res.json();
  sessionStorage.setItem('jwt_token', data.token);
  return data;
}

export function getStoredToken(): string | null {
  return sessionStorage.getItem('jwt_token');
}

export function clearStoredToken(): void {
  sessionStorage.removeItem('jwt_token');
}

export function getStoredUser(): AuthUser | null {
  const raw = sessionStorage.getItem('auth_session');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function storeUser(user: AuthUser): void {
  sessionStorage.setItem('auth_session', JSON.stringify(user));
}

export function clearStoredUser(): void {
  sessionStorage.removeItem('auth_session');
  sessionStorage.removeItem('jwt_token');
}
