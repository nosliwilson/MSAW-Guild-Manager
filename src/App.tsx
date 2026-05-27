/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { Users, Shield, Activity, Swords, Trophy, CalendarX, LogOut, Menu, X, Settings, Gem, History, FileText, Database, UserCog, Loader2, Palette } from 'lucide-react';
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
import SQLEditor from './pages/SQLEditor';
import SettingsPage from './pages/Settings';

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
      { name: 'Configurações', path: '/settings', icon: Settings }
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

function ProtectedRoute({ children, user, setAuth }: { children: React.ReactNode, user: any, setAuth: any }) {
  if (!user) return <Navigate to="/login" replace />;
  return <Layout user={user} setAuth={setAuth}>{children}</Layout>;
}

export default function App() {
  const [user, setUserState] = useState<any>(JSON.parse(localStorage.getItem('user') || 'null'));
  const [loading, setLoading] = useState<boolean>(!!localStorage.getItem('token'));

  const setAuth = (newUser: any | null, token: string | null = null) => {
    setUserState(newUser);
    if (newUser) {
      localStorage.setItem('user', JSON.stringify(newUser));
      if (token) {
        localStorage.setItem('token', token);
      }
    } else {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (!savedToken) {
      setLoading(false);
      setAuth(null);
      return;
    }
    const headers: Record<string, string> = {};
    if (savedToken) {
      headers['Authorization'] = `Bearer ${savedToken}`;
    }
    fetch('/api/auth/me', { headers, credentials: 'include' })
      .then(async res => {
        if (!res.ok) throw new Error('Response not OK');
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return res.json();
        }
        throw new Error('Response not application/json');
      })
      .then(data => {
        if (data && data.user) {
          setAuth(data.user, savedToken);
        } else {
          setAuth(null);
        }
      })
      .catch(() => setAuth(null))
      .finally(() => setLoading(false));
  }, []);

  const fetchApi = async (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers);
    headers.set('X-Requested-With', 'XMLHttpRequest');
    
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      headers.set('Authorization', `Bearer ${savedToken}`);
    }

    if (!(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    } else {
      headers.delete('Content-Type'); // Let browser set boundary
    }
    
    // Ensure cross-origin cookies are sent if necessary
    options.credentials = 'include';
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      setAuth(null);
      if (window.location.pathname !== '/login') {
         window.location.href = '/login';
      }
      throw new Error('Sessão expirada ou inválida. Faça login novamente.');
    }
    if (!res.ok) {
      const contentType = res.headers.get('content-type');
      let errorMsg = 'Erro na requisição';
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json().catch(() => ({}));
        errorMsg = data.error || errorMsg;
      }
      throw new Error(errorMsg);
    }
    return res;
  };

  const handleLogoutReq = async () => {
    try {
      await fetchApi('/api/auth/logout', { method: 'POST' });
    } catch(e) {}
    setAuth(null);
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-emerald-400">
        <Loader2 className="w-10 h-10 animate-spin" />
        <span className="mt-4 text-sm font-medium text-zinc-400 font-sans">Verificando autenticação...</span>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login setAuth={setAuth} />} />
        <Route path="/" element={<ProtectedRoute user={user} setAuth={handleLogoutReq}><Dashboard fetchApi={fetchApi} /></ProtectedRoute>} />
        <Route path="/members" element={<ProtectedRoute user={user} setAuth={handleLogoutReq}><Members fetchApi={fetchApi} user={user} /></ProtectedRoute>} />
        <Route path="/power" element={<ProtectedRoute user={user} setAuth={handleLogoutReq}><PowerHistory fetchApi={fetchApi} /></ProtectedRoute>} />
        <Route path="/fenda" element={<ProtectedRoute user={user} setAuth={handleLogoutReq}><Fenda fetchApi={fetchApi} user={user} /></ProtectedRoute>} />
        <Route path="/tournaments" element={<ProtectedRoute user={user} setAuth={handleLogoutReq}><Tournaments fetchApi={fetchApi} user={user} /></ProtectedRoute>} />
        <Route path="/absences" element={<ProtectedRoute user={user} setAuth={handleLogoutReq}><Absences fetchApi={fetchApi} user={user} /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute user={user} setAuth={handleLogoutReq}><SettingsPage fetchApi={fetchApi} user={user} /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}
