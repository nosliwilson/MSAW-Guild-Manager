import { useState, useEffect, useMemo } from 'react';
import { CalendarX, Info, X, Check, AlertCircle, Filter, RotateCcw } from 'lucide-react';

export default function Absences({ fetchApi }: { fetchApi: any }) {
  const [absences, setAbsences] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'ativos' | 'inativos'>('ativos');
  const [selectedAbsence, setSelectedAbsence] = useState<any>(null);
  const [justificationType, setJustificationType] = useState<'Abonado' | 'Em Observação' | ''>('');
  const [justificationNote, setJustificationNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');

  const loadAbsences = async () => {
    const res = await fetchApi('/api/absences');
    setAbsences(await res.json());
  };

  useEffect(() => {
    loadAbsences();
  }, [fetchApi]);

  const handleSaveJustification = async () => {
    if (!selectedAbsence) return;
    setSaving(true);
    try {
      if (justificationType === '') {
        await fetchApi('/api/absences/justification', {
          method: 'DELETE',
          body: JSON.stringify({
            member_id: selectedAbsence.member_id,
            date: selectedAbsence.date,
            tournament_type: selectedAbsence.tournament_type
          })
        });
      } else {
        await fetchApi('/api/absences/justification', {
          method: 'POST',
          body: JSON.stringify({
            member_id: selectedAbsence.member_id,
            date: selectedAbsence.date,
            tournament_type: selectedAbsence.tournament_type,
            type: justificationType,
            note: justificationNote
          })
        });
      }
      await loadAbsences();
      setSelectedAbsence(null);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const getTournamentName = (type: string) => {
    switch (type) {
      case 'guerra_total': return 'Guerra Total';
      case 'torneio_celeste': return 'Torneio Celeste';
      case 'pico_gloria': return 'Pico de Glória';
      default: return type;
    }
  };

  const filteredAbsences = useMemo(() => {
    return absences.map(member => {
      // Sort missed dates by date descending (most recent first)
      let filteredMissedDates = [...member.missedDates].sort((a, b) => b.date.localeCompare(a.date));

      // Apply time filter
      if (timeFilter !== 'all') {
        const now = new Date();
        const days = parseInt(timeFilter);
        const cutoff = new Date();
        cutoff.setDate(now.getDate() - days);
        filteredMissedDates = filteredMissedDates.filter(m => new Date(m.date) >= cutoff);
      }

      // Apply event filter
      if (eventFilter !== 'all') {
        const limit = parseInt(eventFilter);
        filteredMissedDates = filteredMissedDates.slice(0, limit);
      }

      // Recalculate totals for the filtered list
      const totals = filteredMissedDates.reduce((acc, curr) => {
        acc.total++;
        const type = curr.justification?.type;
        if (type === 'Abonado') acc.abonado++;
        else if (type === 'Em Observação') acc.observacao++;
        else acc.injustificada++;
        return acc;
      }, { total: 0, injustificada: 0, observacao: 0, abonado: 0 });

      return {
        ...member,
        missedDates: filteredMissedDates,
        totals
      };
    });
  }, [absences, timeFilter, eventFilter]);

  const displayAbsences = filteredAbsences.filter(a => activeTab === 'ativos' ? a.status === 'ativo' : a.status === 'inativo');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <CalendarX className="w-6 h-6 text-red-400" />
          Controle de Faltas
        </h1>
      </div>

      <div className="flex gap-2 border-b border-zinc-800 pb-4">
        <button
          onClick={() => setActiveTab('ativos')}
          className={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'ativos' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
        >
          Ativos
        </button>
        <button
          onClick={() => setActiveTab('inativos')}
          className={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'inativos' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
        >
          Arquivo Morto (Inativos)
        </button>
      </div>

      <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-400" />
          <span className="text-sm font-medium text-zinc-300">Filtros:</span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500 uppercase tracking-wider">Tempo:</label>
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">Todo o histórico</option>
            <option value="7">1 Semana</option>
            <option value="14">2 Semanas</option>
            <option value="21">3 Semanas</option>
            <option value="30">1 Mês</option>
            <option value="60">2 Meses</option>
            <option value="90">3 Meses</option>
            <option value="120">4 Meses</option>
            <option value="150">5 Meses</option>
            <option value="180">6 Meses</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500 uppercase tracking-wider">Eventos:</label>
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">Todos os eventos</option>
            <option value="5">Últimos 5</option>
            <option value="10">Últimos 10</option>
            <option value="20">Últimos 20</option>
            <option value="50">Últimos 50</option>
            <option value="100">Últimos 100</option>
          </select>
        </div>

        {(timeFilter !== 'all' || eventFilter !== 'all') && (
          <button
            onClick={() => {
              setTimeFilter('all');
              setEventFilter('all');
            }}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors ml-auto"
          >
            <RotateCcw className="w-3 h-3" />
            Limpar Filtros
          </button>
        )}
      </div>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-800 bg-zinc-950/50">
          <p className="text-sm text-zinc-400">
            O sistema verifica automaticamente se um membro participou dos torneios registrados.
            Membros que não aparecem nos registros de um dia de torneio recebem uma falta.
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-zinc-300">Injustificada</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
              <span className="text-zinc-300">Em Observação</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
              <span className="text-zinc-300">Abonada</span>
            </div>
          </div>
        </div>
        <table className="w-full text-left text-sm text-zinc-400">
          <thead className="bg-zinc-950/50 text-zinc-300">
            <tr>
              <th className="px-6 py-4 font-medium w-16 text-center">#</th>
              <th className="px-6 py-4 font-medium">Nick</th>
              <th className="px-6 py-4 font-medium">Resumo de Faltas</th>
              <th className="px-6 py-4 font-medium">Datas das Faltas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {displayAbsences.map((item, i) => (
              <tr key={i} className="hover:bg-zinc-800/50 align-top">
                <td className="px-6 py-4 font-medium text-zinc-500 text-center">{i + 1}</td>
                <td className="px-6 py-4 font-medium text-white">{item.nick}</td>
                <td className="px-6 py-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs text-zinc-500">Total:</span>
                      <span className="font-bold text-white">{item.totals.total}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs text-zinc-500">Injustificadas:</span>
                      <span className="text-red-400 font-medium">{item.totals.injustificada}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs text-zinc-500">Em Observação:</span>
                      <span className="text-orange-400 font-medium">{item.totals.observacao}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs text-zinc-500">Abonadas:</span>
                      <span className="text-emerald-400 font-medium">{item.totals.abonado}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-2">
                    {item.missedDates.map((miss: any, idx: number) => {
                      const type = miss.justification?.type;
                      let bgColor = 'bg-red-500/20 border-red-500/50 text-red-400';
                      if (type === 'Abonado') bgColor = 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400';
                      if (type === 'Em Observação') bgColor = 'bg-orange-500/20 border-orange-500/50 text-orange-400';

                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            setSelectedAbsence({ ...miss, member_id: item.member_id, nick: item.nick });
                            setJustificationType(miss.justification?.type || '');
                            setJustificationNote(miss.justification?.note || '');
                          }}
                          className={`px-2 py-1 rounded border text-[10px] font-medium transition-all hover:scale-105 ${bgColor}`}
                          title={`${getTournamentName(miss.tournament_type)}${miss.justification?.note ? `: ${miss.justification.note}` : ''}`}
                        >
                          {formatDate(miss.date)}
                        </button>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
            {displayAbsences.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-zinc-500">
                  Nenhuma falta registrada para membros {activeTab}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedAbsence && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-white">Justificar Falta</h2>
                <p className="text-xs text-zinc-400">{selectedAbsence.nick} - {formatDate(selectedAbsence.date)}</p>
              </div>
              <button onClick={() => setSelectedAbsence(null)} className="text-zinc-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Torneio</label>
                <div className="bg-zinc-800 p-3 rounded-lg text-white text-sm">
                  {getTournamentName(selectedAbsence.tournament_type)}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Tipo de Justificativa</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setJustificationType('')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                      justificationType === '' ? 'bg-zinc-700 border-zinc-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                    }`}
                  >
                    Nenhuma
                  </button>
                  <button
                    onClick={() => setJustificationType('Abonado')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                      justificationType === 'Abonado' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                    }`}
                  >
                    Abonado
                  </button>
                  <button
                    onClick={() => setJustificationType('Em Observação')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                      justificationType === 'Em Observação' ? 'bg-orange-500/20 border-orange-500 text-orange-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                    }`}
                  >
                    Em Obs.
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Observação (Opcional)</label>
                <textarea
                  value={justificationNote}
                  onChange={(e) => setJustificationNote(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm h-24 focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Motivo da falta..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setSelectedAbsence(null)}
                  className="flex-1 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveJustification}
                  disabled={saving}
                  className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? 'Salvando...' : (
                    <>
                      <Check className="w-4 h-4" />
                      Salvar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
