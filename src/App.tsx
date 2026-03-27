/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { Users, Shield, Activity, Swords, Trophy, CalendarX, LogOut, Menu, X, Settings, Gem, History, FileText } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Components
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import PowerHistory from './pages/PowerHistory';
import Tournaments from './pages/Tournaments';
import Absences from './pages/Absences';
import UsersAdmin from './pages/UsersAdmin';
import Fenda from './pages/Fenda';
import ImportsHistory from './pages/ImportsHistory';
import StoredCSVs from './pages/StoredCSVs';

function Layout({ children, user, setAuth }: { children: React.ReactNode, user: any, setAuth: any }) {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    setAuth(null, null);
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: Activity },
    { name: 'Membros', path: '/members', icon: Users },
    { name: 'Poder', path: '/power', icon: Shield },
    { name: 'Fenda', path: '/fenda', icon: Gem },
    { name: 'Torneios', path: '/tournaments', icon: Swords },
    { name: 'Faltas', path: '/absences', icon: CalendarX },
    ...(user?.role === 'admin' ? [
      { name: 'Histórico', path: '/imports', icon: History },
      { name: 'Arquivos CSV', path: '/stored-csvs', icon: FileText },
      { name: 'Usuários', path: '/users', icon: Settings }
    ] : []),
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-zinc-900 border-r border-zinc-800 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2 font-bold text-xl text-emerald-400">
            <Trophy className="w-6 h-6" />
            <span>Guild Manager</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-zinc-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-zinc-800">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{user?.username}</span>
              <span className="text-xs text-zinc-500 capitalize">{user?.role}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 flex items-center justify-between px-4 border-b border-zinc-800 bg-zinc-900/50 md:hidden">
          <div className="flex items-center gap-2 font-bold text-emerald-400">
            <Trophy className="w-6 h-6" />
            <span>Guild Manager</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="text-zinc-400 hover:text-white">
            <Menu className="w-6 h-6" />
          </button>
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

function ProtectedRoute({ children, token, user, setAuth }: { children: React.ReactNode, token: string | null, user: any, setAuth: any }) {
  if (!token) return <Navigate to="/login" replace />;
  return <Layout user={user} setAuth={setAuth}>{children}</Layout>;
}

export default function App() {
  const [token, setTokenState] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUserState] = useState<any>(JSON.parse(localStorage.getItem('user') || 'null'));

  const setAuth = (newToken: string | null, newUser: any | null) => {
    setTokenState(newToken);
    setUserState(newUser);
    if (newToken) localStorage.setItem('token', newToken);
    else localStorage.removeItem('token');
    if (newUser) localStorage.setItem('user', JSON.stringify(newUser));
    else localStorage.removeItem('user');
  };

  const fetchApi = async (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (!(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    } else {
      headers.delete('Content-Type'); // Let browser set boundary
    }
    
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401 || res.status === 403) {
      setAuth(null, null);
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Erro na requisição');
    }
    return res;
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login setAuth={setAuth} />} />
        <Route path="/" element={<ProtectedRoute token={token} user={user} setAuth={setAuth}><Dashboard fetchApi={fetchApi} /></ProtectedRoute>} />
        <Route path="/members" element={<ProtectedRoute token={token} user={user} setAuth={setAuth}><Members fetchApi={fetchApi} /></ProtectedRoute>} />
        <Route path="/power" element={<ProtectedRoute token={token} user={user} setAuth={setAuth}><PowerHistory fetchApi={fetchApi} /></ProtectedRoute>} />
        <Route path="/fenda" element={<ProtectedRoute token={token} user={user} setAuth={setAuth}><Fenda fetchApi={fetchApi} /></ProtectedRoute>} />
        <Route path="/tournaments" element={<ProtectedRoute token={token} user={user} setAuth={setAuth}><Tournaments fetchApi={fetchApi} /></ProtectedRoute>} />
        <Route path="/absences" element={<ProtectedRoute token={token} user={user} setAuth={setAuth}><Absences fetchApi={fetchApi} /></ProtectedRoute>} />
        <Route path="/imports" element={<ProtectedRoute token={token} user={user} setAuth={setAuth}><ImportsHistory fetchApi={fetchApi} user={user} /></ProtectedRoute>} />
        <Route path="/stored-csvs" element={<ProtectedRoute token={token} user={user} setAuth={setAuth}><StoredCSVs fetchApi={fetchApi} user={user} /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute token={token} user={user} setAuth={setAuth}><UsersAdmin fetchApi={fetchApi} user={user} /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}
