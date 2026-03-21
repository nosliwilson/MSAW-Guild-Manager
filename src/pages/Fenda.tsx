import React, { useState, useEffect, useMemo } from 'react';
import { Upload, Gem, Info, AlertTriangle, Trash2, RotateCcw, TrendingUp, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { sortMembers, SortCriteria } from '../utils/sorting';
import ImportModal from '../components/ImportModal';
import SortSelector from '../components/SortSelector';
import Pagination from '../components/Pagination';

export default function Fenda({ fetchApi }: { fetchApi: any }) {
  const [data, setData] = useState<any[]>([]);
  const [season, setSeason] = useState<number>(1);
  const [selectedSeason, setSelectedSeason] = useState<number | 'all'>('all');
  const [allSeasons, setAllSeasons] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [statusTab, setStatusTab] = useState<'ativos' | 'inativos'>('ativos');
  const [viewTab, setViewTab] = useState<'historico' | 'comparacao' | 'seasons'>('historico');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [compareStart, setCompareStart] = useState('');
  const [compareEnd, setCompareEnd] = useState('');
  const [compareMode, setCompareMode] = useState<'period' | 'single'>('period');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [compareData, setCompareData] = useState<any[]>([]);
  const [closeDate, setCloseDate] = useState<string>('');
  const [seasonsData, setSeasonsData] = useState<any[]>([]);
  const [importPreview, setImportPreview] = useState<{ results: any[], unknownNicks: string[] } | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [sortCriteria, setSortCriteria] = useState<SortCriteria>('role');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(180);

  const loadMembers = async () => {
    const res = await fetchApi('/api/members');
    setMembers(await res.json());
  };

  const loadData = async (seasonNum?: number | 'all') => {
    const s = seasonNum ?? selectedSeason;
    const url = s === 'all' ? '/api/fenda' : `/api/fenda?season=${s}`;
    const res = await fetchApi(url);
    const json = await res.json();
    setData(json.data);
    setSeason(json.currentSeason);
    if (s === 'all') setSelectedSeason(json.currentSeason);

    // Set default date to latest if not already set or if switching seasons
    const dates = Array.from(new Set(json.data.map((d: any) => d.date))).sort((a: any, b: any) => (b as string).localeCompare(a as string));
    if (dates.length > 0 && (selectedDate === 'all' || !dates.includes(selectedDate))) {
      setSelectedDate(dates[0] as string);
    }
  };

  const loadAllSeasons = async () => {
    const res = await fetchApi('/api/fenda/seasons');
    const json = await res.json();
    setAllSeasons(json);
  };

  const loadSeasons = async () => {
    const res = await fetchApi('/api/fenda/seasons');
    const json = await res.json();
    setSeasonsData(json);
  };

  const loadComparison = async () => {
    if (compareMode === 'period' && (!compareStart || !compareEnd)) return;
    if (compareMode === 'single' && !compareStart) return;

    const end = compareMode === 'single' ? compareStart : compareEnd;
    const seasonParam = selectedSeason !== 'all' ? `&season=${selectedSeason}` : '';
    const res = await fetchApi(`/api/fenda/compare?start=${compareStart}&end=${end}${seasonParam}`);
    const json = await res.json();
    setCompareData(json.filter((d: any) => d.status !== 'inativo').map((d: any) => ({
      ...d,
      diff: d.end_value - d.start_value
    })).sort((a: any, b: any) => b.diff - a.diff));
  };

  useEffect(() => {
    loadData();
    loadMembers();
    loadAllSeasons();
  }, [fetchApi]);

  useEffect(() => {
    if (selectedSeason !== 'all') {
      loadData(selectedSeason);
    }
  }, [selectedSeason]);

  useEffect(() => {
    if (viewTab === 'comparacao') {
      loadComparison();
    } else if (viewTab === 'seasons') {
      loadSeasons();
    }
  }, [viewTab, compareStart, compareEnd, compareMode, selectedSeason]);

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
    if (!confirm('Tem certeza que deseja reabrir a season? Isso voltará a contagem da fenda para a season passada.')) return;
    try {
      await fetchApi('/api/fenda/reopen', { 
        method: 'POST',
        body: JSON.stringify({ season_number: seasonNumber })
      });
      loadData();
      if (viewTab === 'seasons') loadSeasons();
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
    return num.toLocaleString('pt-BR');
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const uniqueDates = Array.from(new Set(data.map(d => d.date))).sort((a, b) => (b as string).localeCompare(a as string));

  const filteredData = useMemo(() => {
    let filtered = data.filter(item => 
      (statusTab === 'ativos' ? item.status === 'ativo' : item.status === 'inativo') && 
      (selectedDate === 'all' || item.date === selectedDate)
    );

    // Join with members to get role and power for sorting
    const enriched = filtered.map(item => {
      const member = members.find(m => m.id === item.member_id || m.nick === item.nick);
      return {
        ...item,
        role: member?.role || 'Membro',
        power: member?.power || 0
      };
    });

    return sortMembers(enriched, sortCriteria);
  }, [data, statusTab, selectedDate, members, sortCriteria]);

  const totalCrystals = useMemo(() => {
    if (selectedDate === 'all') return 0;
    return filteredData.reduce((sum, item) => sum + Number(item.crystals), 0);
  }, [filteredData, selectedDate]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate, statusTab, sortCriteria, itemsPerPage]);

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
          Fenda (Season {selectedSeason === 'all' ? season : selectedSeason})
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
        <div className="flex flex-wrap gap-2">
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
            onClick={() => setViewTab('seasons')}
            className={`px-4 py-2 rounded-lg transition-colors ${viewTab === 'seasons' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            Histórico de Seasons
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-zinc-400">Season:</label>
            <select
              value={selectedSeason}
              onChange={(e) => {
                const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                setSelectedSeason(val);
                setSelectedDate('all');
                setCompareStart('');
                setCompareEnd('');
              }}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {allSeasons.map((s) => (
                <option key={s.season_number} value={s.season_number}>
                  Season {s.season_number} {s.is_active ? '(Atual)' : ''}
                </option>
              ))}
            </select>
          </div>

          {viewTab === 'historico' && (
            <div className="flex gap-2 border-l border-zinc-800 pl-4">
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
            
            <SortSelector criteria={sortCriteria} onChange={setSortCriteria} />

            {selectedDate !== 'all' && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-lg">
                <span className="text-xs text-zinc-400 block">Total de Cristais:</span>
                <span className="text-emerald-400 font-bold">{formatNumber(totalCrystals)}</span>
              </div>
            )}

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
              {paginatedData.map((item, index) => (
                <tr key={item.id} className="hover:bg-zinc-800/50">
                  <td className="px-6 py-4 font-medium text-zinc-500">#{(currentPage - 1) * itemsPerPage + index + 1}</td>
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
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                    Nenhum dado registrado para membros {statusTab} na fenda atual.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredData.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(filteredData.length / itemsPerPage)}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={setItemsPerPage}
            totalItems={filteredData.length}
          />
        )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 space-y-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Modo de Comparação</label>
                <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-700">
                  <button
                    onClick={() => setCompareMode('period')}
                    className={`px-3 py-1.5 rounded-md text-sm transition-colors ${compareMode === 'period' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
                  >
                    Período
                  </button>
                  <button
                    onClick={() => setCompareMode('single')}
                    className={`px-3 py-1.5 rounded-md text-sm transition-colors ${compareMode === 'single' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
                  >
                    Data Única
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">{compareMode === 'period' ? 'Data Inicial' : 'Data'}</label>
                <select
                  value={compareStart}
                  onChange={e => setCompareStart(e.target.value)}
                  className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white min-w-[150px]"
                >
                  <option value="">Selecione...</option>
                  {uniqueDates.map(date => (
                    <option key={date as string} value={date as string}>{formatDate(date as string)}</option>
                  ))}
                </select>
              </div>
              {compareMode === 'period' && (
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Data Final</label>
                  <select
                    value={compareEnd}
                    onChange={e => setCompareEnd(e.target.value)}
                    className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white min-w-[150px]"
                  >
                    <option value="">Selecione...</option>
                    {uniqueDates.map(date => (
                      <option key={date as string} value={date as string}>{formatDate(date as string)}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">Selecionar Membros (Dinâmico)</label>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-3 bg-zinc-950 rounded-lg border border-zinc-700">
                <button
                  onClick={() => setSelectedMembers([])}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${selectedMembers.length === 0 ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'}`}
                >
                  Todos
                </button>
                {Array.from(new Set(data.map(d => d.nick))).sort().map(nick => (
                  <button
                    key={nick as string}
                    onClick={() => {
                      if (selectedMembers.includes(nick as string)) {
                        setSelectedMembers(selectedMembers.filter(m => m !== nick));
                      } else {
                        setSelectedMembers([...selectedMembers, nick as string]);
                      }
                    }}
                    className={`px-3 py-1 rounded-full text-xs border transition-colors ${selectedMembers.includes(nick as string) ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'}`}
                  >
                    {nick as string}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {compareData.length > 0 && (
            <>
              <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={compareData.filter(d => selectedMembers.length === 0 || selectedMembers.includes(d.nick))} 
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                      <XAxis dataKey="nick" stroke="#a1a1aa" />
                      <YAxis 
                        stroke="#a1a1aa" 
                        tickFormatter={(val) => formatNumber(val)}
                        width={80}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff' }}
                        formatter={(value: number) => [formatNumber(value), compareMode === 'period' ? 'Evolução' : 'Cristais']}
                        labelStyle={{ color: '#a1a1aa' }}
                      />
                      <Bar dataKey={compareMode === 'period' ? "diff" : "end_value"} fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                <table className="w-full text-left text-sm text-zinc-400">
                  <thead className="bg-zinc-950/50 text-zinc-300">
                    <tr>
                      <th className="px-6 py-4 font-medium">Nick</th>
                      {compareMode === 'period' ? (
                        <>
                          <th className="px-6 py-4 font-medium">Cristais Iniciais</th>
                          <th className="px-6 py-4 font-medium">Cristais Finais</th>
                          <th className="px-6 py-4 font-medium">Evolução</th>
                        </>
                      ) : (
                        <th className="px-6 py-4 font-medium">Cristais</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {compareData
                      .filter(d => selectedMembers.length === 0 || selectedMembers.includes(d.nick))
                      .map((d, i) => (
                      <tr key={i} className="hover:bg-zinc-800/50">
                        <td className="px-6 py-4 font-medium text-white">{d.nick}</td>
                        {compareMode === 'period' ? (
                          <>
                            <td className="px-6 py-4">{formatNumber(d.start_value)}</td>
                            <td className="px-6 py-4">{formatNumber(d.end_value)}</td>
                            <td className="px-6 py-4">
                              <div className={`flex items-center gap-1 ${d.diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {d.diff >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                {formatNumber(Math.abs(d.diff))}
                              </div>
                            </td>
                          </>
                        ) : (
                          <td className="px-6 py-4">{formatNumber(d.end_value)}</td>
                        )}
                      </tr>
                    ))}
                    {compareData.filter(d => selectedMembers.length === 0 || selectedMembers.includes(d.nick)).length === 0 && (
                      <tr>
                        <td colSpan={compareMode === 'period' ? 4 : 2} className="px-6 py-8 text-center text-zinc-500">
                          Nenhum dado registrado para membros ativos na fenda atual.
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

      {viewTab === 'seasons' && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="bg-zinc-950/50 text-zinc-300">
              <tr>
                <th className="px-6 py-4 font-medium">Season</th>
                <th className="px-6 py-4 font-medium">Data de Fechamento</th>
                <th className="px-6 py-4 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {seasonsData.map((s) => (
                <tr key={s.id} className="hover:bg-zinc-800/50">
                  <td className="px-6 py-4 font-medium text-white">Season {s.season_number}</td>
                  <td className="px-6 py-4">{formatDate(s.closed_at)}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleReopen(s.season_number)}
                      className="text-zinc-400 hover:text-red-400 flex items-center gap-1"
                      title="Excluir fechamento e voltar para esta season"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {seasonsData.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-zinc-500">
                    Nenhum fechamento de season registrado.
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
              Selecione a data em que a fenda foi fechada. Isso iniciará um novo ciclo (Season {season + 1}).
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
