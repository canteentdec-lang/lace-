import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Attendance, Challan, Party, Employee, Settings } from '../../types';
import { Search, Calendar, User, Building2, FileText, Download, Loader2, BarChart3 } from 'lucide-react';
import { formatDate, formatCurrency, formatAmount, loadImage } from '../../lib/utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Reports() {
  const [activeTab, setActiveTab] = useState<'katai' | 'challan' | 'purchase' | 'bill' | 'purchase_due' | 'sales_due'>('katai');
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  
  // Katai Report State
  const [kataiRecords, setKataiRecords] = useState<Attendance[]>([]);
  const [kataiFilters, setKataiFilters] = useState({ startDate: '', endDate: '', employee: '', searchTerm: '' });
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Challan Report State
  const [challanRecords, setChallanRecords] = useState<Challan[]>([]);
  const [challanFilters, setChallanFilters] = useState({ party: '', startDate: '', endDate: '' });
  const [parties, setParties] = useState<Party[]>([]);

  // Purchase Report State
  const [purchaseRecords, setPurchaseRecords] = useState<any[]>([]);
  const [purchaseFilters, setPurchaseFilters] = useState({ party: '', startDate: '', endDate: '' });

  // Bill Report State
  const [billRecords, setBillRecords] = useState<any[]>([]);
  const [billFilters, setBillFilters] = useState({ party: '', startDate: '', endDate: '' });

  // Purchase Due Report State
  const [purchaseDueRecords, setPurchaseDueRecords] = useState<any[]>([]);
  const [purchaseDueFilters, setPurchaseDueFilters] = useState({ party: '', startDate: '', endDate: '' });

  // Sales Due Report State
  const [salesDueRecords, setSalesDueRecords] = useState<any[]>([]);
  const [salesDueFilters, setSalesDueFilters] = useState({ party: '', startDate: '', endDate: '' });

  useEffect(() => {
    fetchEmployees();
    fetchParties();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase.from('settings').select('*').single();
    if (data) setSettings(data);
  };

  useEffect(() => {
    if (activeTab === 'katai') fetchKataiReport();
    else if (activeTab === 'challan') fetchChallanReport();
    else if (activeTab === 'purchase') fetchPurchaseReport();
    else if (activeTab === 'bill') fetchBillReport();
    else if (activeTab === 'purchase_due') fetchPurchaseDueReport();
    else if (activeTab === 'sales_due') fetchSalesDueReport();
  }, [activeTab, kataiFilters, challanFilters, purchaseFilters, billFilters, purchaseDueFilters, salesDueFilters]);

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

  const fetchPurchaseReport = async () => {
    setIsLoading(true);
    let query = supabase.from('purchases').select('*, party:parties(name)').order('date', { ascending: false });
    if (purchaseFilters.party) query = query.eq('party_id', purchaseFilters.party);
    if (purchaseFilters.startDate) query = query.gte('date', purchaseFilters.startDate);
    if (purchaseFilters.endDate) query = query.lte('date', purchaseFilters.endDate);
    const { data } = await query;
    if (data) setPurchaseRecords(data as any);
    setIsLoading(false);
  };

  const fetchBillReport = async () => {
    setIsLoading(true);
    let query = supabase.from('bills').select('*, party:parties(name)').order('date', { ascending: false });
    if (billFilters.party) query = query.eq('party_id', billFilters.party);
    if (billFilters.startDate) query = query.gte('date', billFilters.startDate);
    if (billFilters.endDate) query = query.lte('date', billFilters.endDate);
    const { data } = await query;
    if (data) setBillRecords(data as any);
    setIsLoading(false);
  };

  const fetchPurchaseDueReport = async () => {
    setIsLoading(true);
    let query = supabase.from('parties').select('*').eq('type', 'purchase');
    if (purchaseDueFilters.party) query = query.eq('id', purchaseDueFilters.party);
    
    const { data: partiesData } = await query;
    if (partiesData) {
      const records = await Promise.all(partiesData.map(async (party) => {
        let pQuery = supabase.from('purchases').select('total_amount').eq('party_id', party.id);
        let payQuery = supabase.from('purchase_payments').select('amount_paid').eq('party_id', party.id);
        
        if (purchaseDueFilters.startDate) {
          pQuery = pQuery.gte('date', purchaseDueFilters.startDate);
          payQuery = payQuery.gte('date', purchaseDueFilters.startDate);
        }
        if (purchaseDueFilters.endDate) {
          pQuery = pQuery.lte('date', purchaseDueFilters.endDate);
          payQuery = payQuery.lte('date', purchaseDueFilters.endDate);
        }

        const [purchases, payments] = await Promise.all([pQuery, payQuery]);
        const total = purchases.data?.reduce((sum, p) => sum + (p.total_amount || 0), 0) || 0;
        const paid = payments.data?.reduce((sum, p) => sum + (p.amount_paid || 0), 0) || 0;
        return { name: party.name, total, paid, remaining: total - paid };
      }));
      setPurchaseDueRecords(records);
    }
    setIsLoading(false);
  };

  const fetchSalesDueReport = async () => {
    setIsLoading(true);
    let query = supabase.from('parties').select('*').eq('type', 'sell');
    if (salesDueFilters.party) query = query.eq('id', salesDueFilters.party);
    
    const { data: partiesData } = await query;
    if (partiesData) {
      const records = await Promise.all(partiesData.map(async (party) => {
        let sQuery = supabase.from('challans').select('total_amount').eq('party_id', party.id);
        let recQuery = supabase.from('sales_payments').select('amount_received').eq('party_id', party.id);
        
        if (salesDueFilters.startDate) {
          sQuery = sQuery.gte('date', salesDueFilters.startDate);
          recQuery = recQuery.gte('date', salesDueFilters.startDate);
        }
        if (salesDueFilters.endDate) {
          sQuery = sQuery.lte('date', salesDueFilters.endDate);
          recQuery = recQuery.lte('date', salesDueFilters.endDate);
        }

        const [sales, receipts] = await Promise.all([sQuery, recQuery]);
        const total = sales.data?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0;
        const received = receipts.data?.reduce((sum, p) => sum + (p.amount_received || 0), 0) || 0;
        return { name: party.name, total, received, remaining: total - received };
      }));
      setSalesDueRecords(records);
    }
    setIsLoading(false);
  };

  const exportKataiPDF = async () => {
    try {
      setIsExporting(true);
      if (kataiRecords.length === 0) {
        alert('No records to export');
        setIsExporting(false);
        return;
      }
      const doc = new jsPDF();

      // Header with logo
      if (settings?.logo_url && (settings.logo_url.startsWith('http') || settings.logo_url.startsWith('data:'))) {
        try {
          const logoBase64 = await loadImage(settings.logo_url);
          doc.addImage(logoBase64, 'PNG', 15, 10, 20, 20);
        } catch (e) {
          console.error('Error adding logo to PDF:', e);
        }
      }

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

  const exportChallanPDF = async (isAdmin: boolean = true) => {
    try {
      setIsExporting(true);
      if (challanRecords.length === 0) {
        alert('No records to export');
        setIsExporting(false);
        return;
      }
      const doc = new jsPDF();

      // Header with logo
      if (settings?.logo_url && (settings.logo_url.startsWith('http') || settings.logo_url.startsWith('data:'))) {
        try {
          const logoBase64 = await loadImage(settings.logo_url);
          doc.addImage(logoBase64, 'PNG', 15, 10, 20, 20);
        } catch (e) {
          console.error('Error adding logo to PDF:', e);
        }
      }

      doc.setFontSize(18);
      doc.text('Challan Summary Report' + (isAdmin ? ' (Admin)' : ' (Party)'), 105, 20, { align: 'center' });
      doc.setFontSize(10);
      
      if (challanFilters.startDate || challanFilters.endDate) {
        const start = challanFilters.startDate ? formatDate(challanFilters.startDate) : 'Start';
        const end = challanFilters.endDate ? formatDate(challanFilters.endDate) : 'End';
        doc.text(`Period: ${start} to ${end}`, 20, 30);
      }

      const tableData = challanRecords.map(r => {
        const row = [
          r.challan_no,
          formatDate(r.date),
          r.party?.name || 'N/A',
          formatAmount(r.total_amount)
        ];
        if (isAdmin) {
          row.push(formatAmount(r.total_profit || 0));
        }
        return row;
      });

      const totalSum = challanRecords.reduce((sum, r) => sum + (r.total_amount || 0), 0);
      const totalProfit = challanRecords.reduce((sum, r) => sum + (r.total_profit || 0), 0);

      const head = [['Challan No', 'Date', 'Party', 'Total Amount']];
      if (isAdmin) head[0].push('Profit');

      const foot = [['', '', 'Final Total', formatAmount(totalSum)]];
      if (isAdmin) foot[0].push(formatAmount(totalProfit));

      autoTable(doc, {
        startY: 35,
        head: head,
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] }, // Indigo 600
        foot: foot,
        footStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold' }
      });

      doc.save(`Challan_Report_${isAdmin ? 'Admin' : 'Party'}.pdf`);
    } catch (error) {
      console.error('PDF Export Error:', error);
      alert('Error generating PDF. Please check the console.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportPurchasePDF = async () => {
    try {
      setIsExporting(true);
      if (purchaseRecords.length === 0) {
        alert('No records to export');
        setIsExporting(false);
        return;
      }
      const doc = new jsPDF();

      // Header with logo
      if (settings?.logo_url && (settings.logo_url.startsWith('http') || settings.logo_url.startsWith('data:'))) {
        try {
          const logoBase64 = await loadImage(settings.logo_url);
          doc.addImage(logoBase64, 'PNG', 15, 10, 20, 20);
        } catch (e) {
          console.error('Error adding logo to PDF:', e);
        }
      }

      doc.setFontSize(18);
      doc.text('Purchase Summary Report', 105, 20, { align: 'center' });
      doc.setFontSize(10);
      
      if (purchaseFilters.startDate || purchaseFilters.endDate) {
        const start = purchaseFilters.startDate ? formatDate(purchaseFilters.startDate) : 'Start';
        const end = purchaseFilters.endDate ? formatDate(purchaseFilters.endDate) : 'End';
        doc.text(`Period: ${start} to ${end}`, 20, 30);
      }

      const tableData = purchaseRecords.map(r => [
        r.purchase_number,
        formatDate(r.date),
        r.party?.name || 'N/A',
        formatAmount(r.total_amount)
      ]);

      const totalSum = purchaseRecords.reduce((sum, r) => sum + (r.total_amount || 0), 0);

      autoTable(doc, {
        startY: 35,
        head: [['Purchase No', 'Date', 'Party', 'Total Amount']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] }, // Indigo 600
        foot: [['', '', 'Final Total', formatAmount(totalSum)]],
        footStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold' }
      });

      doc.save('Purchase_Report.pdf');
    } catch (error) {
      console.error('PDF Export Error:', error);
      alert('Error generating PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportBillPDF = async () => {
    try {
      setIsExporting(true);
      if (billRecords.length === 0) {
        alert('No records to export');
        setIsExporting(false);
        return;
      }
      const doc = new jsPDF();

      // Header with logo
      if (settings?.logo_url && (settings.logo_url.startsWith('http') || settings.logo_url.startsWith('data:'))) {
        try {
          const logoBase64 = await loadImage(settings.logo_url);
          doc.addImage(logoBase64, 'PNG', 15, 10, 20, 20);
        } catch (e) {
          console.error('Error adding logo to PDF:', e);
        }
      }

      doc.setFontSize(18);
      doc.text('Bill Summary Report', 105, 20, { align: 'center' });
      doc.setFontSize(10);
      
      if (billFilters.startDate || billFilters.endDate) {
        const start = billFilters.startDate ? formatDate(billFilters.startDate) : 'Start';
        const end = billFilters.endDate ? formatDate(billFilters.endDate) : 'End';
        doc.text(`Period: ${start} to ${end}`, 20, 30);
      }

      const tableData = billRecords.map(r => [
        r.bill_no,
        formatDate(r.date),
        r.party?.name || 'N/A',
        formatAmount(r.grand_total),
        formatAmount(r.total_profit || 0)
      ]);

      const totalSum = billRecords.reduce((sum, r) => sum + (r.grand_total || 0), 0);
      const totalProfit = billRecords.reduce((sum, r) => sum + (r.total_profit || 0), 0);

      autoTable(doc, {
        startY: 35,
        head: [['Bill No', 'Date', 'Party', 'Grand Total', 'Profit']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] }, // Indigo 600
        foot: [['', '', 'Final Total', formatAmount(totalSum), formatAmount(totalProfit)]],
        footStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold' }
      });

      doc.save('Bill_Report.pdf');
    } catch (error) {
      console.error('PDF Export Error:', error);
      alert('Error generating PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportPurchaseDuePDF = async () => {
    try {
      setIsExporting(true);
      const doc = new jsPDF();

      // Header with logo
      if (settings?.logo_url && (settings.logo_url.startsWith('http') || settings.logo_url.startsWith('data:'))) {
        try {
          const logoBase64 = await loadImage(settings.logo_url);
          doc.addImage(logoBase64, 'PNG', 15, 10, 20, 20);
        } catch (e) {
          console.error('Error adding logo to PDF:', e);
        }
      }

      doc.text('Purchase Due Report', 105, 20, { align: 'center' });
      const tableData = purchaseDueRecords.map(r => [r.name, formatAmount(r.total), formatAmount(r.paid), formatAmount(r.remaining)]);
      autoTable(doc, {
        startY: 30,
        head: [['Party Name', 'Total Purchase', 'Total Paid', 'Remaining Due']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] }
      });
      doc.save('Purchase_Due_Report.pdf');
    } finally {
      setIsExporting(false);
    }
  };

  const exportSalesDuePDF = async () => {
    try {
      setIsExporting(true);
      const doc = new jsPDF();

      // Header with logo
      if (settings?.logo_url && (settings.logo_url.startsWith('http') || settings.logo_url.startsWith('data:'))) {
        try {
          const logoBase64 = await loadImage(settings.logo_url);
          doc.addImage(logoBase64, 'PNG', 15, 10, 20, 20);
        } catch (e) {
          console.error('Error adding logo to PDF:', e);
        }
      }

      doc.text('Sales Due Report', 105, 20, { align: 'center' });
      const tableData = salesDueRecords.map(r => [r.name, formatAmount(r.total), formatAmount(r.received), formatAmount(r.remaining)]);
      autoTable(doc, {
        startY: 30,
        head: [['Party Name', 'Total Sales', 'Total Received', 'Remaining Due']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] }
      });
      doc.save('Sales_Due_Report.pdf');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-xl w-fit overflow-x-auto max-w-full">
        <button
          onClick={() => setActiveTab('katai')}
          className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'katai' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Katai Report
        </button>
        <button
          onClick={() => setActiveTab('challan')}
          className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'challan' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Challan Report
        </button>
        <button
          onClick={() => setActiveTab('purchase')}
          className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'purchase' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Purchase Report
        </button>
        <button
          onClick={() => setActiveTab('bill')}
          className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'bill' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Bill Report
        </button>
        <button
          onClick={() => setActiveTab('purchase_due')}
          className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'purchase_due' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Purchase Due
        </button>
        <button
          onClick={() => setActiveTab('sales_due')}
          className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'sales_due' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Sales Due
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
          ) : activeTab === 'challan' ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Party</label>
                <select value={challanFilters.party} onChange={(e) => setChallanFilters({ ...challanFilters, party: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none bg-white focus:ring-2 focus:ring-primary focus:border-transparent">
                  <option value="">All Parties</option>
                  {parties.filter(p => p.type === 'sell').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
          ) : activeTab === 'purchase' ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Party</label>
                <select value={purchaseFilters.party} onChange={(e) => setPurchaseFilters({ ...purchaseFilters, party: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none bg-white focus:ring-2 focus:ring-primary focus:border-transparent">
                  <option value="">All Parties</option>
                  {parties.filter(p => p.type === 'purchase').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
                <input type="date" value={purchaseFilters.startDate} onChange={(e) => setPurchaseFilters({ ...purchaseFilters, startDate: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
                <input type="date" value={purchaseFilters.endDate} onChange={(e) => setPurchaseFilters({ ...purchaseFilters, endDate: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary focus:border-transparent" />
              </div>
            </>
          ) : activeTab === 'bill' ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Party</label>
                <select value={billFilters.party} onChange={(e) => setBillFilters({ ...billFilters, party: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none bg-white focus:ring-2 focus:ring-primary focus:border-transparent">
                  <option value="">All Parties</option>
                  {parties.filter(p => p.type === 'sell').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
                <input type="date" value={billFilters.startDate} onChange={(e) => setBillFilters({ ...billFilters, startDate: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
                <input type="date" value={billFilters.endDate} onChange={(e) => setBillFilters({ ...billFilters, endDate: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary focus:border-transparent" />
              </div>
            </>
          ) : activeTab === 'purchase_due' ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Party</label>
                <select value={purchaseDueFilters.party} onChange={(e) => setPurchaseDueFilters({ ...purchaseDueFilters, party: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none bg-white focus:ring-2 focus:ring-primary focus:border-transparent">
                  <option value="">All Parties</option>
                  {parties.filter(p => p.type === 'purchase').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
                <input type="date" value={purchaseDueFilters.startDate} onChange={(e) => setPurchaseDueFilters({ ...purchaseDueFilters, startDate: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
                <input type="date" value={purchaseDueFilters.endDate} onChange={(e) => setPurchaseDueFilters({ ...purchaseDueFilters, endDate: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary focus:border-transparent" />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Party</label>
                <select value={salesDueFilters.party} onChange={(e) => setSalesDueFilters({ ...salesDueFilters, party: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none bg-white focus:ring-2 focus:ring-primary focus:border-transparent">
                  <option value="">All Parties</option>
                  {parties.filter(p => p.type === 'sell').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
                <input type="date" value={salesDueFilters.startDate} onChange={(e) => setSalesDueFilters({ ...salesDueFilters, startDate: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
                <input type="date" value={salesDueFilters.endDate} onChange={(e) => setSalesDueFilters({ ...salesDueFilters, endDate: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary focus:border-transparent" />
              </div>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {activeTab === 'challan' ? (
            <>
              <button
                onClick={() => exportChallanPDF(true)}
                disabled={isExporting}
                className="bg-primary text-white px-6 py-2 rounded-xl font-semibold hover:bg-primary-hover transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
              >
                {isExporting ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                {isExporting ? 'Exporting...' : 'Export for Admin'}
              </button>
              <button
                onClick={() => exportChallanPDF(false)}
                disabled={isExporting}
                className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
              >
                {isExporting ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                {isExporting ? 'Exporting...' : 'Export for Party'}
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                if (activeTab === 'katai') exportKataiPDF();
                else if (activeTab === 'purchase') exportPurchasePDF();
                else if (activeTab === 'bill') exportBillPDF();
                else if (activeTab === 'purchase_due') exportPurchaseDuePDF();
                else exportSalesDuePDF();
              }}
              disabled={isExporting}
              className="bg-primary text-white px-6 py-2 rounded-xl font-semibold hover:bg-primary-hover transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
            >
              {isExporting ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
              {isExporting ? 'Exporting...' : 'Export PDF'}
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards for Bill/Challan */}
      {(activeTab === 'bill' || activeTab === 'challan') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <BarChart3 size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(
                  activeTab === 'bill' 
                    ? billRecords.reduce((sum, r) => sum + (r.grand_total || 0), 0)
                    : challanRecords.reduce((sum, r) => sum + (r.total_amount || 0), 0)
                )}
              </p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-green-50 text-green-600 rounded-xl">
              <BarChart3 size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Profit</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(
                  activeTab === 'bill'
                    ? billRecords.reduce((sum, r) => sum + (r.total_profit || 0), 0)
                    : challanRecords.reduce((sum, r) => sum + (r.total_profit || 0), 0)
                )}
              </p>
            </div>
          </div>
        </div>
      )}

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
              ) : activeTab === 'challan' ? (
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Challan No</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Party</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Profit</th>
                </tr>
              ) : activeTab === 'purchase' ? (
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Purchase No</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Party</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                </tr>
              ) : activeTab === 'bill' ? (
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Bill No</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Party</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Grand Total</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Profit</th>
                </tr>
              ) : activeTab === 'purchase_due' ? (
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Party Name</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Purchase</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Paid</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Remaining</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Party Name</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Sales</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Received</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Remaining</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" size={32} /></td>
                </tr>
              ) : (activeTab === 'katai' ? kataiRecords : activeTab === 'challan' ? challanRecords : activeTab === 'purchase' ? purchaseRecords : activeTab === 'bill' ? billRecords : activeTab === 'purchase_due' ? purchaseDueRecords : salesDueRecords).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">No records found for the selected filters</td>
                </tr>
              ) : (
                (activeTab === 'katai' ? kataiRecords : activeTab === 'challan' ? challanRecords : activeTab === 'purchase' ? purchaseRecords : activeTab === 'bill' ? billRecords : activeTab === 'purchase_due' ? purchaseDueRecords : salesDueRecords).map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    {activeTab === 'katai' ? (
                      <>
                        <td className="px-6 py-4 text-sm text-gray-600">{formatDate(r.date)}</td>
                        <td className="px-6 py-4 font-medium text-gray-900">{r.employee?.username}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 capitalize">{r.shift}</td>
                        <td className="px-6 py-4 font-bold text-gray-900">{r.katai}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{r.mtr_type}</td>
                      </>
                    ) : activeTab === 'challan' ? (
                      <>
                        <td className="px-6 py-4 font-bold text-gray-900">{r.challan_no}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{formatDate(r.date)}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{r.party?.name}</td>
                        <td className="px-6 py-4 font-bold text-gray-900">{formatCurrency(r.total_amount)}</td>
                        <td className="px-6 py-4 font-bold text-green-600">{formatCurrency(r.total_profit || 0)}</td>
                      </>
                    ) : activeTab === 'purchase' ? (
                      <>
                        <td className="px-6 py-4 font-bold text-gray-900">{r.purchase_number}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{formatDate(r.date)}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{r.party?.name}</td>
                        <td className="px-6 py-4 font-bold text-gray-900">{formatCurrency(r.total_amount)}</td>
                      </>
                    ) : activeTab === 'bill' ? (
                      <>
                        <td className="px-6 py-4 font-bold text-gray-900">{r.bill_no}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{formatDate(r.date)}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{r.party?.name}</td>
                        <td className="px-6 py-4 font-bold text-gray-900">{formatCurrency(r.grand_total)}</td>
                        <td className="px-6 py-4 font-bold text-green-600">{formatCurrency(r.total_profit || 0)}</td>
                      </>
                    ) : activeTab === 'purchase_due' ? (
                      <>
                        <td className="px-6 py-4 font-medium text-gray-900">{r.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(r.total)}</td>
                        <td className="px-6 py-4 text-sm text-green-600">{formatCurrency(r.paid)}</td>
                        <td className="px-6 py-4 text-sm font-bold text-red-600">{formatCurrency(r.remaining)}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 font-medium text-gray-900">{r.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(r.total)}</td>
                        <td className="px-6 py-4 text-sm text-green-600">{formatCurrency(r.received)}</td>
                        <td className="px-6 py-4 text-sm font-bold text-red-600">{formatCurrency(r.remaining)}</td>
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
