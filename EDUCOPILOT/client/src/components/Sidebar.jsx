import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  CalendarDays,
  FileCheck2,
  HelpCircle,
  History,
  BookOpen,
  FolderSync,
  Calendar,
  Layers,
  GraduationCap,
  Sparkles,
  Shield,
} from 'lucide-react';

const Sidebar = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const isStudent = user?.role === 'student';

  const studentLinks = [
    {
      to: '/student/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      description: 'Overview & daily momentum',
    },
    {
      to: '/student/study-plans',
      label: 'Study Plans',
      icon: CalendarDays,
      description: 'Personalized exam prep',
    },
    {
      to: '/student/practice-tests',
      label: 'Practice Tests',
      icon: FileCheck2,
      description: 'Adaptive quizzes & mock tests',
    },
    {
      to: '/student/doubt-chat',
      label: 'Ask a Doubt',
      icon: HelpCircle,
      description: 'RAG syllabus grounded tutor',
    },
    {
      to: '/student/materials-rag',
      label: 'Course Knowledge (RAG)',
      icon: FolderSync,
      description: 'Upload notes & explore library',
    },
    {
      to: '/student/test-history',
      label: 'Test History',
      icon: History,
      description: 'Weak areas & diagnostics',
    },
  ];

  const professorLinks = [
    {
      to: '/professor/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      description: 'Courses & activity summary',
    },
    {
      to: '/professor/materials-rag',
      label: 'Course Materials (RAG)',
      icon: FolderSync,
      description: 'Upload syllabus & knowledge base',
    },
    {
      to: '/professor/scheduling',
      label: 'Lecture Scheduler',
      icon: Calendar,
      description: 'AI-sequenced lecture plan',
    },
    {
      to: '/professor/material-prep',
      label: 'Material Prep',
      icon: Layers,
      description: 'Auto-draft slides & notes',
    },
    {
      to: '/professor/grading',
      label: 'Assessment & Grading',
      icon: GraduationCap,
      description: 'AI rubric & student feedback',
    },
  ];

  const links = isStudent ? studentLinks : professorLinks;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm md:hidden"
        />
      )}

      <aside
        className={`fixed top-16 bottom-0 left-0 z-40 flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {isStudent ? 'Learning Modules' : 'Teaching Suite'}
          </div>

          {links.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => {
                  if (window.innerWidth < 768) onClose();
                }}
                className={({ isActive }) =>
                  `flex items-start gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/80'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`w-5 h-5 mt-0.5 shrink-0 ${
                        isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    />
                    <div className="flex flex-col text-left">
                      <span className="leading-tight">{link.label}</span>
                      <span
                        className={`text-[11px] font-normal leading-tight mt-0.5 ${
                          isActive
                            ? 'text-blue-100'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {link.description}
                      </span>
                    </div>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Data Privacy & Role Scoping Guarantee Card */}
        <div className="p-3 m-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
            <Shield className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Strict Data Isolation</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
            Your records are scoped strictly to your account ID. No cross-user access permitted.
          </p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
