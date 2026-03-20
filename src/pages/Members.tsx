import React, { useState, useEffect } from 'react';
import { Plus, Edit2, ShieldAlert, Upload, Info, Trash2 } from 'lucide-react';

export default function Members({ fetchApi }: { fetchApi: any }) {
  const [members, setMembers] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newNick, setNewNick] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [uploading, setUploading] = useState(false);
  
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [newRole, setNewRole] = useState('Membro');
  const [newRoleDate, setNewRoleDate] = useState(new Date().toISOString().split('T')[0]);

  const loadMembers = async () => {
    const res = await fetchApi('/api/members');
    setMembers(await res.json());
  };

  useEffect(() => {
    loadMembers();
  }, [fetchApi]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/api/members', {
        method: 'POST',
        body: JSON.stringify({ nick: newNick, entry_date: newDate })
      });
      setNewNick('');
      setShowAdd(false);
      loadMembers();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setUploading(true);
    
    const formData = new FormData();
    formData.append('file', e.target.files[0]);
    
    try {
      await fetchApi('/api/upload/members', {
        method: 'POST',
        body: formData
      });
      loadMembers();
      alert('Importação concluída com sucesso!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleStatusChange = async (id: number, status: string) => {
    const exit_date = status === 'inativo' ? new Date().toISOString().split('T')[0] : null;
    await fetchApi(`/api/members/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status, exit_date })
    });
    loadMembers();
  };

  const loadRoles = async (member: any) => {
    setSelectedMember(member);
    const res = await fetchApi(`/api/members/${member.id}/roles`);
    setRoles(await res.json());
  };

  const handleAddRole = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetchApi(`/api/members/${selectedMember.id}/roles`, {
      method: 'POST',
      body: JSON.stringify({ role: newRole, start_date: newRoleDate })
    });
    loadRoles(selectedMember);
  };

  const handleDeleteMember = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este membro? Todo o histórico de poder, torneios e fenda será apagado. Esta ação não pode ser desfeita.')) return;
    try {
      await fetchApi(`/api/members/${id}`, { method: 'DELETE' });
      loadMembers();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Membros</h1>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <button className="text-zinc-400 hover:text-white transition-colors">
              <Info className="w-5 h-5" />
            </button>
            <div className="absolute right-0 top-full mt-2 w-64 bg-zinc-800 text-sm text-zinc-300 p-3 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 border border-zinc-700">
              <p className="font-semibold text-white mb-1">Formato do CSV:</p>
              <p>O arquivo deve conter uma coluna com o nome do membro (ex: <code className="text-emerald-400">Nick</code>, <code className="text-emerald-400">Nome</code>).</p>
              <p className="mt-1">A data de entrada será a data atual, a menos que especificada.</p>
            </div>
          </div>
          <div className="relative">
            <input
              type="file"
              accept=".csv"
              onChange={handleUpload}
              disabled={uploading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <button className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
              <Upload className="w-4 h-4" />
              {uploading ? 'Importando...' : 'Importar CSV'}
            </button>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Membro
          </button>
        </div>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex gap-4 items-end">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Nick</label>
            <input
              type="text"
              required
              value={newNick}
              onChange={e => setNewNick(e.target.value)}
              className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Data de Entrada</label>
            <input
              type="date"
              required
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
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
              <th className="px-6 py-4 font-medium">Nick</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Entrada</th>
              <th className="px-6 py-4 font-medium">Saída</th>
              <th className="px-6 py-4 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {members.map(m => (
              <tr key={m.id} className="hover:bg-zinc-800/50">
                <td className="px-6 py-4 font-medium text-white">{m.nick}</td>
                <td className="px-6 py-4">
                  <select
                    value={m.status}
                    onChange={(e) => handleStatusChange(m.id, e.target.value)}
                    className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-sm"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </td>
                <td className="px-6 py-4">{m.entry_date}</td>
                <td className="px-6 py-4">{m.exit_date || '-'}</td>
                <td className="px-6 py-4 flex gap-3">
                  <button
                    onClick={() => loadRoles(m)}
                    className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                    title="Cargos"
                  >
                    <ShieldAlert className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteMember(m.id)}
                    className="text-zinc-400 hover:text-red-400 flex items-center gap-1"
                    title="Excluir Membro"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Cargos - {selectedMember.nick}</h2>
            
            <form onSubmit={handleAddRole} className="flex gap-2 mb-6">
              <select
                value={newRole}
                onChange={e => setNewRole(e.target.value)}
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white flex-1"
              >
                <option value="Presidente">Presidente</option>
                <option value="Vice-Presidente">Vice-Presidente</option>
                <option value="Elite">Elite</option>
                <option value="Oficial">Oficial</option>
                <option value="Membro">Membro</option>
              </select>
              <input
                type="date"
                value={newRoleDate}
                onChange={e => setNewRoleDate(e.target.value)}
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white w-32"
              />
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg">Add</button>
            </form>

            <div className="space-y-2 max-h-60 overflow-auto">
              {roles.map(r => (
                <div key={r.id} className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 flex justify-between">
                  <span className="font-medium text-white">{r.role}</span>
                  <span className="text-sm text-zinc-400">
                    {r.start_date} até {r.end_date || 'Atual'}
                  </span>
                </div>
              ))}
              {roles.length === 0 && <p className="text-zinc-500 text-center py-4">Nenhum cargo registrado</p>}
            </div>

            <button
              onClick={() => setSelectedMember(null)}
              className="mt-6 w-full bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
