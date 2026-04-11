import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import DashboardOverview from './admin/DashboardOverview';
import EmployeeManagement from './admin/EmployeeManagement';
import AttendanceProduction from './admin/AttendanceProduction';
import PartyManagement from './admin/PartyManagement';
import ProductManagement from './admin/ProductManagement';
import ChallanSystem from './admin/ChallanSystem';
import Reports from './admin/Reports';
import PurchaseSystem from './admin/PurchaseSystem';
import PurchasePayments from './admin/PurchasePayments';
import SalesPayments from './admin/SalesPayments';
import PartyLedger from './admin/PartyLedger';
import BillSystem from './admin/BillSystem';
import ExpenseManagement from './admin/ExpenseManagement';
import SalarySystem from './admin/SalarySystem';
import Settings from './admin/Settings';
import PartyWisePricing from './admin/PartyWisePricing';

interface AdminDashboardProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

export default function AdminDashboard({ currentView, setCurrentView }: AdminDashboardProps) {
  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardOverview />;
      case 'employees':
        return <EmployeeManagement />;
      case 'attendance':
        return <AttendanceProduction />;
      case 'parties':
        return <PartyManagement />;
      case 'products':
        return <ProductManagement />;
      case 'challans':
        return <ChallanSystem />;
      case 'purchases':
        return <PurchaseSystem />;
      case 'purchase_payments':
        return <PurchasePayments />;
      case 'sales_payments':
        return <SalesPayments />;
      case 'ledger':
        return <PartyLedger />;
      case 'bills':
        return <BillSystem onNavigate={setCurrentView} />;
      case 'expenses':
        return <ExpenseManagement />;
      case 'salary':
        return <SalarySystem />;
      case 'party_pricing':
        return <PartyWisePricing />;
      case 'settings':
        return <Settings />;
      case 'reports':
        return <Reports />;
      default:
        return <DashboardOverview />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 capitalize">{currentView}</h2>
      </div>
      {renderView()}
    </div>
  );
}
