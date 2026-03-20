import { useState, useEffect } from 'react';
import { CalendarX } from 'lucide-react';

export default function Absences({ fetchApi }: { fetchApi: any }) {
  const [absences, setAbsences] = useState<any[]>([]);

  useEffect(() => {
    const loadAbsences = async () => {
      const res = await fetchApi('/api/absences');
      setAbsences(await res.json());
    };
    loadAbsences();
  }, [fetchApi]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <CalendarX className="w-6 h-6 text-red-400" />
          Controle de Faltas
        </h1>
      </div>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-800 bg-zinc-950/50">
          <p className="text-sm text-zinc-400">
            O sistema verifica automaticamente se um membro ativo participou dos torneios registrados.
            Membros que não aparecem nos registros de um dia de torneio recebem uma falta.
          </p>
        </div>
        <table className="w-full text-left text-sm text-zinc-400">
          <thead className="bg-zinc-950/50 text-zinc-300">
            <tr>
              <th className="px-6 py-4 font-medium">Nick</th>
              <th className="px-6 py-4 font-medium">Total de Faltas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {absences.map((item, i) => (
              <tr key={i} className="hover:bg-zinc-800/50">
                <td className="px-6 py-4 font-medium text-white">{item.nick}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    item.absences > 3 ? 'bg-red-500/20 text-red-400' : 
                    item.absences > 1 ? 'bg-yellow-500/20 text-yellow-400' : 
                    'bg-zinc-800 text-zinc-300'
                  }`}>
                    {item.absences} {item.absences === 1 ? 'falta' : 'faltas'}
                  </span>
                </td>
              </tr>
            ))}
            {absences.length === 0 && (
              <tr>
                <td colSpan={2} className="px-6 py-8 text-center text-zinc-500">
                  Nenhuma falta registrada para membros ativos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
