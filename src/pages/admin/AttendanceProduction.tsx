import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Attendance, Employee, Product } from '../../types';
import { Search, Calendar, User, Filter, Loader2, Download, Plus, Edit2, Trash2, X, Package } from 'lucide-react';
import { formatTime, formatDate, cn } from '../../lib/utils';

export default function AttendanceProduction() {
  const [records, setRecords] = useState<Attendance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Attendance | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Filter state
  const [dateFilter, setDateFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    user_id: '',
    date: new Date().toISOString().split('T')[0],
    login_time: '',
    logout_time: '',
    shift: 'day' as 'day' | 'night',
    katai: '',
    mtr_type: '17',
    custom_mtr: '',
    product_id: '',
    remarks: ''
  });

  useEffect(() => {
    fetchEmployees();
    fetchRecords();
  }, [dateFilter, employeeFilter]);

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('employees')
      .select('id, username, user_id')
      .order('username', { ascending: true });
    if (data) setEmployees(data);
  };

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('attendance')
        .select(`
          *,
          employee:employees!user_id(username)
        `)
        .order('date', { ascending: false });

      if (dateFilter) {
        query = query.eq('date', dateFilter);
      }
      if (employeeFilter) {
        query = query.eq('user_id', employeeFilter);
      }

      const { data, error } = await query;
      console.log('Fetched raw records count:', data?.length || 0);
      console.log('Fetched records data:', data);
      if (error) throw error;
      if (data) setRecords(data as any);
    } catch (error: any) {
      console.error('Error fetching records:', error);
      alert('Error loading records: ' + (error.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRecords = records.filter(record => 
    (record.employee?.username?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (record.user_id?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const setQuickDate = (type: 'today' | 'yesterday') => {
    const date = new Date();
    if (type === 'yesterday') {
      date.setDate(date.getDate() - 1);
    }
    setDateFilter(date.toISOString().split('T')[0]);
  };

  const handleOpenModal = (record?: Attendance) => {
    console.log('handleOpenModal called', record ? 'editing' : 'new');
    setErrorMsg(null);
    if (record) {
      setEditingRecord(record);
      setFormData({
        user_id: record.user_id,
        date: record.date,
        login_time: record.login_time ? new Date(record.login_time).toISOString().slice(0, 16) : '',
        logout_time: record.logout_time ? new Date(record.logout_time).toISOString().slice(0, 16) : '',
        shift: record.shift || 'day',
        katai: record.katai?.toString() || '',
        mtr_type: record.mtr_type || '17',
        custom_mtr: '',
        remarks: record.remarks || ''
      });
    } else {
      setEditingRecord(null);
      setFormData({
        user_id: '',
        date: new Date().toISOString().split('T')[0],
        login_time: '',
        logout_time: '',
        shift: 'day',
        katai: '',
        mtr_type: '17',
        custom_mtr: '',
        remarks: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      try {
        const { error } = await supabase.from('attendance').delete().eq('id', id);
        if (error) throw error;
        fetchRecords();
      } catch (error: any) {
        alert('Error deleting record: ' + error.message);
      }
    }
  };

  const calculateProduction = (katai: string, mtr_type: string) => {
    const k = parseInt(katai) || 0;
    const mtr = parseFloat(mtr_type) || 0;
    return Math.round(k * mtr);
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
      const { error: testError } = await supabase.from('attendance').select('id').limit(1);
      if (testError) {
        console.error('Supabase connection test failed:', testError);
        throw new Error('Database connection failed: ' + testError.message);
      }
      console.log('Connection test passed');

      let total_hours = null;
      if (formData.login_time && formData.logout_time) {
        const start = new Date(formData.login_time);
        const end = new Date(formData.logout_time);
        const diffMs = end.getTime() - start.getTime();
        total_hours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
      }

      const finalMtr = formData.mtr_type === 'custom' ? formData.custom_mtr : formData.mtr_type;
      const selectedEmployee = employees.find(emp => emp.user_id === formData.user_id);

      const payload = {
        user_id: formData.user_id.trim().toLowerCase(),
        employee_id: selectedEmployee?.id,
        date: formData.date,
        login_time: formData.login_time ? new Date(formData.login_time).toISOString() : null,
        logout_time: formData.logout_time ? new Date(formData.logout_time).toISOString() : null,
        total_hours,
        shift: formData.shift,
        katai: parseInt(formData.katai) || 0,
        mtr_type: finalMtr,
        remarks: formData.remarks || null
      };

      console.log('Sending payload to Supabase:', payload);

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database request timed out after 10 seconds')), 10000)
      );

      let attendanceId = editingRecord?.id;

      if (editingRecord) {
        console.log('Updating record:', editingRecord.id);
        const { error }: any = await Promise.race([
          supabase.from('attendance').update(payload).eq('id', editingRecord.id),
          timeoutPromise
        ]);
        if (error) throw error;

        // Update production as well
        const quantity = calculateProduction(formData.katai, finalMtr);
        await supabase.from('production').upsert({
          attendance_id: editingRecord.id,
          mts: quantity
        }, { onConflict: 'attendance_id' });

      } else {
        console.log('Inserting new record...');
        const { data, error }: any = await Promise.race([
          supabase.from('attendance').insert([payload]).select().single(),
          timeoutPromise
        ]);
        if (error) throw error;
        attendanceId = data.id;

        // Record production
        const quantity = calculateProduction(formData.katai, finalMtr);
        await supabase.from('production').insert({
          attendance_id: attendanceId,
          mts: quantity
        });
      }

      console.log('Record saved successfully!');
      setIsModalOpen(false);
      alert('Entry saved successfully!');
      fetchRecords();
    } catch (error: any) {
      console.error('Detailed error in handleSubmit:', error);
      const msg = error.message || JSON.stringify(error);
      setErrorMsg(msg);
    } finally {
      console.log('handleSubmit finished');
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Attendance & Production</h2>
        <button
          onClick={() => handleOpenModal()}
          className="bg-primary text-white px-6 py-2 rounded-xl font-semibold hover:bg-primary-hover transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          Add Entry
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
              <Search size={18} />
            </span>
            <input
              type="text"
              placeholder="Search by employee name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm"
            />
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex flex-col gap-2">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                  <Calendar size={18} />
                </span>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setQuickDate('today')}
                  className={cn(
                    "flex-1 px-3 py-1 rounded-lg text-xs font-medium transition-all",
                    dateFilter === new Date().toISOString().split('T')[0]
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  Today
                </button>
                <button
                  onClick={() => setQuickDate('yesterday')}
                  className={cn(
                    "flex-1 px-3 py-1 rounded-lg text-xs font-medium transition-all",
                    dateFilter === new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0]
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  Yesterday
                </button>
              </div>
            </div>

            <div className="relative h-fit">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                <User size={18} />
              </span>
              <select
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                className="block w-full pl-10 pr-8 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm appearance-none bg-white"
              >
                <option value="">All Employees</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.user_id}>{emp.username}</option>
                ))}
              </select>
            </div>

            {(dateFilter || employeeFilter) && (
              <button 
                onClick={() => { setDateFilter(''); setEmployeeFilter(''); }}
                className="text-sm text-red-600 font-medium hover:underline"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Working Hours</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Shift</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Katai</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">MTR Type</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Remarks</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin mx-auto text-gray-400" size={32} />
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    No attendance records found
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{record.employee?.username}</div>
                      <div className="text-xs text-gray-500">{record.user_id}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDate(record.date)}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {record.total_hours ? `${record.total_hours} hrs` : '-'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {record.login_time ? formatTime(record.login_time) : '-'} to {record.logout_time ? formatTime(record.logout_time) : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium uppercase",
                        record.shift === 'day' ? "bg-yellow-50 text-yellow-700" : "bg-indigo-50 text-indigo-700"
                      )}>
                        {record.shift || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-gray-900">{record.katai || 0}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{record.mtr_type || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {record.remarks && (
                        <span className="text-red-600 font-medium">{record.remarks}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button 
                        onClick={() => handleOpenModal(record)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(record.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">
                {editingRecord ? 'Edit Entry' : 'Add New Entry'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium">
                  {errorMsg}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                  <select
                    required
                    value={formData.user_id}
                    onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white"
                  >
                    <option value="">Select Employee</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.user_id}>{emp.username}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Login Time</label>
                  <input
                    type="datetime-local"
                    value={formData.login_time}
                    onChange={(e) => setFormData({ ...formData, login_time: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logout Time</label>
                  <input
                    type="datetime-local"
                    value={formData.logout_time}
                    onChange={(e) => setFormData({ ...formData, logout_time: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shift</label>
                  <select
                    value={formData.shift}
                    onChange={(e) => setFormData({ ...formData, shift: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white"
                  >
                    <option value="day">Day</option>
                    <option value="night">Night</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Katai</label>
                  <input
                    type="number"
                    value={formData.katai}
                    onChange={(e) => setFormData({ ...formData, katai: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">MTR Type</label>
                  <select
                    value={formData.mtr_type}
                    onChange={(e) => setFormData({ ...formData, mtr_type: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white"
                  >
                    <option value="17">17</option>
                    <option value="24">24</option>
                    <option value="36">36</option>
                    <option value="171">171</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                {formData.mtr_type === 'custom' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Custom MTR</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.custom_mtr}
                      onChange={(e) => setFormData({ ...formData, custom_mtr: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      placeholder="Enter MTR"
                    />
                  </div>
                )}
                <div className="md:col-span-2">
                  <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Production Preview:</span>
                    <span className="text-lg font-bold text-primary">
                      {formData.katai || 0} × {formData.mtr_type === 'custom' ? formData.custom_mtr : formData.mtr_type} = {calculateProduction(formData.katai, formData.mtr_type === 'custom' ? formData.custom_mtr : formData.mtr_type)} MTR
                    </span>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                  <input
                    type="text"
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    placeholder="e.g. Exit by Default"
                  />
                </div>
              </div>
              
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-3 rounded-xl font-semibold text-white bg-primary hover:bg-primary-hover transition-all disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : editingRecord ? 'Update Entry' : 'Create Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
