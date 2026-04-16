import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, Building2, Package, TrendingUp, ShoppingCart, FileText, Wallet, Banknote, X, Loader2, Square } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';

export default function DashboardOverview() {
  const [dateFilter, setDateFilter] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [stats, setStats] = useState({
    employees: 0,
    parties: 0,
    products: 0,
    todayProduction: 0,
    totalSales: 0,
    totalPurchases: 0,
    totalExpenses: 0,
    totalSalary: 0,
    profit: 0,
    totalPayable: 0,
    totalReceivable: 0
  });
  const [activeEmployees, setActiveEmployees] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [profitChartData, setProfitChartData] = useState<any[]>([]);

  // End Session Modal State
  const [isEndModalOpen, setIsEndModalOpen] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState<any>(null);
  const [machines, setMachines] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [endFormData, setEndFormData] = useState({
    shift: 'day',
    katai: '',
    patti_per_katay: '',
    mtr_type: '17',
    custom_mtr: '',
    machine_id: ''
  });

  const [calculatedQuantity, setCalculatedQuantity] = useState<number>(0);
  const [manualQuantity, setManualQuantity] = useState<string>('');
  const [selectedMachineDesigns, setSelectedMachineDesigns] = useState<any[]>([]);

  useEffect(() => {
    fetchStats();
    fetchChartData();
    fetchProfitChartData();
    fetchMachines();
  }, [dateFilter]);

  useEffect(() => {
    if (endFormData.machine_id) {
      fetchMachineDesigns(endFormData.machine_id);
    }
  }, [endFormData.machine_id]);

  const fetchMachineDesigns = async (machineId: string) => {
    const { data } = await supabase
      .from('designs')
      .select('*, products(*)')
      .eq('machine_id', machineId);
    if (data) setSelectedMachineDesigns(data);
  };

  useEffect(() => {
    calculateProduction();
  }, [endFormData.katai, endFormData.patti_per_katay, selectedMachineDesigns]);

  const calculateProduction = () => {
    const katay = parseInt(endFormData.katai) || 0;
    const pattiPerKatay = parseInt(endFormData.patti_per_katay) || 0;
    
    if (katay > 0 && pattiPerKatay > 0 && selectedMachineDesigns.length > 0) {
      const totalPatti = katay * pattiPerKatay;
      const firstDesign = selectedMachineDesigns[0];
      const productMts = firstDesign.products?.product_mts || 0;
      const pattiMts = firstDesign.products?.patti_mts || 0;

      if (productMts > 0 && pattiMts > 0) {
        const pattiRequired = productMts / pattiMts;
        const totalProduct = Math.round(totalPatti / pattiRequired);
        setCalculatedQuantity(totalProduct);
        setManualQuantity(totalProduct.toString());
      } else {
        setCalculatedQuantity(0);
        setManualQuantity('');
      }
    } else {
      setCalculatedQuantity(0);
      setManualQuantity('');
    }
  };

  const fetchMachines = async () => {
    const { data } = await supabase.from('machines').select('*').order('name', { ascending: true });
    if (data) setMachines(data);
  };

  const roundHours = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    let roundedMinutes = 0;
    if (minutes >= 30) {
      roundedMinutes = 1;
    } else if (minutes >= 15) {
      roundedMinutes = 0.5;
    }
    return hours + roundedMinutes;
  };

  const fetchStats = async () => {
    setIsLoading(true);
    const today = new Date().toISOString().split('T')[0];
    
    const [emp, part, prod, attToday, sales, purchases, expenses, purchasePayments, salesPayments, allAtt, allEmps, activeAtt, challans] = await Promise.all([
      supabase.from('employees').select('*', { count: 'exact', head: true }),
      supabase.from('parties').select('*', { count: 'exact', head: true }),
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase.from('attendance').select('katai').eq('date', today),
      supabase.from('challans').select('total_amount').gte('date', dateFilter.startDate).lte('date', dateFilter.endDate),
      supabase.from('purchases').select('total_amount').gte('date', dateFilter.startDate).lte('date', dateFilter.endDate),
      supabase.from('expenses').select('amount').gte('date', dateFilter.startDate).lte('date', dateFilter.endDate),
      supabase.from('purchase_payments').select('amount_paid'),
      supabase.from('sales_payments').select('amount_received'),
      supabase.from('attendance').select('*').gte('date', dateFilter.startDate).lte('date', dateFilter.endDate),
      supabase.from('employees').select('id, user_id, hourly_rate'),
      supabase.from('attendance').select('*, employee:employees!user_id(username)').is('logout_time', null),
      supabase.from('challans').select('total_profit').gte('date', dateFilter.startDate).lte('date', dateFilter.endDate)
    ]);

    const todayProd = attToday.data?.reduce((sum, item) => sum + (item.katai || 0), 0) || 0;
    const totalSales = sales.data?.reduce((sum, item) => sum + (item.total_amount || 0), 0) || 0;
    const totalPurchases = purchases.data?.reduce((sum, item) => sum + (item.total_amount || 0), 0) || 0;
    const totalExpenses = expenses.data?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
    const totalChallanProfit = challans.data?.reduce((sum, item) => sum + (item.total_profit || 0), 0) || 0;
    
    // Calculate Salary
    let totalSalary = 0;
    if (allEmps.data && allAtt.data) {
      allEmps.data.forEach(employee => {
        const empAttendance = allAtt.data.filter(a => a.employee_id === employee.id || a.user_id === employee.user_id);
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
        const roundedHours = Math.round(totalHours * 2) / 2;
        totalSalary += roundedHours * (employee.hourly_rate || 0);
      });
    }

    const totalPaid = purchasePayments.data?.reduce((sum, item) => sum + (item.amount_paid || 0), 0) || 0;
    const totalReceived = salesPayments.data?.reduce((sum, item) => sum + (item.amount_received || 0), 0) || 0;

    // All-time totals for payable/receivable (not filtered by date range for accurate balance)
    const [allSales, allPurchases] = await Promise.all([
      supabase.from('challans').select('total_amount'),
      supabase.from('purchases').select('total_amount')
    ]);
    const allSalesTotal = allSales.data?.reduce((sum, item) => sum + (item.total_amount || 0), 0) || 0;
    const allPurchasesTotal = allPurchases.data?.reduce((sum, item) => sum + (item.total_amount || 0), 0) || 0;

    setStats({
      employees: emp.count || 0,
      parties: part.count || 0,
      products: prod.count || 0,
      todayProduction: todayProd,
      totalSales,
      totalPurchases,
      totalExpenses,
      totalSalary,
      profit: totalChallanProfit - totalExpenses,
      totalPayable: allPurchasesTotal - totalPaid,
      totalReceivable: allSalesTotal - totalReceived
    });

    if (activeAtt.error) {
      console.error('Error fetching active employees:', activeAtt.error);
    }

    if (activeAtt.data) {
      setActiveEmployees(activeAtt.data);
    }
    setIsLoading(false);
  };

  const fetchChartData = async () => {
    const { data } = await supabase
      .from('attendance')
      .select('date, katai')
      .order('date', { ascending: true })
      .limit(30);

    if (data) {
      const grouped = data.reduce((acc: any, item) => {
        const date = item.date;
        if (!acc[date]) acc[date] = 0;
        acc[date] += item.katai || 0;
        return acc;
      }, {});

      const formatted = Object.entries(grouped).map(([date, katai]) => ({
        date: new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        katai
      }));
      setChartData(formatted);
    }
  };

  const calculateDuration = (loginTime: string) => {
    const login = new Date(loginTime);
    const now = new Date();
    const diff = (now.getTime() - login.getTime()) / (1000 * 60);
    if (diff < 0) return '0m';
    
    const hours = Math.floor(diff / 60);
    const minutes = Math.floor(diff % 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const fetchProfitChartData = async () => {
    const { data: challans } = await supabase.from('challans').select('date, total_amount, total_profit').gte('date', dateFilter.startDate).lte('date', dateFilter.endDate);
    const { data: purchases } = await supabase.from('purchases').select('date, total_amount').gte('date', dateFilter.startDate).lte('date', dateFilter.endDate);
    const { data: expenses } = await supabase.from('expenses').select('date, amount').gte('date', dateFilter.startDate).lte('date', dateFilter.endDate);
    
    const dailyData: any = {};
    
    challans?.forEach(c => {
      if (!dailyData[c.date]) dailyData[c.date] = { sales: 0, cost: 0, profit: 0, expenses: 0 };
      dailyData[c.date].profit += c.total_profit || 0;
      dailyData[c.date].sales += c.total_amount || 0;
    });
    
    purchases?.forEach(p => {
      if (!dailyData[p.date]) dailyData[p.date] = { sales: 0, cost: 0, profit: 0, expenses: 0 };
      dailyData[p.date].cost += p.total_amount || 0;
    });
    
    expenses?.forEach(e => {
      if (!dailyData[e.date]) dailyData[e.date] = { sales: 0, cost: 0, profit: 0, expenses: 0 };
      dailyData[e.date].expenses += e.amount || 0;
    });
    
    const formatted = Object.entries(dailyData).map(([date, values]: any) => ({
      date: new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      sales: values.sales,
      cost: values.cost + values.expenses, // Total cost for the bar chart
      profit: values.profit - values.expenses // Net profit following the user's formula
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    setProfitChartData(formatted);
  };

  const handleEndSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAttendance) return;
    if (!endFormData.machine_id) return alert('Please select a machine!');
    
    setIsSubmitting(true);
    try {
      const logoutTime = new Date();
      const loginTime = new Date(selectedAttendance.login_time);
      const diffMs = logoutTime.getTime() - loginTime.getTime();
      const diffHrs = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

      const finalQuantity = parseFloat(manualQuantity) || calculatedQuantity;

      // 1. Update Attendance
      const { error: attError } = await supabase
        .from('attendance')
        .update({
          logout_time: logoutTime.toISOString(),
          total_hours: diffHrs,
          shift: endFormData.shift,
          katai: parseInt(endFormData.katai),
          patti_per_katay: parseInt(endFormData.patti_per_katay),
          mtr_type: endFormData.mtr_type === 'custom' ? endFormData.custom_mtr : endFormData.mtr_type,
          machine_id: endFormData.machine_id
        })
        .eq('id', selectedAttendance.id);

      if (attError) throw attError;

      // 2. Split Production among designs
      if (selectedMachineDesigns && selectedMachineDesigns.length > 0) {
        const totalPattiCount = selectedMachineDesigns.reduce((sum, d) => sum + d.patti_count, 0);
        const productionEntries = selectedMachineDesigns.map(d => ({
          attendance_id: selectedAttendance.id,
          design_id: d.id,
          mts: (finalQuantity * d.patti_count) / totalPattiCount
        }));
        await supabase.from('production').insert(productionEntries);
      }

      setIsEndModalOpen(false);
      setSelectedAttendance(null);
      setEndFormData({ shift: 'day', katai: '', patti_per_katay: '', mtr_type: '17', custom_mtr: '', machine_id: '' });
      setCalculatedQuantity(0);
      setManualQuantity('');
      fetchStats();
      alert('Session ended successfully!');
    } catch (error) {
      console.error('Error ending session:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const statCards = [
    { label: 'Total Sales', value: formatCurrency(stats.totalSales), icon: FileText, color: 'bg-green-50 text-green-600' },
    { label: 'Total Purchases', value: formatCurrency(stats.totalPurchases), icon: ShoppingCart, color: 'bg-purple-50 text-purple-600' },
    { label: 'Total Expenses', value: formatCurrency(stats.totalExpenses), icon: Wallet, color: 'bg-red-50 text-red-600' },
    { label: 'Total Salary', value: formatCurrency(stats.totalSalary), icon: Users, color: 'bg-blue-50 text-blue-600' },
    { 
      label: 'FINAL PROFIT', 
      value: formatCurrency(stats.profit), 
      icon: TrendingUp, 
      color: stats.profit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600' 
    },
    { label: 'Total Payable', value: formatCurrency(stats.totalPayable), icon: Banknote, color: 'bg-orange-50 text-orange-600' },
  ];

  return (
    <div className="space-y-8">
      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <h2 className="text-lg font-bold text-gray-900">Business Overview</h2>
        <div className="flex gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">From:</span>
            <input 
              type="date" 
              value={dateFilter.startDate} 
              onChange={(e) => setDateFilter({ ...dateFilter, startDate: e.target.value })} 
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary" 
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">To:</span>
            <input 
              type="date" 
              value={dateFilter.endDate} 
              onChange={(e) => setDateFilter({ ...dateFilter, endDate: e.target.value })} 
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary" 
            />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl ${stat.color}`}>
                <stat.icon size={24} />
              </div>
            </div>
            <p className="text-sm font-medium text-gray-500">{stat.label}</p>
            <h3 className={`text-xl font-bold mt-1 ${stat.label === 'FINAL PROFIT' ? (stats.profit >= 0 ? 'text-emerald-600' : 'text-rose-600') : 'text-gray-900'}`}>
              {stat.value}
            </h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Employees */}
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Active Employees</h3>
            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
              {activeEmployees.length} Online
            </span>
          </div>
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            {activeEmployees.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No active employees right now</p>
            ) : (
              activeEmployees.map((att, i) => (
                <div key={i} className="group relative flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-primary/30 transition-all">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{att.employee?.username}</p>
                    <p className="text-xs text-gray-500">Entered at: {new Date(att.login_time).toLocaleTimeString()}</p>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div>
                      <p className="text-sm font-bold text-primary">{calculateDuration(att.login_time)}</p>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Working</p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedAttendance(att);
                        setIsEndModalOpen(true);
                      }}
                      className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors opacity-0 group-hover:opacity-100"
                      title="End Session"
                    >
                      <Square size={16} fill="currentColor" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Charts Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Profit Trend</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={profitChartData}>
                  <defs>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Area type="monotone" dataKey="profit" stroke="#10b981" fillOpacity={1} fill="url(#colorProfit)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Sales vs Cost</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={profitChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <Tooltip 
                    cursor={{ fill: '#f9fafb' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="sales" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="cost" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* End Session Modal */}
      <AnimatePresence>
        {isEndModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">End Session</h3>
                  <p className="text-xs text-gray-500">Employee: {selectedAttendance?.employee?.username}</p>
                </div>
                <button onClick={() => setIsEndModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleEndSession} className="p-6 space-y-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Select Machine</label>
                    <select
                      required
                      value={endFormData.machine_id}
                      onChange={(e) => setEndFormData({ ...endFormData, machine_id: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none bg-white"
                    >
                      <option value="">Choose Machine</option>
                      {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Shift</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setEndFormData({ ...endFormData, shift: 'day' })}
                        className={`py-2 rounded-xl font-bold border-2 transition-all ${endFormData.shift === 'day' ? 'border-primary bg-primary text-white' : 'border-gray-100 text-gray-500'}`}
                      >
                        Day
                      </button>
                      <button
                        type="button"
                        onClick={() => setEndFormData({ ...endFormData, shift: 'night' })}
                        className={`py-2 rounded-xl font-bold border-2 transition-all ${endFormData.shift === 'night' ? 'border-primary bg-primary text-white' : 'border-gray-100 text-gray-500'}`}
                      >
                        Night
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Katai (Count)</label>
                      <input
                        type="number"
                        required
                        value={endFormData.katai}
                        onChange={(e) => setEndFormData({ ...endFormData, katai: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">MTR per Katai</label>
                      <select
                        value={endFormData.mtr_type}
                        onChange={(e) => setEndFormData({ ...endFormData, mtr_type: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none bg-white"
                      >
                        <option value="17">17</option>
                        <option value="24">24</option>
                        <option value="36">36</option>
                        <option value="171">171</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                  </div>

                  {endFormData.mtr_type === 'custom' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                    >
                      <label className="block text-sm font-bold text-gray-700 mb-2">Enter Custom MTR</label>
                      <input
                        type="text"
                        required
                        value={endFormData.custom_mtr}
                        onChange={(e) => setEndFormData({ ...endFormData, custom_mtr: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                        placeholder="e.g. 42"
                      />
                    </motion.div>
                  )}

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Patti per Katai</label>
                    <input
                      type="number"
                      required
                      value={endFormData.patti_per_katay}
                      onChange={(e) => setEndFormData({ ...endFormData, patti_per_katay: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                      placeholder="0"
                    />
                  </div>

                  {calculatedQuantity > 0 && (
                    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 space-y-3 text-center">
                      <div className="text-sm font-medium text-blue-700">Calculated Production</div>
                      <div className="text-2xl font-bold text-blue-900">
                        {endFormData.katai} × {endFormData.mtr_type === 'custom' ? endFormData.custom_mtr : endFormData.mtr_type} = {calculatedQuantity} MTR
                      </div>
                      <div className="pt-2 border-t border-blue-100">
                        <label className="block text-xs font-bold text-blue-600 mb-1 uppercase">Manual Correction (Optional)</label>
                        <input
                          type="number"
                          value={manualQuantity}
                          onChange={(e) => setManualQuantity(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none font-bold text-blue-900 text-center"
                          placeholder="Override total MTR if needed"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsEndModalOpen(false)}
                    className="flex-1 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-[2] py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-all shadow-lg shadow-red-100 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'End Session'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
