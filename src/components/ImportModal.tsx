import React, { useState } from 'react';
import { X, UserPlus, UserCheck, UserMinus } from 'lucide-react';

interface ImportModalProps {
  unknownNicks: string[];
  members: any[];
  onConfirm: (mappings: Record<string, any>) => void;
  onCancel: () => void;
}

export default function ImportModal({ unknownNicks, members, onConfirm, onCancel }: ImportModalProps) {
  const [mappings, setMappings] = useState<Record<string, any>>({});
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentNick = unknownNicks[currentIndex];

  const handleAction = (action: 'associate' | 'ignore' | 'new', memberId?: number) => {
    const newMappings = {
      ...mappings,
      [currentNick]: { action, memberId }
    };
    setMappings(newMappings);

    if (currentIndex < unknownNicks.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onConfirm(newMappings);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Membro não encontrado</h2>
          <button onClick={onCancel} className="text-zinc-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="text-center">
            <p className="text-zinc-400 mb-2">O nick abaixo não foi encontrado no sistema:</p>
            <h3 className="text-2xl font-bold text-emerald-400">"{currentNick}"</h3>
            <p className="text-xs text-zinc-500 mt-2">({currentIndex + 1} de {unknownNicks.length})</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => handleAction('new')}
              className="w-full flex items-center gap-3 bg-zinc-800 hover:bg-zinc-700 text-white p-4 rounded-xl transition-colors text-left"
            >
              <div className="bg-emerald-500/20 p-2 rounded-lg">
                <UserPlus className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="font-bold">Incluir como novo membro</div>
                <div className="text-xs text-zinc-400">Adiciona este nick à lista de membros</div>
              </div>
            </button>

            <div className="relative group">
              <div className="flex items-center gap-3 bg-zinc-800 p-4 rounded-xl text-white">
                <div className="bg-blue-500/20 p-2 rounded-lg">
                  <UserCheck className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1">
                  <div className="font-bold">Associar a membro existente</div>
                  <select
                    className="w-full bg-zinc-950 border border-zinc-700 rounded mt-1 px-2 py-1 text-sm"
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAction('associate', parseInt(e.target.value));
                      }
                    }}
                    value=""
                  >
                    <option value="">Selecione um membro...</option>
                    {members.sort((a, b) => a.nick.localeCompare(b.nick)).map(m => (
                      <option key={m.id} value={m.id}>{m.nick}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleAction('ignore')}
              className="w-full flex items-center gap-3 bg-zinc-800 hover:bg-zinc-700 text-white p-4 rounded-xl transition-colors text-left"
            >
              <div className="bg-red-500/20 p-2 rounded-lg">
                <UserMinus className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <div className="font-bold">Ignorar esta informação</div>
                <div className="text-xs text-zinc-400">Pula este registro e não importa nada</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
