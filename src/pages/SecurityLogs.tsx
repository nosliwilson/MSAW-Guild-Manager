import React, { useState, useEffect } from 'react';
import { ShieldAlert, Trash2, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import Pagination from '../components/Pagination';

export default function SecurityLogs({ fetchApi }: { fetchApi: any }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  useEffect(() => {
    loadLogs();
  }, [page]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * limit;
      const res = await fetchApi(`/api/admin/security-logs?limit=${limit}&offset=${offset}`);
      const data = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = async () => {
    if (!confirm('Tem certeza que deseja limpar todos os logs de segurança? Esta ação não pode ser desfeita.')) return;
    
    try {
      await fetchApi('/api/admin/security-logs', { method: 'DELETE' });
      setLogs([]);
      setTotal(0);
      setPage(1);
      alert('Logs limpos com sucesso!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getLogTypeColor = (type: string) => {
    switch (type) {
      case 'LOGIN_FAILED': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'LOGIN_BLOCKED': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      case 'UNAUTHORIZED_SQL_ATTEMPT': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      case 'SQL_INJECTION_ATTEMPT': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'BOT_FILE_SCAN': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'NOT_FOUND_OR_BOT': return 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20';
      case 'LOGIN_SUCCESS': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      default: return 'text-zinc-300 bg-zinc-800/50 border-zinc-700/50';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-red-400" />
          <h2 className="text-lg font-medium text-white">Eventos de Segurança</h2>
          <span className="text-xs text-zinc-500 ml-2">{total} registros no total</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadLogs()}
            disabled={loading}
            className="p-2 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded-lg transition-colors"
            title="Recarregar"
          >
            <RefreshCw className={loading ? 'animate-spin w-4 h-4' : 'w-4 h-4'} />
          </button>
          <button
            onClick={clearLogs}
            className="flex items-center gap-2 px-3 py-1.5 transition-colors text-red-400 hover:bg-red-400/10 bg-zinc-900 border border-zinc-800 rounded-lg"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-sm font-medium">Limpar Logs</span>
          </button>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-950 border-b border-zinc-800">
              <tr>
                <th className="px-4 py-3 font-medium text-zinc-400">Data/Hora</th>
                <th className="px-4 py-3 font-medium text-zinc-400">IP</th>
                <th className="px-4 py-3 font-medium text-zinc-400">Tipo</th>
                <th className="px-4 py-3 font-medium text-zinc-400">Recurso</th>
                <th className="px-4 py-3 font-medium text-zinc-400">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                    {loading ? 'Carregando...' : 'Nenhum log encontrado.'}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-400 font-mono text-xs">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-white font-mono">{log.ip}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getLogTypeColor(log.type)}`}>
                        {log.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-zinc-500 uppercase">{log.method}</span>
                        <span className="truncate max-w-[200px] font-mono text-xs" title={log.url}>{log.url}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-center mt-6">
        <Pagination
          currentPage={page}
          totalCount={total}
          pageSize={limit}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
