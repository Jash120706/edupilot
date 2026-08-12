import React, { useState, useEffect } from 'react';
import api from '../../api/client';
import { History, Award, AlertTriangle, CheckCircle, Clock, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

const TestHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedAttempt, setExpandedAttempt] = useState(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await api.get('/student/tests/history');
      setHistory(res.data);
    } catch (err) {
      console.error('Failed to load test history:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id) => {
    setExpandedAttempt(expandedAttempt === id ? null : id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-500">Loading your test history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
          <History className="w-7 h-7 text-blue-600" />
          <span>Diagnostic Test History</span>
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Review your performance trends, weak area tags, and previous explanations.
        </p>
      </div>

      {history.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl">
          <Award className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
          <h3 className="mt-4 text-base font-bold text-slate-800 dark:text-slate-200">
            No Practice Tests Taken Yet
          </h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            Take an adaptive practice quiz to evaluate your retention and generate personalized analytics.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((attempt) => {
            const isExpanded = expandedAttempt === attempt._id;
            return (
              <div
                key={attempt._id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm transition-all"
              >
                <div
                  onClick={() => toggleExpand(attempt._id)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                        {attempt.subject}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                        {attempt.difficulty}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {attempt.topic}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Completed {new Date(attempt.completedAt).toLocaleString()} • {attempt.totalQuestions} Questions
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div
                        className={`text-xl font-extrabold ${
                          attempt.percentage >= 80
                            ? 'text-green-600 dark:text-green-400'
                            : attempt.percentage >= 50
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-orange-600 dark:text-orange-400'
                        }`}
                      >
                        {attempt.score}/{attempt.totalQuestions} ({attempt.percentage}%)
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Score
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
                    {/* Weak areas */}
                    {attempt.weakAreas && attempt.weakAreas.length > 0 && (
                      <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/60">
                        <span className="text-xs font-bold text-orange-900 dark:text-orange-200 flex items-center gap-1.5 mb-2">
                          <AlertTriangle className="w-4 h-4 text-orange-600" />
                          Identified Weak Topics:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {attempt.weakAreas.map((area, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-0.5 rounded-full bg-white dark:bg-slate-900 text-xs font-semibold text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-800"
                            >
                              {area}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Question breakdown */}
                    <div className="space-y-3">
                      {attempt.questions?.map((q, idx) => {
                        const isCorrect = q.isCorrect;
                        return (
                          <div
                            key={idx}
                            className={`p-4 rounded-xl border ${
                              isCorrect
                                ? 'bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900/50'
                                : 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                Q{idx + 1}. {q.questionText}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                  isCorrect
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                }`}
                              >
                                {isCorrect ? 'Correct' : 'Incorrect'}
                              </span>
                            </div>
                            <div className="mt-2 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                              <p>
                                <span className="font-semibold">Your answer:</span> {q.userResponse || 'No answer'}
                              </p>
                              {!isCorrect && (
                                <p className="text-green-700 dark:text-green-400 font-semibold">
                                  <span>Correct answer:</span> {q.correctAnswer}
                                </p>
                              )}
                              {q.explanation && (
                                <p className="text-slate-500 dark:text-slate-400 text-[11px] italic mt-1 bg-white/60 dark:bg-slate-900/60 p-2 rounded-lg">
                                  💡 {q.explanation}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TestHistory;
