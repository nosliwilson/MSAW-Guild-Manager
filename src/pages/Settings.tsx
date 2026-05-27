import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Database, Download, Upload, ShieldAlert, Save, Trash2, RefreshCw, History, UserCog, FileText, Settings, Shield, Palette } from 'lucide-react';

import ImportsHistory from './ImportsHistory';
import UsersAdmin from './UsersAdmin';
import SQLEditor from './SQLEditor';
import StoredCSVs from './StoredCSVs';
import RolesAdmin from './RolesAdmin';
import SecurityLogs from './SecurityLogs';

export default function SettingsPage({ fetchApi, user }: { fetchApi: any, user: any }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'database');
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };
  
  const [faviconUrl, setFaviconUrl] = useState(`/favicon.ico?t=${Date.now()}`);
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFaviconUpload = async (file: File) => {
    if (!file) return;
    setFaviconUploading(true);
    try {
      const formData = new FormData();
      formData.append('favicon', file);

      const res = await fetchApi('/api/admin/upload-favicon', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Falha ao atualizar o favicon.');
      }

      alert('Favicon atualizado com sucesso! Limpando o cache do seu navegador ou recarregando a página, as alterações serão visíveis.');
      
      const newUrl = `/favicon.ico?t=${Date.now()}`;
      setFaviconUrl(newUrl);
      
      // Update browser icon dynamically in the current view in real-time
      const link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
      if (link) {
        link.href = newUrl;
      } else {
        const newLink = document.createElement('link');
        newLink.rel = 'icon';
        newLink.href = newUrl;
        document.head.appendChild(newLink);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setFaviconUploading(false);
    }
  };

  const handleFaviconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFaviconUpload(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFaviconUpload(e.dataTransfer.files[0]);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin' && activeTab === 'database') {
      loadBackups();
    }
  }, [user, activeTab]);

  const loadBackups = async () => {
    try {
      const res = await fetchApi('/api/admin/db/backups');
      setBackups(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateBackup = async () => {
    setLoading(true);
    try {
      await fetchApi('/api/admin/db/backup', { method: 'POST' });
      alert('Backup criado com sucesso!');
      loadBackups();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = async (filename: string) => {
    if (!confirm(`Tem certeza que deseja restaurar o backup ${filename}? O banco atual será substituído.`)) return;
    setLoading(true);
    try {
      await fetchApi(`/api/admin/db/restore/${filename}`, {
        method: 'POST'
      });
      alert('Backup restaurado com sucesso! A página será recarregada.');
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    if (!confirm(`Tem certeza que deseja excluir o backup ${filename}?`)) return;
    setLoading(true);
    try {
      await fetchApi(`/api/admin/db/backup/${filename}`, { method: 'DELETE' });
      loadBackups();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImportSQLite = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('Atenção: A migração SQLite irá apagar os dados atuais e tentar importar as tabelas do arquivo enviado. Deseja continuar?')) {
      e.target.value = '';
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      await fetchApi('/api/admin/db/import-sqlite', {
        method: 'POST',
        body: formData
      });
      
      alert('Dados migrados com sucesso! A página será recarregada.');
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleScanFolder = async () => {
    setLoading(true);
    try {
      const res = await fetchApi('/api/admin/scan-csv-folder', { method: 'POST' });
      const data = await res.json();
      alert(`${data.added} novos arquivos CSV foram encontrados e adicionados à lista.`);
      if (activeTab === 'csvs') {
        // If we had a CSV refresh function we would call it here
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportJson = async () => {
    try {
      const res = await fetchApi('/api/admin/db/export');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `database_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('Atenção: A importação irá apagar TODOS os dados atuais e substituí-los pelos dados do arquivo. Deseja continuar?')) {
      e.target.value = '';
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      await fetchApi('/api/admin/db/import', {
        method: 'POST',
        body: formData
      });
      
      alert('Dados importados com sucesso! A página será recarregada.');
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500">
        <ShieldAlert className="w-16 h-16 mb-4 text-red-500/50" />
        <p>Acesso negado. Apenas administradores podem acessar esta página.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-emerald-500/10 rounded-lg">
          <Settings className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Configurações do Sistema</h1>
          <p className="text-zinc-400 text-sm">Gerencie usuários, banco de dados e histórico</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-px">
        <button
          onClick={() => handleTabChange('database')}
          className={`px-4 py-3 text-sm font-medium transition-colors relative flex items-center gap-2 ${
            activeTab === 'database' ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Database className="w-4 h-4" />
          Banco de Dados
          {activeTab === 'database' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />}
        </button>
        <button
          onClick={() => handleTabChange('appearance')}
          className={`px-4 py-3 text-sm font-medium transition-colors relative flex items-center gap-2 ${
            activeTab === 'appearance' ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Palette className="w-4 h-4" />
          Aparência e Favicon
          {activeTab === 'appearance' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />}
        </button>
        <button
          onClick={() => handleTabChange('users')}
          className={`px-4 py-3 text-sm font-medium transition-colors relative flex items-center gap-2 ${
            activeTab === 'users' ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <UserCog className="w-4 h-4" />
          Usuários
          {activeTab === 'users' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />}
        </button>
        <button
          onClick={() => handleTabChange('roles')}
          className={`px-4 py-3 text-sm font-medium transition-colors relative flex items-center gap-2 ${
            activeTab === 'roles' ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Shield className="w-4 h-4" />
          Cargos e Permissões
          {activeTab === 'roles' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />}
        </button>
        <button
          onClick={() => handleTabChange('history')}
          className={`px-4 py-3 text-sm font-medium transition-colors relative flex items-center gap-2 ${
            activeTab === 'history' ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <History className="w-4 h-4" />
          Histórico de Importações
          {activeTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />}
        </button>
        <button
          onClick={() => handleTabChange('csvs')}
          className={`px-4 py-3 text-sm font-medium transition-colors relative flex items-center gap-2 ${
            activeTab === 'csvs' ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          Arquivos CSV
          {activeTab === 'csvs' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />}
        </button>
        <button
          onClick={() => handleTabChange('sql')}
          className={`px-4 py-3 text-sm font-medium transition-colors relative flex items-center gap-2 ${
            activeTab === 'sql' ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Database className="w-4 h-4" />
          Editor SQL
          {activeTab === 'sql' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />}
        </button>
        <button
          onClick={() => handleTabChange('security')}
          className={`px-4 py-3 text-sm font-medium transition-colors relative flex items-center gap-2 ${
            activeTab === 'security' ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Logs de Segurança
          {activeTab === 'security' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />}
        </button>
      </div>

      <div className="pt-4">
        {activeTab === 'users' && <UsersAdmin fetchApi={fetchApi} user={user} />}
        {activeTab === 'roles' && <RolesAdmin fetchApi={fetchApi} user={user} />}
        {activeTab === 'history' && <ImportsHistory fetchApi={fetchApi} user={user} />}
        {activeTab === 'csvs' && <StoredCSVs fetchApi={fetchApi} user={user} />}
        {activeTab === 'sql' && <SQLEditor fetchApi={fetchApi} />}
        {activeTab === 'security' && <SecurityLogs fetchApi={fetchApi} />}
        
        {activeTab === 'appearance' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-2 text-white font-medium border-b border-zinc-800 pb-4">
              <Palette className="w-5 h-5 text-emerald-400" />
              Identidade Visual & Ícone (Favicon)
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
              <div className="space-y-2 lg:col-span-1">
                <h3 className="text-sm font-medium text-white">Visualização do Favicon Atual</h3>
                <p className="text-xs text-zinc-400">
                  O favicon é o pequeno ícone que aparece na aba do seu navegador antes do título da página.
                </p>
                <div className="flex items-center gap-4 p-4 bg-zinc-950 rounded-lg border border-zinc-800 w-fit">
                  <div className="w-16 h-16 bg-zinc-900 rounded-lg border border-zinc-800 flex items-center justify-center p-3">
                    <img 
                      key={faviconUrl} 
                      src={faviconUrl} 
                      alt="Favicon Atual" 
                      className="w-10 h-10 object-contain"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%2334d399" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" fill="%2334d399" r="2"/></svg>';
                      }}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500 block">Tipo: .ico / .png / .svg</span>
                    <span className="text-xs font-mono text-zinc-400 font-sans break-all">/favicon.ico</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 space-y-3">
                <h3 className="text-sm font-medium text-white">Upload de Novo Ícone</h3>
                <p className="text-xs text-zinc-400">
                  Faça o envio de uma imagem para ser usada como o favicon do aplicativo. O sistema salvará de forma limpa na pasta correta.
                </p>

                <div 
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-xl p-8 transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
                    faviconUploading ? 'opacity-50 pointer-events-none' : ''
                  } ${
                    dragActive 
                      ? 'border-emerald-400 bg-emerald-500/5' 
                      : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/20'
                  }`}
                >
                  <input
                    type="file"
                    id="favicon-file-input"
                    accept=".ico,.png,.jpg,.jpeg,.svg"
                    className="hidden"
                    onChange={handleFaviconChange}
                    disabled={faviconUploading}
                  />
                  <label htmlFor="favicon-file-input" className="cursor-pointer flex flex-col items-center">
                    <Upload className={`w-10 h-10 mb-3 text-zinc-500 ${faviconUploading ? 'animate-pulse text-emerald-400' : ''}`} />
                    <p className="text-sm text-zinc-300 font-medium font-sans">
                      {faviconUploading ? 'Enviando e configurando...' : 'Arraste uma imagem ou clique para selecionar'}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1 font-sans">
                      Formatos recomendados: ICO, PNG (quadrado, ex: 32x32 ou 64x64) ou SVG.
                    </p>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'database' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Export / Import JSON */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
              <div className="flex items-center gap-2 text-white font-medium border-b border-zinc-800 pb-4">
                <RefreshCw className="w-5 h-5 text-emerald-400" />
                Migração e Transferência (JSON)
              </div>
              
              <div className="space-y-4">
                <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800">
                  <h3 className="text-sm font-medium text-white mb-2">Exportar Dados (JSON)</h3>
                  <p className="text-xs text-zinc-400 mb-4">
                    Baixe um arquivo JSON contendo todos os dados do banco. Útil para migrar para outro banco de dados (ex: de SQLite para PostgreSQL).
                  </p>
                  <button
                    onClick={handleExportJson}
                    disabled={loading}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Exportar Dados (JSON)
                  </button>
                </div>

                <div className="p-4 bg-zinc-950 rounded-lg border border-red-900/30">
                  <h3 className="text-sm font-medium text-red-400 mb-2">Importar Dados (JSON)</h3>
                  <p className="text-xs text-zinc-400 mb-4">
                    Restaure dados a partir de um arquivo JSON. <strong>Atenção:</strong> Isso apagará todos os dados atuais do banco!
                  </p>
                  <label className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer border border-red-500/20">
                    <Upload className="w-4 h-4" />
                    {loading ? 'Processando...' : 'Importar Dados (JSON)'}
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={handleImportJson}
                      disabled={loading}
                    />
                  </label>
                </div>

                <div className="p-4 bg-zinc-950 rounded-lg border border-amber-900/30">
                  <h3 className="text-sm font-medium text-amber-400 mb-2">Migrar de SQLite Antigo (.db)</h3>
                  <p className="text-xs text-zinc-400 mb-4">
                    Importe dados diretamente de um arquivo de banco de dados SQLite antigo. O sistema tentará mapear as tabelas automaticamente.
                  </p>
                  <label className="w-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer border border-amber-500/20">
                    <Database className="w-4 h-4" />
                    {loading ? 'Processando...' : 'Migrar SQLite (.db)'}
                    <input
                      type="file"
                      accept=".db,.sqlite"
                      className="hidden"
                      onChange={handleImportSQLite}
                      disabled={loading}
                    />
                  </label>
                </div>

                <div className="p-4 bg-zinc-950 rounded-lg border border-blue-900/30">
                  <h3 className="text-sm font-medium text-blue-400 mb-2">Varredura de Pasta de Uploads</h3>
                  <p className="text-xs text-zinc-400 mb-4">
                    Verifica a pasta <code>/uploads</code> por novos arquivos CSV que foram copiados manualmente para o servidor.
                  </p>
                  <button
                    onClick={handleScanFolder}
                    disabled={loading}
                    className="w-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2 border border-blue-500/20"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Sincronizar Pasta de Uploads
                  </button>
                </div>
              </div>
            </div>

            {/* Backups SQLite */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <div className="flex items-center gap-2 text-white font-medium">
                  <Save className="w-5 h-5 text-emerald-400" />
                  Backups do SQLite (.db)
                </div>
                <button
                  onClick={handleCreateBackup}
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Criar Backup
                </button>
              </div>

              <div className="space-y-3">
                {backups.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-4">Nenhum backup encontrado.</p>
                ) : (
                  backups.map((b) => (
                    <div key={b.filename} className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                      <div>
                        <p className="text-sm font-medium text-white">{b.filename}</p>
                        <p className="text-xs text-zinc-500">
                          {new Date(b.createdAt).toLocaleString()} • {(b.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRestoreBackup(b.filename)}
                          disabled={loading}
                          className="p-1.5 text-zinc-400 hover:text-emerald-400 transition-colors"
                          title="Restaurar"
                        >
                          <Upload className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteBackup(b.filename)}
                          disabled={loading}
                          className="p-1.5 text-zinc-400 hover:text-red-400 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
