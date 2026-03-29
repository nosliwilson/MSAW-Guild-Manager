import React, { useState, useEffect, useRef } from 'react';
import { Database, Play, AlertCircle, CheckCircle2, Table as TableIcon, Download, Upload, Save, RotateCcw, FileText, Trash2, HardDrive, Plus } from 'lucide-react';

export default function SQLEditor({ fetchApi }: { fetchApi: any }) {
  const [activeTab, setActiveTab] = useState<'editor' | 'browser' | 'backups'>('editor');
  
  // Editor State
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Browser State
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<{data: any[], total: number} | null>(null);
  const [tableSchema, setTableSchema] = useState<any[] | null>(null);
  const [browserPage, setBrowserPage] = useState(0);
  const browserLimit = 100;

  // Backups State
  const [backups, setBackups] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load tables on mount
  useEffect(() => {
    loadTables();
    loadBackups();
  }, []);

  // Load table data when selected table or page changes
  useEffect(() => {
    if (selectedTable) {
      loadTableData(selectedTable, browserPage);
      loadTableSchema(selectedTable);
    }
  }, [selectedTable, browserPage]);

  const loadTables = async () => {
    try {
      const res = await fetchApi('/api/admin/tables');
      setTables(await res.json());
    } catch (e: any) {
      console.error('Error loading tables:', e);
    }
  };

  const loadTableData = async (tableName: string, page: number) => {
    try {
      const res = await fetchApi(`/api/admin/tables/${tableName}/data?limit=${browserLimit}&offset=${page * browserLimit}`);
      setTableData(await res.json());
    } catch (e: any) {
      setError(e.message);
    }
  };

  const loadTableSchema = async (tableName: string) => {
    try {
      const res = await fetchApi(`/api/admin/tables/${tableName}/schema`);
      setTableSchema(await res.json());
    } catch (e: any) {
      console.error('Error loading schema:', e);
    }
  };

  const loadBackups = async () => {
    try {
      const res = await fetchApi('/api/admin/db/backups');
      setBackups(await res.json());
    } catch (e: any) {
      console.error('Error loading backups:', e);
    }
  };

  const handleExecute = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    setError(null);
    setMessage(null);
    setResults(null);
    
    try {
      const res = await fetchApi('/api/admin/sql', {
        method: 'POST',
        body: JSON.stringify({ query })
      });
      
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setResults(data.results);
        if (data.message) {
          setMessage(data.message);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao executar a query');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleExecute();
    }
    
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const value = target.value;
      
      setQuery(value.substring(0, start) + '  ' + value.substring(end));
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  const handleDownloadDB = async () => {
    try {
      const res = await fetchApi('/api/admin/db/download');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `guild_db_${new Date().toISOString().split('T')[0]}.db`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('Erro ao baixar banco de dados: ' + e.message);
    }
  };

  const handleCreateBackup = async () => {
    if (!confirm('Deseja gerar um novo backup do banco de dados atual?')) return;
    try {
      const res = await fetchApi('/api/admin/db/backup', { method: 'POST' });
      const data = await res.json();
      alert(data.message);
      loadBackups();
    } catch (e: any) {
      alert('Erro ao criar backup: ' + e.message);
    }
  };

  const handleRestoreBackup = async (filename: string) => {
    if (!confirm(`ATENÇÃO: Isso substituirá o banco de dados atual pelo backup "${filename}". Todas as mudanças desde esse backup serão perdidas. Tem certeza?`)) return;
    try {
      const res = await fetchApi(`/api/admin/db/restore/${filename}`, { method: 'POST' });
      const data = await res.json();
      alert(data.message);
      window.location.reload(); // Reload to ensure fresh state
    } catch (e: any) {
      alert('Erro ao restaurar backup: ' + e.message);
    }
  };

  const handleUploadRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!confirm(`ATENÇÃO: Você está prestes a substituir o banco de dados atual pelo arquivo "${file.name}". Isso não pode ser desfeito. Tem certeza?`)) {
      e.target.value = '';
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetchApi('/api/admin/db/upload-restore', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      alert(data.message);
      window.location.reload();
    } catch (err: any) {
      alert('Erro ao restaurar arquivo: ' + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const renderTable = (data: any[]) => {
    if (!data || data.length === 0) return <p className="text-zinc-400 p-4">Nenhum resultado retornado.</p>;

    const columns = Object.keys(data[0]);

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-zinc-400">
          <thead className="bg-zinc-950/50 text-zinc-300">
            <tr>
              {columns.map(col => (
                <th key={col} className="px-4 py-3 font-medium border-b border-zinc-800 whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {data.map((row, i) => (
              <tr key={i} className="hover:bg-zinc-800/50">
                {columns.map(col => (
                  <td key={col} className="px-4 py-3 whitespace-nowrap">
                    {row[col] === null ? <span className="text-zinc-600">NULL</span> : String(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Database className="w-6 h-6 text-emerald-400" />
          Gerenciamento de Banco de Dados
        </h1>
      </div>

      <div className="flex gap-2 border-b border-zinc-800 pb-4">
        <button
          onClick={() => setActiveTab('editor')}
          className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${activeTab === 'editor' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
        >
          <Play className="w-4 h-4" />
          Editor SQL
        </button>
        <button
          onClick={() => setActiveTab('browser')}
          className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${activeTab === 'browser' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
        >
          <TableIcon className="w-4 h-4" />
          Navegador de Tabelas
        </button>
        <button
          onClick={() => setActiveTab('backups')}
          className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${activeTab === 'backups' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
        >
          <HardDrive className="w-4 h-4" />
          Backups & Manutenção
        </button>
      </div>

      {activeTab === 'editor' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-zinc-800 bg-zinc-950/50 flex justify-between items-center">
              <p className="text-sm text-zinc-400">
                Execute queries diretamente no banco de dados SQLite. <span className="text-red-400 font-medium">Atenção: Ações destrutivas não podem ser desfeitas.</span>
              </p>
              <button
                onClick={handleExecute}
                disabled={loading || !query.trim()}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
              >
                <Play className="w-4 h-4" />
                {loading ? 'Executando...' : 'Executar (Ctrl+Enter)'}
              </button>
            </div>
            
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="SELECT * FROM users LIMIT 10;"
              className="w-full h-64 bg-zinc-950 text-emerald-400 p-4 font-mono text-sm focus:outline-none resize-y"
              spellCheck={false}
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-red-400 font-mono text-sm whitespace-pre-wrap break-all">
                {error}
              </div>
            </div>
          )}

          {message && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-emerald-400 text-sm">
                {message}
              </div>
            </div>
          )}

          {results && (
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
              <div className="p-4 border-b border-zinc-800 bg-zinc-950/50">
                <h2 className="text-sm font-medium text-white">Resultados ({results.length} linhas)</h2>
              </div>
              {renderTable(results)}
            </div>
          )}
        </div>
      )}

      {activeTab === 'browser' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="lg:col-span-1 bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden flex flex-col h-[600px]">
            <div className="p-4 border-b border-zinc-800 bg-zinc-950/50">
              <h2 className="font-medium text-white flex items-center gap-2">
                <TableIcon className="w-4 h-4 text-emerald-400" />
                Tabelas
              </h2>
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-1">
              {tables.map(table => (
                <button
                  key={table}
                  onClick={() => {
                    setSelectedTable(table);
                    setBrowserPage(0);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedTable === table ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                >
                  {table}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3 flex flex-col gap-6">
            {selectedTable ? (
              <>
                <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                  <div className="p-4 border-b border-zinc-800 bg-zinc-950/50 flex justify-between items-center">
                    <h2 className="font-medium text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-400" />
                      Estrutura: {selectedTable}
                    </h2>
                  </div>
                  {tableSchema && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-zinc-400">
                        <thead className="bg-zinc-950/50 text-zinc-300">
                          <tr>
                            <th className="px-4 py-2 font-medium border-b border-zinc-800">Coluna</th>
                            <th className="px-4 py-2 font-medium border-b border-zinc-800">Tipo</th>
                            <th className="px-4 py-2 font-medium border-b border-zinc-800">Not Null</th>
                            <th className="px-4 py-2 font-medium border-b border-zinc-800">PK</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                          {tableSchema.map((col: any) => (
                            <tr key={col.name} className="hover:bg-zinc-800/50">
                              <td className="px-4 py-2 font-medium text-white">{col.name}</td>
                              <td className="px-4 py-2 text-emerald-400">{col.type}</td>
                              <td className="px-4 py-2">{col.notnull ? 'Sim' : 'Não'}</td>
                              <td className="px-4 py-2">{col.pk ? 'Sim' : 'Não'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden flex-1">
                  <div className="p-4 border-b border-zinc-800 bg-zinc-950/50 flex justify-between items-center">
                    <h2 className="font-medium text-white flex items-center gap-2">
                      <Database className="w-4 h-4 text-emerald-400" />
                      Dados: {selectedTable}
                    </h2>
                    {tableData && (
                      <div className="flex items-center gap-4 text-sm text-zinc-400">
                        <span>Total: {tableData.total} registros</span>
                        <div className="flex items-center gap-2">
                          <button 
                            disabled={browserPage === 0}
                            onClick={() => setBrowserPage(p => p - 1)}
                            className="px-2 py-1 bg-zinc-800 rounded hover:bg-zinc-700 disabled:opacity-50"
                          >
                            Anterior
                          </button>
                          <span>Página {browserPage + 1}</span>
                          <button 
                            disabled={(browserPage + 1) * browserLimit >= tableData.total}
                            onClick={() => setBrowserPage(p => p + 1)}
                            className="px-2 py-1 bg-zinc-800 rounded hover:bg-zinc-700 disabled:opacity-50"
                          >
                            Próxima
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {tableData && renderTable(tableData.data)}
                </div>
              </>
            ) : (
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 flex items-center justify-center h-[600px] text-zinc-500">
                Selecione uma tabela ao lado para visualizar sua estrutura e dados.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'backups' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="space-y-6">
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Download className="w-5 h-5 text-emerald-400" />
                Exportar Banco de Dados
              </h2>
              <p className="text-zinc-400 text-sm mb-6">
                Faça o download do arquivo SQLite completo (`guild.db`) para sua máquina local. Isso é útil para backups externos ou para abrir o banco em ferramentas como DBeaver ou DB Browser for SQLite.
              </p>
              <button
                onClick={handleDownloadDB}
                className="w-full flex justify-center items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-3 rounded-lg transition-colors font-medium"
              >
                <Download className="w-4 h-4" />
                Download guild.db
              </button>
            </div>

            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5 text-amber-400" />
                Restaurar de Arquivo Local
              </h2>
              <p className="text-zinc-400 text-sm mb-6">
                Faça o upload de um arquivo `.db` para substituir o banco de dados atual. <strong className="text-red-400">Atenção: Todos os dados atuais serão sobrescritos.</strong>
              </p>
              <input 
                type="file" 
                accept=".db,.sqlite,.sqlite3" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleUploadRestore}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full flex justify-center items-center gap-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-500 border border-amber-500/50 px-4 py-3 rounded-lg transition-colors font-medium disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {uploading ? 'Restaurando...' : 'Fazer Upload e Restaurar'}
              </button>
            </div>
          </div>

          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Save className="w-5 h-5 text-emerald-400" />
                Backups no Servidor
              </h2>
              <button
                onClick={handleCreateBackup}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Gerar Backup
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 p-2">
              {backups.length === 0 ? (
                <div className="text-center py-12 text-zinc-500">
                  Nenhum backup encontrado no servidor.
                </div>
              ) : (
                <div className="space-y-2">
                  {backups.map(backup => (
                    <div key={backup.filename} className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-white">{backup.filename}</p>
                        <p className="text-xs text-zinc-400 mt-1">
                          {new Date(backup.date).toLocaleString('pt-BR')} • {formatBytes(backup.size)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRestoreBackup(backup.filename)}
                        className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-2 rounded-lg transition-colors text-sm whitespace-nowrap"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Restaurar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
