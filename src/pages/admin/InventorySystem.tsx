import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Product } from '../../types';
import { Search, Loader2, Warehouse, TrendingUp, TrendingDown, Package } from 'lucide-react';
import { formatAmount } from '../../lib/utils';

export default function InventorySystem() {
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Products
      const { data: prods, error: prodError } = await supabase.from('products').select('*').order('name', { ascending: true });
      if (prodError) throw prodError;
      if (!prods) return;
      setProducts(prods);

      // 2. Fetch Purchase Totals
      const { data: purItems } = await supabase.from('purchase_items').select('product_id, quantity');
      const purchaseTotals = (purItems || []).reduce((acc: any, item) => {
        acc[item.product_id] = (acc[item.product_id] || 0) + (item.quantity || 0);
        return acc;
      }, {});

      // 3. Fetch Production Totals
      const { data: prodItems } = await supabase.from('production').select('product_id, mts');

      const productionTotals = (prodItems || []).reduce((acc: any, item) => {
        if (item.product_id) {
          acc[item.product_id] = (acc[item.product_id] || 0) + (item.mts || 0);
        }
        return acc;
      }, {});

      // 4. Fetch Sales Totals (Challans)
      const { data: saleItems } = await supabase.from('challan_items').select('product_id, quantity');
      const salesTotals = (saleItems || []).reduce((acc: any, item) => {
        acc[item.product_id] = (acc[item.product_id] || 0) + (item.quantity || 0);
        return acc;
      }, {});

      // 5. Combine
      const combined = prods.map(p => {
        const purchased = purchaseTotals[p.id] || 0;
        const produced = productionTotals[p.id] || 0;
        const sold = salesTotals[p.id] || 0;
        const stock = (purchased + produced) - sold;
        return {
          ...p,
          purchased,
          produced,
          sold,
          stock
        };
      });

      setInventory(combined);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredInventory = inventory.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative w-full sm:w-96">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
            <Search size={18} />
          </span>
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm"
          />
        </div>
        <button
          onClick={fetchInventory}
          className="w-full sm:w-auto bg-gray-100 text-gray-600 px-6 py-2 rounded-xl font-semibold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
        >
          Refresh Stock
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><TrendingUp size={24} /></div>
            <p className="text-sm font-medium text-gray-500">Total Produced</p>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{formatAmount(inventory.reduce((sum, i) => sum + i.produced, 0))} MTR</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-green-50 text-green-600 rounded-xl"><Package size={24} /></div>
            <p className="text-sm font-medium text-gray-500">Total Purchased</p>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{formatAmount(inventory.reduce((sum, i) => sum + i.purchased, 0))} MTR</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-red-50 text-red-600 rounded-xl"><TrendingDown size={24} /></div>
            <p className="text-sm font-medium text-gray-500">Total Sold</p>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{formatAmount(inventory.reduce((sum, i) => sum + i.sold, 0))} MTR</h3>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product Name</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Purchased</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Produced</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sold</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Available Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></td></tr>
              ) : filteredInventory.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">No inventory data found</td></tr>
              ) : (
                filteredInventory.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900">{item.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatAmount(item.purchased)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatAmount(item.produced)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatAmount(item.sold)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${item.stock > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {formatAmount(item.stock)} MTR
                      </span>
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
