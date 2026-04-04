import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Purchase, Party, Product, PurchaseItem } from '../../types';
import { Plus, Search, Download, Trash2, X, Loader2, ArrowLeft, PlusCircle, MinusCircle, Edit2 } from 'lucide-react';
import { formatCurrency, formatDate, formatAmount } from '../../lib/utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function PurchaseSystem() {
  const [view, setView] = useState<'list' | 'create'>('list');
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    purchase_number: '',
    party_id: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [items, setItems] = useState<Partial<PurchaseItem>[]>([
    { product_id: '', product_name: '', price: 0, quantity: 1, total: 0 }
  ]);

  useEffect(() => {
    fetchPurchases();
    fetchParties();
    fetchProducts();
  }, []);

  const fetchPurchases = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('purchases')
      .select('*, party:parties(name)')
      .order('date', { ascending: false });
    if (data) setPurchases(data as any);
    setIsLoading(false);
  };

  const fetchParties = async () => {
    const { data } = await supabase
      .from('parties')
      .select('*')
      .eq('type', 'purchase')
      .order('name', { ascending: true });
    if (data) setParties(data);
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('type', 'purchase')
      .order('name', { ascending: true });
    if (data) setProducts(data);
  };

  const addItem = () => {
    setItems([...items, { product_id: '', product_name: '', price: 0, quantity: 1, total: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof PurchaseItem, value: any) => {
    const newItems = [...items];
    const item = { ...newItems[index] };

    if (field === 'product_id') {
      const product = products.find(p => p.id === value);
      if (product) {
        item.product_id = product.id;
        item.product_name = product.name;
        item.price = product.price;
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
    console.log('handleSubmit called', { formData, items });
    setErrorMsg(null);
    if (!formData.party_id) return setErrorMsg('Please select a party');
    setIsLoading(true);

    try {
      console.log('Checking Supabase client...');
      if (!supabase) {
        throw new Error('Supabase client is not initialized');
      }

      console.log('Testing Supabase connection...');
      const { error: testError } = await supabase.from('purchases').select('id').limit(1);
      if (testError) {
        console.error('Supabase connection test failed:', testError);
        throw new Error('Database connection failed: ' + testError.message);
      }
      console.log('Connection test passed');

      const totalAmount = calculateTotal();
      let purchaseId = editingPurchaseId;

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database request timed out after 10 seconds')), 10000)
      );

      if (editingPurchaseId) {
        console.log('Updating purchase:', editingPurchaseId);
        const { error: updateError } = await Promise.race([
          supabase.from('purchases').update({ ...formData, total_amount: totalAmount }).eq('id', editingPurchaseId),
          timeoutPromise
        ]) as any;
        if (updateError) throw updateError;

        console.log('Deleting old items...');
        const { error: deleteError } = await supabase.from('purchase_items').delete().eq('purchase_id', editingPurchaseId);
        if (deleteError) throw deleteError;
      } else {
        console.log('Inserting new purchase...');
        const { data, error }: any = await Promise.race([
          supabase.from('purchases').insert([{ ...formData, total_amount: totalAmount }]).select().single(),
          timeoutPromise
        ]);
        if (error) throw error;
        purchaseId = data.id;
      }

      console.log('Preparing purchase items...');
      const purchaseItems = items
        .filter(item => item.product_id)
        .map(item => ({
          purchase_id: purchaseId,
          product_id: item.product_id,
          product_name: item.product_name,
          price: item.price,
          quantity: item.quantity,
          total: item.total
        }));

      if (purchaseItems.length > 0) {
        console.log('Inserting purchase items:', purchaseItems.length);
        const { error: itemsError } = await supabase.from('purchase_items').insert(purchaseItems);
        if (itemsError) throw itemsError;
      }

      console.log('Purchase saved successfully!');
      setView('list');
      setEditingPurchaseId(null);
      fetchPurchases();
      setFormData({ purchase_number: '', party_id: '', date: new Date().toISOString().split('T')[0] });
      setItems([{ product_id: '', product_name: '', price: 0, quantity: 1, total: 0 }]);
      alert('Purchase saved successfully!');
    } catch (error: any) {
      console.error('Detailed error in handleSubmit:', error);
      const msg = error.message || JSON.stringify(error);
      setErrorMsg(msg);
    } finally {
      console.log('handleSubmit finished');
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this purchase?')) {
      await supabase.from('purchase_items').delete().eq('purchase_id', id);
      await supabase.from('purchases').delete().eq('id', id);
      fetchPurchases();
    }
  };

  const handleEdit = async (purchase: Purchase) => {
    setIsLoading(true);
    const { data } = await supabase.from('purchase_items').select('*').eq('purchase_id', purchase.id);
    setEditingPurchaseId(purchase.id);
    setFormData({
      purchase_number: purchase.purchase_number,
      party_id: purchase.party_id,
      date: purchase.date
    });
    setItems(data || []);
    setView('create');
    setIsLoading(false);
  };

  const exportPDF = (purchase: Purchase) => {
    // Similar to Challan PDF
    const doc = new jsPDF();
    doc.text('PURCHASE INVOICE', 105, 20, { align: 'center' });
    // ... add more details ...
    doc.save(`Purchase_${purchase.purchase_number}.pdf`);
  };

  if (view === 'create') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setView('list')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-2xl font-bold text-gray-900">{editingPurchaseId ? 'Edit Purchase' : 'Add New Purchase'}</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm font-medium">
              {errorMsg}
            </div>
          )}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Purchase No</label>
              <input type="text" required value={formData.purchase_number} onChange={(e) => setFormData({ ...formData, purchase_number: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none" placeholder="e.g. PUR-001" />
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
                  <div className="md:col-span-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Product</label>
                    <select required value={item.product_id} onChange={(e) => updateItem(index, 'product_id', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none bg-white">
                      <option value="">Select Product</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Price</label>
                    <input type="number" step="0.01" value={item.price || ''} onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none" />
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
                <p className="text-sm text-gray-500">Grand Total</p>
                <p className="text-3xl font-bold text-gray-900">{formatCurrency(calculateTotal())}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <button type="button" onClick={() => setView('list')} className="px-8 py-3 rounded-xl font-semibold text-gray-600 hover:bg-gray-100">Cancel</button>
            <button type="submit" disabled={isLoading} className="px-8 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-hover disabled:opacity-50">
              {isLoading ? 'Saving...' : editingPurchaseId ? 'Update Purchase' : 'Save Purchase'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative w-full sm:w-96">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
            <Search size={18} />
          </span>
          <input
            type="text"
            placeholder="Search by purchase no or party..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm"
          />
        </div>
        <button
          onClick={() => {
            setEditingPurchaseId(null);
            setFormData({ purchase_number: '', party_id: '', date: new Date().toISOString().split('T')[0] });
            setItems([{ product_id: '', product_name: '', price: 0, quantity: 1, total: 0 }]);
            setView('create');
          }}
          className="w-full sm:w-auto bg-primary text-white px-6 py-2 rounded-xl font-semibold hover:bg-primary-hover transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          New Purchase
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Purchase No</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Party</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></td></tr>
              ) : purchases.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">No purchases found</td></tr>
              ) : (
                purchases.filter(p => p.purchase_number.toLowerCase().includes(searchTerm.toLowerCase()) || p.party?.name.toLowerCase().includes(searchTerm.toLowerCase())).map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900">{p.purchase_number}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{p.party?.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDate(p.date)}</td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">{formatCurrency(p.total_amount)}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => handleEdit(p)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={18} /></button>
                      <button onClick={() => handleDelete(p.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
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
