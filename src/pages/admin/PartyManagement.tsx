import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Party } from '../../types';
import { Plus, Search, Edit2, Trash2, X, Loader2, Building2 } from 'lucide-react';

export default function PartyManagement() {
  const [parties, setParties] = useState<Party[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    gst_no: '',
    phone: '',
    address: '',
    type: 'sell' as 'purchase' | 'sell'
  });
  const [typeFilter, setTypeFilter] = useState<'all' | 'purchase' | 'sell'>('all');

  useEffect(() => {
    fetchParties();
  }, []);

  const fetchParties = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('parties').select('*').order('name', { ascending: true });
    if (data) setParties(data);
    setIsLoading(false);
  };

  const handleOpenModal = (party?: Party) => {
    console.log('handleOpenModal called', party ? 'editing' : 'new');
    setErrorMsg(null);
    if (party) {
      setEditingParty(party);
      setFormData({
        name: party.name,
        gst_no: party.gst_no,
        phone: party.phone,
        address: party.address,
        type: party.type || 'sell'
      });
    } else {
      setEditingParty(null);
      setFormData({ name: '', gst_no: '', phone: '', address: '', type: 'sell' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('handleSubmit called', formData);
    setErrorMsg(null);
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

      console.log('Sending payload to Supabase:', formData);

      // Add a timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database request timed out after 10 seconds')), 10000)
      );

      const supabasePromise = editingParty 
        ? supabase.from('parties').update(formData).eq('id', editingParty.id).select()
        : supabase.from('parties').insert([formData]).select();

      const { data, error }: any = await Promise.race([supabasePromise, timeoutPromise]);

      console.log('Supabase response:', { data, error });

      if (error) {
        console.error('Supabase error detail:', error);
        throw error;
      }
      
      console.log('Party saved successfully, closing modal...');
      setIsModalOpen(false);
      alert('Party saved successfully!');
      
      console.log('Refreshing party list...');
      await fetchParties();
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
    if (window.confirm('Are you sure you want to delete this party?')) {
      await supabase.from('parties').delete().eq('id', id);
      fetchParties();
    }
  };

  const filteredParties = parties.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.gst_no.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || p.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <div className="relative w-full sm:w-80">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
              <Search size={18} />
            </span>
            <input
              type="text"
              placeholder="Search by name or GST..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setTypeFilter('all')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${typeFilter === 'all' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              All
            </button>
            <button 
              onClick={() => setTypeFilter('purchase')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${typeFilter === 'purchase' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Purchase
            </button>
            <button 
              onClick={() => setTypeFilter('sell')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${typeFilter === 'sell' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Sell
            </button>
          </div>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="w-full sm:w-auto bg-primary text-white px-6 py-2 rounded-xl font-semibold hover:bg-primary-hover transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          Add Party
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full py-12 text-center">
            <Loader2 className="animate-spin mx-auto text-gray-400" size={32} />
          </div>
        ) : filteredParties.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-500">
            No parties found
          </div>
        ) : (
          filteredParties.map((party) => (
            <div key={party.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-gray-50 text-gray-600">
                    <Building2 size={24} />
                  </div>
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${party.type === 'purchase' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                    {party.type || 'sell'}
                  </span>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleOpenModal(party)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(party.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                </div>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">{party.name}</h3>
              <div className="space-y-2 text-sm text-gray-500">
                <p><span className="font-medium text-gray-700">GST:</span> {party.gst_no || 'N/A'}</p>
                <p><span className="font-medium text-gray-700">Phone:</span> {party.phone || 'N/A'}</p>
                <p className="line-clamp-2"><span className="font-medium text-gray-700">Address:</span> {party.address || 'N/A'}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">{editingParty ? 'Edit Party' : 'Add New Party'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium">
                  {errorMsg}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Party Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'purchase' })}
                    className={`py-2 rounded-xl text-sm font-semibold border-2 transition-all ${formData.type === 'purchase' ? 'border-primary bg-primary text-white' : 'border-gray-100 text-gray-500 hover:bg-gray-50'}`}
                  >
                    Purchase Party
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'sell' })}
                    className={`py-2 rounded-xl text-sm font-semibold border-2 transition-all ${formData.type === 'sell' ? 'border-primary bg-primary text-white' : 'border-gray-100 text-gray-500 hover:bg-gray-50'}`}
                  >
                    Sell Party
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Party Name</label>
                <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none" placeholder="e.g. ABC Textiles" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GST No</label>
                <input type="text" value={formData.gst_no} onChange={(e) => setFormData({ ...formData, gst_no: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none" placeholder="e.g. 24AAAAA0000A1Z5" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none" placeholder="e.g. 9876543210" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none h-24 resize-none" placeholder="Enter full address" />
              </div>
              <div className="pt-4">
                <button type="submit" disabled={isLoading} className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50">
                  {isLoading ? 'Saving...' : editingParty ? 'Update Party' : 'Create Party'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
