import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Machine, Design, Product } from '../../types';
import { Plus, Search, Edit2, Trash2, X, Loader2, Cpu, LayoutGrid, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function DesignManagement() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMachineModalOpen, setIsMachineModalOpen] = useState(false);
  const [isDesignModalOpen, setIsDesignModalOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [editingDesign, setEditingDesign] = useState<Design | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'machine' | 'design', id: string } | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const [machineForm, setMachineForm] = useState({ name: '' });
  const [designForm, setDesignForm] = useState({
    machine_id: '',
    product_id: '',
    name: '',
    patti_count: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const { data: m } = await supabase.from('machines').select('*').order('name', { ascending: true });
    const { data: d } = await supabase.from('designs').select('*, machines(name), products(name)').order('name', { ascending: true });
    const { data: p } = await supabase.from('products').select('*').order('name', { ascending: true });
    
    if (m) setMachines(m);
    if (d) setDesigns(d as any);
    if (p) setProducts(p);
    setIsLoading(false);
  };

  const handleSaveMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setNotification(null);
    try {
      if (editingMachine) {
        const { error } = await supabase.from('machines').update(machineForm).eq('id', editingMachine.id);
        if (error) throw error;
        setNotification({ type: 'success', message: 'Machine updated successfully' });
      } else {
        const { error } = await supabase.from('machines').insert([machineForm]);
        if (error) throw error;
        setNotification({ type: 'success', message: 'Machine added successfully' });
      }
      setIsMachineModalOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error saving machine:', error);
      setNotification({ type: 'error', message: error.message || 'Error saving machine' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDesign = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setNotification(null);
    try {
      const payload = {
        ...designForm,
        patti_count: parseInt(designForm.patti_count)
      };
      if (editingDesign) {
        const { error } = await supabase.from('designs').update(payload).eq('id', editingDesign.id);
        if (error) throw error;
        setNotification({ type: 'success', message: 'Design updated successfully' });
      } else {
        const { error } = await supabase.from('designs').insert([payload]);
        if (error) throw error;
        setNotification({ type: 'success', message: 'Design added successfully' });
      }
      setIsDesignModalOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error saving design:', error);
      setNotification({ type: 'error', message: error.message || 'Error saving design' });
    } finally {
      setIsLoading(false);
    }
  };

  const processDelete = async () => {
    if (!confirmDelete) return;
    setIsLoading(true);
    try {
      const { type, id } = confirmDelete;
      const { error } = await supabase.from(type === 'machine' ? 'machines' : 'designs').delete().eq('id', id);
      if (error) throw error;
      
      setNotification({ type: 'success', message: `${type === 'machine' ? 'Machine' : 'Design'} deleted successfully` });
      setConfirmDelete(null);
      fetchData();
    } catch (error: any) {
      console.error('Error deleting:', error);
      setNotification({ type: 'error', message: error.message || 'Error during deletion' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {notification && (
        <div className={`p-4 rounded-xl flex items-center justify-between ${notification.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span className="font-medium">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="hover:opacity-70"><X size={18} /></button>
        </div>
      )}

      {/* Machines Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Cpu className="text-primary" /> Machines
          </h2>
          <button onClick={() => { setEditingMachine(null); setMachineForm({ name: '' }); setIsMachineModalOpen(true); }} className="bg-primary text-white px-4 py-2 rounded-xl font-semibold hover:bg-primary-hover transition-colors flex items-center gap-2 text-sm">
            <Plus size={18} /> Add Machine
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {machines.map(m => (
              <div key={m.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center">
                <span className="font-bold text-gray-900">{m.name}</span>
                <div className="flex gap-1">
                  <button onClick={() => { setEditingMachine(m); setMachineForm({ name: m.name }); setIsMachineModalOpen(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={16} /></button>
                  <button onClick={() => setConfirmDelete({ type: 'machine', id: m.id })} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                </div>
              </div>
          ))}
        </div>
      </div>

      {/* Designs Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <LayoutGrid className="text-primary" /> Designs
          </h2>
          <button onClick={() => { setEditingDesign(null); setDesignForm({ machine_id: '', product_id: '', name: '', patti_count: '' }); setIsDesignModalOpen(true); }} className="bg-primary text-white px-4 py-2 rounded-xl font-semibold hover:bg-primary-hover transition-colors flex items-center gap-2 text-sm">
            <Plus size={18} /> Add Design
          </button>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Design Name</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Machine</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Product</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Patti Count</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {designs.map(d => (
                <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-gray-900">{d.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{(d as any).machines?.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{(d as any).products?.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 font-bold">{d.patti_count}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button onClick={() => { setEditingDesign(d); setDesignForm({ machine_id: d.machine_id, product_id: (d as any).product_id || '', name: d.name, patti_count: d.patti_count.toString() }); setIsDesignModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={18} /></button>
                    <button onClick={() => setConfirmDelete({ type: 'design', id: d.id })} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Machine Modal */}
      {isMachineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">{editingMachine ? 'Edit Machine' : 'Add Machine'}</h3>
              <button onClick={() => setIsMachineModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            <form onSubmit={handleSaveMachine} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Machine Name</label>
                <input type="text" required value={machineForm.name} onChange={(e) => setMachineForm({ name: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none" placeholder="e.g. Machine 1" />
              </div>
              <button type="submit" disabled={isLoading} className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50">
                {isLoading ? 'Saving...' : 'Save Machine'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Design Modal */}
      {isDesignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">{editingDesign ? 'Edit Design' : 'Add Design'}</h3>
              <button onClick={() => setIsDesignModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            <form onSubmit={handleSaveDesign} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Machine</label>
                <select required value={designForm.machine_id} onChange={(e) => setDesignForm({ ...designForm, machine_id: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white">
                  <option value="">Select Machine</option>
                  {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                <select required value={designForm.product_id} onChange={(e) => setDesignForm({ ...designForm, product_id: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white">
                  <option value="">Select Product</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Design Name</label>
                <input type="text" required value={designForm.name} onChange={(e) => setDesignForm({ ...designForm, name: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none" placeholder="e.g. Design A" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patti Count</label>
                <input type="number" required value={designForm.patti_count} onChange={(e) => setDesignForm({ ...designForm, patti_count: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none" placeholder="e.g. 10" />
              </div>
              <button type="submit" disabled={isLoading} className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50">
                {isLoading ? 'Saving...' : 'Save Design'}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden p-8 text-center space-y-6"
            >
              <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <Trash2 size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-gray-900">Confirm Deletion</h3>
                <p className="text-gray-500">
                  Are you sure you want to delete this {confirmDelete.type}? This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-3 rounded-xl font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={processDelete}
                  disabled={isLoading}
                  className="flex-[2] py-3 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-all shadow-lg shadow-red-100 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Delete Now'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
