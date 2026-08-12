import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  FolderSync,
  Upload,
  FileText,
  Trash2,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  FileUp,
  BookOpen,
  CalendarDays,
  HelpCircle,
  Search,
  Shield,
} from 'lucide-react';

const StudentMaterials = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Form State for Student Personal Notes Upload
  const [docTitle, setDocTitle] = useState('');
  const [subject, setSubject] = useState('Computer Science');
  const [courseCode, setCourseCode] = useState('CS-301');
  const [file, setFile] = useState(null);
  const [rawText, setRawText] = useState('');

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await api.get('/rag/documents');
      setDocuments(res.data);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setUploading(true);
    setMessage('');
    setError('');

    try {
      const formData = new FormData();
      formData.append('docTitle', docTitle || (file ? file.name.replace(/\.[^/.]+$/, '') : 'My Study Notes'));
      formData.append('subject', subject);
      formData.append('courseCode', courseCode || '');

      if (file) {
        formData.append('file', file);
      }
      if (rawText && rawText.trim()) {
        formData.append('rawText', rawText);
      }

      const res = await api.post('/rag/upload', formData);

      setMessage(res.data.message || 'Successfully indexed notes into RAG knowledge base.');
      setFile(null);
      setRawText('');
      setDocTitle('');
      fetchDocuments();
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to upload notes.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (title, subj) => {
    if (!window.confirm(`Delete "${title}" from your indexed notes?`)) return;
    try {
      await api.delete(`/rag/documents/${encodeURIComponent(title)}?subject=${encodeURIComponent(subj)}`);
      fetchDocuments();
    } catch (err) {
      alert('Failed to delete document chunks.');
    }
  };

  const filteredDocs = documents.filter((d) =>
    `${d.docTitle} ${d.subject} ${d.courseCode}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <FolderSync className="w-7 h-7 text-blue-600" />
            <span>Personal RAG Knowledge Vault</span>
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Your uploaded notes and textbooks are strictly isolated to your account. No other student or user can see or query your files.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-xs font-semibold text-blue-700 dark:text-blue-300 shrink-0">
          <Shield className="w-4 h-4 text-blue-600" />
          <span>Private Vault: {user?.name}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Upload Form for Student */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Upload className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Upload Study Notes or Syllabus (PDF)
              </h2>
            </div>

            {message && (
              <div className="mb-4 p-3.5 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900/60 rounded-xl flex items-start gap-2.5 text-xs text-green-800 dark:text-green-300">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{message}</span>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Document / Notes Title
                </label>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="e.g. My Distributed Systems Notes"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Subject Tag
                  </label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Computer Science"
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Course Code
                  </label>
                  <input
                    type="text"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    placeholder="CS-301"
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none dark:text-white"
                  />
                </div>
              </div>

              {/* Upload PDF Option */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Upload PDF / Text Document
                </label>
                {file ? (
                  <div className="flex items-center justify-between p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <FileText className="w-5 h-5 text-blue-600 shrink-0" />
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {file.name}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          {(file.size / 1024).toFixed(1)} KB • Ready to index
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="text-xs text-red-600 dark:text-red-400 hover:underline shrink-0 ml-2 font-semibold"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-2xl cursor-pointer bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-700 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-2 pb-2">
                        <FileUp className="w-6 h-6 text-slate-400 mb-1" />
                        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                          Click to select PDF or Text document
                        </p>
                        <p className="text-[10px] text-slate-400">PDF, TXT, or MD (up to 15MB)</p>
                      </div>
                      <input
                        type="file"
                        accept=".pdf,.txt,.md"
                        onChange={(e) => {
                          const selected = e.target.files[0];
                          if (selected) {
                            setFile(selected);
                            if (!docTitle) {
                              setDocTitle(selected.name.replace(/\.[^/.]+$/, ''));
                            }
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Or Paste Raw Text */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Or Paste Notes Text
                </label>
                <textarea
                  rows={4}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Paste lecture notes, study summaries, or textbook excerpts..."
                  className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none dark:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={uploading || (!file && (!rawText || rawText.trim().length < 10))}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.99] transition-all shadow-md shadow-blue-500/20 disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Chunking & Indexing Notes...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Chunk & Index for RAG</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Active Documents Knowledge Base */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Available Course Knowledge Base ({documents.length})
                </h2>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter documents..."
                  className="pl-9 pr-3.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none dark:text-white"
                />
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading vector chunks...</div>
            ) : filteredDocs.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">
                No course documents found matching your filter.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDocs.map((doc, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                          {doc.subject}
                        </span>
                        {doc.courseCode && (
                          <span className="text-[11px] font-bold text-slate-500">
                            {doc.courseCode}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {doc.docTitle}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {doc.chunkCount} vector chunks • Approx {doc.totalTokens} tokens
                      </p>
                    </div>

                    {/* Quick RAG Action Shortcuts for Student */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        to="/student/doubt-chat"
                        className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 text-xs font-semibold inline-flex items-center gap-1 transition-colors border border-blue-200/60 dark:border-blue-900"
                        title="Ask a doubt grounded on this document"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>Ask Doubt</span>
                      </Link>

                      <Link
                        to="/student/study-plans"
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                        title="Generate a study plan using this material"
                      >
                        <CalendarDays className="w-3.5 h-3.5" />
                        <span>Plan</span>
                      </Link>

                      <button
                        onClick={() => handleDelete(doc.docTitle, doc.subject)}
                        className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors"
                        title="Delete your uploaded document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentMaterials;
