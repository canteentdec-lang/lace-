import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import DashboardOverview from './admin/DashboardOverview';
import EmployeeManagement from './admin/EmployeeManagement';
import AttendanceProduction from './admin/AttendanceProduction';
import PartyManagement from './admin/PartyManagement';
import ProductManagement from './admin/ProductManagement';
import ChallanSystem from './admin/ChallanSystem';
import Reports from './admin/Reports';

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
