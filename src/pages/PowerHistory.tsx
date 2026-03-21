import React, { useState, useEffect } from 'react';
import { Upload, Download, Info, Trash2, TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { sortMembers } from '../utils/sorting';
import ImportModal from '../components/ImportModal';

export default function PowerHistory({ fetchApi }: { fetchApi: any }) {
  const [history, setHistory] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedNick, setSelectedNick] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [statusTab, setStatusTab] = useState<'ativos' | 'inativos'>('ativos');
  const [activeTab, setActiveTab] = useState<'historico' | 'comparacao'>('historico');
  const [compareStart, setCompareStart] = useState('');
  const [compareEnd, setCompareEnd] = useState('');
  const [compareData, setCompareData] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<'cargo' | 'poder'>('cargo');
  const [importPreview, setImportPreview] = useState<{ results: any[], unknownNicks: string[] } | null>(null);
  const [members, setMembers] = useState<any[]>([]);

  const loadMembers = async () => {
    const res = await fetchApi('/api/members');
    setMembers(await res.json());
  };

  const loadHistory = async () => {
    const res = await fetchApi('/api/power');
    const data = await res.json();
    setHistory(data);
  };

  const loadComparison = async () => {
    if (!compareStart || !compareEnd) return;
    const res = await fetchApi(`/api/power/compare?start=${compareStart}&end=${compareEnd}`);
    const data = await res.json();
    setCompareData(data.map((d: any) => ({
      ...d,
      diff: d.end_power - d.start_power
    })).sort((a: any, b: any) => b.diff - a.diff));
  };

  useEffect(() => {
    loadHistory();
    loadMembers();
  }, [fetchApi]);

  useEffect(() => {
    if (activeTab === 'comparacao') {
      loadComparison();
    }
  }, [activeTab, compareStart, compareEnd]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setUploading(true);
    
    const formData = new FormData();
    formData.append('file', e.target.files[0]);
    
    try {
      const res = await fetchApi('/api/upload/power/preview', {
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
      await fetchApi('/api/upload/power', {
        method: 'POST',
        body: JSON.stringify({ results, mappings })
      });
      loadHistory();
      alert('Importação concluída com sucesso!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
      setImportPreview(null);
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

  const uniqueNicks = Array.from(new Set(history.filter(h => (statusTab === 'ativos' ? h.status === 'ativo' : h.status === 'inativo') && (selectedRole === 'all' || (h.role || 'Membro') === selectedRole)).map(h => h.nick))).sort();
  const uniqueDates = Array.from(new Set(history.filter(h => statusTab === 'ativos' ? h.status === 'ativo' : h.status === 'inativo').map(h => h.date))).sort((a, b) => (b as string).localeCompare(a as string));
  const uniqueRoles = Array.from(new Set(history.filter(h => statusTab === 'ativos' ? h.status === 'ativo' : h.status === 'inativo').map(h => h.role || 'Membro'))).sort();

  const getSortedHistory = () => {
    const filtered = history
      .filter(h => (statusTab === 'ativos' ? h.status === 'ativo' : h.status === 'inativo'))
      .filter(h => (selectedNick === 'all' || h.nick === selectedNick) && (selectedDate === 'all' || h.date === selectedDate) && (selectedRole === 'all' || (h.role || 'Membro') === selectedRole));

    if (sortBy === 'poder') {
      return filtered.sort((a, b) => Number(b.power) - Number(a.power));
    }
    return filtered.sort(sortMembers);
  };

  // Prepare chart data
  const chartData = history
    .filter(h => (statusTab === 'ativos' ? h.status === 'ativo' : h.status === 'inativo'))
    .filter(h => (selectedNick === 'all' || h.nick === selectedNick) && (selectedDate === 'all' || h.date === selectedDate) && (selectedRole === 'all' || (h.role || 'Membro') === selectedRole))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(h => ({
      date: h.date,
      power: Number(h.power),
      nick: h.nick
    }));

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

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

      <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('historico')}
            className={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'historico' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            Histórico Geral
          </button>
          <button
            onClick={() => setActiveTab('comparacao')}
            className={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'comparacao' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            Comparação de Poder
          </button>
        </div>
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
      </div>

      {activeTab === 'historico' ? (
        <>
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
          <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-zinc-400">Ordenar por:</label>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white"
              >
                <option value="cargo">Cargo (Padrão)</option>
                <option value="poder">Poder (Maior para Menor)</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
            <label className="text-sm text-zinc-400">Filtrar por Cargo:</label>
            <select
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value)}
              className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white"
            >
              <option value="all">Todos</option>
              {uniqueRoles.map(role => (
                <option key={role as string} value={role as string}>{role as string}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
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
                  <th className="px-6 py-4 font-medium">Cargo</th>
                  <th className="px-6 py-4 font-medium">Poder</th>
                  <th className="px-6 py-4 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {getSortedHistory().map((h, i) => (
                  <tr key={i} className="hover:bg-zinc-800/50">
                    <td className="px-6 py-4">{formatDate(h.date)}</td>
                    <td className="px-6 py-4 font-medium text-white">{h.nick}</td>
                    <td className="px-6 py-4 text-emerald-400">{h.role || 'Membro'}</td>
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
                {history.filter(h => (statusTab === 'ativos' ? h.status === 'ativo' : h.status === 'inativo') && (selectedNick === 'all' || h.nick === selectedNick) && (selectedDate === 'all' || h.date === selectedDate) && (selectedRole === 'all' || (h.role || 'Membro') === selectedRole)).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                      Nenhum dado registrado para membros {statusTab}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 flex flex-wrap gap-4 items-end">
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
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Filtrar por Cargo</label>
              <select
                value={selectedRole}
                onChange={e => setSelectedRole(e.target.value)}
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white"
              >
                <option value="all">Todos</option>
                {uniqueRoles.map(role => (
                  <option key={role as string} value={role as string}>{role as string}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Filtrar por Membro</label>
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
          </div>

          {compareData.length > 0 && (
            <>
              <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={compareData.filter(d => (statusTab === 'ativos' ? d.status === 'ativo' : d.status === 'inativo') && (selectedRole === 'all' || (d.role || 'Membro') === selectedRole) && (selectedNick === 'all' || d.nick === selectedNick))} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                      <XAxis dataKey="nick" stroke="#a1a1aa" />
                      <YAxis 
                        stroke="#a1a1aa" 
                        tickFormatter={(val) => formatPower(val)}
                        width={80}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff' }}
                        formatter={(value: number) => [formatPower(value), 'Evolução']}
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
                      <th className="px-6 py-4 font-medium">Cargo</th>
                      <th className="px-6 py-4 font-medium">Poder Inicial</th>
                      <th className="px-6 py-4 font-medium">Poder Final</th>
                      <th className="px-6 py-4 font-medium">Evolução</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {compareData.filter(d => (statusTab === 'ativos' ? d.status === 'ativo' : d.status === 'inativo') && (selectedRole === 'all' || (d.role || 'Membro') === selectedRole) && (selectedNick === 'all' || d.nick === selectedNick)).map((d, i) => (
                      <tr key={i} className="hover:bg-zinc-800/50">
                        <td className="px-6 py-4 font-medium text-white">{d.nick}</td>
                        <td className="px-6 py-4 text-emerald-400">{d.role || 'Membro'}</td>
                        <td className="px-6 py-4">{formatPower(d.start_power)}</td>
                        <td className="px-6 py-4">{formatPower(d.end_power)}</td>
                        <td className="px-6 py-4">
                          <div className={`flex items-center gap-1 ${d.diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {d.diff >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            {formatPower(Math.abs(d.diff))}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {compareData.filter(d => (statusTab === 'ativos' ? d.status === 'ativo' : d.status === 'inativo') && (selectedRole === 'all' || (d.role || 'Membro') === selectedRole)).length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                          Nenhum dado registrado para membros {statusTab}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
