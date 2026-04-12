import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { RawMaterialCategory, RawMaterialSubcategory, Settings } from '../../types';
import { Loader2, Package, Tag, Send, CheckCircle2, ArrowLeft, MessageSquare, Plus, Minus } from 'lucide-react';

export default function RawMaterialRequest() {
  const [categories, setCategories] = useState<RawMaterialCategory[]>([]);
  const [subcategories, setSubcategories] = useState<RawMaterialSubcategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<RawMaterialCategory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);

  const [selectedItems, setSelectedItems] = useState<{
    subcategory: RawMaterialSubcategory;
    quantity: string;
    notes: string;
  }[]>([]);

  useEffect(() => {
    fetchData();
    fetchSettings();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [catRes, subRes] = await Promise.all([
        supabase.from('raw_material_categories').select('*').order('name', { ascending: true }),
        supabase.from('raw_material_subcategories').select('*, category:raw_material_categories(name)').order('name', { ascending: true })
      ]);

      if (catRes.error) throw catRes.error;
      if (subRes.error) throw subRes.error;

      setCategories(catRes.data || []);
      setSubcategories(subRes.data || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSettings = async () => {
    const { data } = await supabase.from('settings').select('*').single();
    if (data) setSettings(data);
  };

  const getContrastColor = (hexColor: string) => {
    // Remove # if present
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 155 ? 'text-black' : 'text-white';
  };

  const toggleItemSelection = (sub: RawMaterialSubcategory) => {
    const exists = selectedItems.find(item => item.subcategory.id === sub.id);
    if (exists) {
      setSelectedItems(selectedItems.filter(item => item.subcategory.id !== sub.id));
    } else {
      setSelectedItems([...selectedItems, { subcategory: sub, quantity: '', notes: '' }]);
    }
  };

  const updateItemDetails = (id: string, field: 'quantity' | 'notes', value: string) => {
    setSelectedItems(selectedItems.map(item => 
      item.subcategory.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleSendRequest = () => {
    if (selectedItems.length === 0) return alert('Please select at least one item');
    if (!settings?.phone) return alert('Admin phone number not set in settings');

    let message = `*Raw Material Request*\n\n`;
    selectedItems.forEach((item, index) => {
      message += `${index + 1}. *${item.subcategory.category?.name} - ${item.subcategory.name}*\n`;
      message += `   Color: ${item.subcategory.color_name}\n`;
      if (item.quantity) message += `   Quantity: ${item.quantity}\n`;
      if (item.notes) message += `   Notes: ${item.notes}\n`;
      message += `\n`;
    });

    const encodedMessage = encodeURIComponent(message);
    
    // Send to first number
    const whatsappUrl1 = `https://wa.me/${settings.phone}?text=${encodedMessage}`;
    window.open(whatsappUrl1, '_blank');

    // Send to second number if exists
    if (settings.phone2) {
      setTimeout(() => {
        const whatsappUrl2 = `https://wa.me/${settings.phone2}?text=${encodedMessage}`;
        window.open(whatsappUrl2, '_blank');
      }, 500); // Small delay to help avoid popup blockers
    }
    
    // Clear selection after sending
    setSelectedItems([]);
    setSelectedCategory(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3">
          {selectedCategory && (
            <button onClick={() => setSelectedCategory(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <ArrowLeft size={20} />
            </button>
          )}
          <h3 className="text-lg font-bold text-gray-900">
            {selectedCategory ? `Select ${selectedCategory.name}` : 'Raw Material Categories'}
          </h3>
        </div>
        {selectedItems.length > 0 && (
          <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-bold">
            <CheckCircle2 size={14} />
            {selectedItems.length} Items Selected
          </div>
        )}
      </div>

      {!selectedCategory ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat)}
              className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md hover:border-primary/20 transition-all text-center space-y-3 group"
            >
              <div className="w-12 h-12 bg-primary/5 text-primary rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                <Package size={24} />
              </div>
              <span className="block font-bold text-gray-900">{cat.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {subcategories
            .filter(sub => sub.category_id === selectedCategory.id)
            .map(sub => {
              const isSelected = selectedItems.some(item => item.subcategory.id === sub.id);
              const textColorClass = getContrastColor(sub.color_code || '#FFFFFF');
              
              return (
                <div 
                  key={sub.id}
                  onClick={() => toggleItemSelection(sub)}
                  className={`relative p-6 rounded-3xl cursor-pointer transition-all duration-300 flex flex-col items-center justify-center text-center min-h-[140px] shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] border-4 ${isSelected ? 'border-primary' : 'border-transparent'}`}
                  style={{ backgroundColor: sub.color_code || '#FFFFFF' }}
                >
                  <div className={`space-y-1 ${textColorClass}`}>
                    <h4 className="font-bold text-lg leading-tight">{sub.name}</h4>
                    <p className="text-xs font-medium opacity-80">{sub.color_name}</p>
                  </div>

                  {isSelected && (
                    <div className="absolute top-3 right-3">
                      <div className={`p-1 rounded-full ${textColorClass === 'text-white' ? 'bg-white/20' : 'bg-black/10'}`}>
                        <CheckCircle2 size={20} />
                      </div>
                    </div>
                  )}
                  
                  {isSelected && (
                    <div 
                      className="mt-4 w-full space-y-3 pt-3 border-t border-current/10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="text-left">
                        <label className={`block text-[10px] font-bold uppercase mb-1 opacity-70 ${textColorClass}`}>Quantity</label>
                        <input 
                          type="text" 
                          placeholder="e.g. 5 Rolls"
                          value={selectedItems.find(item => item.subcategory.id === sub.id)?.quantity || ''}
                          onChange={e => updateItemDetails(sub.id, 'quantity', e.target.value)}
                          className={`w-full px-3 py-2 rounded-xl text-xs outline-none border-none ${
                            textColorClass === 'text-white' 
                              ? 'bg-white/20 text-white placeholder:text-white/50' 
                              : 'bg-black/5 text-black placeholder:text-black/40'
                          }`}
                        />
                      </div>
                      <div className="text-left">
                        <label className={`block text-[10px] font-bold uppercase mb-1 opacity-70 ${textColorClass}`}>Notes</label>
                        <input 
                          type="text" 
                          placeholder="Any specific note..."
                          value={selectedItems.find(item => item.subcategory.id === sub.id)?.notes || ''}
                          onChange={e => updateItemDetails(sub.id, 'notes', e.target.value)}
                          className={`w-full px-3 py-2 rounded-xl text-xs outline-none border-none ${
                            textColorClass === 'text-white' 
                              ? 'bg-white/20 text-white placeholder:text-white/50' 
                              : 'bg-black/5 text-black placeholder:text-black/40'
                          }`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* Floating Send Button */}
      {selectedItems.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-50">
          <button
            onClick={handleSendRequest}
            className="w-full bg-primary text-white py-4 rounded-2xl font-bold shadow-xl shadow-primary/20 hover:bg-primary-hover transition-all flex items-center justify-center gap-3"
          >
            <MessageSquare size={20} />
            Send Request via WhatsApp
            <span className="bg-white/20 px-2 py-0.5 rounded-lg text-xs">{selectedItems.length}</span>
          </button>
        </div>
      )}
    </div>
  );
}
