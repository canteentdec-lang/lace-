import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Party } from '../../types';
import { Search, Loader2, Building2, Calendar, ArrowUpRight, ArrowDownLeft, Filter } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/utils';

interface LedgerEntry {
  id: string;
  date: string;
  type: 'Purchase' | 'Payment' | 'Sale' | 'Receipt';
  description: string;
  debit: number; // We pay or they receive
  credit: number; // We receive or they pay
  balance: number;
}

export default function PartyLedger() {
  const [parties, setParties] = useState<Party[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [partyStats, setPartyStats] = useState({ totalDebit: 0, totalCredit: 0, finalBalance: 0 });

  useEffect(() => {
    fetchParties();
  }, []);

  useEffect(() => {
    if (selectedPartyId) {
      fetchLedger();
    } else {
      setLedger([]);
    }
  }, [selectedPartyId]);

  const fetchParties = async () => {
    const { data } = await supabase.from('parties').select('*').order('name', { ascending: true });
    if (data) setParties(data);
  };

  const fetchLedger = async () => {
    setIsLoading(true);
    try {
      const [purchases, pPayments, bills, sPayments] = await Promise.all([
        supabase.from('purchases').select('*').eq('party_id', selectedPartyId),
        supabase.from('purchase_payments').select('*').eq('party_id', selectedPartyId),
        supabase.from('bills').select('*').eq('party_id', selectedPartyId),
        supabase.from('sales_payments').select('*').eq('party_id', selectedPartyId)
      ]);

      const entries: LedgerEntry[] = [];

      // Purchases (Debit - we owe them more)
      purchases.data?.forEach(p => {
        entries.push({
          id: p.id,
          date: p.date,
          type: 'Purchase',
          description: `Purchase #${p.purchase_number}`,
          debit: p.total_amount,
          credit: 0,
          balance: 0
        });
      });

      // Purchase Payments (Credit - we paid them)
      pPayments.data?.forEach(p => {
        entries.push({
          id: p.id,
          date: p.date,
          type: 'Payment',
          description: 'Payment Made',
          debit: 0,
          credit: p.amount_paid,
          balance: 0
        });
      });

      // Sales (Credit - they owe us more)
      bills.data?.forEach(b => {
        entries.push({
          id: b.id,
          date: b.date,
          type: 'Sale',
          description: `Invoice #${b.bill_no}`,
          debit: 0,
          credit: b.grand_total,
          balance: 0
        });
      });

      // Sales Receipts (Debit - they paid us)
      sPayments.data?.forEach(p => {
        entries.push({
          id: p.id,
          date: p.date,
          type: 'Receipt',
          description: 'Payment Received',
          debit: p.amount_received,
          credit: 0,
          balance: 0
        });
      });

      // Sort by date
      entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Calculate running balance
      // Positive balance = They owe us (Receivable)
      // Negative balance = We owe them (Payable)
      let runningBalance = 0;
      let totalDebit = 0;
      let totalCredit = 0;

      const ledgerWithBalance = entries.map(entry => {
        // In this context:
        // Sales/Credit increases what they owe us
        // Receipts/Debit decreases what they owe us
        // Purchases/Debit increases what we owe them (decreases our net receivable)
        // Payments/Credit decreases what we owe them (increases our net receivable)
        
        // Let's use a simpler logic:
        // Credit = Money coming in or value we provided (Sales, Payments we made)
        // Debit = Money going out or value they provided (Purchases, Receipts we got)
        
        // Actually, let's follow the user's prompt:
        // Positive -> We have to receive
        // Negative -> We have to pay
        
        // Sale: +Credit (They owe us)
        // Receipt: -Debit (They paid us)
        // Purchase: -Debit (We owe them)
        // Payment: +Credit (We paid them)
        
        const change = entry.credit - entry.debit;
        runningBalance += change;
        totalDebit += entry.debit;
        totalCredit += entry.credit;
        
        return { ...entry, balance: runningBalance };
      });

      setLedger(ledgerWithBalance);
      setPartyStats({ totalDebit, totalCredit, finalBalance: runningBalance });
    } catch (error) {
      console.error('Error fetching ledger:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-6 items-end">
        <div className="flex-1 w-full">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Party</label>
          <select
            value={selectedPartyId}
            onChange={(e) => setSelectedPartyId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white"
          >
            <option value="">Choose a party...</option>
            {parties.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
            ))}
          </select>
        </div>
        {selectedPartyId && (
          <div className="flex gap-4 w-full md:w-auto">
            <div className="flex-1 md:flex-none bg-blue-50 p-4 rounded-xl border border-blue-100">
              <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-1">Status</p>
              <p className={`text-lg font-bold ${partyStats.finalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {partyStats.finalBalance >= 0 ? 'Receivable' : 'Payable'}
              </p>
            </div>
            <div className="flex-1 md:flex-none bg-gray-50 p-4 rounded-xl border border-gray-100">
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Balance</p>
              <p className={`text-lg font-bold ${partyStats.finalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(Math.abs(partyStats.finalBalance))}
              </p>
            </div>
          </div>
        )}
      </div>

      {selectedPartyId ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Debit (-)</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Credit (+)</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Loader2 className="animate-spin mx-auto text-gray-400" size={32} />
                    </td>
                  </tr>
                ) : ledger.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No transactions found for this party
                    </td>
                  </tr>
                ) : (
                  ledger.map((entry, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDate(entry.date)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          entry.type === 'Sale' || entry.type === 'Payment' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {entry.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{entry.description}</td>
                      <td className="px-6 py-4 text-sm text-right text-red-600">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-green-600">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                      </td>
                      <td className={`px-6 py-4 text-sm text-right font-bold ${entry.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(Math.abs(entry.balance))} {entry.balance >= 0 ? 'Dr' : 'Cr'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {!isLoading && ledger.length > 0 && (
                <tfoot className="bg-gray-50 font-bold">
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-right text-gray-900">Totals:</td>
                    <td className="px-6 py-4 text-right text-red-600">{formatCurrency(partyStats.totalDebit)}</td>
                    <td className="px-6 py-4 text-right text-green-600">{formatCurrency(partyStats.totalCredit)}</td>
                    <td className={`px-6 py-4 text-right ${partyStats.finalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(Math.abs(partyStats.finalBalance))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 rounded-2xl border border-dashed border-gray-200 text-center space-y-4">
          <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto">
            <Filter size={32} />
          </div>
          <p className="text-gray-500">Select a party to view their full transaction history and running balance.</p>
        </div>
      )}
    </div>
  );
}
