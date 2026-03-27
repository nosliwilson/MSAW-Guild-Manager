import { useState, useEffect } from 'react';
import { History, Trash2 } from 'lucide-react';

export default function ImportsHistory({ fetchApi, user }: { fetchApi: any, user: any }) {
  const [imports, setImports] = useState<any[]>([]);

  const loadImports = async () => {
    const res = await fetchApi('/api/imports');
    setImports(await res.json());
  };

  useEffect(() => {
    loadImports();
  }, [fetchApi]);

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir esta importação? Todos os registros associados a ela serão apagados. Esta ação não pode ser desfeita.')) return;
    try {
      await fetchApi(`/api/imports/${id}`, { method: 'DELETE' });
      loadImports();
      alert('Importação excluída com sucesso!');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const formatType = (type: string) => {
    const types: Record<string, string> = {
      'power': 'Poder',
      'guerra_total': 'Guerra Total',
      'torneio_celeste': 'Torneio Celeste',
      'pico_gloria': 'Pico de Glória',
      'fenda': 'Fenda',
      'members': 'Membros'
    };
    return types[type] || type;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <History className="w-6 h-6 text-emerald-400" />
          Histórico de Importações
        </h1>
      </div>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-left text-sm text-zinc-400">
          <thead className="bg-zinc-950/50 text-zinc-300">
            <tr>
              <th className="px-6 py-4 font-medium">ID</th>
              <th className="px-6 py-4 font-medium">Data/Hora</th>
              <th className="px-6 py-4 font-medium">Tipo</th>
              <th className="px-6 py-4 font-medium">Usuário</th>
              <th className="px-6 py-4 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {imports.map(imp => (
              <tr key={imp.id} className="hover:bg-zinc-800/50">
                <td className="px-6 py-4">{imp.id}</td>
                <td className="px-6 py-4">{new Date(imp.created_at).toLocaleString('pt-BR')}</td>
                <td className="px-6 py-4 font-medium text-white">{formatType(imp.type)}</td>
                <td className="px-6 py-4">{imp.username}</td>
                <td className="px-6 py-4">
                  {user.can_delete_imports && (
                    <button
                      onClick={() => handleDelete(imp.id)}
                      className="text-zinc-400 hover:text-red-400 flex items-center gap-1"
                      title="Excluir Importação (Rollback)"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {imports.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                  Nenhuma importação registrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
