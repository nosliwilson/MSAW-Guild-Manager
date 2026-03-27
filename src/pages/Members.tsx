import React, { useState, useEffect } from 'react';
import { Plus, Edit2, ShieldAlert, Upload, Info, Trash2, X, Database } from 'lucide-react';
import { sortMembers, SortCriteria } from '../utils/sorting';
import ImportModal from '../components/ImportModal';
import Pagination from '../components/Pagination';
import SortSelector from '../components/SortSelector';
import CSVImportButton from '../components/CSVImportButton';

export default function Members({ fetchApi }: { fetchApi: any }) {
  const [members, setMembers] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newNick, setNewNick] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'ativos' | 'inativos'>('ativos');
  const [showExitModal, setShowExitModal] = useState(false);
  const [memberToDeactivate, setMemberToDeactivate] = useState<any>(null);
  const [exitDate, setExitDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [editNickValue, setEditNickValue] = useState('');
  const [roles, setRoles] = useState<any[]>([]);
  const [newRole, setNewRole] = useState('Membro');
  const [newRoleDate, setNewRoleDate] = useState(new Date().toISOString().split('T')[0]);
  const [importPreview, setImportPreview] = useState<{ results: any[], unknownNicks: string[] } | null>(null);

  const [sortCriteria, setSortCriteria] = useState<SortCriteria>('role');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(180);

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
      const res = await fetchApi('/api/upload/members/preview', {
        method: 'POST',
        body: formData
      });
      const preview = await res.json();
      
      if (preview.unknownNicks.length > 0) {
        setImportPreview(preview);
      } else {
        await finalizeImport(preview.results);
      }
    } catch (err: any) {
      alert(err.message);
      setUploading(false);
    } finally {
      e.target.value = '';
    }
  };

  const finalizeImport = async (results: any[], mappings?: Record<string, any>) => {
    setUploading(true);
    try {
      await fetchApi('/api/upload/members', {
        method: 'POST',
        body: JSON.stringify({ results, mappings })
      });
      loadMembers();
      alert('Importação concluída com sucesso!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
      setImportPreview(null);
    }
  };

  const handleStatusChange = async (member: any, status: string) => {
    if (status === 'inativo') {
      setMemberToDeactivate(member);
      setExitDate(new Date().toISOString().split('T')[0]);
      setShowExitModal(true);
      return;
    }
    
    await fetchApi(`/api/members/${member.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status, exit_date: null })
    });
    loadMembers();
  };

  const confirmDeactivation = async () => {
    if (!memberToDeactivate) return;
    await fetchApi(`/api/members/${memberToDeactivate.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'inativo', exit_date: exitDate })
    });
    setShowExitModal(false);
    setMemberToDeactivate(null);
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
    loadMembers();
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

  const handleUpdateNick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    try {
      await fetchApi(`/api/members/${editingMember.id}/nick`, {
        method: 'PUT',
        body: JSON.stringify({ nick: editNickValue })
      });
      setEditingMember(null);
      loadMembers();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const filteredMembers = members
    .filter(m => activeTab === 'ativos' ? m.status === 'ativo' : m.status === 'inativo')
    .sort((a, b) => sortMembers(a, b, sortCriteria));

  const totalPages = Math.ceil(filteredMembers.length / pageSize);
  const paginatedMembers = filteredMembers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, sortCriteria, pageSize]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {importPreview && (
          <ImportModal
            unknownNicks={importPreview.unknownNicks}
            members={members}
            onConfirm={(mappings) => finalizeImport(importPreview.results, mappings)}
            onCancel={() => {
              setImportPreview(null);
              setUploading(false);
            }}
          />
        )}
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
          <CSVImportButton
            type="members"
            fetchApi={fetchApi}
            onPreview={setImportPreview}
            onUploading={setUploading}
            disabled={uploading}
          />
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Membro
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('ativos')}
            className={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'ativos' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            Ativos
          </button>
          <button
            onClick={() => setActiveTab('inativos')}
            className={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'inativos' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            Arquivo Morto (Inativos)
          </button>
        </div>
        <SortSelector criteria={sortCriteria} onChange={setSortCriteria} />
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
              <th className="px-6 py-4 font-medium w-16 text-center">#</th>
              <th className="px-6 py-4 font-medium">Nick</th>
              <th className="px-6 py-4 font-medium">Cargo</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Entrada</th>
              <th className="px-6 py-4 font-medium">Saída</th>
              <th className="px-6 py-4 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {paginatedMembers.map((m, index) => (
              <tr key={m.id} className="hover:bg-zinc-800/50">
                <td className="px-6 py-4 font-medium text-zinc-500 text-center">
                  {(currentPage - 1) * pageSize + index + 1}
                </td>
                <td className="px-6 py-4 font-medium text-white">{m.nick}</td>
                <td className="px-6 py-4 text-emerald-400">{m.role || 'Membro'}</td>
                <td className="px-6 py-4">
                  <select
                    value={m.status}
                    onChange={(e) => handleStatusChange(m, e.target.value)}
                    className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-sm"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </td>
                <td className="px-6 py-4">{formatDate(m.entry_date)}</td>
                <td className="px-6 py-4">{formatDate(m.exit_date)}</td>
                <td className="px-6 py-4 flex gap-3">
                  <button
                    onClick={() => {
                      setEditingMember(m);
                      setEditNickValue(m.nick);
                    }}
                    className="text-zinc-400 hover:text-white flex items-center gap-1"
                    title="Editar Nick"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
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
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          itemsPerPage={pageSize}
          onItemsPerPageChange={setPageSize}
          totalItems={filteredMembers.length}
        />
      </div>

      {showExitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Inativar Membro</h2>
              <button onClick={() => setShowExitModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-zinc-400 mb-4">
              Selecione a data de saída para <strong className="text-white">{memberToDeactivate?.nick}</strong>:
            </p>
            <input
              type="date"
              value={exitDate}
              onChange={e => setExitDate(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white mb-6"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowExitModal(false)}
                className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeactivation}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Confirmar Inativação
              </button>
            </div>
          </div>
        </div>
      )}

      {editingMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Editar Nickname</h2>
              <button onClick={() => setEditingMember(null)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateNick} className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Novo Nick</label>
                <input
                  type="text"
                  required
                  value={editNickValue}
                  onChange={e => setEditNickValue(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white"
                  placeholder="Digite o novo nick..."
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Salvar Alteração
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
