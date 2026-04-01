import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AuthUser, Attendance } from '../types';
import { Play, Square, Loader2, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { formatTime, formatDate } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface UserDashboardProps {
  user: AuthUser;
}

export default function UserDashboard({ user }: UserDashboardProps) {
  const [activeRecord, setActiveRecord] = useState<Attendance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form State (Hindi)
  const [formData, setFormData] = useState({
    shift: 'day',
    katai: '',
    mtr_type: '17',
    custom_mtr: ''
  });

  useEffect(() => {
    fetchActiveRecord();
  }, []);

  const fetchActiveRecord = async () => {
    setIsLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', user.user_id)
      .eq('date', today)
      .is('logout_time', null)
      .single();

    if (data) setActiveRecord(data);
    else setActiveRecord(null);
    setIsLoading(false);
  };

  const handleStartWork = async () => {
    setIsSubmitting(true);
    const now = new Date();
    const { data, error } = await supabase
      .from('attendance')
      .insert([{
        user_id: user.user_id,
        date: now.toISOString().split('T')[0],
        login_time: now.toISOString(),
      }])
      .select()
      .single();

    if (data) setActiveRecord(data);
    setIsSubmitting(false);
  };

  const handleEndWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRecord) return;
    setIsSubmitting(true);

    const logoutTime = new Date();
    const loginTime = new Date(activeRecord.login_time!);
    const diffMs = logoutTime.getTime() - loginTime.getTime();
    const diffHrs = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100; // Rounded to 2 decimal places

    const { error } = await supabase
      .from('attendance')
      .update({
        logout_time: logoutTime.toISOString(),
        total_hours: diffHrs,
        shift: formData.shift,
        katai: parseInt(formData.katai),
        mtr_type: formData.mtr_type === 'custom' ? formData.custom_mtr : formData.mtr_type
      })
      .eq('id', activeRecord.id);

    if (!error) {
      setActiveRecord(null);
      setShowForm(false);
      setFormData({ shift: 'day', katai: '', mtr_type: '17', custom_mtr: '' });
      alert('काम सफलतापूर्वक सहेजा गया!');
    } else {
      alert('कुछ गलत हो गया। कृपया फिर से प्रयास करें।');
    }
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="animate-spin text-gray-400" size={48} />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-8 pb-12">
      {/* Welcome Header */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-gray-900">नमस्ते, {user.username}!</h2>
        <p className="text-gray-500">{formatDate(new Date())}</p>
      </div>

      {/* Main Action Card */}
      <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm text-center space-y-8">
        {!activeRecord ? (
          <div className="space-y-6">
            <div className="w-24 h-24 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto">
              <Play size={40} fill="currentColor" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-gray-900">काम शुरू करने के लिए तैयार?</h3>
              <p className="text-sm text-gray-500">अपना काम शुरू करने के लिए नीचे दिए गए बटन को दबाएं।</p>
            </div>
            <button
              onClick={handleStartWork}
              disabled={isSubmitting}
              className="w-full bg-green-600 text-white py-5 rounded-2xl font-bold text-xl hover:bg-green-700 transition-all shadow-lg shadow-green-100 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : 'काम शुरू करें'}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="w-24 h-24 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto animate-pulse">
              <Square size={40} fill="currentColor" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-gray-900">काम चल रहा है...</h3>
              <p className="text-sm text-gray-500">शुरू होने का समय: <span className="font-bold text-gray-900">{formatTime(activeRecord.login_time!)}</span></p>
            </div>
            {!showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="w-full bg-red-600 text-white py-5 rounded-2xl font-bold text-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 flex items-center justify-center gap-3"
              >
                काम बंद करें
              </button>
            ) : (
              <motion.form 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleEndWork} 
                className="text-left space-y-6 pt-4 border-t border-gray-100"
              >
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">शिफ्ट चुनें (Shift)</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, shift: 'day' })}
                        className={`py-3 rounded-xl font-bold border-2 transition-all ${formData.shift === 'day' ? 'border-primary bg-primary text-white' : 'border-gray-100 text-gray-500'}`}
                      >
                        दिन (Day)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, shift: 'night' })}
                        className={`py-3 rounded-xl font-bold border-2 transition-all ${formData.shift === 'night' ? 'border-primary bg-primary text-white' : 'border-gray-100 text-gray-500'}`}
                      >
                        रात (Night)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">कटाई की संख्या (Katai)</label>
                    <input
                      type="number"
                      required
                      value={formData.katai}
                      onChange={(e) => setFormData({ ...formData, katai: e.target.value })}
                      className="w-full px-4 py-4 border-2 border-gray-100 rounded-xl focus:border-primary outline-none text-lg font-bold"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">MTR प्रति कटाई</label>
                    <select
                      value={formData.mtr_type}
                      onChange={(e) => setFormData({ ...formData, mtr_type: e.target.value })}
                      className="w-full px-4 py-4 border-2 border-gray-100 rounded-xl focus:border-primary outline-none text-lg font-bold bg-white"
                    >
                      <option value="17">17</option>
                      <option value="24">24</option>
                      <option value="36">36</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>

                  {formData.mtr_type === 'custom' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                    >
                      <label className="block text-sm font-bold text-gray-700 mb-2">कस्टम MTR दर्ज करें</label>
                      <input
                        type="text"
                        required
                        value={formData.custom_mtr}
                        onChange={(e) => setFormData({ ...formData, custom_mtr: e.target.value })}
                        className="w-full px-4 py-4 border-2 border-gray-100 rounded-xl focus:border-primary outline-none text-lg font-bold"
                        placeholder="Enter custom MTR"
                      />
                    </motion.div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 py-4 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all"
                  >
                    वापस
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-[2] py-4 rounded-xl font-bold text-white bg-primary hover:bg-primary-hover transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'सहेज रहे हैं...' : 'जमा करें'}
                  </button>
                </div>
              </motion.form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
