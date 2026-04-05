import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Settings as SettingsType } from '../../types';
import { Save, Loader2, Building2, MapPin, Hash, Phone, Mail, Image as ImageIcon } from 'lucide-react';

export default function Settings() {
  const [settings, setSettings] = useState<Partial<SettingsType>>({
    business_name: '',
    address: '',
    gst_no: '',
    phone: '',
    email: '',
    logo_url: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      console.log('Fetching settings...');
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .maybeSingle(); // Use maybeSingle to avoid error if no row exists
      
      if (error) {
        console.error('Error fetching settings:', error);
        setErrorMsg('Failed to load settings: ' + error.message);
      } else if (data) {
        console.log('Settings loaded:', data);
        setSettings(data);
      } else {
        console.log('No settings found, using defaults.');
      }
    } catch (error: any) {
      console.error('Unexpected error fetching settings:', error);
      setErrorMsg('An unexpected error occurred while loading settings.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please upload an image file.');
      return;
    }

    // Validate file size (e.g., 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('File size should be less than 2MB.');
      return;
    }

    setIsUploading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      // Upload to 'logos' bucket
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file);

      if (uploadError) {
        // If bucket doesn't exist, this might fail. 
        // In a real app, you'd ensure the bucket exists.
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath);

      setSettings(prev => ({ ...prev, logo_url: publicUrl }));
      setSuccessMsg('Logo uploaded successfully! Remember to save settings.');
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      setErrorMsg('Failed to upload logo: ' + error.message + '. Make sure "logos" bucket exists in Supabase Storage.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('handleSubmit triggered for settings');
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // Basic validation
      if (!settings.business_name || !settings.address || !settings.gst_no || !settings.phone || !settings.email) {
        throw new Error('Please fill in all required fields.');
      }

      console.log('Saving settings data:', settings);
      
      // Explicitly handle the ID to avoid "null value in column id" errors
      const { id, ...rest } = settings;
      const payload = id ? { id, ...rest } : rest;

      const { data, error } = await supabase
        .from('settings')
        .upsert([payload])
        .select()
        .single();
      
      if (error) {
        console.error('Supabase error saving settings:', error);
        throw new Error(`Failed to save settings: ${error.message}`);
      }

      console.log('Settings saved successfully:', data);
      setSettings(data);
      setSuccessMsg('Settings saved successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (error: any) {
      console.error('Error in handleSubmit:', error);
      setErrorMsg(error.message || 'Error saving settings.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-8">
        <div className="flex items-center gap-4 border-b border-gray-50 pb-6">
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
            <Building2 size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Business Settings</h2>
            <p className="text-gray-500 text-sm">Update your business information for invoices</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {errorMsg && (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm font-medium">
                {errorMsg}
              </div>
              {errorMsg.includes('Bucket not found') || errorMsg.includes('violates row-level security policy') ? (
                <div className="p-4 bg-blue-50 border border-blue-100 text-blue-700 rounded-2xl text-sm">
                  <p className="font-bold mb-1">How to fix this in Supabase:</p>
                  <ol className="list-decimal ml-4 space-y-2">
                    <li>Go to <b>Storage</b> in your Supabase Dashboard.</li>
                    <li>Create a new bucket named <b>"logos"</b> and set it to <b>Public</b>.</li>
                    <li>Click on <b>Policies</b> for the "logos" bucket.</li>
                    <li>Add a <b>New Policy</b>:
                      <ul className="list-disc ml-4 mt-1 text-xs space-y-1">
                        <li>Select <b>"Full access to all users"</b> (or "Allow all operations").</li>
                        <li>This allows the app to upload and update the logo.</li>
                      </ul>
                    </li>
                    <li>Try uploading your logo again.</li>
                  </ol>
                </div>
              ) : null}
            </div>
          )}
          {successMsg && (
            <div className="p-4 bg-green-50 border border-green-100 text-green-600 rounded-2xl text-sm font-medium">
              {successMsg}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Building2 size={16} className="text-gray-400" />
                Business Name
              </label>
              <input
                type="text"
                required
                value={settings.business_name}
                onChange={(e) => setSettings({ ...settings, business_name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                placeholder="e.g. Shree Mahalaxmi Lace"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Hash size={16} className="text-gray-400" />
                GST Number
              </label>
              <input
                type="text"
                required
                value={settings.gst_no}
                onChange={(e) => setSettings({ ...settings, gst_no: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                placeholder="e.g. 24AGQPJ2786A1ZF"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <MapPin size={16} className="text-gray-400" />
                Address
              </label>
              <textarea
                required
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all min-h-[100px]"
                placeholder="Business Address"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Phone size={16} className="text-gray-400" />
                Phone Number
              </label>
              <input
                type="text"
                required
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                placeholder="e.g. 9825033599"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Mail size={16} className="text-gray-400" />
                Email Address
              </label>
              <input
                type="email"
                required
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                placeholder="e.g. shreemahalaxmilace@gmail.com"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <ImageIcon size={16} className="text-gray-400" />
                Business Logo
              </label>
              <div className="flex items-start gap-6 p-6 border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/50">
                <div className="w-24 h-24 bg-white rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden shadow-sm">
                  {settings.logo_url ? (
                    <img 
                      src={settings.logo_url} 
                      alt="Logo Preview" 
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <ImageIcon className="text-gray-300" size={32} />
                  )}
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer bg-white border border-gray-200 px-4 py-2 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-sm">
                      {isUploading ? 'Uploading...' : 'Choose File'}
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleLogoUpload}
                        disabled={isUploading}
                      />
                    </label>
                    {settings.logo_url && (
                      <button 
                        type="button"
                        onClick={() => setSettings({ ...settings, logo_url: '' })}
                        className="text-sm font-bold text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 italic">
                    Upload your business logo (PNG, JPG). Max size 2MB.
                  </p>
                  {settings.logo_url && (
                    <div className="text-[10px] text-gray-400 break-all bg-white p-2 rounded border border-gray-100">
                      URL: {settings.logo_url}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-primary-hover transition-all flex items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
