import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Party, Bill, SalesPayment } from '../../types';
import { Search, Plus, Loader2, X, ArrowLeft, Receipt, History } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/utils';

export default function SalesPayments() {
  const [parties, setParties] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedParty, setSelectedParty] = useState<any>(null);
  const [paymentData, setPaymentData] = useState({
    amount_received: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch all sell parties
      const { data: partiesData } = await supabase
        .from('parties')
        .select('*')
        .eq('type', 'sell')
        .order('name', { ascending: true });

      if (partiesData) {
        // For each party, get total sales and total received
        const partiesWithBalances = await Promise.all(partiesData.map(async (party) => {
          const [sales, payments] = await Promise.all([
            supabase.from('bills').select('grand_total').eq('party_id', party.id),
            supabase.from('sales_payments').select('amount_received').eq('party_id', party.id)
          ]);

          const totalSales = sales.data?.reduce((sum, s) => sum + (s.grand_total || 0), 0) || 0;
          const totalReceived = payments.data?.reduce((sum, p) => sum + (p.amount_received || 0), 0) || 0;
          const due = totalSales - totalReceived;

          return {
            ...party,
            totalSales,
            totalReceived,
            due
          };
        }));
        setParties(partiesWithBalances);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenReceiveModal = (party: any) => {
    setSelectedParty(party);
    setPaymentData({
      amount_received: '',
      date: new Date().toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParty || !paymentData.amount_received) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.from('sales_payments').insert([{
        party_id: selectedParty.id,
        amount_received: parseFloat(paymentData.amount_received),
        date: paymentData.date
      }]);

      if (error) throw error;

      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving payment:', error);
      alert('Error saving payment.');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredParties = parties.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
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
            placeholder="Search by party name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Party Name</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Sales</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Received</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Remaining Due</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && parties.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin mx-auto text-gray-400" size={32} />
                  </td>
                </tr>
              ) : filteredParties.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No sales parties found
                  </td>
                </tr>
              ) : (
                filteredParties.map((party) => (
                  <tr key={party.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gray-50 text-gray-500"><Receipt size={18} /></div>
                        <div className="font-medium text-gray-900">{party.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">{formatCurrency(party.totalSales)}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-green-600">{formatCurrency(party.totalReceived)}</td>
                    <td className="px-6 py-4 text-sm font-bold text-red-600">{formatCurrency(party.due)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenReceiveModal(party)}
                        className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors flex items-center gap-2 ml-auto"
                      >
                        <Receipt size={16} />
                        Receive Payment
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && selectedParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Receive Payment</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmitPayment} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Party</label>
                <div className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl font-semibold text-gray-900">
                  {selectedParty.name}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Total Due</label>
                <div className="px-4 py-2 bg-red-50 border border-red-100 rounded-xl font-bold text-red-600">
                  {formatCurrency(selectedParty.due)}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Received</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  value={paymentData.amount_received}
                  onChange={(e) => setPaymentData({ ...paymentData, amount_received: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={paymentData.date}
                  onChange={(e) => setPaymentData({ ...paymentData, date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-primary-hover disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Receipt size={20} />}
                  Submit Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
