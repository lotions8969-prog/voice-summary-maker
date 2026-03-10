'use client';

import { useState, useRef, useCallback } from 'react';

type SummaryStyle = 'concise' | 'detailed' | 'bullets' | 'action';
type AppState = 'idle' | 'recording' | 'transcribing' | 'summarizing' | 'done' | 'error';

const STYLE_OPTIONS: { value: SummaryStyle; label: string; desc: string }[] = [
  { value: 'concise', label: '簡潔', desc: '3〜5行でコンパクトに' },
  { value: 'detailed', label: '詳細', desc: '重要ポイントを詳しく' },
  { value: 'bullets', label: '箇条書き', desc: '要点を整理して列挙' },
  { value: 'action', label: 'アクション', desc: 'TODO・決定事項を抽出' },
];

export default function Home() {
  const [appState, setAppState] = useState<AppState>('idle');
  const [transcription, setTranscription] = useState('');
  const [summary, setSummary] = useState('');
  const [summaryStyle, setSummaryStyle] = useState<SummaryStyle>('concise');
  const [errorMsg, setErrorMsg] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const resetState = () => {
    setTranscription('');
    setSummary('');
    setErrorMsg('');
    setAppState('idle');
  };

  const processAudio = async (file: File | Blob, name?: string) => {
    setAppState('transcribing');

    try {
      const formData = new FormData();
      const audioFile = file instanceof File ? file : new File([file], name || 'recording.webm', { type: 'audio/webm' });
      formData.append('audio', audioFile);

      const transcribeRes = await fetch('/api/transcribe', { method: 'POST', body: formData });
      const transcribeData = await transcribeRes.json();

      if (!transcribeRes.ok) throw new Error(transcribeData.error);

      const text = transcribeData.text;
      setTranscription(text);
      setAppState('summarizing');

      const summarizeRes = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, style: summaryStyle }),
      });
      const summarizeData = await summarizeRes.json();

      if (!summarizeRes.ok) throw new Error(summarizeData.error);

      setSummary(summarizeData.summary);
      setAppState('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'エラーが発生しました');
      setAppState('error');
    }
  };

  const handleFileSelect = (file: File) => {
    processAudio(file, file.name);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
      handleFileSelect(file);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryStyle]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        processAudio(blob);
      };

      recorder.start();
      setAppState('recording');
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      setErrorMsg('マイクへのアクセスが許可されていません');
      setAppState('error');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const isProcessing = appState === 'transcribing' || appState === 'summarizing';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-500/30 mb-4">
            <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            音声要約メーカー
          </h1>
          <p className="text-slate-400 mt-2">音声・録音を自動で文字起こし＆AI要約</p>
        </div>

        {/* Summary Style Selector */}
        {appState === 'idle' && (
          <div className="mb-6">
            <p className="text-sm text-slate-400 mb-3 text-center">要約スタイルを選択</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STYLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSummaryStyle(opt.value)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    summaryStyle === opt.value
                      ? 'border-purple-500 bg-purple-500/20 text-white'
                      : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  <div className="font-medium text-sm">{opt.label}</div>
                  <div className="text-xs mt-0.5 opacity-70">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main Area - Idle */}
        {appState === 'idle' && (
          <div className="space-y-4">
            {/* Drop Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-purple-400 bg-purple-500/10'
                  : 'border-slate-600 hover:border-slate-500 bg-slate-800/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
              <svg className="w-12 h-12 text-slate-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              <p className="text-slate-300 font-medium">音声ファイルをドロップ</p>
              <p className="text-slate-500 text-sm mt-1">または クリックして選択 (MP3, WAV, M4A, WebM...)</p>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-700" />
              <span className="text-slate-500 text-sm">または</span>
              <div className="flex-1 h-px bg-slate-700" />
            </div>

            {/* Record Button */}
            <button
              onClick={startRecording}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 font-medium transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="4" />
              </svg>
              マイクで録音して要約
            </button>
          </div>
        )}

        {/* Recording State */}
        {appState === 'recording' && (
          <div className="text-center py-10">
            <div className="relative inline-flex">
              <div className="w-24 h-24 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center">
                <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-30" />
            </div>
            <p className="text-2xl font-mono mt-4 text-red-400">{formatTime(recordingTime)}</p>
            <p className="text-slate-400 mt-1 mb-6">録音中...</p>
            <button
              onClick={stopRecording}
              className="px-8 py-3 rounded-xl bg-red-500/20 border border-red-500 text-red-400 hover:bg-red-500/30 transition-all font-medium"
            >
              停止して要約
            </button>
          </div>
        )}

        {/* Processing State */}
        {isProcessing && (
          <div className="text-center py-10">
            <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto" />
            <p className="text-lg font-medium mt-4">
              {appState === 'transcribing' ? '文字起こし中...' : 'AI要約生成中...'}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              {appState === 'transcribing' ? 'Whisper AIが音声を解析しています' : 'Claude AIが要約を作成しています'}
            </p>
          </div>
        )}

        {/* Error State */}
        {appState === 'error' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-red-400 font-medium">{errorMsg}</p>
            <button onClick={resetState} className="mt-4 px-6 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-all text-sm">
              やり直す
            </button>
          </div>
        )}

        {/* Results */}
        {appState === 'done' && (
          <div className="space-y-4">
            {/* Summary Card */}
            <div className="rounded-2xl bg-gradient-to-br from-purple-900/50 to-pink-900/30 border border-purple-500/30 p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-purple-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </span>
                  <h2 className="font-semibold text-purple-300">AI要約</h2>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    {STYLE_OPTIONS.find((s) => s.value === summaryStyle)?.label}
                  </span>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(summary)}
                  className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  コピー
                </button>
              </div>
              <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">{summary}</p>
            </div>

            {/* Transcription Card */}
            <details className="rounded-2xl bg-slate-800/50 border border-slate-700 overflow-hidden">
              <summary className="px-6 py-4 cursor-pointer flex items-center justify-between text-slate-300 hover:text-white transition-colors">
                <span className="font-medium flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  文字起こし全文
                </span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-6 pb-6 border-t border-slate-700 pt-4">
                <div className="flex justify-end mb-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(transcription)}
                    className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    コピー
                  </button>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{transcription}</p>
              </div>
            </details>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={resetState}
                className="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 transition-all font-medium"
              >
                新しい音声を処理
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([`【要約】\n${summary}\n\n【文字起こし全文】\n${transcription}`], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `音声要約_${new Date().toLocaleDateString('ja-JP').replace(/\//g, '-')}.txt`;
                  a.click();
                }}
                className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 transition-all font-medium flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                テキストで保存
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
