import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Attendance, Employee } from '../../types';
import { Search, Calendar, User, Filter, Loader2, Download } from 'lucide-react';
import { formatTime, formatDate, cn } from '../../lib/utils';

export default function AttendanceProduction() {
  const [records, setRecords] = useState<Attendance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filter state
  const [dateFilter, setDateFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchEmployees();
    fetchRecords();
  }, [dateFilter, employeeFilter]);

  const fetchEmployees = async () => {
    const { data } = await supabase.from('employees').select('*');
    if (data) setEmployees(data);
  };

  const fetchRecords = async () => {
    setIsLoading(true);
    let query = supabase
      .from('attendance')
      .select(`
        *,
        employee:employees(username)
      `)
      .order('date', { ascending: false });

    if (dateFilter) {
      query = query.eq('date', dateFilter);
    }
    if (employeeFilter) {
      query = query.eq('user_id', employeeFilter);
    }

    const { data, error } = await query;
    if (data) setRecords(data as any);
    setIsLoading(false);
  };

  const filteredRecords = records.filter(record => 
    record.employee?.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.user_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
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

            <div className="relative">
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin mx-auto text-gray-400" size={32} />
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
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
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">{record.katai || 0}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{record.mtr_type || '-'}</td>
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
