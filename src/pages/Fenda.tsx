import { useState, useEffect } from 'react';
import { Upload, Gem, Info, AlertTriangle, Trash2 } from 'lucide-react';

export default function Fenda({ fetchApi }: { fetchApi: any }) {
  const [data, setData] = useState<any[]>([]);
  const [season, setSeason] = useState<number>(1);
  const [uploading, setUploading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const loadData = async () => {
    const res = await fetchApi('/api/fenda');
    const json = await res.json();
    setData(json.data);
    setSeason(json.season);
  };

  useEffect(() => {
    loadData();
  }, [fetchApi]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setUploading(true);
    
    const formData = new FormData();
    formData.append('file', e.target.files[0]);
    
    try {
      await fetchApi('/api/upload/fenda', {
        method: 'POST',
        body: formData
      });
      loadData();
      alert('Importação concluída com sucesso!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const confirmClose = async () => {
    try {
      await fetchApi('/api/fenda/close', { method: 'POST' });
      setShowConfirm(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteByDate = async (date: string) => {
    if (!confirm(`Tem certeza que deseja excluir TODOS os registros da fenda na data ${date}? Esta ação não pode ser desfeita e serve como rollback de importação.`)) return;
    try {
      await fetchApi(`/api/fenda/date/${date}`, { method: 'DELETE' });
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
    return num.toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Gem className="w-6 h-6 text-emerald-400" />
          Fenda (Temporada {season})
        </h1>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <button className="text-zinc-400 hover:text-white transition-colors">
              <Info className="w-5 h-5" />
            </button>
            <div className="absolute right-0 top-full mt-2 w-72 bg-zinc-800 text-sm text-zinc-300 p-3 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 border border-zinc-700">
              <p className="font-semibold text-white mb-1">Formato do CSV:</p>
              <p>O arquivo deve conter as colunas:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li><code className="text-emerald-400">Nick</code> (Nome do membro)</li>
                <li><code className="text-emerald-400">Cristais</code> (Valor numérico)</li>
              </ul>
              <p className="mt-2 text-xs text-zinc-400">A data será registrada como o dia da importação, a menos que uma coluna <code className="text-emerald-400">Data</code> seja fornecida.</p>
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
            onClick={() => setShowConfirm(true)}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            Fechar Fenda
          </button>
        </div>
      </div>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-left text-sm text-zinc-400">
          <thead className="bg-zinc-950/50 text-zinc-300">
            <tr>
              <th className="px-6 py-4 font-medium">Posição</th>
              <th className="px-6 py-4 font-medium">Nick</th>
              <th className="px-6 py-4 font-medium">Cristais Extraídos</th>
              <th className="px-6 py-4 font-medium">Data do Registro</th>
              <th className="px-6 py-4 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {data.map((item, index) => (
              <tr key={item.id} className="hover:bg-zinc-800/50">
                <td className="px-6 py-4 font-medium text-zinc-500">#{index + 1}</td>
                <td className="px-6 py-4 font-medium text-white">{item.nick}</td>
                <td className="px-6 py-4 text-emerald-400 font-medium">{formatNumber(Number(item.crystals))}</td>
                <td className="px-6 py-4">{item.date}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleDeleteByDate(item.date)}
                    className="text-zinc-400 hover:text-red-400 flex items-center gap-1"
                    title="Excluir todos os registros desta data (Rollback)"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                  Nenhum dado registrado para a fenda atual.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              Fechar Fenda
            </h2>
            <p className="text-zinc-300 mb-6">
              Tem certeza que deseja fechar a fenda atual? Isso iniciará um novo ciclo (Temporada {season + 1}) e a contagem de cristais será resetada para a nova fenda.
            </p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setShowConfirm(false)} 
                className="px-4 py-2 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmClose} 
                className="px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors"
              >
                Sim, Fechar Fenda
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
