import React, { useState, useEffect } from 'react';
import { User, Shield, Lock, Palette, Filter, Globe, Trash2, Ban, CheckCircle, XCircle, Key, UserPlus, Save } from 'lucide-react';

export default function Settings({ fetchApi, user, setAuth }: { fetchApi: any, user: any, setAuth: any }) {
  const [activeTab, setActiveTab] = useState('perfil');
  const [profile, setProfile] = useState({
    display_name: user?.display_name || '',
    theme: user?.theme || 'dark',
    default_absence_period: user?.default_absence_period || 30,
    password: '',
    confirmPassword: ''
  });
  const [systemSettings, setSystemSettings] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '' });

  useEffect(() => {
    loadSettings();
    if (user?.role === 'admin') {
      loadUsers();
    }
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetchApi('/api/settings');
      setSystemSettings(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await fetchApi('/api/users');
      setUsers(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profile.password && profile.password !== profile.confirmPassword) {
      alert('As senhas não coincidem');
      return;
    }

    setLoading(true);
    try {
      const res = await fetchApi('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(profile)
      });
      const updatedUser = await res.json();
      setAuth(localStorage.getItem('token'), { ...user, ...updatedUser });
      alert('Perfil atualizado com sucesso!');
      
      // Apply theme immediately
      if (profile.theme === 'light') {
        document.documentElement.classList.add('light');
      } else {
        document.documentElement.classList.remove('light');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSystemSetting = async (key: string, value: string) => {
    try {
      await fetchApi('/api/settings', {
        method: 'POST',
        body: JSON.stringify({ key, value })
      });
      setSystemSettings(prev => ({ ...prev, [key]: value }));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUserAction = async (userId: number, action: string, value?: any) => {
    try {
      let url = `/api/users/${userId}/${action}`;
      let method = 'POST';
      let body: any = {};

      if (action === 'block') body = { blocked: value };
      if (action === 'role') body = { role: value };
      if (action === 'permissions') {
        url = `/api/users/${userId}/permissions`;
        method = 'PUT';
        body = value;
      }
      if (action === 'delete') {
        url = `/api/users/${userId}`;
        method = 'DELETE';
      }
      if (action === 'reset-password') {
        const newPass = prompt('Digite a nova senha:');
        if (!newPass) return;
        body = { newPassword: newPass };
      }

      await fetchApi(url, {
        method,
        body: method !== 'DELETE' ? JSON.stringify(body) : undefined
      });
      loadUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(newUser)
      });
      setNewUser({ username: '', password: '' });
      loadUsers();
      alert('Usuário registrado com sucesso!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-emerald-500/10 rounded-lg">
          <Globe className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Configurações</h1>
          <p className="text-zinc-400 text-sm">Gerencie seu perfil e as preferências do sistema</p>
        </div>
      </div>

      <div className="flex gap-4 border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('perfil')}
          className={`pb-4 px-2 text-sm font-medium transition-colors relative ${
            activeTab === 'perfil' ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'
          }`}
        >
          Meu Perfil
          {activeTab === 'perfil' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />}
        </button>
        {user?.role === 'admin' && (
          <>
            <button
              onClick={() => setActiveTab('sistema')}
              className={`pb-4 px-2 text-sm font-medium transition-colors relative ${
                activeTab === 'sistema' ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Sistema
              {activeTab === 'sistema' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />}
            </button>
            <button
              onClick={() => setActiveTab('usuarios')}
              className={`pb-4 px-2 text-sm font-medium transition-colors relative ${
                activeTab === 'usuarios' ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Gerenciar Usuários
              {activeTab === 'usuarios' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />}
            </button>
          </>
        )}
      </div>

      {activeTab === 'perfil' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-2 text-white font-medium">
              <User className="w-5 h-5 text-emerald-400" />
              Informações Básicas
            </div>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Nome de Exibição</label>
                <input
                  type="text"
                  value={profile.display_name}
                  onChange={e => setProfile({ ...profile, display_name: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                  placeholder="Seu nome"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Tema</label>
                <select
                  value={profile.theme}
                  onChange={e => setProfile({ ...profile, theme: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="dark">Escuro</option>
                  <option value="light">Claro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Período Padrão de Faltas (dias)</label>
                <input
                  type="number"
                  value={profile.default_absence_period}
                  onChange={e => setProfile({ ...profile, default_absence_period: parseInt(e.target.value) })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="pt-4 border-t border-zinc-800">
                <div className="flex items-center gap-2 text-white font-medium mb-4">
                  <Lock className="w-5 h-5 text-emerald-400" />
                  Alterar Senha
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">Nova Senha</label>
                    <input
                      type="password"
                      value={profile.password}
                      onChange={e => setProfile({ ...profile, password: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                      placeholder="Deixe em branco para não alterar"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">Confirmar Nova Senha</label>
                    <input
                      type="password"
                      value={profile.confirmPassword}
                      onChange={e => setProfile({ ...profile, confirmPassword: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-pure-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </form>
          </div>

          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center gap-2 text-white font-medium mb-4">
                <Palette className="w-5 h-5 text-emerald-400" />
                Personalização Visual
              </div>
              <p className="text-zinc-400 text-sm mb-4">
                O tema claro está em fase experimental. Algumas cores podem não estar perfeitamente otimizadas.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setProfile({ ...profile, theme: 'dark' })}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    profile.theme === 'dark' ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-950'
                  }`}
                >
                  <div className="w-full h-12 bg-zinc-900 rounded mb-2 border border-zinc-800" />
                  <span className="text-sm font-medium">Tema Escuro</span>
                </button>
                <button
                  onClick={() => setProfile({ ...profile, theme: 'light' })}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    profile.theme === 'light' ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 bg-white'
                  }`}
                >
                  <div className="w-full h-12 bg-zinc-100 rounded mb-2 border border-zinc-200" />
                  <span className={`text-sm font-medium ${profile.theme === 'light' ? 'text-zinc-950' : 'text-zinc-400'}`}>Tema Claro</span>
                </button>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center gap-2 text-white font-medium mb-4">
                <Filter className="w-5 h-5 text-emerald-400" />
                Filtros Padrão
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Ordenação Padrão</label>
                  <select
                    value={profile.default_filters?.sort || 'role'}
                    onChange={e => setProfile({ 
                      ...profile, 
                      default_filters: { ...profile.default_filters, sort: e.target.value } 
                    })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="role">Cargo</option>
                    <option value="nick">Nick</option>
                    <option value="power">Poder</option>
                    <option value="date">Data</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Itens por Página</label>
                  <select
                    value={profile.default_filters?.pageSize || 180}
                    onChange={e => setProfile({ 
                      ...profile, 
                      default_filters: { ...profile.default_filters, pageSize: parseInt(e.target.value) } 
                    })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={180}>180 (Todos)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'sistema' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
          <div className="flex items-center gap-2 text-white font-medium">
            <Globe className="w-5 h-5 text-emerald-400" />
            Configurações Globais
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Nome da Minha Guild (para Importação)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={systemSettings.my_guild_name || ''}
                  onChange={e => setSystemSettings({ ...systemSettings, my_guild_name: e.target.value })}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                  placeholder="Ex: MinhaGuild"
                />
                <button
                  onClick={() => handleUpdateSystemSetting('my_guild_name', systemSettings.my_guild_name)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-pure-white px-4 py-2 rounded-lg transition-colors"
                >
                  Salvar
                </button>
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                Membros de outras guilds serão importados como "Externos" e não serão adicionados à sua lista de membros.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Temporada da Fenda</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={systemSettings.fenda_season || '1'}
                  onChange={e => setSystemSettings({ ...systemSettings, fenda_season: e.target.value })}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={() => handleUpdateSystemSetting('fenda_season', systemSettings.fenda_season)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-pure-white px-4 py-2 rounded-lg transition-colors"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'usuarios' && (
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center gap-2 text-white font-medium mb-6">
              <UserPlus className="w-5 h-5 text-emerald-400" />
              Novo Usuário
            </div>
            <form onSubmit={handleRegister} className="flex flex-wrap gap-4">
              <input
                type="text"
                placeholder="Username"
                value={newUser.username}
                onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                required
              />
              <input
                type="password"
                placeholder="Senha"
                value={newUser.password}
                onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                required
              />
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-pure-white px-6 py-2 rounded-lg transition-colors">
                Registrar
              </button>
            </form>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-zinc-800/50 text-zinc-400 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-medium">Usuário</th>
                  <th className="px-6 py-4 font-medium">Papel</th>
                  <th className="px-6 py-4 font-medium">Permissões</th>
                  <th className="px-6 py-4 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-zinc-800/30">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-white font-medium">{u.display_name || u.username}</span>
                        <span className="text-xs text-zinc-500">@{u.username}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={u.role}
                        onChange={e => handleUserAction(u.id, 'role', e.target.value)}
                        className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-white"
                      >
                        <option value="user">Usuário</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <label className="flex items-center gap-2 text-[10px] text-zinc-400 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={!!u.can_import} 
                            onChange={e => handleUserAction(u.id, 'permissions', { ...u, can_import: e.target.checked })}
                            className="rounded border-zinc-800 bg-zinc-950 text-emerald-500"
                          />
                          Importar
                        </label>
                        <label className="flex items-center gap-2 text-[10px] text-zinc-400 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={!!u.can_manage_members} 
                            onChange={e => handleUserAction(u.id, 'permissions', { ...u, can_manage_members: e.target.checked })}
                            className="rounded border-zinc-800 bg-zinc-950 text-emerald-500"
                          />
                          Membros
                        </label>
                        <label className="flex items-center gap-2 text-[10px] text-zinc-400 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={!!u.can_manage_roles} 
                            onChange={e => handleUserAction(u.id, 'permissions', { ...u, can_manage_roles: e.target.checked })}
                            className="rounded border-zinc-800 bg-zinc-950 text-emerald-500"
                          />
                          Cargos
                        </label>
                        <label className="flex items-center gap-2 text-[10px] text-zinc-400 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={!!u.can_delete} 
                            onChange={e => handleUserAction(u.id, 'permissions', { ...u, can_delete: e.target.checked })}
                            className="rounded border-zinc-800 bg-zinc-950 text-emerald-500"
                          />
                          Excluir
                        </label>
                        <label className="flex items-center gap-2 text-[10px] text-zinc-400 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={!!u.can_delete_imports} 
                            onChange={e => handleUserAction(u.id, 'permissions', { ...u, can_delete_imports: e.target.checked })}
                            className="rounded border-zinc-800 bg-zinc-950 text-emerald-500"
                          />
                          Hist. Imp.
                        </label>
                        <label className="flex items-center gap-2 text-[10px] text-zinc-400 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={!!u.can_justify_absences} 
                            onChange={e => handleUserAction(u.id, 'permissions', { ...u, can_justify_absences: e.target.checked })}
                            className="rounded border-zinc-800 bg-zinc-950 text-emerald-500"
                          />
                          Justificar
                        </label>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleUserAction(u.id, 'block', !u.is_blocked)}
                          className={`p-1 transition-colors ${u.is_blocked ? 'text-emerald-400' : 'text-zinc-500 hover:text-red-400'}`}
                          title={u.is_blocked ? 'Desbloquear' : 'Bloquear'}
                        >
                          {u.is_blocked ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleUserAction(u.id, 'reset-password')}
                          className="text-zinc-500 hover:text-white p-1"
                          title="Resetar Senha"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { if(confirm('Excluir usuário?')) handleUserAction(u.id, 'delete') }}
                          className="text-zinc-500 hover:text-red-400 p-1"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
