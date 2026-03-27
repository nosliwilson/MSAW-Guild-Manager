import React, { useState, useEffect } from 'react';
import { Upload, FileText, Download, Trash2, X, Database } from 'lucide-react';

interface CSVImportButtonProps {
  type: string;
  fetchApi: any;
  onPreview: (preview: any) => void;
  onUploading: (uploading: boolean) => void;
  disabled?: boolean;
}

export default function CSVImportButton({ type, fetchApi, onPreview, onUploading, disabled }: CSVImportButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [storedCsvs, setStoredCsvs] = useState<any[]>([]);
  const [loadingStored, setLoadingStored] = useState(false);
  const [storeOnServer, setStoreOnServer] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'stored'>('upload');

  const loadStoredCsvs = async () => {
    setLoadingStored(true);
    try {
      const res = await fetchApi('/api/stored-csvs');
      const data = await res.json();
      // Filter by type
      setStoredCsvs(data.filter((csv: any) => csv.type === type));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStored(false);
    }
  };

  useEffect(() => {
    if (showModal && activeTab === 'stored') {
      loadStoredCsvs();
    }
  }, [showModal, activeTab]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setShowModal(false);
    onUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('store', storeOnServer.toString());

    try {
      const res = await fetchApi(`/api/upload/${type}/preview`, {
        method: 'POST',
        body: formData
      });
      const preview = await res.json();
      onPreview(preview);
    } catch (err: any) {
      alert(err.message);
      onUploading(false);
    } finally {
      e.target.value = '';
    }
  };

  const handleSelectStored = async (csvId: number) => {
    setShowModal(false);
    onUploading(true);
    try {
      const res = await fetchApi(`/api/stored-csvs/${csvId}/preview`);
      const preview = await res.json();
      onPreview(preview);
    } catch (err: any) {
      alert(err.message);
      onUploading(false);
    }
  };

  const handleDeleteStored = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este arquivo?')) return;
    try {
      await fetchApi(`/api/stored-csvs/${id}`, { method: 'DELETE' });
      loadStoredCsvs();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={disabled}
        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
      >
        <Upload className="w-4 h-4" />
        Importar CSV
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-400" />
                Importar Dados
              </h2>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex border-b border-zinc-800">
              <button
                onClick={() => setActiveTab('upload')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'upload' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-400/5' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
              >
                Novo Upload
              </button>
              <button
                onClick={() => setActiveTab('stored')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'stored' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-400/5' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
              >
                Arquivos Armazenados
              </button>
            </div>

            <div className="p-6 flex-1 overflow-auto">
              {activeTab === 'upload' ? (
                <div className="space-y-6">
                  <div className="border-2 border-dashed border-zinc-700 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-emerald-500/50 transition-colors relative">
                    <Upload className="w-12 h-12 text-zinc-500 mb-4" />
                    <p className="text-zinc-300 mb-2">Clique ou arraste o arquivo CSV para importar</p>
                    <p className="text-xs text-zinc-500">Apenas arquivos .csv são aceitos</p>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>

                  <label className="flex items-center gap-3 p-4 bg-zinc-950 rounded-lg border border-zinc-800 cursor-pointer hover:bg-zinc-900 transition-colors">
                    <input
                      type="checkbox"
                      checked={storeOnServer}
                      onChange={e => setStoreOnServer(e.target.checked)}
                      className="w-5 h-5 rounded border-zinc-700 text-emerald-600 focus:ring-emerald-500 bg-zinc-900"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-white">Armazenar este arquivo no servidor?</span>
                      <span className="text-xs text-zinc-500">Isso permitirá que você importe este arquivo novamente sem precisar fazer o upload.</span>
                    </div>
                  </label>
                </div>
              ) : (
                <div className="space-y-4">
                  {loadingStored ? (
                    <div className="text-center py-8 text-zinc-500">Carregando arquivos...</div>
                  ) : storedCsvs.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500">Nenhum arquivo armazenado para este tipo.</div>
                  ) : (
                    <div className="grid gap-3">
                      {storedCsvs.map(csv => (
                        <div key={csv.id} className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 flex items-center justify-between hover:border-emerald-500/30 transition-colors group">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-zinc-500" />
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-white">{csv.original_name}</span>
                              <span className="text-xs text-zinc-500">{new Date(csv.created_at).toLocaleString('pt-BR')}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSelectStored(csv.id)}
                              className="bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600 hover:text-white px-3 py-1.5 rounded text-xs font-medium transition-colors"
                            >
                              Selecionar
                            </button>
                            <button
                              onClick={() => handleDeleteStored(csv.id)}
                              className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-zinc-800 bg-zinc-950/50 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
