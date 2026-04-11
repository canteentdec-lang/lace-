import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Challan, Party, Product, ChallanItem, PartyProductPrice } from '../../types';
import { Plus, Search, FileText, Download, Trash2, X, Loader2, ArrowLeft, PlusCircle, MinusCircle, Edit2 } from 'lucide-react';
import { formatCurrency, formatDate, formatAmount, loadImage } from '../../lib/utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ChallanSystem() {
  const [view, setView] = useState<'list' | 'create'>('list');
  const [challans, setChallans] = useState<Challan[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [partyPrices, setPartyPrices] = useState<PartyProductPrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Create Challan State
  const [newChallan, setNewChallan] = useState({
    challan_no: '',
    party_id: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [items, setItems] = useState<Partial<ChallanItem>[]>([
    { product_id: '', product_name: '', price: 0, quantity: 1, total: 0 }
  ]);
  const [editingChallanId, setEditingChallanId] = useState<string | null>(null);
  const [suggestedChallanNo, setSuggestedChallanNo] = useState<string | null>(null);
  const [isFetchingSuggestion, setIsFetchingSuggestion] = useState(false);

  useEffect(() => {
    fetchChallans();
    fetchParties();
    fetchProducts();
    fetchPartyPrices();
  }, []);

  const fetchPartyPrices = async () => {
    const { data } = await supabase.from('party_product_prices').select('*');
    if (data) setPartyPrices(data);
  };

  const fetchChallans = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('challans')
      .select('*, party:parties(name, address, gst_no)')
      .order('created_at', { ascending: false });
    if (data) setChallans(data as any);
    setIsLoading(false);
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

  const getNextChallanSuggestion = async (input: string) => {
    if (editingChallanId) return; // Don't suggest when editing existing
    
    setIsFetchingSuggestion(true);
    try {
      // Extract prefix and current number if any
      // Regex to split alpha prefix and numeric suffix
      const match = input.match(/^([a-zA-Z-]*?)(\d*)$/);
      const prefix = match ? match[1] : '';
      
      let query = supabase
        .from('challans')
        .select('challan_no')
        .order('created_at', { ascending: false })
        .limit(50); // Get recent ones to find the max in this series

      if (prefix) {
        query = query.ilike('challan_no', `${prefix}%`);
      } else {
        // If no prefix, look for purely numeric ones
        query = query.not('challan_no', 'ilike', '%[^0-9]%');
      }

      const { data, error } = await query;
      
      if (error) throw error;

      let nextNum = 1;
      if (data && data.length > 0) {
        const numbers = data
          .map(c => {
            const m = c.challan_no.match(new RegExp(`^${prefix}(\\d+)$`));
            return m ? parseInt(m[1], 10) : (prefix === '' && /^\d+$/.test(c.challan_no) ? parseInt(c.challan_no, 10) : 0);
          })
          .filter(n => !isNaN(n));
        
        if (numbers.length > 0) {
          nextNum = Math.max(...numbers) + 1;
        }
      }

      setSuggestedChallanNo(`${prefix}${nextNum}`);
    } catch (error) {
      console.error('Error fetching suggestion:', error);
    } finally {
      setIsFetchingSuggestion(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (view === 'create') {
        getNextChallanSuggestion(newChallan.challan_no);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [newChallan.challan_no, view]);

  const addItem = () => {
    setItems([...items, { product_id: '', product_name: '', price: 0, quantity: 1, total: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof ChallanItem, value: any) => {
    const newItems = [...items];
    const item = { ...newItems[index] };

    if (field === 'product_id') {
      const product = products.find(p => p.id === value);
      if (product) {
        item.product_id = product.id;
        item.product_name = product.name;
        
        // Check for custom party price
        const customPrice = partyPrices.find(pp => pp.party_id === newChallan.party_id && pp.product_id === product.id);
        
        if (customPrice && customPrice.challan_price > 0) {
          item.price = customPrice.challan_price;
        } else {
          item.price = product.challan_price || product.price || 0;
        }
        
        item.base_price = product.base_price || product.price || 0;
      }
    } else {
      (item as any)[field] = value;
    }

    item.total = (item.price || 0) * (item.quantity || 0);
    newItems[index] = item;
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.total || 0), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChallan.party_id) return alert('Please select a party');
    setIsLoading(true);

    try {
      const totalAmount = calculateTotal();
      
      // Calculate total profit
      const totalProfit = items.reduce((sum, item) => {
        const profitPerItem = (item.price || 0) - (item.base_price || 0);
        return sum + (profitPerItem * (item.quantity || 0));
      }, 0);

      let challanId = editingChallanId;

      if (editingChallanId) {
        // Update Challan
        const { error: challanError } = await supabase
          .from('challans')
          .update({ ...newChallan, total_amount: totalAmount, total_profit: totalProfit })
          .eq('id', editingChallanId);

        if (challanError) throw challanError;

        // Delete old items
        await supabase.from('challan_items').delete().eq('challan_id', editingChallanId);
      } else {
        // Create Challan
        const { data: challanData, error: challanError } = await supabase
          .from('challans')
          .insert([{ ...newChallan, total_amount: totalAmount, total_profit: totalProfit }])
          .select()
          .single();

        if (challanError) throw challanError;
        challanId = challanData.id;
      }

      // Create Items
      const challanItems = items
        .filter(item => item.product_id)
        .map(item => ({
          challan_id: challanId,
          product_id: item.product_id,
          product_name: item.product_name,
          price: item.price,
          base_price: item.base_price || 0,
          quantity: item.quantity,
          total: item.total
        }));

      if (challanItems.length > 0) {
        const { error: itemsError } = await supabase
          .from('challan_items')
          .insert(challanItems);
        if (itemsError) throw itemsError;
      }

      setView('list');
      setEditingChallanId(null);
      fetchChallans();
      setNewChallan({ challan_no: '', party_id: '', date: new Date().toISOString().split('T')[0] });
      setItems([{ product_id: '', product_name: '', price: 0, quantity: 1, total: 0 }]);
    } catch (error) {
      console.error('Error saving challan:', error);
      alert('Error saving challan. Check if Challan No is unique.');
    } finally {
      setIsLoading(false);
    }
  };

  const generatePDF = async (challan: Challan) => {
    try {
      setIsExporting(true);
      const { data: itemsData } = await supabase
        .from('challan_items')
        .select('*')
        .eq('challan_id', challan.id);

      const { data: settings } = await supabase.from('settings').select('*').single();

      if (!itemsData) {
        setIsExporting(false);
        return;
      }

      const doc = new jsPDF();
      const party = challan.party;

      // Header
      if (settings?.logo_url && (settings.logo_url.startsWith('http') || settings.logo_url.startsWith('data:'))) {
        try {
          const logoBase64 = await loadImage(settings.logo_url);
          doc.addImage(logoBase64, 'PNG', 15, 10, 30, 30);
        } catch (e) {
          console.error('Error adding logo to PDF:', e);
        }
      }

      doc.setFontSize(22);
      doc.text('CHALLAN', 105, 20, { align: 'center' });
      
      doc.setFontSize(10);
      if (settings) {
        doc.text(settings.business_name, 20, 30);
      } else {
        doc.text('Shree Mahalaxmi Lace', 20, 30);
      }
      doc.text('Date: ' + formatDate(challan.date), 150, 30);
      doc.text('Challan No: ' + challan.challan_no, 150, 35);

      // Party Details
      doc.setFontSize(12);
      doc.text('Bill To:', 20, 50);
      doc.setFontSize(10);
      doc.text(party?.name || 'N/A', 20, 55);
      doc.text(party?.address || 'N/A', 20, 60, { maxWidth: 80 });
      doc.text('GSTIN: ' + (party?.gst_no || 'N/A'), 20, 75);

      // Table
      const tableData = itemsData.map((item, i) => [
        i + 1,
        item.product_name,
        item.quantity,
        formatAmount(item.price),
        formatAmount(item.total)
      ]);

      autoTable(doc, {
        startY: 85,
        head: [['#', 'Product', 'Qty', 'Price', 'Total']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] }, // Indigo 600
        foot: [['', '', '', 'Grand Total', formatAmount(challan.total_amount)]],
        footStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold' }
      });

      // Footer
      const finalY = (doc as any).lastAutoTable.finalY || 150;
      doc.text('Authorized Signatory', 150, finalY + 30);
      doc.line(140, finalY + 25, 190, finalY + 25);

      doc.save(`Challan_${challan.challan_no}.pdf`);
    } catch (error) {
      console.error('PDF Generation Error:', error);
      alert('Error generating PDF. Please check the console.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this challan and all its items?')) {
      try {
        setIsLoading(true);
        // Delete items first
        await supabase.from('challan_items').delete().eq('challan_id', id);
        // Then delete challan
        const { error } = await supabase.from('challans').delete().eq('id', id);
        if (error) throw error;
        fetchChallans();
      } catch (error) {
        console.error('Error deleting challan:', error);
        alert('Error deleting challan. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleEdit = async (challan: Challan) => {
    setIsLoading(true);
    try {
      const { data: itemsData, error } = await supabase
        .from('challan_items')
        .select('*')
        .eq('challan_id', challan.id);
      
      if (error) throw error;

      setEditingChallanId(challan.id);
      setNewChallan({
        challan_no: challan.challan_no,
        party_id: challan.party_id,
        date: challan.date
      });
      setItems(itemsData || []);
      setView('create');
    } catch (error) {
      console.error('Error fetching challan items:', error);
      alert('Error loading challan for editing.');
    } finally {
      setIsLoading(false);
    }
  };

  if (view === 'create') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setView('list')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-2xl font-bold text-gray-900">{editingChallanId ? 'Edit Challan' : 'Create New Challan'}</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Challan No</label>
              <div className="relative">
                <input 
                  type="text" 
                  required 
                  value={newChallan.challan_no} 
                  onChange={(e) => setNewChallan({ ...newChallan, challan_no: e.target.value })} 
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent outline-none" 
                  placeholder="e.g. CH-001" 
                />
                {suggestedChallanNo && suggestedChallanNo !== newChallan.challan_no && (
                  <button
                    type="button"
                    onClick={() => setNewChallan({ ...newChallan, challan_no: suggestedChallanNo })}
                    className="absolute left-0 -bottom-6 text-[10px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                  >
                    <Plus size={10} /> Suggestion: {suggestedChallanNo} (Click to apply)
                  </button>
                )}
                {isFetchingSuggestion && (
                  <div className="absolute right-3 top-2.5">
                    <Loader2 size={14} className="animate-spin text-gray-400" />
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Party</label>
              <select required value={newChallan.party_id} onChange={(e) => setNewChallan({ ...newChallan, party_id: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent outline-none bg-white">
                <option value="">Select Party</option>
                {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input type="date" required value={newChallan.date} onChange={(e) => setNewChallan({ ...newChallan, date: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent outline-none" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Products</h3>
              <button type="button" onClick={addItem} className="text-sm font-semibold text-blue-600 flex items-center gap-1 hover:underline">
                <PlusCircle size={18} /> Add Item
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end border-b border-gray-50 pb-4 md:border-0 md:pb-0">
                  <div className="md:col-span-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Select Product</label>
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
                        {partyPrices.some(pp => pp.party_id === newChallan.party_id && pp.product_id === item.product_id && pp.challan_price > 0) 
                          ? 'Using custom party price' 
                          : 'Using default product price'}
                      </p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
                    <input type="number" step="0.01" value={item.quantity || ''} onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none" />
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

            <div className="pt-6 border-t border-gray-100 flex justify-end">
              <div className="text-right">
                <p className="text-sm text-gray-500">Overall Total</p>
                <p className="text-3xl font-bold text-gray-900">{formatCurrency(calculateTotal())}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <button type="button" onClick={() => setView('list')} className="px-8 py-3 rounded-xl font-semibold text-gray-600 hover:bg-gray-100">Cancel</button>
            <button type="submit" disabled={isLoading} className="px-8 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-hover disabled:opacity-50">
              {isLoading ? 'Saving...' : editingChallanId ? 'Update Challan' : 'Create Challan'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  const filteredChallans = challans.filter(challan => {
    const matchesSearch = challan.challan_no.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         challan.party?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesParty = !partyFilter || challan.party_id === partyFilter;
    const matchesDateFrom = !dateFrom || challan.date >= dateFrom;
    const matchesDateTo = !dateTo || challan.date <= dateTo;
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
              placeholder="Search challans..."
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
          onClick={() => {
            setEditingChallanId(null);
            setNewChallan({ challan_no: '', party_id: '', date: new Date().toISOString().split('T')[0] });
            setItems([{ product_id: '', product_name: '', price: 0, quantity: 1, total: 0 }]);
            setView('create');
          }}
          className="w-full sm:w-auto bg-primary text-white px-6 py-2 rounded-xl font-semibold hover:bg-primary-hover transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          New Challan
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Challan No</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Party</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Profit</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin mx-auto text-gray-400" size={32} />
                  </td>
                </tr>
              ) : filteredChallans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No challans found
                  </td>
                </tr>
              ) : (
                filteredChallans.map((challan) => (
                  <tr key={challan.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900">{challan.challan_no}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{challan.party?.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDate(challan.date)}</td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">{formatCurrency(challan.total_amount)}</td>
                    <td className="px-6 py-4 text-sm font-bold text-green-600">{formatCurrency(challan.total_profit || 0)}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button 
                        onClick={() => generatePDF(challan)} 
                        disabled={isExporting}
                        title="Download PDF" 
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isExporting ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                      </button>
                      <button 
                        onClick={() => handleEdit(challan)} 
                        title="Edit" 
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDelete(challan.id)} title="Delete" className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
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
