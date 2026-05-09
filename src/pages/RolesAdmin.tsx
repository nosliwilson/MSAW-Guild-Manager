import React, { useState, useEffect } from 'react';
import { Shield, Plus, Save, Trash2, Edit2, X } from 'lucide-react';

export default function RolesAdmin({ fetchApi, user }: { fetchApi: any, user: any }) {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRole, setEditingRole] = useState<any | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const defaultPermissions = {
    members: { view: false, import: false, edit: false, delete: false },
    fenda: { view: false, import: false, edit: false, delete: false },
    tournaments: { view: false, import: false, edit: false, delete: false },
    absences: { view: false, import: false, edit: false, delete: false },
    settings: { view: false, import: false, edit: false, delete: false }
  };

  const [formData, setFormData] = useState({
    name: '',
    permissions: defaultPermissions
  });

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      const res = await fetchApi('/api/roles');
      const data = await res.json();
      setRoles(data.map((r: any) => ({ ...r, permissions: JSON.parse(r.permissions) })));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    if (!formData.name) return alert('Nome do cargo é obrigatório');
    
    setLoading(true);
    try {
      if (isCreating) {
        await fetchApi('/api/roles', {
          method: 'POST',
          body: JSON.stringify(formData)
        });
      } else {
        await fetchApi(`/api/roles/${editingRole.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData)
        });
      }
      
      setEditingRole(null);
      setIsCreating(false);
      loadRoles();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar cargo');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este cargo?')) return;
    
    setLoading(true);
    try {
      const res = await fetchApi(`/api/roles/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      loadRoles();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir cargo');
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (area: string, action: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [area]: {
          ...(prev.permissions as any)[area],
          [action]: !(prev.permissions as any)[area][action]
        }
      }
    }));
  };

  const areas = [
    { id: 'members', label: 'Membros' },
    { id: 'fenda', label: 'Fenda' },
    { id: 'tournaments', label: 'Torneios' },
    { id: 'absences', label: 'Faltas' },
    { id: 'settings', label: 'Configurações' }
  ];

  const actions = [
    { id: 'view', label: 'Visualizar' },
    { id: 'import', label: 'Importar' },
    { id: 'edit', label: 'Editar' },
    { id: 'delete', label: 'Excluir' }
  ];

  if (editingRole || isCreating) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">
            {isCreating ? 'Novo Cargo' : `Editar Cargo: ${editingRole.name}`}
          </h2>
          <button
            onClick={() => {
              setEditingRole(null);
              setIsCreating(false);
            }}
            className="text-zinc-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Nome do Cargo</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
              placeholder="Ex: Moderador"
              disabled={editingRole?.name === 'admin' || editingRole?.name === 'user'}
            />
            {(editingRole?.name === 'admin' || editingRole?.name === 'user') && (
              <p className="text-xs text-amber-500 mt-1">O nome deste cargo padrão não pode ser alterado.</p>
            )}
          </div>

          <div>
            <h3 className="text-lg font-medium text-white mb-4">Permissões</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="py-3 px-4 text-sm font-medium text-zinc-400">Área</th>
                    {actions.map(action => (
                      <th key={action.id} className="py-3 px-4 text-sm font-medium text-zinc-400 text-center">
                        {action.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {areas.map(area => (
                    <tr key={area.id} className="border-b border-zinc-800/50">
                      <td className="py-3 px-4 text-sm text-white font-medium">{area.label}</td>
                      {actions.map(action => (
                        <td key={action.id} className="py-3 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={(formData.permissions as any)[area.id]?.[action.id] || false}
                            onChange={() => togglePermission(area.id, action.id)}
                            className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-zinc-900"
                            disabled={editingRole?.name === 'admin'} // Admin always has all permissions
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {editingRole?.name === 'admin' && (
              <p className="text-xs text-amber-500 mt-2">As permissões do administrador não podem ser alteradas.</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => {
                setEditingRole(null);
                setIsCreating(false);
              }}
              className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={loading || editingRole?.name === 'admin'}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Salvar Cargo
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-bold text-white">Cargos do Sistema</h2>
        </div>
        <button
          onClick={() => {
            setFormData({ name: '', permissions: defaultPermissions });
            setIsCreating(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Cargo
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-zinc-950/50">
            <tr>
              <th className="px-6 py-4 text-sm font-medium text-zinc-400">Nome do Cargo</th>
              <th className="px-6 py-4 text-sm font-medium text-zinc-400 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {roles.map((role) => (
              <tr key={role.id} className="hover:bg-zinc-800/50 transition-colors">
                <td className="px-6 py-4">
                  <span className="font-medium text-white">{role.name}</span>
                  {role.name === 'admin' && <span className="ml-2 text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Sistema</span>}
                  {role.name === 'user' && <span className="ml-2 text-xs bg-zinc-500/20 text-zinc-400 px-2 py-0.5 rounded-full">Padrão</span>}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setFormData({ name: role.name, permissions: role.permissions });
                        setEditingRole(role);
                      }}
                      className="p-2 text-zinc-400 hover:text-emerald-400 transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {role.name !== 'admin' && role.name !== 'user' && (
                      <button
                        onClick={() => handleDelete(role.id)}
                        className="p-2 text-zinc-400 hover:text-red-400 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {roles.length === 0 && (
              <tr>
                <td colSpan={2} className="px-6 py-8 text-center text-zinc-500">
                  Nenhum cargo encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
