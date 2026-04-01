import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { AuthUser, Role } from './types';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import UserDashboard from './pages/UserDashboard';
import Sidebar from './components/Sidebar';
import { LogOut, Menu, X, AlertTriangle } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('katai_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  const [configError, setConfigError] = useState(false);

  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key || url.includes('your-project-url')) {
      setConfigError(true);
    }
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem('katai_user', JSON.stringify(user));
      setIsSidebarOpen(false); // Ensure sidebar is closed on login/user change
    } else {
      localStorage.removeItem('katai_user');
    }
  }, [user]);

  const handleLogout = () => {
    setUser(null);
    setCurrentView('dashboard');
  };

  if (configError) {
    return (
      <div className="min-h-screen bg-bg-soft flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-orange-100 shadow-sm text-center space-y-6">
          <div className="w-16 h-16 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">Configuration Required</h2>
            <p className="text-gray-500">Please set your Supabase URL and Anon Key in the Secrets panel to start using the app.</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-xl text-left text-xs font-mono text-gray-600 space-y-2">
            <p>VITE_SUPABASE_URL=...</p>
            <p>VITE_SUPABASE_ANON_KEY=...</p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-primary-hover transition-all"
          >
            I've set the keys, reload
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <div className="min-h-screen bg-bg-soft text-text-main flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <h1 className="font-bold text-xl tracking-tight">Shree Mahalaxmi Lace</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-bold text-gray-900">{user.username}</p>
            <p className="text-xs text-gray-500 uppercase tracking-widest">{user.role}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold border border-gray-200">
            {user.username[0]}
          </div>
        </div>
      </div>

      <div className="flex flex-1 relative">
        {/* Sidebar / Navigation */}
        <Sidebar 
          user={user} 
          currentView={currentView} 
          setCurrentView={(view) => {
            setCurrentView(view);
            setIsSidebarOpen(false);
          }}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onLogout={handleLogout}
        />

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {user.role === 'admin' ? (
            <AdminDashboard currentView={currentView} setCurrentView={setCurrentView} />
          ) : (
            <UserDashboard user={user} />
          )}
        </div>
      </main>
    </div>
  </div>
  );
}
