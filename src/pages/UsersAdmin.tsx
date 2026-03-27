import React, { useState, useEffect } from 'react';
import { Settings, ShieldAlert, UserX, UserCheck, KeyRound, Trash2 } from 'lucide-react';

export default function UsersAdmin({ fetchApi, user }: { fetchApi: any, user: any }) {
  const [users, setUsers] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [resetId, setResetId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  const loadUsers = async () => {
    const res = await fetchApi('/api/users');
    setUsers(await res.json());
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      loadUsers();
    }
  }, [fetchApi, user]);

  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500">
        <ShieldAlert className="w-16 h-16 mb-4 text-red-500/50" />
        <p>Acesso negado. Apenas administradores podem acessar esta página.</p>
      </div>
    );
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: newUsername, password: newPassword })
      });
      setNewUsername('');
      setNewPassword('');
      setShowAdd(false);
      loadUsers();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleBlock = async (id: number, blocked: boolean) => {
    await fetchApi(`/api/users/${id}/block`, {
      method: 'POST',
      body: JSON.stringify({ blocked })
    });
    loadUsers();
  };

  const handleRoleChange = async (id: number, role: string) => {
    try {
      await fetchApi(`/api/users/${id}/role`, {
        method: 'POST',
        body: JSON.stringify({ role })
      });
      loadUsers();
    } catch (e: any) {
      alert(e.message);
      loadUsers();
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetId) return;
    try {
      await fetchApi(`/api/users/${resetId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: resetPassword })
      });
      setResetId(null);
      setResetPassword('');
      alert('Senha redefinida com sucesso!');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.')) return;
    try {
      await fetchApi(`/api/users/${id}`, { method: 'DELETE' });
      loadUsers();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-emerald-400" />
          Gerenciar Usuários
        </h1>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Novo Usuário
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex gap-4 items-end">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Usuário</label>
            <input
              type="text"
              required
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
              className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Senha</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg">Salvar</button>
            <button type="button" onClick={() => setShowAdd(false)} className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg">Cancelar</button>
          </div>
        </form>
      )}

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-left text-sm text-zinc-400">
          <thead className="bg-zinc-950/50 text-zinc-300">
            <tr>
              <th className="px-6 py-4 font-medium w-16 text-center">#</th>
              <th className="px-6 py-4 font-medium">ID</th>
              <th className="px-6 py-4 font-medium">Usuário</th>
              <th className="px-6 py-4 font-medium">Papel</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {users.map((u, i) => (
              <tr key={u.id} className="hover:bg-zinc-800/50">
                <td className="px-6 py-4 font-medium text-zinc-500 text-center">{i + 1}</td>
                <td className="px-6 py-4">{u.id}</td>
                <td className="px-6 py-4 font-medium text-white">{u.username}</td>
                <td className="px-6 py-4">
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    disabled={u.id === user.id}
                    className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-sm text-white disabled:opacity-50"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="px-6 py-4">
                  {u.is_blocked ? (
                    <span className="text-red-400 bg-red-500/10 px-2 py-1 rounded text-xs">Bloqueado</span>
                  ) : (
                    <span className="text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded text-xs">Ativo</span>
                  )}
                </td>
                <td className="px-6 py-4 flex gap-3">
                  {u.role !== 'admin' && (
                    <button
                      onClick={() => handleBlock(u.id, !u.is_blocked)}
                      className="text-zinc-400 hover:text-white flex items-center gap-1"
                      title={u.is_blocked ? "Desbloquear" : "Bloquear"}
                    >
                      {u.is_blocked ? <UserCheck className="w-4 h-4 text-emerald-400" /> : <UserX className="w-4 h-4 text-red-400" />}
                    </button>
                  )}
                  <button
                    onClick={() => setResetId(u.id)}
                    className="text-zinc-400 hover:text-white flex items-center gap-1"
                    title="Redefinir Senha"
                  >
                    <KeyRound className="w-4 h-4 text-blue-400" />
                  </button>
                  {u.id !== user.id && (
                    <button
                      onClick={() => handleDelete(u.id)}
                      className="text-zinc-400 hover:text-red-400 flex items-center gap-1"
                      title="Excluir Usuário"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resetId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Redefinir Senha</h2>
            <form onSubmit={handleResetPassword}>
              <div className="mb-4">
                <label className="block text-sm text-zinc-400 mb-1">Nova Senha</label>
                <input
                  type="password"
                  required
                  value={resetPassword}
                  onChange={e => setResetPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg">Confirmar</button>
                <button type="button" onClick={() => setResetId(null)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
