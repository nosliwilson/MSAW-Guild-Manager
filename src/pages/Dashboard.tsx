import { useState, useEffect } from 'react';
import { Users, Shield, Swords, CalendarX } from 'lucide-react';

export default function Dashboard({ fetchApi }: { fetchApi: any }) {
  const [stats, setStats] = useState({
    activeMembers: 0,
    totalPower: 0,
    tournaments: 0,
    absences: 0
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [membersRes, powerRes, gtRes, tcRes, pgRes, absencesRes] = await Promise.all([
          fetchApi('/api/members'),
          fetchApi('/api/power'),
          fetchApi('/api/tournaments/guerra_total'),
          fetchApi('/api/tournaments/torneio_celeste'),
          fetchApi('/api/tournaments/pico_gloria'),
          fetchApi('/api/absences')
        ]);

        const members = await membersRes.json();
        const power = await powerRes.json();
        const gt = await gtRes.json();
        const tc = await tcRes.json();
        const pg = await pgRes.json();
        const absences = await absencesRes.json();

        const active = members.filter((m: any) => m.status === 'ativo').length;
        
        // Get latest power for each active member
        const latestPowerMap = new Map();
        power.forEach((p: any) => {
          if (p.status === 'ativo' && !latestPowerMap.has(p.member_id)) {
            latestPowerMap.set(p.member_id, p.power);
          }
        });
        const totalPower = Array.from(latestPowerMap.values()).reduce((a: any, b: any) => a + Number(b), 0);

        setStats({
          activeMembers: active,
          totalPower,
          tournaments: gt.filter((t: any) => t.status === 'ativo').length + tc.filter((t: any) => t.status === 'ativo').length + pg.filter((t: any) => t.status === 'ativo').length,
          absences: absences.filter((a: any) => a.status === 'ativo').reduce((a: any, b: any) => a + b.absences, 0)
        });
      } catch (e) {
        console.error(e);
      }
    };
    loadData();
  }, [fetchApi]);

  const formatPower = (power: number) => {
    if (power >= 1000000000) return (power / 1000000000).toFixed(2) + 'B';
    if (power >= 1000000) return (power / 1000000).toFixed(2) + 'M';
    return power.toLocaleString();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-zinc-400">Membros Ativos</p>
              <p className="text-2xl font-bold text-white">{stats.activeMembers}</p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-lg">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-zinc-400">Poder Total</p>
              <p className="text-2xl font-bold text-white">{formatPower(stats.totalPower)}</p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 text-purple-400 rounded-lg">
              <Swords className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-zinc-400">Registros de Torneio</p>
              <p className="text-2xl font-bold text-white">{stats.tournaments}</p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-500/10 text-red-400 rounded-lg">
              <CalendarX className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-zinc-400">Total de Faltas</p>
              <p className="text-2xl font-bold text-white">{stats.absences}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
