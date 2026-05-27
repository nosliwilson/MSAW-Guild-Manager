import React, { useState } from 'react';
import { Sparkles, Upload, Image as ImageIcon, Calendar, Check, AlertCircle, Trash2, Save, RefreshCw, Layers } from 'lucide-react';

interface AIImporterProps {
  fetchApi: any;
}

interface ParsedRecord {
  Nick: string;
  Power?: number;
  Guild?: string;
  Score?: number;
  Field?: string;
  Round?: number;
  Team?: string;
  Crystals?: number;
  Date: string;
}

export default function AIImporter({ fetchApi }: { fetchApi: any }) {
  // Processing states
  const [eventType, setEventType] = useState('power');
  const [targetDate, setTargetDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedImages, setSelectedImages] = useState<{ file: File; base64: string; preview: string }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorText, setErrorText] = useState('');
  
  // Results states
  const [parsedResults, setParsedResults] = useState<ParsedRecord[]>([]);
  const [savingCsv, setSavingCsv] = useState(false);
  const [savedCsvRecord, setSavedCsvRecord] = useState<any>(null);

  // Convert File to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileChange = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorText('');
    setSavedCsvRecord(null);

    const imagesToProcess = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (imagesToProcess.length === 0) {
      setErrorText('Apenas arquivos de imagem (PNG, JPG, JPEG) são permitidos.');
      return;
    }

    try {
      const newImages = await Promise.all(
        imagesToProcess.map(async (file) => {
          const base64 = await fileToBase64(file);
          const preview = URL.createObjectURL(file);
          return { file, base64, preview };
        })
      );
      setSelectedImages(prev => [...prev, ...newImages]);
    } catch (err) {
      console.error('Erro ao carregar imagens:', err);
      setErrorText('Ocorreu um erro ao processar as imagens selecionadas.');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileChange(e.dataTransfer.files);
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(selectedImages[index].preview);
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllImages = () => {
    selectedImages.forEach(img => URL.revokeObjectURL(img.preview));
    setSelectedImages([]);
    setParsedResults([]);
    setSavedCsvRecord(null);
  };

  // Call API to process images with AI
  const handleProcessImages = async () => {
    if (selectedImages.length === 0) {
      setErrorText('Por favor, selecione ou arraste pelo menos um print de tela do jogo.');
      return;
    }

    setProcessing(true);
    setParsedResults([]);
    setSavedCsvRecord(null);
    setErrorText('');
    
    // Dynamic loading status simulation
    const statuses = [
      'Estabelecendo conexão segura com o Google Gemini...',
      'Transmitindo capturas de tela comprimidas...',
      'Executando OCR neuronal de alta fidelidade...',
      'Segmentando as linhas da tabela de jogadores...',
      'Normalizando registros de dados e formatos comerciais...',
      'Estruturando e consolidando resultados em JSON...'
    ];

    let statusIdx = 0;
    setStatusMessage(statuses[0]);
    const interval = setInterval(() => {
      statusIdx = (statusIdx + 1) % statuses.length;
      setStatusMessage(statuses[statusIdx]);
    }, 4500);

    try {
      const imagesPayload = selectedImages.map(img => ({
        data: img.base64,
        mimeType: img.file.type || 'image/png'
      }));

      const res = await fetchApi('/api/admin/ai/process-screenshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: eventType,
          date: targetDate,
          images: imagesPayload
        })
      });

      clearInterval(interval);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Falha ao processar imagens através da IA.');
      }

      const body = await res.json();
      if (body.data && Array.isArray(body.data)) {
        setParsedResults(body.data);
        if (body.data.length === 0) {
          setErrorText('Nenhum jogador foi identificado nos prints de tela fornecidos. Verifique a qualidade da imagem.');
        }
      } else {
        throw new Error('Formato retornado pela inteligência artificial é inválido.');
      }
    } catch (err: any) {
      clearInterval(interval);
      setErrorText(err.message || 'Erro deconhecido ao processar capturas de tela.');
    } finally {
      setProcessing(false);
    }
  };

  // Save parsed results into system CSV
  const handleSaveAsCsv = async () => {
    if (parsedResults.length === 0) return;
    setSavingCsv(true);
    try {
      const res = await fetchApi('/api/admin/ai/save-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: eventType,
          date: targetDate,
          data: parsedResults
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Falha ao salvar CSV no repositório.');
      }

      const body = await res.json();
      setSavedCsvRecord(body.record);
      alert('Tabela convertida e salva como arquivo CSV com sucesso!');
    } catch (err: any) {
      alert('Erro ao salvar CSV: ' + err.message);
    } finally {
      setSavingCsv(false);
    }
  };

  // Editable fields handlers for client modifications BEFORE saving
  const handleEditCell = (index: number, key: keyof ParsedRecord, value: any) => {
    setParsedResults(prev => {
      const updated = [...prev];
      const rec = { ...updated[index] };
      if (key === 'Power' || key === 'Score' || key === 'Round' || key === 'Crystals') {
        const num = parseInt(value, 10);
        rec[key] = isNaN(num) ? undefined : num as any;
      } else {
        rec[key] = value as string;
      }
      updated[index] = rec;
      return updated;
    });
  };

  const handleDeleteRow = (index: number) => {
    setParsedResults(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      
      {/* Interactive AI Drag & Drop Importer */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-4 mb-6">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <h2 className="text-white font-medium">Extração OCR Avançada de Prints de Jogo</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Select Event Module */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              Evento do CSV de Destino
            </label>
            <select
              value={eventType}
              onChange={(e) => {
                setEventType(e.target.value);
                setParsedResults([]);
                setSavedCsvRecord(null);
              }}
              className="w-full bg-zinc-950 border border-zinc-800 text-white text-sm rounded-lg p-3 outline-none focus:border-emerald-500 transition-all"
            >
              <option value="power">Histórico de Poder (Geral)</option>
              <option value="guerra_total">Guerra Total</option>
              <option value="torneio_celeste">Torneio Celeste</option>
              <option value="pico_gloria">Pico de Glória</option>
              <option value="fenda">Fenda / Cristais</option>
              <option value="members">Cadastro / Membros</option>
            </select>
          </div>

          {/* Select Date */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Data para os Registros
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => {
                setTargetDate(e.target.value);
                setParsedResults([]);
                setSavedCsvRecord(null);
              }}
              className="w-full bg-zinc-950 border border-zinc-800 text-white text-sm rounded-lg p-3 outline-none focus:border-emerald-500 transition-all"
            />
          </div>

          {/* Prompt description badge */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              Regra do Prompt IA Pré-programado
            </label>
            <div className="h-[46px] rounded-lg bg-zinc-950 border border-zinc-800/80 px-3 py-2 text-xs text-zinc-400 flex items-center italic">
              {eventType === 'power' && 'OCR para Nick e Poder atual dos jogadores na tela.'}
              {eventType === 'guerra_total' && 'Transcreve Nick e Poder específicos de Guerra Total.'}
              {eventType === 'torneio_celeste' && 'Captura Nick, Guilda, Campo e Pontos Celestes.'}
              {eventType === 'pico_gloria' && 'Extrai Nick, Rodada da partida, Pontuação e Time.'}
              {eventType === 'fenda' && 'OCR para Nome e quantidade de Cristais obtidos.'}
              {eventType === 'members' && 'Identifica jogador (Nick) e registra data de entrada.'}
            </div>
          </div>
        </div>

        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
            isDragging 
              ? 'border-emerald-400 bg-emerald-500/5' 
              : selectedImages.length > 0 
                ? 'border-zinc-800 bg-zinc-950/20' 
                : 'border-zinc-800 hover:border-emerald-500/50 bg-zinc-950/40 hover:bg-zinc-950/60'
          }`}
          onClick={() => document.getElementById('ai-img-uploader')?.click()}
        >
          <input
            id="ai-img-uploader"
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileChange(e.target.files)}
          />

          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="p-4 bg-emerald-500/10 rounded-full text-emerald-400">
              <Upload className="w-8 h-8" />
            </div>
            <div>
              <p className="text-white font-medium text-sm">Arraste e solte seus prints de tela aqui</p>
              <p className="text-zinc-500 text-xs mt-1">Formatos suportados: PNG, JPG, JPEG (É aceito carregar múltiplos prints)</p>
            </div>
            <button
              type="button"
              className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-semibold transition-colors border border-zinc-700"
            >
              Selecionar Arquivos
            </button>
          </div>
        </div>

        {/* Selected Images List */}
        {selectedImages.length > 0 && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-zinc-500" />
                Prints Selecionados ({selectedImages.length})
              </h3>
              <button
                type="button"
                onClick={clearAllImages}
                className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remover todos
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {selectedImages.map((img, idx) => (
                <div key={idx} className="relative group aspect-[9/16] bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden flex flex-col justify-between">
                  <img src={img.preview} alt={img.file.name} className="w-full h-full object-cover" />
                  <div className="absolute top-1 right-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(idx);
                      }}
                      className="p-1 bg-black/80 hover:bg-red-500 text-zinc-400 hover:text-white rounded-md transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-black/75 p-1 transition-opacity">
                    <p className="text-[9px] text-zinc-300 truncate text-center">{img.file.name}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={handleProcessImages}
                disabled={processing || selectedImages.length === 0}
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black text-sm font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10"
              >
                {processing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processando com IA...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Processar com IA e Gerar Tabela</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {processing && (
          <div className="mt-6 flex flex-col items-center justify-center p-8 bg-zinc-950/40 rounded-xl border border-zinc-800/50 space-y-4">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
            <div className="text-center">
              <p className="text-white text-sm font-medium">{statusMessage}</p>
              <p className="text-zinc-500 text-xs mt-1">Este processo costuma levar entre 10 e 20 segundos dependendo de quantas imagens enviou.</p>
            </div>
          </div>
        )}

        {/* Error box */}
        {errorText && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Erro de Processamento</p>
              <p className="mt-0.5">{errorText}</p>
            </div>
          </div>
        )}
      </div>

      {/* 3. AI Generated Results & Interactive Preview */}
      {parsedResults.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-zinc-800 pb-4 mb-4 gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-white font-medium">
                <Check className="w-5 h-5 text-emerald-400" />
                <h2>Preview dos Dados Extraídos ({parsedResults.length} registros)</h2>
              </div>
              <p className="text-xs text-zinc-400 mt-1">Análise concluída com sucesso! Revise os valores na tabela abaixo antes de exportá-los para CSV.</p>
            </div>
            
            {!savedCsvRecord ? (
              <button
                type="button"
                onClick={handleSaveAsCsv}
                disabled={savingCsv}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {savingCsv ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Confirmar e Salvar em CSV
              </button>
            ) : (
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs flex flex-col gap-1 items-end">
                <span className="font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  Salvo com Sucesso!
                </span>
                <span>Nome: {savedCsvRecord.original_name}</span>
              </div>
            )}
          </div>

          <div className="overflow-x-auto border border-zinc-800 rounded-lg max-h-[500px]">
            <table className="w-full text-left text-sm text-zinc-400">
              <thead className="bg-zinc-950/80 text-zinc-300 sticky top-0 backdrop-blur-sm z-10 border-b border-zinc-800">
                <tr>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-zinc-500">Ações</th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">Nick</th>
                  
                  {/* Event Specific Headers */}
                  {(eventType === 'power' || eventType === 'guerra_total') && (
                    <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-right">Poder</th>
                  )}
                  {eventType === 'torneio_celeste' && (
                    <>
                      <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">Aliança</th>
                      <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-right">Pontuação</th>
                      <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">Campo</th>
                    </>
                  )}
                  {eventType === 'pico_gloria' && (
                    <>
                      <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-right">Rodada</th>
                      <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-right">Pontuação</th>
                      <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">Time</th>
                    </>
                  )}
                  {eventType === 'fenda' && (
                    <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-right">Cristais</th>
                  )}
                  
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 bg-zinc-900/30">
                {parsedResults.map((row, idx) => (
                  <tr key={idx} className="hover:bg-zinc-950/30 transition-colors">
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(idx)}
                        className="p-1 hover:bg-zinc-800 hover:text-red-400 rounded transition-colors text-zinc-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="px-4 py-1.5">
                      <input
                        type="text"
                        value={row.Nick}
                        onChange={(e) => handleEditCell(idx, 'Nick', e.target.value)}
                        className="bg-zinc-950/60 border border-zinc-800 focus:border-emerald-500 rounded px-2.5 py-1 text-white text-sm outline-none w-full"
                      />
                    </td>
                    
                    {/* Event Specific Cells */}
                    {(eventType === 'power' || eventType === 'guerra_total') && (
                      <td className="px-4 py-1.5 text-right">
                        <input
                          type="number"
                          value={row.Power ?? ''}
                          onChange={(e) => handleEditCell(idx, 'Power', e.target.value)}
                          className="bg-zinc-950/60 border border-zinc-800 focus:border-emerald-500 rounded px-2.5 py-1 text-white text-sm text-right outline-none max-w-[120px]"
                        />
                      </td>
                    )}

                    {eventType === 'torneio_celeste' && (
                      <>
                        <td className="px-4 py-1.5">
                          <input
                            type="text"
                            value={row.Guild ?? ''}
                            onChange={(e) => handleEditCell(idx, 'Guild', e.target.value)}
                            className="bg-zinc-950/60 border border-zinc-800 focus:border-emerald-500 rounded px-2.5 py-1 text-white text-sm outline-none"
                          />
                        </td>
                        <td className="px-4 py-1.5 text-right">
                          <input
                            type="number"
                            value={row.Score ?? ''}
                            onChange={(e) => handleEditCell(idx, 'Score', e.target.value)}
                            className="bg-zinc-950/60 border border-zinc-800 focus:border-emerald-500 rounded px-2.5 py-1 text-white text-sm text-right outline-none max-w-[100px]"
                          />
                        </td>
                        <td className="px-4 py-1.5">
                          <input
                            type="text"
                            value={row.Field ?? ''}
                            onChange={(e) => handleEditCell(idx, 'Field', e.target.value)}
                            className="bg-zinc-950/60 border border-zinc-800 focus:border-emerald-500 rounded px-2.5 py-1 text-white text-sm outline-none max-w-[100px]"
                          />
                        </td>
                      </>
                    )}

                    {eventType === 'pico_gloria' && (
                      <>
                        <td className="px-4 py-1.5 text-right">
                          <input
                            type="number"
                            value={row.Round ?? ''}
                            onChange={(e) => handleEditCell(idx, 'Round', e.target.value)}
                            className="bg-zinc-950/60 border border-zinc-800 focus:border-emerald-500 rounded px-2.5 py-1 text-white text-sm text-right outline-none max-w-[80px]"
                          />
                        </td>
                        <td className="px-4 py-1.5 text-right">
                          <input
                            type="number"
                            value={row.Score ?? ''}
                            onChange={(e) => handleEditCell(idx, 'Score', e.target.value)}
                            className="bg-zinc-950/60 border border-zinc-800 focus:border-emerald-500 rounded px-2.5 py-1 text-white text-sm text-right outline-none max-w-[100px]"
                          />
                        </td>
                        <td className="px-4 py-1.5">
                          <input
                            type="text"
                            value={row.Team ?? ''}
                            onChange={(e) => handleEditCell(idx, 'Team', e.target.value)}
                            className="bg-zinc-950/60 border border-zinc-800 focus:border-emerald-500 rounded px-2.5 py-1 text-white text-sm outline-none max-w-[100px]"
                          />
                        </td>
                      </>
                    )}

                    {eventType === 'fenda' && (
                      <td className="px-4 py-1.5 text-right">
                        <input
                          type="number"
                          value={row.Crystals ?? ''}
                          onChange={(e) => handleEditCell(idx, 'Crystals', e.target.value)}
                          className="bg-zinc-950/60 border border-zinc-800 focus:border-emerald-500 rounded px-2.5 py-1 text-white text-sm text-right outline-none max-w-[100px]"
                        />
                      </td>
                    )}

                    <td className="px-4 py-1.5 text-zinc-400 font-mono text-xs">{row.Date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 text-xs text-zinc-500 leading-relaxed italic border-t border-zinc-800/80 pt-3">
            * Para carregar de fato estes dados aos rankings do sistema, salve em CSV acima, e em seguida vá na aba <strong>&quot;Arquivos CSV&quot;</strong>, localize o arquivo gerado e clique em <strong>&quot;Visualizar / Importar&quot;</strong>.
          </div>
        </div>
      )}

    </div>
  );
}
