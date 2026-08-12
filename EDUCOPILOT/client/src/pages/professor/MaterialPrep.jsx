import React, { useState, useEffect } from 'react';
import api from '../../api/client';
import {
  Layers,
  Sparkles,
  Copy,
  Check,
  Presentation,
  FileText,
  FileCheck,
  BookOpen,
  ChevronRight,
  Upload,
  FileUp,
  HelpCircle,
  Download,
  AlertCircle,
  Eye,
} from 'lucide-react';

const MaterialPrep = () => {
  const [materials, setMaterials] = useState([]);
  const [activeMaterial, setActiveMaterial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  // Generator form state
  const [subject, setSubject] = useState('Computer Science');
  const [topic, setTopic] = useState('Distributed Consensus & Raft Protocol');
  const [type, setType] = useState('slides'); // 'slides' | 'notes' | 'assignment' | 'practice_questions'
  const [syllabusRef, setSyllabusRef] = useState('Chapter 2: Consensus Protocols');
  const [uploadFile, setUploadFile] = useState(null);
  const [rawText, setRawText] = useState('');

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      const res = await api.get('/professor/materials');
      setMaterials(res.data);
      if (res.data.length > 0 && !activeMaterial) {
        setActiveMaterial(res.data[0]);
      }
    } catch (err) {
      console.error('Failed to load materials:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setGenerating(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('subject', subject);
      formData.append('topic', topic);
      formData.append('type', type);
      formData.append('syllabusRef', syllabusRef);

      if (uploadFile) {
        formData.append('file', uploadFile);
      }
      if (rawText && rawText.trim()) {
        formData.append('rawText', rawText);
      }

      const res = await api.post('/professor/materials/generate-with-upload', formData);

      setMaterials([res.data, ...materials]);
      setActiveMaterial(res.data);
      setUploadFile(null);
      setRawText('');
    } catch (err) {
      console.error('Failed to generate material:', err);
      setError(err.response?.data?.error || err.message || 'Failed to generate material.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getFormatIcon = (t) => {
    switch (t) {
      case 'slides':
        return Presentation;
      case 'notes':
        return FileText;
      case 'assignment':
        return FileCheck;
      case 'practice_questions':
        return HelpCircle;
      default:
        return BookOpen;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
          <Presentation className="w-7 h-7 text-blue-600" />
          <span>AI Material Preparation (Slides, Notes & Questions)</span>
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Upload PDF textbooks or reference materials to generate grounded lecture slide outlines, comprehensive markdown notes, academic assignments with rubrics, or formative question banks.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl flex items-start gap-3 text-xs text-red-800 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form & Material History */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Generate Grounded Material
              </h2>
            </div>

            <form onSubmit={handleGenerate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Format Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none dark:text-white"
                  >
                    <option value="slides">Lecture Slides</option>
                    <option value="notes">Structured Notes</option>
                    <option value="assignment">Assignment with Rubric</option>
                    <option value="practice_questions">Practice Questions Bank</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Topic / Concept Focus
                </label>
                <input
                  type="text"
                  required
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Raft Consensus Algorithm & Invariants"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Syllabus Benchmark / Chapter Ref
                </label>
                <input
                  type="text"
                  value={syllabusRef}
                  onChange={(e) => setSyllabusRef(e.target.value)}
                  placeholder="Chapter 2: State Machine Replication"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none dark:text-white"
                />
              </div>

              {/* Direct File Attachment for RAG */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Attach PDF or Textbook Chapter (Optional)
                </label>
                {uploadFile ? (
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-xs">
                    <span className="font-bold text-blue-700 dark:text-blue-300 truncate max-w-[200px]">
                      {uploadFile.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setUploadFile(null)}
                      className="text-red-600 font-semibold hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center p-3 border-2 border-dashed rounded-xl cursor-pointer bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 border-slate-300 dark:border-slate-700 transition-colors">
                    <FileUp className="w-4 h-4 text-blue-600 mr-2" />
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      Upload PDF/Text document to ground generation
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.txt,.md"
                      onChange={(e) => setUploadFile(e.target.files[0] || null)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <button
                type="submit"
                disabled={generating}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.99] transition-all shadow-md shadow-blue-500/20 disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Synthesizing from Course Materials...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Grounded {type.toUpperCase()}</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Generated Materials Library */}
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Prepared Material Vault ({materials.length})</span>
            </h3>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading materials...</div>
            ) : materials.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No materials drafted yet.</div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {materials.map((m) => {
                  const Icon = getFormatIcon(m.type);
                  const isSelected = activeMaterial?._id === m._id;
                  return (
                    <button
                      key={m._id}
                      type="button"
                      onClick={() => setActiveMaterial(m)}
                      className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-900 dark:text-blue-200'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <Icon className="w-4 h-4 text-blue-600 shrink-0" />
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold truncate text-slate-900 dark:text-white">
                            {m.title || m.topic}
                          </p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                            {m.type} • {m.subject}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Material Viewer & Slide Preview Cards */}
        <div className="lg:col-span-7 space-y-6">
          {activeMaterial ? (
            <div className="p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                      {activeMaterial.type}
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      {activeMaterial.subject}
                    </span>
                  </div>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                    {activeMaterial.title || activeMaterial.topic}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      handleCopy(
                        typeof activeMaterial.content === 'object'
                          ? JSON.stringify(activeMaterial.content, null, 2)
                          : activeMaterial.content
                      )
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* RENDER SLIDES */}
              {activeMaterial.type === 'slides' && activeMaterial.content?.slides && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    {activeMaterial.content.slides.map((slide, idx) => (
                      <div
                        key={idx}
                        className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white shadow-md border border-slate-700 space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold">
                            SLIDE {slide.slideNumber || idx + 1}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">
                            EduCopilot Slide Deck
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-white">{slide.title}</h3>
                        <ul className="space-y-1.5 pl-4 list-disc text-xs text-slate-200">
                          {slide.bullets?.map((b, bi) => (
                            <li key={bi}>{b}</li>
                          ))}
                        </ul>

                        {slide.visualSuggestion && (
                          <div className="p-2.5 rounded-xl bg-blue-900/30 border border-blue-700/40 text-[11px] text-blue-200">
                            <strong>Visual:</strong> {slide.visualSuggestion}
                          </div>
                        )}

                        {slide.speakerNotes && (
                          <div className="pt-2 border-t border-slate-700/50 text-[11px] text-slate-400 italic">
                            <strong>Speaker Notes:</strong> {slide.speakerNotes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* RENDER NOTES */}
              {activeMaterial.type === 'notes' && (
                <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 font-sans text-sm leading-relaxed dark:text-slate-200 whitespace-pre-wrap">
                  {activeMaterial.content?.lectureNotes || JSON.stringify(activeMaterial.content, null, 2)}
                </div>
              )}

              {/* RENDER ASSIGNMENT */}
              {activeMaterial.type === 'assignment' && activeMaterial.content?.assignments && (
                <div className="space-y-4">
                  {activeMaterial.content.instructions && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-900 dark:text-amber-300">
                      <strong>Instructions:</strong> {activeMaterial.content.instructions}
                    </div>
                  )}
                  {activeMaterial.content.assignments.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                        <span>Question {idx + 1}</span>
                        <span className="text-blue-600 dark:text-blue-400">{item.points || 25} Points</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{item.question}</p>
                      {item.rubric && (
                        <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 text-[11px] text-blue-900 dark:text-blue-300">
                          <strong>Rubric:</strong> {item.rubric}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* RENDER PRACTICE QUESTIONS */}
              {activeMaterial.type === 'practice_questions' && activeMaterial.content?.practiceQuestions && (
                <div className="space-y-4">
                  {activeMaterial.content.practiceQuestions.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                        <span>Question {idx + 1} ({item.difficulty || 'Medium'})</span>
                        <span className="text-green-600 dark:text-green-400">{item.points || 10} Points</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{item.question}</p>
                      {item.modelAnswer && (
                        <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 text-xs text-green-900 dark:text-green-300">
                          <strong>Model Solution:</strong> {item.modelAnswer}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="py-24 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              Select or generate a course material to view grounded slides, notes, assignments, or practice questions.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MaterialPrep;
