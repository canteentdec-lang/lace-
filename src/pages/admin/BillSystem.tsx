import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Bill, Party, Product, BillItem, Settings, PartyProductPrice } from '../../types';
import { Plus, Search, Download, Trash2, X, Loader2, ArrowLeft, PlusCircle, MinusCircle, Receipt, Share2, CheckCircle2 } from 'lucide-react';
import { formatCurrency, formatDate, formatAmount, loadImage } from '../../lib/utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function BillSystem() {
  const [view, setView] = useState<'list' | 'create' | 'success'>('list');
  const [bills, setBills] = useState<Bill[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [partyPrices, setPartyPrices] = useState<PartyProductPrice[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastCreatedBill, setLastCreatedBill] = useState<Bill | null>(null);
  
  console.log('BillSystem state:', { view, isSaving, isLoading, errorMsg, settings: !!settings });

  const [formData, setFormData] = useState({
    bill_no: '',
    party_id: '',
    date: new Date().toISOString().split('T')[0],
    gst_enabled: true
  });
  const [items, setItems] = useState<Partial<BillItem>[]>([
    { product_id: '', product_name: '', price: 0, quantity: 1, gst_percentage: 0, gst_amount: 0, total: 0 }
  ]);

  useEffect(() => {
    fetchBills();
    fetchParties();
    fetchProducts();
    fetchSettings();
    fetchPartyPrices();
  }, []);

  const fetchPartyPrices = async () => {
    const { data } = await supabase.from('party_product_prices').select('*');
    if (data) setPartyPrices(data);
  };

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase.from('settings').select('*').single();
      if (error) {
        console.warn('Settings not found or error fetching settings:', error);
        setSettings(null);
      } else {
        setSettings(data);
      }
    } catch (e) {
      console.error('Error in fetchSettings:', e);
      setSettings(null);
    }
  };

  const fetchBills = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('bills')
      .select('*, party:parties(*)')
      .order('date', { ascending: false });
    if (data) setBills(data as any);
    setIsLoading(false);
  };

  const getNextBillNo = async () => {
    const { data } = await supabase
      .from('bills')
      .select('bill_no')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (data && data.length > 0) {
      const lastNo = data[0].bill_no;
      const match = lastNo.match(/(\d+)$/);
      if (match) {
        const nextNum = parseInt(match[1]) + 1;
        const prefix = lastNo.replace(match[1], '');
        return `${prefix}${nextNum.toString().padStart(match[1].length, '0')}`;
      }
    }
    return 'INV-001';
  };

  const fetchParties = async () => {
    const { data } = await supabase
      .from('parties')
      .select('*')
      .eq('type', 'sell')
      .order('name', { ascending: true });
    if (data) setParties(data);
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('type', 'sell')
      .order('name', { ascending: true });
    if (data) setProducts(data);
  };

  const addItem = () => {
    setItems([...items, { product_id: '', product_name: '', price: 0, quantity: 1, gst_percentage: 0, gst_amount: 0, total: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof BillItem, value: any) => {
    const newItems = [...items];
    const item = { ...newItems[index] };

    if (field === 'product_id') {
      const product = products.find(p => p.id === value);
      if (product) {
        item.product_id = product.id;
        item.product_name = product.name;
        
        // Check for custom party price
        const customPrice = partyPrices.find(pp => pp.party_id === formData.party_id && pp.product_id === product.id);
        
        if (customPrice && customPrice.bill_price > 0) {
          item.price = customPrice.bill_price;
        } else {
          item.price = product.bill_price || product.price || 0;
        }
        
        item.base_price = product.base_price || product.price || 0;
        item.gst_percentage = product.gst_applicable ? product.gst_percent : 0;
      }
    } else {
      (item as any)[field] = value;
    }

    const subtotal = (item.price || 0) * (item.quantity || 0);
    if (formData.gst_enabled) {
      item.gst_amount = (subtotal * (item.gst_percentage || 0)) / 100;
      item.total = subtotal + item.gst_amount;
    } else {
      item.gst_amount = 0;
      item.total = subtotal;
    }

    newItems[index] = item;
    setItems(newItems);
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0);
    const totalGst = items.reduce((sum, item) => sum + (item.gst_amount || 0), 0);
    const grandTotal = subtotal + totalGst;
    return { subtotal, totalGst, grandTotal };
  };

  const numberToWords = (num: number) => {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const n = ('0000000' + Math.floor(num)).slice(-7).match(/^(\d{2})(\d{2})(\d{2})(\d{1})$/);
    if (!n) return '';
    let str = '';
    str += (parseInt(n[1]) !== 0) ? (a[Number(n[1])] || b[Number(n[1][0])] + ' ' + a[Number(n[1][1])]) + 'Lakh ' : '';
    str += (parseInt(n[2]) !== 0) ? (a[Number(n[2])] || b[Number(n[2][0])] + ' ' + a[Number(n[2][1])]) + 'Thousand ' : '';
    str += (parseInt(n[3]) !== 0) ? (a[Number(n[3])] || b[Number(n[3][0])] + ' ' + a[Number(n[3][1])]) + 'Hundred ' : '';
    str += (parseInt(n[4]) !== 0) ? ((str !== '') ? 'and ' : '') + (a[Number(n[4])] || b[Number(n[4][0])] + ' ' + a[Number(n[4][1])]) : '';
    return str + 'Rupees Only';
  };

  const generatePDF = async (bill: Bill, billItems: BillItem[], party: Party, businessSettings: Settings) => {
    console.log('Generating PDF for bill:', bill.bill_no);
    try {
      const doc = new jsPDF();
      
      if (typeof autoTable !== 'function') {
        console.error('autoTable is not a function. Check jspdf-autotable import.');
        throw new Error('PDF Table plugin not loaded correctly.');
      }
    
    // Header
    if (businessSettings.logo_url && (businessSettings.logo_url.startsWith('http') || businessSettings.logo_url.startsWith('data:'))) {
      try {
        const logoBase64 = await loadImage(businessSettings.logo_url);
        doc.addImage(logoBase64, 'PNG', 15, 10, 30, 30);
      } catch (e) {
        console.error('Error adding logo to PDF:', e);
      }
    }

    // Business Info
    doc.setFillColor(59, 130, 246); // Blue color from image
    doc.rect(60, 10, 135, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(businessSettings.business_name, 65, 17);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const addressLines = doc.splitTextToSize(businessSettings.address, 130);
    doc.text(addressLines, 60, 25);
    doc.setFont('helvetica', 'bold');
    doc.text(`GSTIN.: ${businessSettings.gst_no}`, 60, 35);
    doc.setFont('helvetica', 'normal');
    doc.text(`M.: ${businessSettings.phone}`, 60, 40);
    doc.text(`E.: ${businessSettings.email}`, 110, 40);

    doc.setDrawColor(59, 130, 246);
    doc.line(15, 45, 195, 45);

    // Bill To & Invoice Info
    doc.setTextColor(59, 130, 246);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold italic');
    doc.text('BILL TO', 15, 52);
    doc.line(15, 54, 70, 54);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(party.name, 15, 60);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`M.: ${party.phone}`, 15, 65);
    doc.text(`GSTIN.: ${party.gst_no}`, 15, 70);
    const partyAddressLines = doc.splitTextToSize(`Add.: ${party.address}`, 60);
    doc.text(partyAddressLines, 15, 75);

    // Right Side Info
    doc.setFontSize(9);
    doc.text('Original for Recipient', 195, 52, { align: 'right' });
    doc.setTextColor(59, 130, 246);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`INVOICE ${bill.bill_no}`, 195, 62, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.text(`Date: ${formatDate(bill.date)}`, 195, 70, { align: 'right' });

    // Table
    const tableData = billItems.map((item, index) => [
      index + 1,
      item.product_name,
      '5806', // Placeholder HSN as in image
      item.quantity.toFixed(2),
      'PCS',
      `Rs. ${item.price.toFixed(2)}`,
      bill.gst_enabled ? `Rs. ${item.gst_amount.toFixed(2)} (${item.gst_percentage}%)` : '-',
      `Rs. ${item.total.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 95,
      head: [['#', 'Product/Service Name', 'HSN', 'Qty', 'Unit', 'Price', 'GST', 'Amount']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 60 },
        3: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY;

    // Totals
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL', 80, finalY + 10);
    doc.text(billItems.reduce((sum, i) => sum + i.quantity, 0).toFixed(1), 100, finalY + 10);
    if (bill.gst_enabled) {
      doc.text(`Rs. ${bill.total_gst.toFixed(2)}`, 160, finalY + 10);
    }
    doc.text(`Rs. ${bill.grand_total.toFixed(2)}`, 195, finalY + 10, { align: 'right' });
    doc.line(15, finalY + 12, 195, finalY + 12);

    // Footer
    doc.setFontSize(10);
    doc.text('INVOICE AMOUNT IN WORD', 15, finalY + 20);
    doc.setFont('helvetica', 'normal');
    doc.text(numberToWords(bill.grand_total), 15, finalY + 25);

    doc.setFont('helvetica', 'bold');
    doc.text('TERMS AND CONDITIONS', 15, finalY + 35);
    
    // Right side totals
    const rightX = 140;
    doc.text('Sub Total', rightX, finalY + 20);
    doc.text(`Rs. ${bill.subtotal.toFixed(2)}`, 195, finalY + 20, { align: 'right' });
    
    doc.text('Discount (-)', rightX, finalY + 25);
    doc.text('Rs. 0.00', 195, finalY + 25, { align: 'right' });

    if (bill.gst_enabled) {
      const halfGst = bill.total_gst / 2;
      doc.text('SGST Amount', rightX, finalY + 30);
      doc.text(`Rs. ${halfGst.toFixed(2)}`, 195, finalY + 30, { align: 'right' });
      doc.text('CGST Amount', rightX, finalY + 35);
      doc.text(`Rs. ${halfGst.toFixed(2)}`, 195, finalY + 35, { align: 'right' });
      doc.text('IGST Amount', rightX, finalY + 40);
      doc.text('Rs. 0.00', 195, finalY + 40, { align: 'right' });
    }

    doc.setFontSize(12);
    doc.text('Total', rightX, finalY + 48);
    doc.text(`Rs. ${bill.grand_total.toFixed(2)}`, 195, finalY + 48, { align: 'right' });
    doc.line(rightX, finalY + 50, 195, finalY + 50);

    doc.setFontSize(10);
    doc.text(`For, ${businessSettings.business_name}`, 195, finalY + 65, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text('Authorized Signatory', 195, finalY + 90, { align: 'right' });

    doc.save(`Invoice_${bill.bill_no}.pdf`);
    return doc;
    } catch (err) {
      console.error('Error in generatePDF:', err);
      throw err;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('handleSubmit triggered');
    setErrorMsg(null);
    
    if (!formData.bill_no) {
      setErrorMsg('Please enter a bill number');
      return;
    }
    if (!formData.party_id) {
      setErrorMsg('Please select a party');
      return;
    }
    if (!formData.date) {
      setErrorMsg('Please select a date');
      return;
    }
    if (!settings) {
      setErrorMsg('Please configure business settings first in the Settings section');
      return;
    }
    
    const validItems = items.filter(item => item.product_id && (item.quantity || 0) > 0);
    if (validItems.length === 0) {
      setErrorMsg('Please add at least one valid product with quantity');
      return;
    }

    setIsSaving(true);
    console.log('Starting bill creation process with data:', { formData, itemsCount: validItems.length });

    try {
      // Test connection
      const { error: connError } = await supabase.from('bills').select('id').limit(1);
      if (connError) throw new Error(`Database connection failed: ${connError.message}`);

      const { subtotal, totalGst, grandTotal } = calculateTotals();
      
      // Calculate total profit for bill
      const totalProfit = validItems.reduce((sum, item) => {
        const profitPerItem = (item.price || 0) - (item.base_price || 0);
        return sum + (profitPerItem * (item.quantity || 0));
      }, 0);

      // 1. Create Bill
      console.log('Inserting bill record...');
      const { data: bill, error: billError } = await supabase
        .from('bills')
        .insert([{ 
          bill_no: formData.bill_no,
          party_id: formData.party_id,
          date: formData.date,
          gst_enabled: formData.gst_enabled,
          subtotal, 
          total_gst: totalGst, 
          grand_total: grandTotal,
          total_profit: totalProfit
        }])
        .select('*, party:parties(*)')
        .single();
      
      if (billError) {
        console.error('Bill insertion error:', billError);
        if (billError.code === '23505') {
          throw new Error(`Bill number "${formData.bill_no}" already exists. Please use a different bill number.`);
        }
        throw new Error(`Failed to create bill: ${billError.message}`);
      }
      console.log('Bill created successfully:', bill.id);

      // 2. Create Bill Items
      console.log('Preparing bill items...');
      const billItemsData = validItems.map(item => ({
        bill_id: bill.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        price: item.price,
        base_price: item.base_price || 0,
        gst_percentage: item.gst_percentage,
        gst_amount: item.gst_amount,
        total: item.total
      }));
      
      let savedItems: BillItem[] = [];
      if (billItemsData.length > 0) {
        console.log('Inserting bill items...');
        const { data: itemsData, error: itemsError } = await supabase
          .from('bill_items')
          .insert(billItemsData)
          .select();
        
        if (itemsError) {
          console.error('Bill items insertion error:', itemsError);
          throw new Error(`Failed to save bill items: ${itemsError.message}`);
        }
        savedItems = itemsData;
        console.log('Bill items saved:', savedItems.length);
      }

      // 3. Auto Create Challan
      console.log('Creating associated challan...');
      
      // Calculate challan total and profit using challan_price
      let challanTotalAmount = 0;
      let challanTotalProfit = 0;
      const challanItemsToInsert = validItems.map(item => {
        const product = products.find(p => p.id === item.product_id);
        const challanPrice = product?.challan_price || item.price || 0;
        const profitPerItem = challanPrice - (item.base_price || 0);
        const itemTotal = challanPrice * (item.quantity || 0);
        
        challanTotalAmount += itemTotal;
        challanTotalProfit += (profitPerItem * (item.quantity || 0));
        
        return {
          product_id: item.product_id,
          product_name: item.product_name,
          price: challanPrice,
          base_price: item.base_price || 0,
          quantity: item.quantity,
          total: itemTotal
        };
      });

      const { data: challan, error: challanError } = await supabase
        .from('challans')
        .insert([{
          challan_no: `CHL-B-${bill.bill_no}`,
          party_id: bill.party_id,
          date: bill.date,
          total_amount: challanTotalAmount,
          total_profit: challanTotalProfit
        }])
        .select()
        .single();
      
      if (challanError) {
        console.warn('Challan creation failed (non-critical):', challanError);
        // We continue even if challan fails, but log it
      } else {
        console.log('Challan created:', challan.id);
        const challanItemsWithId = challanItemsToInsert.map(item => ({
          ...item,
          challan_id: challan.id
        }));
        
        if (challanItemsWithId.length > 0) {
          const { error: cItemsError } = await supabase.from('challan_items').insert(challanItemsWithId);
          if (cItemsError) console.warn('Challan items creation failed:', cItemsError);
        }
      }

      // Auto Download PDF
      console.log('Generating PDF...');
      try {
        await generatePDF(bill, savedItems, bill.party, settings);
      } catch (pdfError) {
        console.error('PDF Generation error:', pdfError);
        setErrorMsg('Bill created, but PDF generation failed. You can try downloading it again from the list.');
      }

      setLastCreatedBill(bill);
      setView('success');
      fetchBills();
    } catch (error: any) {
      console.error('Detailed error in handleSubmit:', error);
      let message = error.message || 'An unexpected error occurred while saving the bill.';
      
      if (message.includes("Could not find the table 'public.bills'")) {
        message = "The 'bills' table is missing from your database. Please go to your Supabase SQL Editor and run the 'complete_schema.sql' script to create the necessary tables.";
      }
      
      setErrorMsg(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this bill?')) {
      await supabase.from('bill_items').delete().eq('bill_id', id);
      await supabase.from('bills').delete().eq('id', id);
      fetchBills();
    }
  };

  const handleShareWhatsApp = () => {
    if (!lastCreatedBill || !lastCreatedBill.party) return;
    const message = `Hello ${lastCreatedBill.party.name}, your invoice ${lastCreatedBill.bill_no} for amount ${formatCurrency(lastCreatedBill.grand_total)} is ready. Please check the bill.`;
    const url = `https://wa.me/${lastCreatedBill.party.phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const exportPDFById = async (bill: Bill) => {
    const { data: itemsData } = await supabase.from('bill_items').select('*').eq('bill_id', bill.id);
    const { data: partyData } = await supabase.from('parties').select('*').eq('id', bill.party_id).single();
    if (itemsData && partyData && settings) {
      await generatePDF(bill, itemsData, partyData, settings);
    }
  };

  if (view === 'success') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-white p-12 rounded-3xl border border-gray-100 shadow-xl text-center space-y-8 max-w-md w-full">
          <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={48} />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-gray-900">Bill Created!</h2>
            <p className="text-gray-500">Invoice {lastCreatedBill?.bill_no} has been generated and downloaded.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 pt-4">
            <button
              onClick={() => lastCreatedBill && exportPDFById(lastCreatedBill)}
              className="flex items-center justify-center gap-2 w-full bg-gray-100 text-gray-900 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all"
            >
              <Download size={20} />
              Download Again
            </button>
            <button
              onClick={handleShareWhatsApp}
              className="flex items-center justify-center gap-2 w-full bg-[#25D366] text-white py-4 rounded-2xl font-bold hover:opacity-90 transition-all"
            >
              <Share2 size={20} />
              Share on WhatsApp
            </button>
            <button
              onClick={() => setView('list')}
              className="text-gray-500 font-semibold hover:text-gray-900 transition-colors pt-2"
            >
              Back to List
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'create') {
    const { subtotal, totalGst, grandTotal } = calculateTotals();
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setView('list')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-2xl font-bold text-gray-900">Create New Bill</h2>
        </div>

        <form onSubmit={(e) => { console.log('Form onSubmit triggered'); handleSubmit(e); }} noValidate className="space-y-6">
          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm font-medium">
              {errorMsg}
            </div>
          )}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bill No</label>
              <input type="text" required value={formData.bill_no} onChange={(e) => setFormData({ ...formData, bill_no: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none" placeholder="e.g. INV-001" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Party</label>
              <select required value={formData.party_id} onChange={(e) => setFormData({ ...formData, party_id: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white">
                <option value="">Select Party</option>
                {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none" />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" id="gst_enabled" checked={formData.gst_enabled} onChange={(e) => {
                setFormData({ ...formData, gst_enabled: e.target.checked });
                const newItems = items.map(item => {
                  const sub = (item.price || 0) * (item.quantity || 0);
                  const gst = e.target.checked ? (sub * (item.gst_percentage || 0)) / 100 : 0;
                  return { ...item, gst_amount: gst, total: sub + gst };
                });
                setItems(newItems);
              }} className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary" />
              <label htmlFor="gst_enabled" className="text-sm font-medium text-gray-700">Enable GST</label>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Items</h3>
              <button type="button" onClick={addItem} className="text-sm font-semibold text-primary flex items-center gap-1 hover:underline">
                <PlusCircle size={18} /> Add Item
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Product</label>
                    <select required value={item.product_id} onChange={(e) => updateItem(index, 'product_id', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none bg-white">
                      <option value="">Select Product</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Price</label>
                    <input type="number" step="0.01" value={item.price || ''} onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none" />
                    {item.product_id && (
                      <p className="text-[10px] mt-1 text-gray-400">
                        {partyPrices.some(pp => pp.party_id === formData.party_id && pp.product_id === item.product_id && pp.bill_price > 0) 
                          ? 'Using custom party price' 
                          : 'Using default product price'}
                      </p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
                    <input type="number" step="0.01" value={item.quantity || ''} onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none" />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">GST %</label>
                    <div className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm">
                      {item.gst_percentage}%
                    </div>
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Total</label>
                    <div className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm font-semibold">
                      {formatCurrency(item.total || 0)}
                    </div>
                  </div>
                  <div className="md:col-span-1 flex justify-center">
                    <button type="button" onClick={() => removeItem(index)} className="p-2 text-red-400 hover:text-red-600">
                      <MinusCircle size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-6 border-t border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-start-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-semibold">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total GST</span>
                  <span className="font-semibold">{formatCurrency(totalGst)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-100">
                  <span className="text-lg font-bold text-gray-900">Grand Total</span>
                  <span className="text-2xl font-bold text-primary">{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <button type="button" onClick={() => setView('list')} className="px-8 py-3 rounded-xl font-semibold text-gray-600 hover:bg-gray-100">Cancel</button>
            <button type="submit" onClick={() => console.log('Submit button clicked')} disabled={isSaving} className="px-8 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-hover disabled:opacity-50 flex items-center gap-2">
              {isSaving && <Loader2 className="animate-spin" size={20} />}
              {isSaving ? 'Creating...' : 'Create Bill & Download PDF'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  const filteredBills = bills.filter(bill => {
    const matchesSearch = bill.bill_no.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         bill.party?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesParty = !partyFilter || bill.party_id === partyFilter;
    const matchesDateFrom = !dateFrom || bill.date >= dateFrom;
    const matchesDateTo = !dateTo || bill.date <= dateTo;
    return matchesSearch && matchesParty && matchesDateFrom && matchesDateTo;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <div className="relative w-full sm:w-64">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
              <Search size={18} />
            </span>
            <input
              type="text"
              placeholder="Search bills..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm"
            />
          </div>
          
          <select
            value={partyFilter}
            onChange={(e) => setPartyFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm bg-white"
          >
            <option value="">All Parties</option>
            {parties.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm"
            />
            <span className="text-gray-400 text-xs">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm"
            />
          </div>
        </div>
        <button
          onClick={async () => {
            const nextNo = await getNextBillNo();
            setFormData({ bill_no: nextNo, party_id: '', date: new Date().toISOString().split('T')[0], gst_enabled: true });
            setItems([{ product_id: '', product_name: '', price: 0, quantity: 1, gst_percentage: 0, gst_amount: 0, total: 0 }]);
            setView('create');
          }}
          className="w-full sm:w-auto bg-primary text-white px-6 py-2 rounded-xl font-semibold hover:bg-primary-hover transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          New Bill
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Bill No</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Party</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Profit</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></td></tr>
              ) : filteredBills.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">No bills found</td></tr>
              ) : (
                filteredBills.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900">{b.bill_no}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{b.party?.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDate(b.date)}</td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">{formatCurrency(b.grand_total)}</td>
                    <td className="px-6 py-4 text-sm font-bold text-green-600">{formatCurrency(b.total_profit || 0)}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => exportPDFById(b)} className="p-2 text-primary hover:bg-primary/5 rounded-lg transition-colors"><Download size={18} /></button>
                      <button onClick={() => handleDelete(b.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
                    </td>
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
