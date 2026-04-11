import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Party, Product, PartyProductPrice } from '../../types';
import { Plus, Search, Trash2, Loader2, Tag, Save, X, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

export default function PartyWisePricing() {
  const [prices, setPrices] = useState<PartyProductPrice[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    party_id: '',
    product_id: '',
    bill_price: '',
    challan_price: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [pricesRes, partiesRes, productsRes] = await Promise.all([
        supabase.from('party_product_prices').select('*, party:parties(name), product:products(name)').order('created_at', { ascending: false }),
        supabase.from('parties').select('*').eq('type', 'sell').order('name', { ascending: true }),
        supabase.from('products').select('*').eq('type', 'sell').order('name', { ascending: true })
      ]);

      if (pricesRes.data) setPrices(pricesRes.data as any);
      if (partiesRes.data) setParties(partiesRes.data);
      if (productsRes.data) setProducts(productsRes.data);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      setErrorMsg('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.party_id || !formData.product_id) return;

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const payload = {
        party_id: formData.party_id,
        product_id: formData.product_id,
        bill_price: parseFloat(formData.bill_price) || 0,
        challan_price: parseFloat(formData.challan_price) || 0
      };

      const { error } = await supabase
        .from('party_product_prices')
        .upsert(payload, { onConflict: 'party_id,product_id' });

      if (error) throw error;

      setFormData({ party_id: '', product_id: '', bill_price: '', challan_price: '' });
      fetchData();
      alert('Price saved successfully!');
    } catch (error: any) {
      console.error('Error saving price:', error);
      setErrorMsg(error.message || 'Failed to save price');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this custom price?')) return;

    try {
      const { error } = await supabase.from('party_product_prices').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (error: any) {
      alert('Error deleting price: ' + error.message);
    }
  };

  const filteredPrices = prices.filter(p => 
    p.party?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.product?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Set Party-wise Price</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Party</label>
            <select 
              required 
              value={formData.party_id} 
              onChange={e => setFormData({...formData, party_id: e.target.value})}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none bg-white"
            >
              <option value="">Select Party</option>
              {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Product</label>
            <select 
              required 
              value={formData.product_id} 
              onChange={e => setFormData({...formData, product_id: e.target.value})}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none bg-white"
            >
              <option value="">Select Product</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bill Price (₹)</label>
            <input 
              type="number" 
              step="0.01" 
              required 
              value={formData.bill_price} 
              onChange={e => setFormData({...formData, bill_price: e.target.value})}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Challan Price (₹)</label>
            <input 
              type="number" 
              step="0.01" 
              required 
              value={formData.challan_price} 
              onChange={e => setFormData({...formData, challan_price: e.target.value})}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
              placeholder="0.00"
            />
          </div>
          <button 
            type="submit" 
            disabled={isSaving}
            className="bg-primary text-white px-6 py-2 rounded-xl font-semibold hover:bg-primary-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Save Price
          </button>
        </form>
        {errorMsg && (
          <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            {errorMsg}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
              <Search size={18} />
            </span>
            <input
              type="text"
              placeholder="Search by party or product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Party</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Bill Price</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Challan Price</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></td></tr>
              ) : filteredPrices.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">No custom prices set</td></tr>
              ) : (
                filteredPrices.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{p.party?.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{p.product?.name}</td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">{formatCurrency(p.bill_price)}</td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">{formatCurrency(p.challan_price)}</td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => {
                          setFormData({
                            party_id: p.party_id,
                            product_id: p.product_id,
                            bill_price: p.bill_price.toString(),
                            challan_price: p.challan_price.toString()
                          });
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors mr-2"
                        title="Edit"
                      >
                        <Tag size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(p.id)} 
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
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
