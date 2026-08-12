import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import confetti from 'canvas-confetti';
import {
  FileCheck2,
  Sparkles,
  Award,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  RotateCcw,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  HelpCircle,
  FileUp,
  TrendingUp,
  BookmarkPlus,
  Layers,
  AlertCircle,
  Flame,
} from 'lucide-react';

const PracticeTests = () => {
  // Test Config State
  const [subject, setSubject] = useState('Computer Science');
  const [topic, setTopic] = useState('Distributed Consensus & Graph Algorithms');
  const [difficulty, setDifficulty] = useState('Medium');
  const [questionCount, setQuestionCount] = useState(4);
  const [questionType, setQuestionType] = useState('Mixed'); // 'MCQ' | 'TrueFalse' | 'FillBlank' | 'ShortAnswer' | 'Mixed'
  const [uploadFile, setUploadFile] = useState(null);
  const [rawText, setRawText] = useState('');

  // Flow State: 'config' | 'running' | 'results'
  const [mode, setMode] = useState('config');
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Active Test State
  const [currentTest, setCurrentTest] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(300); // 5 mins
  const [evaluatedResult, setEvaluatedResult] = useState(null);

  // Timer Effect
  useEffect(() => {
    let timer = null;
    if (mode === 'running' && timeRemaining > 0) {
      timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleSubmitTest();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [mode, timeRemaining]);

  const handleStartTest = async (e) => {
    e?.preventDefault();
    setGenerating(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('subject', subject);
      formData.append('topic', topic);
      formData.append('difficulty', difficulty);
      formData.append('questionCount', questionCount);
      formData.append('questionType', questionType);

      if (uploadFile) {
        formData.append('file', uploadFile);
      }
      if (rawText && rawText.trim()) {
        formData.append('rawText', rawText);
      }

      const res = await api.post('/student/tests/generate-from-material', formData);

      if (!res.data.questions || res.data.questions.length === 0) {
        setError('No test questions could be generated. Please refine your topic or study material.');
        setGenerating(false);
        return;
      }

      setCurrentTest(res.data);
      setCurrentQuestionIndex(0);
      setUserAnswers({});
      setTimeRemaining((res.data.questions.length || 4) * 90); // 90 secs per question
      setMode('running');
    } catch (err) {
      console.error('Failed to generate test:', err);
      setError(err.response?.data?.error || err.message || 'Failed to generate practice test.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectOption = (qIdx, optIdx) => {
    setUserAnswers({
      ...userAnswers,
      [qIdx]: optIdx,
    });
  };

  const handleTextInputAnswer = (qIdx, text) => {
    setUserAnswers({
      ...userAnswers,
      [qIdx]: text,
    });
  };

  const handleSubmitTest = async () => {
    if (!currentTest) return;
    setSubmitting(true);
    setError('');

    try {
      const durationTaken =
        (currentTest.questions.length || 4) * 90 - (timeRemaining > 0 ? timeRemaining : 0);

      const res = await api.post('/student/tests/submit-comprehensive', {
        subject: currentTest.subject || subject,
        topic: currentTest.topic || topic,
        difficulty: currentTest.difficulty || difficulty,
        questionTypeFilter: questionType,
        sourceMaterialTitle: currentTest.sourceMaterialTitle || '',
        questions: currentTest.questions,
        userAnswers,
        timeTakenSeconds: durationTaken,
      });

      setEvaluatedResult(res.data);
      setMode('results');

      if (res.data.percentage >= 80) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      }
    } catch (err) {
      console.error('Failed to submit test:', err);
      setError('Failed to evaluate test results.');
    } finally {
      setSubmitting(false);
    }
  };

  const currentQ = currentTest?.questions?.[currentQuestionIndex];
  const isLastQuestion = currentTest && currentQuestionIndex === currentTest.questions.length - 1;

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
          <FileCheck2 className="w-7 h-7 text-blue-600" />
          <span>Material-Based Practice Quizzes & Mock Exams</span>
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Generate interactive practice tests grounded directly in your uploaded study notes or course knowledge vault. Supports MCQs, True/False, Fill-in-the-blank, and Short-answer questions with instant AI evaluation and revision suggestions.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl flex items-start gap-3 text-xs text-red-800 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. CONFIGURATION VIEW */}
      {mode === 'config' && (
        <div className="max-w-2xl mx-auto p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Configure Grounded Practice Test
            </h2>
          </div>

          <form onSubmit={handleStartTest} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  Question Count
                </label>
                <select
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none dark:text-white"
                >
                  <option value={3}>3 Questions (Quick Check)</option>
                  <option value={5}>5 Questions (Standard)</option>
                  <option value={8}>8 Questions (In-Depth)</option>
                  <option value={10}>10 Questions (Mock Exam)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Question Type Format
                </label>
                <select
                  value={questionType}
                  onChange={(e) => setQuestionType(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none dark:text-white"
                >
                  <option value="Mixed">Mixed (MCQ + Fill-in + Short Answer)</option>
                  <option value="MCQ">Multiple Choice (MCQs only)</option>
                  <option value="TrueFalse">True / False</option>
                  <option value="FillBlank">Fill in the Blanks</option>
                  <option value="ShortAnswer">Short Answer & Conceptual</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Difficulty Level
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none dark:text-white"
                >
                  <option value="Easy">Easy (Foundations)</option>
                  <option value="Medium">Medium (Standard Exam Level)</option>
                  <option value="Hard">Hard (Edge Cases & Proofs)</option>
                  <option value="Adaptive">Adaptive (Based on Past Weak Areas)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Topic / Chapter Focus
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

            {/* Direct Study Material Upload */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Attach Study Notes / Textbook PDF (Optional)
              </label>
              {uploadFile ? (
                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-semibold text-blue-700 dark:text-blue-300">
                  <span className="truncate">{uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)</span>
                  <button
                    type="button"
                    onClick={() => setUploadFile(null)}
                    className="text-red-600 hover:underline shrink-0 ml-2"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center p-3 border-2 border-dashed rounded-xl cursor-pointer bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 border-slate-300 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 transition-colors">
                  <FileUp className="w-4 h-4 mr-2 text-blue-600" />
                  <span>Upload Study Material (PDF/Text) to ground test questions</span>
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
                  <span>Generating Grounded Questions...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Practice Test</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* 2. RUNNING TEST VIEW (MULTI-TYPE QUESTION RUNNER) */}
      {mode === 'running' && currentTest && currentQ && (
        <div className="max-w-3xl mx-auto p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-6">
          {/* Test Header with Timer & Progress */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                {currentTest.subject}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                Q{currentQuestionIndex + 1} of {currentTest.questions.length} ({currentQ.questionType || 'MCQ'})
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>{formatTime(timeRemaining)}</span>
            </div>
          </div>

          {/* Question Text */}
          <div className="space-y-2">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-relaxed">
              {currentQ.question}
            </h3>
            {currentQ.topicTag && (
              <span className="inline-block text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold">
                Topic: {currentQ.topicTag}
              </span>
            )}
          </div>

          {/* INPUT FORMAT: MCQ / TRUE-FALSE */}
          {(currentQ.questionType === 'MCQ' || currentQ.questionType === 'TrueFalse' || (!currentQ.questionType && currentQ.options?.length > 0)) && (
            <div className="space-y-3">
              {currentQ.options?.map((opt, optIdx) => {
                const isSelected = userAnswers[currentQuestionIndex] === optIdx;
                return (
                  <button
                    key={optIdx}
                    type="button"
                    onClick={() => handleSelectOption(currentQuestionIndex, optIdx)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-600 text-blue-900 dark:text-blue-100 font-semibold shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${
                          isSelected
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-300 dark:border-slate-600 text-slate-500'
                        }`}
                      >
                        {String.fromCharCode(65 + optIdx)}
                      </div>
                      <span className="text-xs sm:text-sm">{opt}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* INPUT FORMAT: FILL IN THE BLANK */}
          {currentQ.questionType === 'FillBlank' && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Type your answer for the blank:
              </label>
              <input
                type="text"
                value={userAnswers[currentQuestionIndex] || ''}
                onChange={(e) => handleTextInputAnswer(currentQuestionIndex, e.target.value)}
                placeholder="Enter missing key term..."
                className="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-600 focus:outline-none dark:text-white"
              />
            </div>
          )}

          {/* INPUT FORMAT: SHORT ANSWER / DESCRIPTIVE */}
          {(currentQ.questionType === 'ShortAnswer' || currentQ.questionType === 'Descriptive') && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Your Conceptual Explanation (1-3 sentences):
              </label>
              <textarea
                rows={4}
                value={userAnswers[currentQuestionIndex] || ''}
                onChange={(e) => handleTextInputAnswer(currentQuestionIndex, e.target.value)}
                placeholder="Explain the key mechanics, invariants, or algorithm steps..."
                className="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-600 focus:outline-none dark:text-white font-mono"
              />
            </div>
          )}

          {/* Navigation & Submit Buttons */}
          <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-5">
            <button
              type="button"
              disabled={currentQuestionIndex === 0}
              onClick={() => setCurrentQuestionIndex(currentQuestionIndex - 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            {isLastQuestion ? (
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmitTest}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-700 active:scale-95 transition-all shadow-md shadow-green-500/20 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Evaluating Test...</span>
                  </>
                ) : (
                  <>
                    <FileCheck2 className="w-4 h-4" />
                    <span>Submit Practice Test</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-500/20"
              >
                <span>Next Question</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. EVALUATION RESULTS VIEW (DETAILED DIAGNOSTICS & REVISION RECOMMENDATIONS) */}
      {mode === 'results' && evaluatedResult && (
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Results Score Card */}
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="space-y-1">
              <span className="inline-block px-3 py-1 rounded-full bg-white/15 text-xs font-bold backdrop-blur-md">
                Test Completed!
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold">{evaluatedResult.topic}</h2>
              <p className="text-xs sm:text-sm text-blue-100">{evaluatedResult.subject} • {evaluatedResult.difficulty} Level</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-3xl sm:text-4xl font-black">
                  {evaluatedResult.score}/{evaluatedResult.totalMaxPoints || evaluatedResult.totalQuestions}
                </p>
                <p className="text-xs text-blue-200 font-semibold">{evaluatedResult.percentage}% Score</p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-2xl">
                <Award className="w-8 h-8 text-amber-300" />
              </div>
            </div>
          </div>

          {/* AI Diagnostic Feedback */}
          {evaluatedResult.aiDiagnosticFeedback && (
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-xs leading-relaxed text-slate-700 dark:text-slate-300">
              <strong className="text-blue-600 dark:text-blue-400 block mb-1">AI Diagnostic Assessment:</strong>
              {evaluatedResult.aiDiagnosticFeedback}
            </div>
          )}

          {/* Strengths & Weaknesses Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/60 space-y-2">
              <h4 className="text-xs font-bold text-green-900 dark:text-green-300 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span>Mastered Strengths</span>
              </h4>
              {evaluatedResult.strengths?.length > 0 ? (
                <ul className="space-y-1 text-xs text-green-800 dark:text-green-400">
                  {evaluatedResult.strengths.map((s, i) => (
                    <li key={i}>• {s}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-green-700 dark:text-green-400">Keep practicing to build your foundation!</p>
              )}
            </div>

            <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 space-y-2">
              <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Identified Weak Areas</span>
              </h4>
              {evaluatedResult.weakAreas?.length > 0 ? (
                <ul className="space-y-1 text-xs text-amber-800 dark:text-amber-400">
                  {evaluatedResult.weakAreas.map((w, i) => (
                    <li key={i}>• {w}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-amber-700 dark:text-amber-400">No weak areas detected! Excellent mastery.</p>
              )}
            </div>
          </div>

          {/* RECOMMENDED TOPICS FOR REVISION */}
          {evaluatedResult.recommendedRevisionTopics?.length > 0 && (
            <div className="p-5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                  <BookmarkPlus className="w-4 h-4 text-blue-600" />
                  <span>Recommended Topics for Revision</span>
                </h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {evaluatedResult.recommendedRevisionTopics.map((top, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
                  >
                    <span>{top}</span>
                    <Link
                      to="/student/doubt-chat"
                      className="text-[10px] text-blue-600 font-bold hover:underline"
                    >
                      Ask Doubt →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Question-By-Question Detailed Explanations */}
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Question-Wise Performance Breakdown</span>
            </h3>

            <div className="space-y-4">
              {evaluatedResult.questions?.map((q, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border ${
                    q.isCorrect
                      ? 'bg-green-50/30 dark:bg-green-950/20 border-green-200 dark:border-green-900/60'
                      : 'bg-red-50/30 dark:bg-red-950/20 border-red-200 dark:border-red-900/60'
                  } space-y-2`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {q.isCorrect ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600" />
                      )}
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Question {idx + 1} ({q.questionType || 'MCQ'})
                      </span>
                    </div>
                    <span
                      className={`text-xs font-bold ${
                        q.isCorrect ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      +{q.awardedPoints || (q.isCorrect ? 1 : 0)} / {q.points || 1} Pts
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {q.question}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] text-slate-400 block font-semibold">Your Answer:</span>
                      <span className={`font-semibold ${q.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                        {q.userTextAnswer || (q.options && q.userSelectedOption !== null ? q.options[q.userSelectedOption] : 'No answer entered')}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900">
                      <span className="text-[10px] text-green-600 dark:text-green-400 block font-semibold">Correct Answer / Benchmark:</span>
                      <span className="font-semibold text-green-800 dark:text-green-200">
                        {q.correctTextAnswer || (q.options ? q.options[q.correctAnswerIndex] : 'Expected answer')}
                      </span>
                    </div>
                  </div>

                  {q.explanation && (
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 pt-1">
                      <strong>Explanation:</strong> {q.explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => {
                setMode('config');
                setEvaluatedResult(null);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-500/20"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Take Another Practice Test</span>
            </button>

            <Link
              to="/student/study-plans"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors"
            >
              <span>Build Revision Study Plan</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default PracticeTests;
