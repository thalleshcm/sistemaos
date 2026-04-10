// User API for CRUD via server.ts
export interface UserRow {
  id?: number;
  name: string;
  email: string;
  level: 'Admin' | 'Operador';
  lastAccess?: string;
  password?: string;
}

export async function getUsers(): Promise<UserRow[]> {
  const res = await fetch('/api/users', { headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) throw new Error('Erro ao buscar usuários');
  return res.json();
}

export async function createUser(user: Omit<UserRow, 'id' | 'lastAccess'> & { password: string }): Promise<UserRow> {
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user),
  });
  if (!res.ok) throw new Error('Erro ao criar usuário');
  return res.json();
}

export async function deleteUser(id: number): Promise<void> {
  const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Erro ao deletar usuário');
}
