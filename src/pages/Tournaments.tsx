import React, { useState, useEffect, useMemo } from 'react';
import { Upload, Swords, Info, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { sortMembers, SortCriteria } from '../utils/sorting';
import ImportModal from '../components/ImportModal';
import SortSelector from '../components/SortSelector';
import Pagination from '../components/Pagination';

export default function Tournaments({ fetchApi }: { fetchApi: any }) {
  const [activeTab, setActiveTab] = useState('guerra_total');
  const [statusTab, setStatusTab] = useState<'ativos' | 'inativos'>('ativos');
  const [viewTab, setViewTab] = useState<'historico' | 'comparacao'>('historico');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [selectedRound, setSelectedRound] = useState<string>('all');
  const [selectedGuild, setSelectedGuild] = useState<string>('all');
  const [selectedField, setSelectedField] = useState<string>('all');
  const [data, setData] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [compareStart, setCompareStart] = useState('');
  const [compareEnd, setCompareEnd] = useState('');
  const [compareMode, setCompareMode] = useState<'period' | 'single'>('period');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [compareData, setCompareData] = useState<any[]>([]);
  const [importPreview, setImportPreview] = useState<{ results: any[], unknownNicks: string[] } | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [sortCriteria, setSortCriteria] = useState<SortCriteria>('role');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(180);

  const loadMembers = async () => {
    const res = await fetchApi('/api/members');
    setMembers(await res.json());
  };

  useEffect(() => {
    setSelectedDate('all');
    setSelectedTeam('all');
    setSelectedRound('all');
    setSelectedGuild('all');
    setSelectedField('all');
  }, [activeTab]);

  const loadData = async (type: string) => {
    const res = await fetchApi(`/api/tournaments/${type}`);
    const json = await res.json();
    setData(json);

    // Set default date to latest if not already set or if switching tabs
    const dates = Array.from(new Set(json.map((d: any) => d.date))).sort((a: any, b: any) => (b as string).localeCompare(a as string));
    if (dates.length > 0 && (selectedDate === 'all' || !dates.includes(selectedDate))) {
      setSelectedDate(dates[0] as string);
    }
  };

  const loadComparison = async () => {
    if (compareMode === 'period' && (!compareStart || !compareEnd)) return;
    if (compareMode === 'single' && !compareStart) return;

    const end = compareMode === 'single' ? compareStart : compareEnd;
    const res = await fetchApi(`/api/tournaments/${activeTab}/compare?start=${compareStart}&end=${end}`);
    const json = await res.json();
    setCompareData(json.filter((d: any) => d.status !== 'inativo').map((d: any) => ({
      ...d,
      diff: d.end_value - d.start_value
    })).sort((a: any, b: any) => b.diff - a.diff));
  };

  useEffect(() => {
    if (viewTab === 'historico') {
      loadData(activeTab);
    } else {
      loadComparison();
    }
    loadMembers();
  }, [activeTab, viewTab, compareStart, compareEnd, compareMode, fetchApi]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setUploading(true);
    
    const formData = new FormData();
    formData.append('file', e.target.files[0]);
    
    try {
      const res = await fetchApi(`/api/upload/${activeTab}/preview`, {
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
      await fetchApi(`/api/upload/${activeTab}`, {
        method: 'POST',
        body: JSON.stringify({ results, mappings })
      });
      loadData(activeTab);
      alert('Importação concluída com sucesso!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
      setImportPreview(null);
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
    return power.toLocaleString('pt-BR');
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const uniqueDates = Array.from(new Set(data.map(d => d.date))).sort((a, b) => (b as string).localeCompare(a as string));
  const uniqueTeams = Array.from(new Set(data.map(d => String(d.team || 'Livre')))).sort();
  const uniqueRounds = Array.from(new Set(data.map(d => String(d.round)).filter(r => r !== 'undefined'))).sort((a, b) => Number(a) - Number(b));
  const uniqueGuilds = Array.from(new Set(data.map(d => String(d.guild)).filter(g => g !== 'undefined'))).sort();
  const uniqueFields = Array.from(new Set(data.map(d => String(d.field)).filter(f => f !== 'undefined'))).sort();

  const filteredData = useMemo(() => {
    let filtered = data.filter(item => {
      if (statusTab === 'ativos' && item.status !== 'ativo') return false;
      if (statusTab === 'inativos' && item.status !== 'inativo') return false;
      if (selectedDate !== 'all' && item.date !== selectedDate) return false;
      
      if (activeTab === 'pico_gloria') {
        if (selectedTeam !== 'all' && String(item.team || 'Livre') !== selectedTeam) return false;
        if (selectedRound !== 'all' && String(item.round) !== selectedRound) return false;
      }
      
      if (activeTab === 'torneio_celeste') {
        if (selectedGuild !== 'all' && String(item.guild) !== selectedGuild) return false;
        if (selectedField !== 'all' && String(item.field) !== selectedField) return false;
      }
      
      return true;
    });

    // Enriched with member info for sorting
    const enriched = filtered.map(item => {
      const member = members.find(m => m.id === item.member_id || m.nick === item.nick);
      return {
        ...item,
        role: member?.role || 'Membro',
        current_power: member?.power || 0
      };
    });

    return [...enriched].sort((a, b) => sortMembers(a, b, sortCriteria));
  }, [data, statusTab, selectedDate, activeTab, selectedTeam, selectedRound, selectedGuild, selectedField, members, sortCriteria]);

  const totalPoints = useMemo(() => {
    if (selectedDate === 'all') return 0;
    return filteredData.reduce((sum, item) => sum + Number(item.power || item.score || 0), 0);
  }, [filteredData, selectedDate]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate, statusTab, sortCriteria, itemsPerPage, activeTab, selectedTeam, selectedRound, selectedGuild, selectedField]);

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
                  <>
                    <li><code className="text-emerald-400">Pontuação</code> (Valor numérico)</li>
                    <li><code className="text-emerald-400">Data</code> (Opcional, formato DD/MM/YYYY)</li>
                  </>
                )}
                {activeTab === 'torneio_celeste' && (
                  <>
                    <li><code className="text-emerald-400">Guild</code> (Nome da guilda)</li>
                    <li><code className="text-emerald-400">Campo</code> (Nome do campo)</li>
                    <li><code className="text-emerald-400">Pontuação</code> (Valor numérico)</li>
                    <li><code className="text-emerald-400">Data</code> (Opcional, formato DD/MM/YYYY)</li>
                  </>
                )}
                {activeTab === 'pico_gloria' && (
                  <>
                    <li><code className="text-emerald-400">Rodada</code> (Número da rodada)</li>
                    <li><code className="text-emerald-400">Pontuação</code> (Valor numérico)</li>
                    <li><code className="text-emerald-400">Time</code> (Elite ou Livre)</li>
                    <li><code className="text-emerald-400">Data</code> (Opcional, formato DD/MM/YYYY)</li>
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

      <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
        <div className="flex gap-2">
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
            Comparação
          </button>
        </div>
      </div>

      {viewTab === 'historico' && (
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm text-zinc-400">Data:</label>
              <select
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white"
              >
                <option value="all">Todas</option>
                {uniqueDates.map(date => (
                  <option key={date as string} value={date as string}>{formatDate(date as string)}</option>
                ))}
              </select>
            </div>

            {activeTab === 'pico_gloria' && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-zinc-400">Time:</label>
                  <select
                    value={selectedTeam}
                    onChange={e => setSelectedTeam(e.target.value)}
                    className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="all">Todos</option>
                    {uniqueTeams.map(team => (
                      <option key={team as string} value={team as string}>{team as string}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-zinc-400">Rodada:</label>
                  <select
                    value={selectedRound}
                    onChange={e => setSelectedRound(e.target.value)}
                    className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="all">Todas</option>
                    {uniqueRounds.map(round => (
                      <option key={round as string} value={round as string}>{round as string}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {activeTab === 'torneio_celeste' && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-zinc-400">Guild:</label>
                  <select
                    value={selectedGuild}
                    onChange={e => setSelectedGuild(e.target.value)}
                    className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="all">Todas</option>
                    {uniqueGuilds.map(guild => (
                      <option key={guild as string} value={guild as string}>{guild as string}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-zinc-400">Campo:</label>
                  <select
                    value={selectedField}
                    onChange={e => setSelectedField(e.target.value)}
                    className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="all">Todos</option>
                    {uniqueFields.map(field => (
                      <option key={field as string} value={field as string}>{field as string}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {selectedDate !== 'all' && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-lg">
                <span className="text-xs text-zinc-400 block">Total de Pontos:</span>
                <span className="text-emerald-400 font-bold">{totalPoints.toLocaleString('pt-BR')}</span>
              </div>
            )}

            {selectedDate !== 'all' && (
              <button
                onClick={() => {
                  handleDeleteByDate(selectedDate);
                  setSelectedDate('all');
                }}
                className="flex items-center gap-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 px-4 py-2 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Excluir registros de {formatDate(selectedDate)}
              </button>
            )}
          </div>
          <div className="flex items-center gap-4">
            <SortSelector criteria={sortCriteria} onChange={setSortCriteria} />
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
        </div>
      )}

      {viewTab === 'historico' ? (
        <div className="space-y-4">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="bg-zinc-950/50 text-zinc-300">
              <tr>
                <th className="px-6 py-4 font-medium">Data</th>
                <th className="px-6 py-4 font-medium">Nick</th>
                
                {activeTab === 'guerra_total' && (
                  <th className="px-6 py-4 font-medium">Pontuação</th>
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
                    <th className="px-6 py-4 font-medium">Time</th>
                    <th className="px-6 py-4 font-medium">Rodada</th>
                    <th className="px-6 py-4 font-medium">Pontuação</th>
                  </>
                )}
                <th className="px-6 py-4 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {paginatedData.map(item => (
                <tr key={item.id} className="hover:bg-zinc-800/50">
                  <td className="px-6 py-4">{formatDate(item.date)}</td>
                  <td className="px-6 py-4 font-medium text-white">{item.nick}</td>
                  
                  {activeTab === 'guerra_total' && (
                    <td className="px-6 py-4 text-emerald-400">{formatPower(Number(item.power))}</td>
                  )}
                  
                  {activeTab === 'torneio_celeste' && (
                    <>
                      <td className="px-6 py-4">{item.guild}</td>
                      <td className="px-6 py-4">{item.field}</td>
                      <td className="px-6 py-4 text-emerald-400">{(item.score || 0).toLocaleString('pt-BR')}</td>
                    </>
                  )}
                  
                  {activeTab === 'pico_gloria' && (
                    <>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.team === 'Elite' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                          {item.team || 'Livre'}
                        </span>
                      </td>
                      <td className="px-6 py-4">{item.round}</td>
                      <td className="px-6 py-4 text-emerald-400">{(item.score || 0).toLocaleString('pt-BR')}</td>
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
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-zinc-500">
                    Nenhum dado registrado para membros {statusTab} neste torneio.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredData.length > 0 && (
          <div className="mt-4">
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(filteredData.length / itemsPerPage)}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={setItemsPerPage}
              totalItems={filteredData.length}
            />
          </div>
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
                        tickFormatter={(val) => activeTab === 'guerra_total' ? formatPower(val) : val.toLocaleString()}
                        width={80}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff' }}
                        formatter={(value: number) => [activeTab === 'guerra_total' ? formatPower(value) : value.toLocaleString(), compareMode === 'period' ? 'Evolução' : 'Pontuação']}
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
                          <th className="px-6 py-4 font-medium">Valor Inicial</th>
                          <th className="px-6 py-4 font-medium">Valor Final</th>
                          <th className="px-6 py-4 font-medium">Evolução</th>
                        </>
                      ) : (
                        <th className="px-6 py-4 font-medium">Pontuação</th>
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
                            <td className="px-6 py-4">{activeTab === 'guerra_total' ? formatPower(d.start_value) : d.start_value.toLocaleString()}</td>
                            <td className="px-6 py-4">{activeTab === 'guerra_total' ? formatPower(d.end_value) : d.end_value.toLocaleString()}</td>
                            <td className="px-6 py-4">
                              <div className={`flex items-center gap-1 ${d.diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {d.diff >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                {activeTab === 'guerra_total' ? formatPower(Math.abs(d.diff)) : Math.abs(d.diff).toLocaleString()}
                              </div>
                            </td>
                          </>
                        ) : (
                          <td className="px-6 py-4">{activeTab === 'guerra_total' ? formatPower(d.end_value) : d.end_value.toLocaleString()}</td>
                        )}
                      </tr>
                    ))}
                    {compareData.filter(d => selectedMembers.length === 0 || selectedMembers.includes(d.nick)).length === 0 && (
                      <tr>
                        <td colSpan={compareMode === 'period' ? 4 : 2} className="px-6 py-8 text-center text-zinc-500">
                          Nenhum dado registrado para membros ativos neste torneio.
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
