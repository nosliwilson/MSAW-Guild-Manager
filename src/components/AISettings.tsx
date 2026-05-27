import React, { useState, useEffect } from 'react';
import { Key, Save, RefreshCw, AlertCircle, ShieldCheck, Eye, EyeOff, FileText, Sparkles, HelpCircle } from 'lucide-react';

interface AISettingsProps {
  fetchApi: any;
}

const DEFAULT_AI_RULES: Record<string, string> = {
  power: 'O nome do jogador (Nick) e o Poder de combate geral atual. Se for escrito em formato reduzido como 120M ou 120.5M, converta para número inteiro cheio.',
  guerra_total: 'O nome do jogador (Nick) e o Poder da equipe específico de Guerra Total. Use as mesmas regras de numerais.',
  torneio_celeste: 'O nome do jogador (Nick), a Aliança (Guild), a Pontuação acumulada (Score) e o Campo de Batalha correspondente (Field, ex: Campo 1, Campo 2, etc.).',
  pico_gloria: 'O nome do jogador (Nick), a Rodada disputada (Round), a Pontuação acumulada (Score) e o Time do jogador (Team).',
  fenda: 'O nome do jogador (Nick) e a quantidade acumulada de Cristais de Fenda (Crystals) mostrados no painel.',
  members: 'Apenas os nomes dos jogadores (Nick) presentes na lista de membros da guilda, para vinculação/cadastro de entrada.'
};

const EVENT_LABELS: Record<string, string> = {
  power: 'Histórico de Poder (Geral)',
  guerra_total: 'Guerra Total',
  torneio_celeste: 'Torneio Celeste',
  pico_gloria: 'Pico de Glória',
  fenda: 'Fenda / Cristais',
  members: 'Cadastro de Membros'
};

export default function AISettings({ fetchApi }: AISettingsProps) {
  // Key state
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<{ isSet: boolean, hasEnvKey: boolean }>({ isSet: false, hasEnvKey: false });
  const [savingKey, setSavingKey] = useState(false);

  // Rules state
  const [rules, setRules] = useState<Record<string, string>>({ ...DEFAULT_AI_RULES });
  const [loadingRules, setLoadingRules] = useState(true);
  const [savingRules, setSavingRules] = useState(false);

  useEffect(() => {
    loadKeyStatus();
    loadRules();
  }, []);

  const loadKeyStatus = async () => {
    try {
      const res = await fetchApi('/api/admin/config/gemini');
      if (res.ok) {
        const data = await res.json();
        setKeyStatus(data);
      }
    } catch (err) {
      console.error('Erro ao buscar status da chave:', err);
    }
  };

  const loadRules = async () => {
    setLoadingRules(true);
    try {
      const res = await fetchApi('/api/admin/config/ai-rules');
      if (res.ok) {
        const data = await res.json();
        setRules(data);
      }
    } catch (err) {
      console.error('Erro ao buscar regras customizadas de IA:', err);
    } finally {
      setLoadingRules(false);
    }
  };

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setSavingKey(true);
    try {
      const res = await fetchApi('/api/admin/config/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      if (res.ok) {
        alert('Chave de API do Google Gemini atualizada com sucesso!');
        setApiKey('');
        loadKeyStatus();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || 'Erro ao salvar chave.');
      }
    } catch (err: any) {
      alert('Erro ao se conectar com o servidor: ' + err.message);
    } finally {
      setSavingKey(false);
    }
  };

  const handleRuleChange = (key: string, val: string) => {
    setRules(prev => ({
      ...prev,
      [key]: val
    }));
  };

  const handleRestoreDefaultRule = (key: string) => {
    if (window.confirm(`Tem certeza que deseja restaurar a instrução padrão de ${EVENT_LABELS[key]}?`)) {
      handleRuleChange(key, DEFAULT_AI_RULES[key]);
    }
  };

  const handleSaveRules = async () => {
    setSavingRules(true);
    try {
      const res = await fetchApi('/api/admin/config/ai-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules }),
      });
      if (res.ok) {
        alert('Instruções e prompts customizados do Importador IA atualizados com sucesso!');
        loadRules();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || 'Erro ao salvar instruções.');
      }
    } catch (err: any) {
      alert('Erro ao se conectar com o servidor: ' + err.message);
    } finally {
      setSavingRules(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Secure Gemini API Key Row */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-emerald-400" />
            <h2 className="text-white font-medium">Chave de API Compartilhada (Google Gemini)</h2>
          </div>
          <div>
            {keyStatus.isSet ? (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Chave Ativa e Protegida
              </span>
            ) : keyStatus.hasEnvKey ? (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Configurado por .env local
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Não Configurada
              </span>
            )}
          </div>
        </div>

        <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
          Esta chave de API do Gemini será utilizada **globalmente** por todos os usuários do sistema ao utilizarem o <strong>Importador IA</strong>.
          <br />
          <span className="text-amber-500/80 text-xs font-medium">
            Segurança de chaves: Os usuários adicionados não conseguirão ler ou descriptografar a chave já salva no sistema, garantindo sua total segurança. Eles apenas usufruirão do poder da extração OCR sem ter acesso à credencial.
          </span>
        </p>

        <form onSubmit={handleSaveKey} className="flex gap-2 max-w-2xl relative">
          <div className="relative flex-1">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={keyStatus.isSet ? '••••••••••••••••••••••••••••••••••••••••' : 'Insira sua Google Gemini API Key...'}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 pl-3 pr-10 text-white text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none placeholder-zinc-600 transition-all font-mono"
              required
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button
            type="submit"
            disabled={savingKey || !apiKey.trim()}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {savingKey ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Atualizar Chave
          </button>
        </form>
      </div>

      {/* 2. Custom Prompts and event rules */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h2 className="text-white font-medium">Instruções Customizadas por Evento (Prompt Pré-programado)</h2>
          </div>
          <button
            onClick={handleSaveRules}
            disabled={loadingRules || savingRules}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {savingRules ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Salvar Todas as Instruções
          </button>
        </div>

        <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
          O modelo de inteligência artificial receberá as instruções abaixo especificadas para o tipo de evento escolhido ao ler os prints de tela.
          Edite as orientações comerciais ou particularidades do print de tela de cada evento (ex: formatos de pontuação, recortes, ou palavras-chave comuns de OCR) para ajustar a precisão.
        </p>

        {loadingRules ? (
          <div className="flex items-center justify-center p-12 text-zinc-500 gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
            <span>Carregando instruções de importação de eventos...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.keys(DEFAULT_AI_RULES).map(key => (
              <div key={key} className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
                    <FileText className="w-4 h-4" />
                    {EVENT_LABELS[key]}
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleRestoreDefaultRule(key)}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1 italic cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Restaurar Padrão
                  </button>
                </div>
                
                <textarea
                  value={rules[key] || ''}
                  onChange={(e) => handleRuleChange(key, e.target.value)}
                  placeholder={`Instruções para ${EVENT_LABELS[key]}...`}
                  className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700/80 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none rounded-lg p-3 text-sm text-white h-24 transition-all"
                />
              </div>
            ))}
            
            <div className="flex justify-end pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={handleSaveRules}
                disabled={savingRules}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black text-sm font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
              >
                {savingRules ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Configurações de IA
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
