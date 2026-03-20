import React, { useState, useEffect } from 'react';
import { Upload, Download, Info, Trash2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function PowerHistory({ fetchApi }: { fetchApi: any }) {
  const [history, setHistory] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedNick, setSelectedNick] = useState<string>('all');

  const loadHistory = async () => {
    const res = await fetchApi('/api/power');
    setHistory(await res.json());
  };

  useEffect(() => {
    loadHistory();
  }, [fetchApi]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setUploading(true);
    
    const formData = new FormData();
    formData.append('file', e.target.files[0]);
    
    try {
      await fetchApi('/api/upload/power', {
        method: 'POST',
        body: formData
      });
      loadHistory();
      alert('Importação concluída com sucesso!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteByDate = async (date: string) => {
    if (!confirm(`Tem certeza que deseja excluir TODOS os registros de poder da data ${date}? Esta ação não pode ser desfeita e serve como rollback de importação.`)) return;
    try {
      await fetchApi(`/api/power/date/${date}`, { method: 'DELETE' });
      loadHistory();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const formatPower = (power: number) => {
    if (power >= 1000000000) return (power / 1000000000).toFixed(2) + 'B';
    if (power >= 1000000) return (power / 1000000).toFixed(2) + 'M';
    return power.toLocaleString();
  };

  const uniqueNicks = Array.from(new Set(history.map(h => h.nick))).sort();

  // Prepare chart data
  const chartData = history
    .filter(h => selectedNick === 'all' || h.nick === selectedNick)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(h => ({
      date: h.date,
      power: Number(h.power),
      nick: h.nick
    }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Histórico de Poder</h1>
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
                <li><code className="text-emerald-400">Poder</code> (Valor numérico)</li>
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
            <button className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
              <Upload className="w-4 h-4" />
              {uploading ? 'Importando...' : 'Importar CSV'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
        <div className="mb-6 flex items-center gap-4">
          <label className="text-sm text-zinc-400">Filtrar por Membro:</label>
          <select
            value={selectedNick}
            onChange={e => setSelectedNick(e.target.value)}
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white"
          >
            <option value="all">Todos</option>
            {uniqueNicks.map(nick => (
              <option key={nick as string} value={nick as string}>{nick as string}</option>
            ))}
          </select>
        </div>

        <div className="h-[400px] w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                <XAxis dataKey="date" stroke="#a1a1aa" />
                <YAxis 
                  stroke="#a1a1aa" 
                  tickFormatter={(val) => formatPower(val)}
                  width={80}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff' }}
                  formatter={(value: number) => [formatPower(value), 'Poder']}
                  labelStyle={{ color: '#a1a1aa' }}
                />
                <Legend />
                {selectedNick === 'all' ? (
                  uniqueNicks.slice(0, 10).map((nick, i) => (
                    <Line 
                      key={nick as string}
                      type="monotone" 
                      data={chartData.filter(d => d.nick === nick)}
                      dataKey="power" 
                      name={nick as string}
                      stroke={`hsl(${(i * 137.5) % 360}, 70%, 50%)`} 
                      dot={false}
                    />
                  ))
                ) : (
                  <Line type="monotone" dataKey="power" stroke="#10b981" strokeWidth={2} />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-zinc-500">
              Nenhum dado disponível
            </div>
          )}
        </div>
      </div>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-left text-sm text-zinc-400">
          <thead className="bg-zinc-950/50 text-zinc-300">
            <tr>
              <th className="px-6 py-4 font-medium">Data</th>
              <th className="px-6 py-4 font-medium">Nick</th>
              <th className="px-6 py-4 font-medium">Poder</th>
              <th className="px-6 py-4 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {history.filter(h => selectedNick === 'all' || h.nick === selectedNick).map(h => (
              <tr key={h.id} className="hover:bg-zinc-800/50">
                <td className="px-6 py-4">{h.date}</td>
                <td className="px-6 py-4 font-medium text-white">{h.nick}</td>
                <td className="px-6 py-4 text-emerald-400">{formatPower(Number(h.power))}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleDeleteByDate(h.date)}
                    className="text-zinc-400 hover:text-red-400 flex items-center gap-1"
                    title="Excluir todos os registros desta data (Rollback)"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
