import React, { useState, useEffect } from 'react';
import { FileText, Download, Trash2, Calendar, FileType } from 'lucide-react';

export default function StoredCSVs({ fetchApi, user }: { fetchApi: any, user: any }) {
  const [csvs, setCsvs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCsvs = async () => {
    try {
      const res = await fetchApi('/api/stored-csvs');
      setCsvs(await res.json());
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCsvs();
  }, []);

  const handleDownload = async (id: number, filename: string) => {
    try {
      const res = await fetchApi(`/api/stored-csvs/${id}/download`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este arquivo?')) return;
    try {
      await fetchApi(`/api/stored-csvs/${id}`, { method: 'DELETE' });
      loadCsvs();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR');
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      members: 'Membros',
      power: 'Poder',
      guerra_total: 'Guerra Total',
      torneio_celeste: 'Torneio Celeste',
      pico_gloria: 'Pico da Glória',
      fenda: 'Fenda'
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText className="w-6 h-6 text-emerald-400" />
          Arquivos CSV Armazenados
        </h1>
      </div>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-left text-sm text-zinc-400">
          <thead className="bg-zinc-950/50 text-zinc-300">
            <tr>
              <th className="px-6 py-4 font-medium">#</th>
              <th className="px-6 py-4 font-medium">Nome Original</th>
              <th className="px-6 py-4 font-medium">Tipo</th>
              <th className="px-6 py-4 font-medium">Data de Armazenamento</th>
              <th className="px-6 py-4 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center">Carregando...</td>
              </tr>
            ) : csvs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center">Nenhum arquivo armazenado.</td>
              </tr>
            ) : (
              csvs.map((csv, index) => (
                <tr key={csv.id} className="hover:bg-zinc-800/50">
                  <td className="px-6 py-4 text-zinc-500">{index + 1}</td>
                  <td className="px-6 py-4 font-medium text-white flex items-center gap-2">
                    <FileType className="w-4 h-4 text-zinc-500" />
                    {csv.original_name}
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded text-xs">
                      {getTypeLabel(csv.type)}
                    </span>
                  </td>
                  <td className="px-6 py-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-zinc-500" />
                    {formatDate(csv.created_at)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => handleDownload(csv.id, csv.original_name)}
                        className="text-zinc-400 hover:text-emerald-400 transition-colors"
                        title="Baixar"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      {user?.role === 'admin' && (
                        <button
                          onClick={() => handleDelete(csv.id)}
                          className="text-zinc-400 hover:text-red-400 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
