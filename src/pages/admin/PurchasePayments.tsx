import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Party, Purchase, PurchasePayment } from '../../types';
import { Search, Plus, Loader2, X, ArrowLeft, Banknote, History, Building2 } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/utils';

export default function PurchasePayments() {
  const [parties, setParties] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedParty, setSelectedParty] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState({
    amount_paid: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch all purchase parties
      const { data: partiesData } = await supabase
        .from('parties')
        .select('*')
        .eq('type', 'purchase')
        .order('name', { ascending: true });

      if (partiesData) {
        // For each party, get total purchases and total payments
        const partiesWithBalances = await Promise.all(partiesData.map(async (party) => {
          let purchaseQuery = supabase.from('purchases').select('total_amount').eq('party_id', party.id);
          let paymentQuery = supabase.from('purchase_payments').select('amount_paid').eq('party_id', party.id);

          if (startDate) {
            purchaseQuery = purchaseQuery.gte('date', startDate);
            paymentQuery = paymentQuery.gte('date', startDate);
          }
          if (endDate) {
            purchaseQuery = purchaseQuery.lte('date', endDate);
            paymentQuery = paymentQuery.lte('date', endDate);
          }

          const [purchases, payments] = await Promise.all([purchaseQuery, paymentQuery]);

          const totalPurchase = purchases.data?.reduce((sum, p) => sum + (p.total_amount || 0), 0) || 0;
          const totalPaid = payments.data?.reduce((sum, p) => sum + (p.amount_paid || 0), 0) || 0;
          const due = totalPurchase - totalPaid;

          return {
            ...party,
            totalPurchase,
            totalPaid,
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

  const handleOpenPayModal = (party: any) => {
    console.log('handleOpenPayModal called', party);
    setErrorMsg(null);
    setSelectedParty(party);
    setPaymentData({
      amount_paid: '',
      date: new Date().toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('handleSubmitPayment called', { selectedParty, paymentData });
    setErrorMsg(null);
    if (!selectedParty || !paymentData.amount_paid) return setErrorMsg('Please enter an amount');

    setIsLoading(true);
    try {
      console.log('Checking Supabase client...');
      if (!supabase) {
        throw new Error('Supabase client is not initialized');
      }

      console.log('Testing Supabase connection...');
      const { error: testError } = await supabase.from('parties').select('id').limit(1);
      if (testError) {
        console.error('Supabase connection test failed:', testError);
        throw new Error('Database connection failed: ' + testError.message);
      }
      console.log('Connection test passed');

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database request timed out after 10 seconds')), 10000)
      );

      console.log('Recording payment...');
      const { error: paymentError }: any = await Promise.race([
        supabase.from('purchase_payments').insert([{
          party_id: selectedParty.id,
          amount_paid: parseFloat(paymentData.amount_paid),
          date: paymentData.date
        }]),
        timeoutPromise
      ]);

      if (paymentError) {
        console.error('Supabase payment error:', paymentError);
        throw paymentError;
      }

      console.log('Recording expense...');
      const { error: expenseError }: any = await Promise.race([
        supabase.from('expenses').insert([{
          title: `Payment to Party: ${selectedParty.name}`,
          amount: parseFloat(paymentData.amount_paid),
          date: paymentData.date
        }]),
        timeoutPromise
      ]);

      if (expenseError) {
        console.error('Supabase expense error:', expenseError);
        // We don't throw here to avoid failing the whole payment if only expense fails, 
        // but we should probably log it.
      }

      console.log('Payment recorded successfully!');
      setIsModalOpen(false);
      alert('Payment recorded successfully!');
      fetchData();
    } catch (error: any) {
      console.error('Detailed error in handleSubmitPayment:', error);
      const msg = error.message || JSON.stringify(error);
      setErrorMsg(msg);
    } finally {
      console.log('handleSubmitPayment finished');
      setIsLoading(false);
    }
  };

  const filteredParties = parties.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-end">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full lg:w-auto flex-1">
            <div className="relative">
              <label className="block text-xs font-medium text-gray-500 mb-1">Search Party</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                  <Search size={16} />
                </span>
                <input
                  type="text"
                  placeholder="Search party..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setSearchTerm('');
              }}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
            >
              Clear Filters
            </button>
            <button
              onClick={fetchData}
              className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-900 hover:bg-gray-200 rounded-xl transition-all flex items-center gap-2"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Party Name</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Purchase</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Paid</th>
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
                    No purchase parties found
                  </td>
                </tr>
              ) : (
                filteredParties.map((party) => (
                  <tr key={party.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gray-50 text-gray-500"><Building2 size={18} /></div>
                        <div className="font-medium text-gray-900">{party.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">{formatCurrency(party.totalPurchase)}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-green-600">{formatCurrency(party.totalPaid)}</td>
                    <td className="px-6 py-4 text-sm font-bold text-red-600">{formatCurrency(party.due)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenPayModal(party)}
                        className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors flex items-center gap-2 ml-auto"
                      >
                        <Banknote size={16} />
                        Pay
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
              <h3 className="text-lg font-bold text-gray-900">Record Payment</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmitPayment} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium">
                  {errorMsg}
                </div>
              )}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount to Pay</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  value={paymentData.amount_paid}
                  onChange={(e) => setPaymentData({ ...paymentData, amount_paid: e.target.value })}
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
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Banknote size={20} />}
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
