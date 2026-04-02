import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Attendance, Challan, Party, Employee } from '../../types';
import { Search, Calendar, User, Building2, FileText, Download, Loader2, BarChart3 } from 'lucide-react';
import { formatDate, formatCurrency, formatAmount } from '../../lib/utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Reports() {
  const [activeTab, setActiveTab] = useState<'katai' | 'challan'>('katai');
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // Katai Report State
  const [kataiRecords, setKataiRecords] = useState<Attendance[]>([]);
  const [kataiFilters, setKataiFilters] = useState({ startDate: '', endDate: '', employee: '', searchTerm: '' });
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Challan Report State
  const [challanRecords, setChallanRecords] = useState<Challan[]>([]);
  const [challanFilters, setChallanFilters] = useState({ party: '', startDate: '', endDate: '' });
  const [parties, setParties] = useState<Party[]>([]);

  useEffect(() => {
    fetchEmployees();
    fetchParties();
  }, []);

  useEffect(() => {
    if (activeTab === 'katai') fetchKataiReport();
    else fetchChallanReport();
  }, [activeTab, kataiFilters, challanFilters]);

  const fetchEmployees = async () => {
    const { data } = await supabase.from('employees').select('*');
    if (data) setEmployees(data);
  };

  const fetchParties = async () => {
    const { data } = await supabase.from('parties').select('*');
    if (data) setParties(data);
  };

  const fetchKataiReport = async () => {
    setIsLoading(true);
    let query = supabase.from('attendance').select('*, employee:employees(username)').order('date', { ascending: false });
    if (kataiFilters.startDate) query = query.gte('date', kataiFilters.startDate);
    if (kataiFilters.endDate) query = query.lte('date', kataiFilters.endDate);
    if (kataiFilters.employee) query = query.eq('user_id', kataiFilters.employee);
    
    const { data } = await query;
    if (data) {
      let filtered = data as any[];
      if (kataiFilters.searchTerm) {
        filtered = filtered.filter(r => 
          r.employee?.username?.toLowerCase().includes(kataiFilters.searchTerm.toLowerCase())
        );
      }
      setKataiRecords(filtered);
    }
    setIsLoading(false);
  };

  const fetchChallanReport = async () => {
    setIsLoading(true);
    let query = supabase.from('challans').select('*, party:parties(name)').order('date', { ascending: false });
    if (challanFilters.party) query = query.eq('party_id', challanFilters.party);
    if (challanFilters.startDate) query = query.gte('date', challanFilters.startDate);
    if (challanFilters.endDate) query = query.lte('date', challanFilters.endDate);
    const { data } = await query;
    if (data) setChallanRecords(data as any);
    setIsLoading(false);
  };

  const exportKataiPDF = () => {
    try {
      setIsExporting(true);
      if (kataiRecords.length === 0) {
        alert('No records to export');
        setIsExporting(false);
        return;
      }
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text('Katai Production Report', 105, 20, { align: 'center' });
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, 30);
      if (kataiFilters.startDate || kataiFilters.endDate) {
        const start = kataiFilters.startDate ? formatDate(kataiFilters.startDate) : 'Start';
        const end = kataiFilters.endDate ? formatDate(kataiFilters.endDate) : 'End';
        doc.text(`Period: ${start} to ${end}`, 20, 35);
      }

      const tableData = kataiRecords.map(r => [
        formatDate(r.date),
        r.employee?.username || r.user_id,
        r.shift || '-',
        r.katai || 0,
        r.mtr_type || '-'
      ]);

      const totalKatai = kataiRecords.reduce((sum, r) => sum + (r.katai || 0), 0);

      autoTable(doc, {
        startY: 40,
        head: [['Date', 'Employee', 'Shift', 'Katai', 'MTR Type']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] }, // Indigo 600
        foot: [['', '', 'Total Katai', totalKatai, '']],
        footStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold' }
      });

      doc.save('Katai_Report.pdf');
    } catch (error) {
      console.error('PDF Export Error:', error);
      alert('Error generating PDF. Please check the console.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportChallanPDF = () => {
    try {
      setIsExporting(true);
      if (challanRecords.length === 0) {
        alert('No records to export');
        setIsExporting(false);
        return;
      }
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text('Challan Summary Report', 105, 20, { align: 'center' });
      doc.setFontSize(10);
      
      if (challanFilters.startDate || challanFilters.endDate) {
        const start = challanFilters.startDate ? formatDate(challanFilters.startDate) : 'Start';
        const end = challanFilters.endDate ? formatDate(challanFilters.endDate) : 'End';
        doc.text(`Period: ${start} to ${end}`, 20, 30);
      }

      const tableData = challanRecords.map(r => [
        r.challan_no,
        formatDate(r.date),
        r.party?.name || 'N/A',
        formatAmount(r.total_amount)
      ]);

      const totalSum = challanRecords.reduce((sum, r) => sum + (r.total_amount || 0), 0);

      autoTable(doc, {
        startY: 35,
        head: [['Challan No', 'Date', 'Party', 'Total Amount']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] }, // Indigo 600
        foot: [['', '', 'Final Total', formatAmount(totalSum)]],
        footStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold' }
      });

      doc.save('Challan_Report.pdf');
    } catch (error) {
      console.error('PDF Export Error:', error);
      alert('Error generating PDF. Please check the console.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('katai')}
          className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'katai' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Katai Report
        </button>
        <button
          onClick={() => setActiveTab('challan')}
          className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'challan' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Challan Report
        </button>
      </div>

      {/* Filters & Export */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-end gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 flex-1 w-full">
          {activeTab === 'katai' ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Search Employee</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                    <Search size={14} />
                  </span>
                  <input 
                    type="text" 
                    placeholder="Search name..."
                    value={kataiFilters.searchTerm} 
                    onChange={(e) => setKataiFilters({ ...kataiFilters, searchTerm: e.target.value })} 
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary focus:border-transparent" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
                <input type="date" value={kataiFilters.startDate} onChange={(e) => setKataiFilters({ ...kataiFilters, startDate: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
                <input type="date" value={kataiFilters.endDate} onChange={(e) => setKataiFilters({ ...kataiFilters, endDate: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Select Employee</label>
                <select value={kataiFilters.employee} onChange={(e) => setKataiFilters({ ...kataiFilters, employee: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none bg-white focus:ring-2 focus:ring-primary focus:border-transparent">
                  <option value="">All Employees</option>
                  {employees.map(e => <option key={e.id} value={e.user_id}>{e.username}</option>)}
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Party</label>
                <select value={challanFilters.party} onChange={(e) => setChallanFilters({ ...challanFilters, party: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none bg-white focus:ring-2 focus:ring-primary focus:border-transparent">
                  <option value="">All Parties</option>
                  {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
                <input type="date" value={challanFilters.startDate} onChange={(e) => setChallanFilters({ ...challanFilters, startDate: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
                <input type="date" value={challanFilters.endDate} onChange={(e) => setChallanFilters({ ...challanFilters, endDate: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary focus:border-transparent" />
              </div>
            </>
          )}
        </div>
        <button
          onClick={activeTab === 'katai' ? exportKataiPDF : exportChallanPDF}
          disabled={isExporting}
          className="bg-primary text-white px-6 py-2 rounded-xl font-semibold hover:bg-primary-hover transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
        >
          {isExporting ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
          {isExporting ? 'Exporting...' : 'Export PDF'}
        </button>
      </div>

      {/* Report Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              {activeTab === 'katai' ? (
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Shift</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Katai</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">MTR</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Challan No</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Party</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" size={32} /></td>
                </tr>
              ) : (activeTab === 'katai' ? kataiRecords : challanRecords).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">No records found for the selected filters</td>
                </tr>
              ) : (
                (activeTab === 'katai' ? kataiRecords : challanRecords).map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    {activeTab === 'katai' ? (
                      <>
                        <td className="px-6 py-4 text-sm text-gray-600">{formatDate(r.date)}</td>
                        <td className="px-6 py-4 font-medium text-gray-900">{r.employee?.username}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 capitalize">{r.shift}</td>
                        <td className="px-6 py-4 font-bold text-gray-900">{r.katai}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{r.mtr_type}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 font-bold text-gray-900">{r.challan_no}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{formatDate(r.date)}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{r.party?.name}</td>
                        <td className="px-6 py-4 font-bold text-gray-900">{formatCurrency(r.total_amount)}</td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
