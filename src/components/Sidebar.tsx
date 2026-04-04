import { AuthUser } from '../types';
import { 
  LayoutDashboard, 
  Users, 
  Clock, 
  Building2, 
  Package, 
  FileText, 
  BarChart3, 
  LogOut,
  ShoppingCart,
  Warehouse,
  Receipt,
  Wallet,
  Banknote,
  Cpu,
  History,
  Settings as SettingsIcon
} from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarProps {
  user: AuthUser;
  currentView: string;
  setCurrentView: (view: string) => void;
  isOpen: boolean;
  onLogout: () => void;
  onClose: () => void;
}

export default function Sidebar({ user, currentView, setCurrentView, isOpen, onLogout, onClose }: SidebarProps) {
  const menuItems = user.role === 'admin' ? [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'attendance', label: 'Attendance', icon: Clock },
    { id: 'salary', label: 'Salary & Advances', icon: Banknote },
    { id: 'parties', label: 'Parties', icon: Building2 },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'purchases', label: 'Purchases', icon: ShoppingCart },
    { id: 'purchase_payments', label: 'Purchase Payments', icon: Banknote },
    { id: 'challans', label: 'Challans', icon: FileText },
    { id: 'bills', label: 'Bills (GST)', icon: Receipt },
    { id: 'sales_payments', label: 'Sales Payments', icon: Wallet },
    { id: 'ledger', label: 'Party Ledger', icon: History },
    { id: 'expenses', label: 'Expenses', icon: Wallet },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ] : [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ];

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 transition-opacity"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
      <div className="h-full flex flex-col">
        <div className="p-6">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 leading-tight">Shree Mahalaxmi Lace</h1>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest leading-tight">{user.role}</p>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                currentView === item.id 
                  ? "bg-primary text-white shadow-sm" 
                  : "text-gray-600 hover:bg-gray-50"
              )}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold">
              {user.username[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user.username}</p>
              <p className="text-xs text-gray-500 truncate">{user.user_id}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-all"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </div>
    </aside>
    </>
  );
}
