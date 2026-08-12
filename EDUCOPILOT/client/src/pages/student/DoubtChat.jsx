import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/client';
import {
  HelpCircle,
  Sparkles,
  Send,
  BookOpen,
  FileText,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  MessageSquare,
  Bot,
  User,
  History,
} from 'lucide-react';

const DoubtChat = () => {
  const [subject, setSubject] = useState('Computer Science');
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [expandedSources, setExpandedSources] = useState({});

  const chatEndRef = useRef(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchHistory = async () => {
    try {
      const res = await api.get('/student/doubts/history');
      setHistoryList(res.data);
      if (res.data.length > 0 && messages.length === 0) {
        // Load the latest doubt into active chat view
        const latest = res.data[0];
        setMessages([
          { role: 'user', content: latest.query, timestamp: latest.createdAt },
          {
            role: 'assistant',
            content: latest.answer,
            citedSources: latest.citedSources,
            keyTakeaways: latest.keyTakeaways,
            suggestedFollowUps: latest.suggestedFollowUps,
            timestamp: latest.createdAt,
            _id: latest._id,
          },
        ]);
      }
    } catch (err) {
      console.error('Failed to load doubt history:', err);
    }
  };

  const handleSendQuery = async (customQuery = null) => {
    const textToSend = customQuery || query;
    if (!textToSend.trim() || loading) return;

    const userMsg = {
      role: 'user',
      content: textToSend,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuery('');
    setLoading(true);

    try {
      const res = await api.post('/student/doubts', {
        subject,
        query: textToSend,
      });

      const assistantMsg = {
        role: 'assistant',
        content: res.data.answer,
        citedSources: res.data.citedSources,
        keyTakeaways: res.data.keyTakeaways,
        suggestedFollowUps: res.data.suggestedFollowUps,
        timestamp: res.data.createdAt,
        _id: res.data._id,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setHistoryList((prev) => [res.data, ...prev]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error clarifying that doubt. Please try again.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const toggleSourceView = (id) => {
    setExpandedSources((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <HelpCircle className="w-7 h-7 text-blue-600" />
            <span>Course Doubt Clarification</span>
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Instant AI tutoring grounded strictly in your uploaded course syllabus and textbooks.
          </p>
        </div>

        {/* Subject Filter Tag */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">Course:</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject Filter"
            className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none dark:text-white font-medium"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Recent Doubts Drawer */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Doubt History ({historyList.length})
              </h2>
            </div>

            {historyList.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 py-4 text-center">
                No past questions asked yet.
              </p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {historyList.map((item) => (
                  <button
                    key={item._id}
                    onClick={() => {
                      setMessages([
                        { role: 'user', content: item.query, timestamp: item.createdAt },
                        {
                          role: 'assistant',
                          content: item.answer,
                          citedSources: item.citedSources,
                          keyTakeaways: item.keyTakeaways,
                          suggestedFollowUps: item.suggestedFollowUps,
                          timestamp: item.createdAt,
                          _id: item._id,
                        },
                      ]);
                    }}
                    className="w-full text-left p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                  >
                    <div className="flex items-center justify-between text-[10px] font-semibold text-blue-600 dark:text-blue-400 mb-1">
                      <span>{item.subject}</span>
                      <span className="text-slate-400">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-2">
                      {item.query}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Chat Box */}
        <div className="lg:col-span-8 flex flex-col h-[650px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
          {/* Chat Messages Body */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="p-4 rounded-3xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 mb-3">
                  <Bot className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Ask Any Course Question
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Answers are generated from indexed course documents with citations and key takeaways.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-4 max-w-md">
                  <button
                    onClick={() =>
                      handleSendQuery('Explain Raft leader election and how split votes are prevented.')
                    }
                    className="text-xs px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 hover:text-blue-600 transition-colors text-slate-600 dark:text-slate-300 font-medium"
                  >
                    💡 Raft Leader Election?
                  </button>
                  <button
                    onClick={() =>
                      handleSendQuery('What is the difference between Linearizable Consistency and Eventual Consistency?')
                    }
                    className="text-xs px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 hover:text-blue-600 transition-colors text-slate-600 dark:text-slate-300 font-medium"
                  >
                    💡 Linearizability vs Eventual Consistency?
                  </button>
                </div>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex gap-3.5 ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-2xl rounded-2xl p-4 ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </div>

                    {/* Key Takeaways */}
                    {msg.keyTakeaways && msg.keyTakeaways.length > 0 && (
                      <div className="mt-4 p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 mb-1.5">
                          <Lightbulb className="w-3.5 h-3.5" />
                          <span>Core Takeaways</span>
                        </div>
                        <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                          {msg.keyTakeaways.map((item, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="text-blue-600 font-bold">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Grounded Source Citations */}
                    {msg.citedSources && msg.citedSources.length > 0 && (
                      <div className="mt-3">
                        <button
                          onClick={() => toggleSourceView(msg._id || index)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <FileText className="w-3 h-3" />
                          <span>
                            {msg.citedSources.length} Grounded Source Citation(s)
                          </span>
                          {expandedSources[msg._id || index] ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>

                        {expandedSources[msg._id || index] && (
                          <div className="mt-2 space-y-2">
                            {msg.citedSources.map((src, i) => (
                              <div
                                key={i}
                                className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                              >
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                                  <span className="text-blue-600">{src.docTitle}</span>
                                  <span>Relevance: {Math.round((src.relevanceScore || 0.9) * 100)}%</span>
                                </div>
                                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 italic">
                                  "{src.chunkSnippet}"
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Suggested Follow-ups */}
                    {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {msg.suggestedFollowUps.map((q, i) => (
                          <button
                            key={i}
                            onClick={() => handleSendQuery(q)}
                            className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition-colors"
                          >
                            👉 {q}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                    </div>
                  )}
                </div>
              ))
            )}

            {loading && (
              <div className="flex gap-3.5">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 animate-pulse">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce"></div>
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.4s]"></div>
                  <span className="text-xs text-slate-400 ml-2">Grounding response with RAG...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input Bar */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendQuery();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask a question about your course..."
                disabled={loading}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm disabled:opacity-40 transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoubtChat;
