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
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedParty, setSelectedParty] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
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
            supabase.from('challans').select('total_amount').eq('party_id', party.id),
            supabase.from('sales_payments').select('amount_received').eq('party_id', party.id)
          ]);

          const totalSales = sales.data?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0;
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
    setErrorMsg(null);
    setSelectedParty(party);
    setPaymentData({
      amount_received: '',
      date: new Date().toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };

  const handleOpenHistoryModal = async (party: any) => {
    setSelectedParty(party);
    setIsHistoryModalOpen(true);
    setIsHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('sales_payments')
        .select('*')
        .eq('party_id', party.id)
        .order('date', { ascending: false });
      
      if (error) throw error;
      setPaymentHistory(data || []);
    } catch (error) {
      console.error('Error fetching payment history:', error);
      alert('Error fetching payment history');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    console.log('handleSubmitPayment called', { selectedParty, paymentData });
    
    const amount = parseFloat(paymentData.amount_received);
    if (!selectedParty || isNaN(amount) || amount <= 0) {
      setErrorMsg('Please enter a valid amount greater than 0');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Checking Supabase client...');
      if (!supabase) {
        throw new Error('Supabase client is not initialized');
      }

      console.log('Testing Supabase connection...');
      const { error: testError } = await supabase.from('sales_payments').select('id').limit(1);
      if (testError) {
        console.error('Supabase connection test failed:', testError);
        // If the table doesn't exist, this will fail.
        throw new Error('Database connection failed or table missing: ' + testError.message);
      }
      console.log('Connection test passed');

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database request timed out after 10 seconds')), 10000)
      );

      console.log('Recording payment...');
      const { error: paymentError }: any = await Promise.race([
        supabase.from('sales_payments').insert([{
          party_id: selectedParty.id,
          amount_received: amount,
          date: paymentData.date
        }]),
        timeoutPromise
      ]);

      if (paymentError) {
        console.error('Supabase payment error:', paymentError);
        throw paymentError;
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
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenHistoryModal(party)}
                          className="p-2 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
                          title="Payment History"
                        >
                          <History size={18} />
                        </button>
                        <button
                          onClick={() => handleOpenReceiveModal(party)}
                          className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors flex items-center gap-2"
                        >
                          <Receipt size={16} />
                          Receive Payment
                        </button>
                      </div>
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

      {/* History Modal */}
      {isHistoryModalOpen && selectedParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Payment History</h3>
                <p className="text-xs text-gray-500">{selectedParty.name}</p>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
              {isHistoryLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-gray-400" size={32} />
                </div>
              ) : paymentHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No payment history found for this party.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Amount Received</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paymentHistory.map((payment) => (
                        <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-600">{formatDate(payment.date)}</td>
                          <td className="px-4 py-3 text-sm font-bold text-green-600 text-right">
                            {formatCurrency(payment.amount_received)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 font-bold">
                      <tr>
                        <td className="px-4 py-3 text-sm text-gray-900">Total Received</td>
                        <td className="px-4 py-3 text-sm text-green-600 text-right">
                          {formatCurrency(paymentHistory.reduce((sum, p) => sum + (p.amount_received || 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-6 py-2 bg-white border border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
