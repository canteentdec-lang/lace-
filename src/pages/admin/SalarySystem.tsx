import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Employee, Attendance, Advance } from '../../types';
import { Search, Loader2, Banknote, Plus, Trash2, X, Download, Calendar, CheckCircle2 } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function SalarySystem() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmPay, setConfirmPay] = useState<Employee | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const [advanceForm, setAdvanceForm] = useState({
    employee_id: '',
    amount: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchData();
  }, [dateFilter]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: emps } = await supabase.from('employees').select('*').order('username', { ascending: true });
      const { data: att } = await supabase.from('attendance').select('*').gte('date', dateFilter.startDate).lte('date', dateFilter.endDate);
      const { data: adv } = await supabase.from('advances').select('*').gte('date', dateFilter.startDate).lte('date', dateFilter.endDate);
      
      if (emps) setEmployees(emps);
      if (att) setAttendance(att);
      if (adv) setAdvances(adv);
    } catch (error) {
      console.error('Error fetching salary data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateSalary = (employee: Employee) => {
    const empAttendance = attendance.filter(a => a.employee_id === employee.id || a.user_id === employee.user_id);
    const empAdvances = advances.filter(a => a.employee_id === employee.id);
    
    let totalHours = 0;
    empAttendance.forEach(a => {
      if (a.total_hours) {
        totalHours += a.total_hours;
      } else if (a.login_time && a.logout_time) {
        const login = new Date(a.login_time);
        const logout = new Date(a.logout_time);
        const diff = (logout.getTime() - login.getTime()) / (1000 * 60 * 60);
        if (diff > 0) totalHours += diff;
      }
    });

    const roundedHours = Math.round(totalHours * 2) / 2; // Round to nearest 0.5
    const grossSalary = roundedHours * (employee.hourly_rate || 0);
    const totalAdvances = empAdvances.reduce((sum, a) => sum + a.amount, 0);
    const netSalary = grossSalary - totalAdvances;

    return { roundedHours, grossSalary, totalAdvances, netSalary };
  };

  const handleAddAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setNotification(null);
    try {
      const amount = parseFloat(advanceForm.amount);
      if (isNaN(amount) || amount <= 0) {
        setNotification({ type: 'error', message: 'Please enter a valid amount' });
        setIsLoading(false);
        return;
      }

      const employee = employees.find(emp => emp.id === advanceForm.employee_id);
      if (!employee) {
        setNotification({ type: 'error', message: 'Please select an employee' });
        setIsLoading(false);
        return;
      }
      
      // Add Advance
      const { error: advError } = await supabase.from('advances').insert([{
        employee_id: advanceForm.employee_id,
        amount: amount,
        date: advanceForm.date
      }]);

      if (advError) throw advError;

      // Add to Expenses
      const { error: expError } = await supabase.from('expenses').insert([{
        title: `Advance: ${employee.username}`,
        amount: amount,
        date: advanceForm.date
      }]);

      if (expError) throw expError;

      setAdvanceForm({
        employee_id: '',
        amount: '',
        date: new Date().toISOString().split('T')[0]
      });
      setIsModalOpen(false);
      await fetchData();
      setNotification({ type: 'success', message: 'Advance added successfully' });
    } catch (error) {
      console.error('Error adding advance:', error);
      setNotification({ type: 'error', message: 'Error adding advance. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaySalary = async (employee: Employee) => {
    const { netSalary } = calculateSalary(employee);
    if (netSalary <= 0) {
      setNotification({ type: 'error', message: 'Net salary must be greater than 0' });
      return;
    }
    setConfirmPay(employee);
  };

  const processSalaryPayment = async () => {
    if (!confirmPay) return;
    const employee = confirmPay;
    const { netSalary } = calculateSalary(employee);
    
    setIsLoading(true);
    setNotification(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Add to Expenses
      const { error } = await supabase.from('expenses').insert([{
        title: `Salary: ${employee.username} (${formatDate(dateFilter.startDate)} - ${formatDate(dateFilter.endDate)})`,
        amount: netSalary,
        date: today
      }]);

      if (error) throw error;

      setNotification({ type: 'success', message: `Salary payment of ${formatCurrency(netSalary)} recorded for ${employee.username}` });
      setConfirmPay(null);
      await fetchData();
    } catch (error) {
      console.error('Error paying salary:', error);
      setNotification({ type: 'error', message: 'Error recording salary payment.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAdvance = async (id: string) => {
    if (window.confirm('Delete this advance?')) {
      await supabase.from('advances').delete().eq('id', id);
      fetchData();
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text('Salary Report', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Period: ${formatDate(dateFilter.startDate)} to ${formatDate(dateFilter.endDate)}`, 20, 30);

    const tableData = employees.map(emp => {
      const { roundedHours, grossSalary, totalAdvances, netSalary } = calculateSalary(emp);
      return [emp.username, roundedHours, formatCurrency(grossSalary), formatCurrency(totalAdvances), formatCurrency(netSalary)];
    });

    autoTable(doc, {
      startY: 35,
      head: [['Employee', 'Hours', 'Gross', 'Advances', 'Net Salary']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }
    });
    doc.save('Salary_Report.pdf');
  };

  const filteredEmployees = employees.filter(e => 
    e.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {notification && (
        <div className={`p-4 rounded-xl flex items-center justify-between ${notification.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle2 size={20} /> : <X size={20} />}
            <span className="font-medium">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="hover:opacity-70"><X size={18} /></button>
        </div>
      )}

      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
              <Search size={18} />
            </span>
            <input
              type="text"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm"
            />
          </div>
          <div className="flex gap-2">
            <input type="date" value={dateFilter.startDate} onChange={(e) => setDateFilter({ ...dateFilter, startDate: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none" />
            <input type="date" value={dateFilter.endDate} onChange={(e) => setDateFilter({ ...dateFilter, endDate: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none" />
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button onClick={exportPDF} className="flex-1 md:flex-none bg-gray-100 text-gray-600 px-6 py-2 rounded-xl font-semibold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2">
            <Download size={20} /> Export
          </button>
          <button onClick={() => setIsModalOpen(true)} className="flex-1 md:flex-none bg-primary text-white px-6 py-2 rounded-xl font-semibold hover:bg-primary-hover transition-colors flex items-center justify-center gap-2">
            <Plus size={20} /> Add Advance
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Hours (Rounded)</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Gross Salary</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Advances</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Net Salary</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></td></tr>
              ) : filteredEmployees.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">No employees found</td></tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const { roundedHours, grossSalary, totalAdvances, netSalary } = calculateSalary(emp);
                  return (
                    <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{emp.username}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{roundedHours} hrs</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatCurrency(grossSalary)}</td>
                      <td className="px-6 py-4 text-sm text-red-600">-{formatCurrency(totalAdvances)}</td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">{formatCurrency(netSalary)}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handlePaySalary(emp)}
                          className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-primary-hover transition-all shadow-sm flex items-center gap-2 ml-auto"
                        >
                          <Banknote size={16} />
                          Pay Salary
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Add Advance</h3>
              <button onClick={() => { setIsModalOpen(false); setNotification(null); }} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            <form onSubmit={handleAddAdvance} className="p-6 space-y-4">
              {notification && notification.type === 'error' && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
                  {notification.message}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                <select required value={advanceForm.employee_id} onChange={(e) => setAdvanceForm({ ...advanceForm, employee_id: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white">
                  <option value="">Select Employee</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.username}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                <input type="number" step="0.01" required value={advanceForm.amount || ''} onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" required value={advanceForm.date} onChange={(e) => setAdvanceForm({ ...advanceForm, date: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none" />
              </div>
              <div className="pt-4">
                <button type="submit" disabled={isLoading} className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50">
                  {isLoading ? 'Saving...' : 'Add Advance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
              <Banknote size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-gray-900">Confirm Payment</h3>
              <p className="text-gray-500">
                Are you sure you want to pay <span className="font-bold text-gray-900">{formatCurrency(calculateSalary(confirmPay).netSalary)}</span> to <span className="font-bold text-gray-900">{confirmPay.username}</span>?
              </p>
            </div>
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setConfirmPay(null)}
                className="flex-1 py-3 rounded-xl font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={processSalaryPayment}
                disabled={isLoading}
                className="flex-[2] py-3 rounded-xl font-semibold text-white bg-primary hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {isLoading ? 'Processing...' : 'Confirm & Pay'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
