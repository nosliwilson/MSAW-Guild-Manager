import React, { useState, useEffect } from 'react';
import { Upload, Gem, Info, AlertTriangle, Trash2, RotateCcw, TrendingUp, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { sortMembers } from '../utils/sorting';
import ImportModal from '../components/ImportModal';

export default function Fenda({ fetchApi }: { fetchApi: any }) {
  const [data, setData] = useState<any[]>([]);
  const [season, setSeason] = useState<number>(1);
  const [uploading, setUploading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [statusTab, setStatusTab] = useState<'ativos' | 'inativos'>('ativos');
  const [viewTab, setViewTab] = useState<'historico' | 'comparacao' | 'temporadas'>('historico');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [compareStart, setCompareStart] = useState('');
  const [compareEnd, setCompareEnd] = useState('');
  const [compareData, setCompareData] = useState<any[]>([]);
  const [closeDate, setCloseDate] = useState<string>('');
  const [seasonsData, setSeasonsData] = useState<any[]>([]);
  const [importPreview, setImportPreview] = useState<{ results: any[], unknownNicks: string[] } | null>(null);
  const [members, setMembers] = useState<any[]>([]);

  const loadMembers = async () => {
    const res = await fetchApi('/api/members');
    setMembers(await res.json());
  };

  const loadData = async () => {
    const res = await fetchApi('/api/fenda');
    const json = await res.json();
    setData(json.data);
    setSeason(json.season);
  };

  const loadSeasons = async () => {
    const res = await fetchApi('/api/fenda/seasons');
    const json = await res.json();
    setSeasonsData(json);
  };

  const loadComparison = async () => {
    if (!compareStart || !compareEnd) return;
    const res = await fetchApi(`/api/fenda/compare?start=${compareStart}&end=${compareEnd}`);
    const json = await res.json();
    setCompareData(json.filter((d: any) => d.status !== 'inativo').map((d: any) => ({
      ...d,
      diff: d.end_value - d.start_value
    })).sort((a: any, b: any) => b.diff - a.diff));
  };

  useEffect(() => {
    loadData();
    loadMembers();
  }, [fetchApi]);

  useEffect(() => {
    if (viewTab === 'comparacao') {
      loadComparison();
    } else if (viewTab === 'temporadas') {
      loadSeasons();
    }
  }, [viewTab, compareStart, compareEnd]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setUploading(true);
    
    const formData = new FormData();
    formData.append('file', e.target.files[0]);
    
    try {
      const res = await fetchApi('/api/upload/fenda/preview', {
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
      await fetchApi('/api/upload/fenda', {
        method: 'POST',
        body: JSON.stringify({ results, mappings })
      });
      loadData();
      alert('Importação concluída com sucesso!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
      setImportPreview(null);
    }
  };

  const confirmClose = async () => {
    if (!closeDate) {
      alert('Por favor, selecione a data de fechamento.');
      return;
    }
    try {
      await fetchApi('/api/fenda/close', { 
        method: 'POST',
        body: JSON.stringify({ date: closeDate })
      });
      setShowConfirm(false);
      setCloseDate('');
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReopen = async (seasonNumber?: number) => {
    if (!confirm('Tem certeza que deseja reabrir a temporada? Isso voltará a contagem da fenda para a temporada passada.')) return;
    try {
      await fetchApi('/api/fenda/reopen', { 
        method: 'POST',
        body: JSON.stringify({ season_number: seasonNumber })
      });
      loadData();
      if (viewTab === 'temporadas') loadSeasons();
    } catch (e: any) {
      alert(e.message);
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

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const uniqueDates = Array.from(new Set(data.map(d => d.date))).sort((a, b) => (b as string).localeCompare(a as string));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
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
          {season > 1 && (
            <button
              onClick={handleReopen}
              className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg transition-colors"
              title="Desfazer Fechamento"
            >
              <RotateCcw className="w-4 h-4 text-amber-400" />
            </button>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setViewTab('historico')}
            className={`px-4 py-2 rounded-lg transition-colors ${viewTab === 'historico' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            Histórico Geral
          </button>
          <button
            onClick={() => setViewTab('comparacao')}
            className={`px-4 py-2 rounded-lg transition-colors ${viewTab === 'comparacao' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            Comparação de Fenda
          </button>
          <button
            onClick={() => setViewTab('temporadas')}
            className={`px-4 py-2 rounded-lg transition-colors ${viewTab === 'temporadas' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            Histórico de Temporadas
          </button>
        </div>
        {viewTab === 'historico' && (
          <div className="flex gap-2">
            <button
              onClick={() => setStatusTab('ativos')}
              className={`px-4 py-2 rounded-lg transition-colors ${statusTab === 'ativos' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              Ativos
            </button>
            <button
              onClick={() => setStatusTab('inativos')}
              className={`px-4 py-2 rounded-lg transition-colors ${statusTab === 'inativos' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              Arquivo Morto (Inativos)
            </button>
          </div>
        )}
      </div>

      {viewTab === 'historico' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-zinc-400">Filtrar por Data:</label>
              <select
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white"
              >
                <option value="all">Todas as Datas</option>
                {uniqueDates.map(date => (
                  <option key={date as string} value={date as string}>{formatDate(date as string)}</option>
                ))}
              </select>
            </div>
            {selectedDate !== 'all' && (
              <button
                onClick={() => {
                  handleDeleteByDate(selectedDate);
                  setSelectedDate('all');
                }}
                className="flex items-center gap-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 px-4 py-2 rounded-lg transition-colors ml-auto"
              >
                <Trash2 className="w-4 h-4" />
                Excluir registros de {formatDate(selectedDate)}
              </button>
            )}
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
              {data.filter(item => (statusTab === 'ativos' ? item.status === 'ativo' : item.status === 'inativo') && (selectedDate === 'all' || item.date === selectedDate)).map((item, index) => (
                <tr key={item.id} className="hover:bg-zinc-800/50">
                  <td className="px-6 py-4 font-medium text-zinc-500">#{index + 1}</td>
                  <td className="px-6 py-4 font-medium text-white">{item.nick}</td>
                  <td className="px-6 py-4 text-emerald-400 font-medium">{formatNumber(Number(item.crystals))}</td>
                  <td className="px-6 py-4">{formatDate(item.date)}</td>
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
              {data.filter(item => (statusTab === 'ativos' ? item.status === 'ativo' : item.status === 'inativo') && (selectedDate === 'all' || item.date === selectedDate)).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                    Nenhum dado registrado para membros {statusTab} na fenda atual.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 flex gap-4 items-end">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Data Inicial</label>
              <input
                type="date"
                value={compareStart}
                onChange={e => setCompareStart(e.target.value)}
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Data Final</label>
              <input
                type="date"
                value={compareEnd}
                onChange={e => setCompareEnd(e.target.value)}
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>

          {compareData.length > 0 && (
            <>
              <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={compareData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                      <XAxis dataKey="nick" stroke="#a1a1aa" />
                      <YAxis 
                        stroke="#a1a1aa" 
                        tickFormatter={(val) => formatNumber(val)}
                        width={80}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff' }}
                        formatter={(value: number) => [formatNumber(value), 'Evolução']}
                        labelStyle={{ color: '#a1a1aa' }}
                      />
                      <Bar dataKey="diff" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                <table className="w-full text-left text-sm text-zinc-400">
                  <thead className="bg-zinc-950/50 text-zinc-300">
                    <tr>
                      <th className="px-6 py-4 font-medium">Nick</th>
                      <th className="px-6 py-4 font-medium">Cristais Iniciais</th>
                      <th className="px-6 py-4 font-medium">Cristais Finais</th>
                      <th className="px-6 py-4 font-medium">Evolução</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {compareData.map((d, i) => (
                      <tr key={i} className="hover:bg-zinc-800/50">
                        <td className="px-6 py-4 font-medium text-white">{d.nick}</td>
                        <td className="px-6 py-4">{formatNumber(d.start_value)}</td>
                        <td className="px-6 py-4">{formatNumber(d.end_value)}</td>
                        <td className="px-6 py-4">
                          <div className={`flex items-center gap-1 ${d.diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {d.diff >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            {formatNumber(Math.abs(d.diff))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {viewTab === 'temporadas' && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="bg-zinc-950/50 text-zinc-300">
              <tr>
                <th className="px-6 py-4 font-medium">Temporada</th>
                <th className="px-6 py-4 font-medium">Data de Fechamento</th>
                <th className="px-6 py-4 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {seasonsData.map((s) => (
                <tr key={s.id} className="hover:bg-zinc-800/50">
                  <td className="px-6 py-4 font-medium text-white">Temporada {s.season_number}</td>
                  <td className="px-6 py-4">{formatDate(s.closed_at)}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleReopen(s.season_number)}
                      className="text-zinc-400 hover:text-red-400 flex items-center gap-1"
                      title="Excluir fechamento e voltar para esta temporada"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {seasonsData.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-zinc-500">
                    Nenhum fechamento de temporada registrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              Fechar Fenda
            </h2>
            <p className="text-zinc-300 mb-4">
              Selecione a data em que a fenda foi fechada. Isso iniciará um novo ciclo (Temporada {season + 1}).
            </p>
            <input
              type="date"
              value={closeDate}
              onChange={e => setCloseDate(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white mb-6"
            />
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
