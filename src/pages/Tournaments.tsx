import React, { useState, useEffect } from 'react';
import { Upload, Swords, Info, Trash2 } from 'lucide-react';

export default function Tournaments({ fetchApi }: { fetchApi: any }) {
  const [activeTab, setActiveTab] = useState('guerra_total');
  const [data, setData] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  const loadData = async (type: string) => {
    const res = await fetchApi(`/api/tournaments/${type}`);
    setData(await res.json());
  };

  useEffect(() => {
    loadData(activeTab);
  }, [activeTab, fetchApi]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setUploading(true);
    
    const formData = new FormData();
    formData.append('file', e.target.files[0]);
    
    try {
      await fetchApi(`/api/upload/${activeTab}`, {
        method: 'POST',
        body: formData
      });
      loadData(activeTab);
      alert('Importação concluída com sucesso!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteByDate = async (date: string) => {
    if (!confirm(`Tem certeza que deseja excluir TODOS os registros deste torneio na data ${date}? Esta ação não pode ser desfeita e serve como rollback de importação.`)) return;
    try {
      await fetchApi(`/api/tournaments/${activeTab}/date/${date}`, { method: 'DELETE' });
      loadData(activeTab);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const formatPower = (power: number) => {
    if (power >= 1000000000) return (power / 1000000000).toFixed(2) + 'B';
    if (power >= 1000000) return (power / 1000000).toFixed(2) + 'M';
    return power.toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Swords className="w-6 h-6 text-emerald-400" />
          Torneios
        </h1>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <button className="text-zinc-400 hover:text-white transition-colors">
              <Info className="w-5 h-5" />
            </button>
            <div className="absolute right-0 top-full mt-2 w-80 bg-zinc-800 text-sm text-zinc-300 p-3 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 border border-zinc-700">
              <p className="font-semibold text-white mb-1">Formato do CSV ({activeTab === 'guerra_total' ? 'Guerra Total' : activeTab === 'torneio_celeste' ? 'Torneio Celeste' : 'Pico de Glória'}):</p>
              <p>O arquivo deve conter as colunas:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li><code className="text-emerald-400">Nick</code> (Nome do membro)</li>
                {activeTab === 'guerra_total' && (
                  <li><code className="text-emerald-400">Poder</code> (Valor numérico)</li>
                )}
                {activeTab === 'torneio_celeste' && (
                  <>
                    <li><code className="text-emerald-400">Guild</code> (Nome da guilda)</li>
                    <li><code className="text-emerald-400">Campo</code> (Nome do campo)</li>
                    <li><code className="text-emerald-400">Pontuação</code> (Valor numérico)</li>
                  </>
                )}
                {activeTab === 'pico_gloria' && (
                  <>
                    <li><code className="text-emerald-400">Rodada</code> (Número da rodada)</li>
                    <li><code className="text-emerald-400">Pontuação</code> (Valor numérico)</li>
                  </>
                )}
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

      <div className="flex gap-2 border-b border-zinc-800 pb-4">
        <button
          onClick={() => setActiveTab('guerra_total')}
          className={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'guerra_total' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
        >
          Guerra Total
        </button>
        <button
          onClick={() => setActiveTab('torneio_celeste')}
          className={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'torneio_celeste' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
        >
          Torneio Celeste
        </button>
        <button
          onClick={() => setActiveTab('pico_gloria')}
          className={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'pico_gloria' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
        >
          Pico de Glória
        </button>
      </div>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-left text-sm text-zinc-400">
          <thead className="bg-zinc-950/50 text-zinc-300">
            <tr>
              <th className="px-6 py-4 font-medium">Data</th>
              <th className="px-6 py-4 font-medium">Nick</th>
              
              {activeTab === 'guerra_total' && (
                <th className="px-6 py-4 font-medium">Poder Total</th>
              )}
              
              {activeTab === 'torneio_celeste' && (
                <>
                  <th className="px-6 py-4 font-medium">Guild</th>
                  <th className="px-6 py-4 font-medium">Campo</th>
                  <th className="px-6 py-4 font-medium">Pontuação</th>
                </>
              )}
              
              {activeTab === 'pico_gloria' && (
                <>
                  <th className="px-6 py-4 font-medium">Rodada</th>
                  <th className="px-6 py-4 font-medium">Pontuação</th>
                </>
              )}
              <th className="px-6 py-4 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {data.map(item => (
              <tr key={item.id} className="hover:bg-zinc-800/50">
                <td className="px-6 py-4">{item.date}</td>
                <td className="px-6 py-4 font-medium text-white">{item.nick}</td>
                
                {activeTab === 'guerra_total' && (
                  <td className="px-6 py-4 text-emerald-400">{formatPower(Number(item.power))}</td>
                )}
                
                {activeTab === 'torneio_celeste' && (
                  <>
                    <td className="px-6 py-4">{item.guild}</td>
                    <td className="px-6 py-4">{item.field}</td>
                    <td className="px-6 py-4 text-emerald-400">{item.score.toLocaleString()}</td>
                  </>
                )}
                
                {activeTab === 'pico_gloria' && (
                  <>
                    <td className="px-6 py-4">{item.round}</td>
                    <td className="px-6 py-4 text-emerald-400">{item.score.toLocaleString()}</td>
                  </>
                )}
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
                <td colSpan={7} className="px-6 py-8 text-center text-zinc-500">
                  Nenhum dado registrado para este torneio.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
