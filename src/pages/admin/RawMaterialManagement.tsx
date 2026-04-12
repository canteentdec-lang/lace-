import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { RawMaterialCategory, RawMaterialSubcategory } from '../../types';
import { Plus, Search, Edit2, Trash2, X, Loader2, Package, Tag, Palette, Save, Check } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';

const COMMON_COLORS = [
  { name: 'White', code: '#FFFFFF' },
  { name: 'Off White', code: '#FAF9F6' },
  { name: 'Cream', code: '#FFFDD0' },
  { name: 'Ivory', code: '#FFFFF0' },
  { name: 'Black', code: '#000000' },
  { name: 'Jet Black', code: '#343434' },
  { name: 'Charcoal', code: '#36454F' },
  { name: 'Silver', code: '#C0C0C0' },
  { name: 'Light Silver', code: '#D3D3D3' },
  { name: 'Dark Silver', code: '#A9A9A9' },
  { name: 'Metallic Silver', code: '#BCC6CC' },
  { name: 'Gold', code: '#FFD700' },
  { name: 'Light Gold', code: '#FFEC8B' },
  { name: 'Old Gold', code: '#CFB53B' },
  { name: 'Rose Gold', code: '#B76E79' },
  { name: 'Red', code: '#FF0000' },
  { name: 'Dark Red', code: '#8B0000' },
  { name: 'Maroon', code: '#800000' },
  { name: 'Crimson', code: '#DC143C' },
  { name: 'Blue', code: '#0000FF' },
  { name: 'Light Blue', code: '#ADD8E6' },
  { name: 'Sky Blue', code: '#87CEEB' },
  { name: 'Navy Blue', code: '#000080' },
  { name: 'Royal Blue', code: '#4169E1' },
  { name: 'Green', code: '#008000' },
  { name: 'Light Green', code: '#90EE90' },
  { name: 'Dark Green', code: '#006400' },
  { name: 'Olive Green', code: '#808000' },
  { name: 'Lime Green', code: '#32CD32' },
  { name: 'Yellow', code: '#FFFF00' },
  { name: 'Lemon Yellow', code: '#FFF700' },
  { name: 'Golden Yellow', code: '#FFDF00' },
  { name: 'Pink', code: '#FFC0CB' },
  { name: 'Hot Pink', code: '#FF69B4' },
  { name: 'Deep Pink', code: '#FF1493' },
  { name: 'Baby Pink', code: '#F4C2C2' },
  { name: 'Orange', code: '#FFA500' },
  { name: 'Dark Orange', code: '#FF8C00' },
  { name: 'Coral', code: '#FF7F50' },
  { name: 'Purple', code: '#800080' },
  { name: 'Lavender', code: '#E6E6FA' },
  { name: 'Violet', code: '#EE82EE' },
  { name: 'Magenta', code: '#FF00FF' },
  { name: 'Brown', code: '#A52A2A' },
  { name: 'Chocolate', code: '#D2691E' },
  { name: 'Saddle Brown', code: '#8B4513' },
  { name: 'Tan', code: '#D2B48C' },
  { name: 'Grey', code: '#808080' },
  { name: 'Light Grey', code: '#D3D3D3' },
  { name: 'Dark Grey', code: '#A9A9A9' },
  { name: 'Slate Grey', code: '#708090' },
  { name: 'Teal', code: '#008080' },
  { name: 'Turquoise', code: '#40E0D0' },
  { name: 'Cyan', code: '#00FFFF' },
  { name: 'Aqua', code: '#00FFFF' },
  { name: 'Beige', code: '#F5F5DC' },
  { name: 'Khaki', code: '#F0E68C' },
  { name: 'Peach', code: '#FFDAB9' },
  { name: 'Mint', code: '#F5FFFA' },
  { name: 'Apricot', code: '#FBCEB1' },
  { name: 'Bronze', code: '#CD7F32' },
  { name: 'Copper', code: '#B87333' },
  { name: 'Indigo', code: '#4B0082' },
  { name: 'Plum', code: '#DDA0DD' },
  { name: 'Orchid', code: '#DA70D6' },
  { name: 'Salmon', code: '#FA8072' },
  { name: 'Mustard', code: '#FFDB58' },
  { name: 'Rust', code: '#B7410E' },
  { name: 'Wine', code: '#722F37' },
  { name: 'Emerald', code: '#50C878' },
  { name: 'Sapphire', code: '#0F52BA' },
  { name: 'Ruby', code: '#E0115F' },
  { name: 'Amber', code: '#FFBF00' },
  { name: 'Pearl', code: '#EAE0C8' },
  { name: 'Champagne', code: '#F7E7CE' },
  { name: 'Coffee', code: '#6F4E37' },
  { name: 'Camel', code: '#C19A6B' },
  { name: 'Sand', code: '#C2B280' },
  { name: 'Wheat', code: '#F5DEB3' },
  { name: 'Sky', code: '#00BFFF' },
  { name: 'Ocean', code: '#0077BE' },
  { name: 'Forest', code: '#228B22' },
  { name: 'Moss', code: '#8A9A5B' },
  { name: 'Sage', code: '#BCB88A' },
  { name: 'Pistachio', code: '#93C572' },
  { name: 'Lilac', code: '#C8A2C8' },
  { name: 'Mauve', code: '#E0B0FF' },
  { name: 'Periwinkle', code: '#CCCCFF' },
  { name: 'Denim', code: '#1560BD' },
  { name: 'Steel', code: '#4682B4' },
  { name: 'Gunmetal', code: '#2A3439' },
  { name: 'Midnight', code: '#191970' },
  { name: 'Bordeaux', code: '#4C0805' },
  { name: 'Burgundy', code: '#800020' },
  { name: 'Terracotta', code: '#E2725B' },
  { name: 'Ochre', code: '#CC7722' },
  { name: 'Sienna', code: '#A0522D' },
  { name: 'Umbra', code: '#635147' },
  { name: 'Sepia', code: '#704214' }
];

export default function RawMaterialManagement() {
  const [categories, setCategories] = useState<RawMaterialCategory[]>([]);
  const [subcategories, setSubcategories] = useState<RawMaterialSubcategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isSubcategoryModalOpen, setIsSubcategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<RawMaterialCategory | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<RawMaterialSubcategory | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [categoryForm, setCategoryForm] = useState({ name: '' });
  const [subcategoryForm, setSubcategoryForm] = useState({
    category_id: '',
    name: '',
    color_name: '',
    color_code: '#000000'
  });
  const [colorSearch, setColorSearch] = useState('');

  useEffect(() => {
    fetchData();
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
      alert('Error loading data: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const payload = { name: categoryForm.name };
      const { error } = editingCategory
        ? await supabase.from('raw_material_categories').update(payload).eq('id', editingCategory.id)
        : await supabase.from('raw_material_categories').insert([payload]);

      if (error) throw error;
      setIsCategoryModalOpen(false);
      fetchData();
    } catch (error: any) {
      alert('Error saving category: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubcategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const payload = {
        category_id: subcategoryForm.category_id,
        name: subcategoryForm.name,
        color_name: subcategoryForm.color_name,
        color_code: subcategoryForm.color_code
      };
      const { error } = editingSubcategory
        ? await supabase.from('raw_material_subcategories').update(payload).eq('id', editingSubcategory.id)
        : await supabase.from('raw_material_subcategories').insert([payload]);

      if (error) throw error;
      setIsSubcategoryModalOpen(false);
      fetchData();
    } catch (error: any) {
      alert('Error saving sub-category: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!window.confirm('Are you sure? This will delete all sub-categories too.')) return;
    try {
      const { error } = await supabase.from('raw_material_categories').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (error: any) {
      alert('Error deleting category: ' + error.message);
    }
  };

  const deleteSubcategory = async (id: string) => {
    if (!window.confirm('Are you sure?')) return;
    try {
      const { error } = await supabase.from('raw_material_subcategories').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (error: any) {
      alert('Error deleting sub-category: ' + error.message);
    }
  };

  const filteredColors = COMMON_COLORS.filter(c => 
    c.name.toLowerCase().includes(colorSearch.toLowerCase())
  );

  const getContrastColor = (hexColor: string) => {
    const hex = hexColor.replace('#', '');
    if (hex.length !== 6) return 'text-black';
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 155 ? 'text-black' : 'text-white';
  };

  return (
    <div className="space-y-8">
      {/* Categories Section */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="text-primary" /> Raw Material Categories
          </h3>
          <button 
            onClick={() => {
              setEditingCategory(null);
              setCategoryForm({ name: '' });
              setIsCategoryModalOpen(true);
            }}
            className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-primary-hover transition-colors"
          >
            <Plus size={18} /> Add Category
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map(cat => (
            <div key={cat.id} className="p-4 border border-gray-100 rounded-xl hover:shadow-md transition-all group">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-900">{cat.name}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => {
                      setEditingCategory(cat);
                      setCategoryForm({ name: cat.name });
                      setIsCategoryModalOpen(true);
                    }}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button 
                    onClick={() => deleteCategory(cat.id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sub-categories Section */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Tag className="text-primary" /> Sub-categories & Colors
          </h3>
          <button 
            onClick={() => {
              setEditingSubcategory(null);
              setSubcategoryForm({ category_id: '', name: '', color_name: '', color_code: '#000000' });
              setIsSubcategoryModalOpen(true);
            }}
            className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-primary-hover transition-colors"
          >
            <Plus size={18} /> Add Sub-category
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {subcategories.map(sub => (
            <div key={sub.id} className="bg-gray-50 p-4 rounded-2xl space-y-3 relative group border border-transparent hover:border-primary/20 transition-all">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-bold text-primary uppercase tracking-wider">{sub.category?.name}</p>
                  <h4 className="font-bold text-gray-900">{sub.name}</h4>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => {
                      setEditingSubcategory(sub);
                      setSubcategoryForm({
                        category_id: sub.category_id,
                        name: sub.name,
                        color_name: sub.color_name,
                        color_code: sub.color_code
                      });
                      setIsSubcategoryModalOpen(true);
                    }}
                    className="p-1.5 bg-white text-blue-600 hover:bg-blue-50 rounded-lg shadow-sm"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button 
                    onClick={() => deleteSubcategory(sub.id)}
                    className="p-1.5 bg-white text-red-600 hover:bg-red-50 rounded-lg shadow-sm"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm">
                <div 
                  className="w-8 h-8 rounded-lg border border-gray-100" 
                  style={{ backgroundColor: sub.color_code }}
                />
                <div>
                  <p className="text-xs font-medium text-gray-900">{sub.color_name}</p>
                  <p className="text-[10px] text-gray-400 font-mono">{sub.color_code}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">{editingCategory ? 'Edit Category' : 'Add Category'}</h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            <form onSubmit={handleCategorySubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
                <input 
                  type="text" 
                  required 
                  value={categoryForm.name} 
                  onChange={e => setCategoryForm({ name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                  placeholder="e.g. Chapti Dori"
                />
              </div>
              <button type="submit" className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-primary-hover transition-colors">
                {editingCategory ? 'Update' : 'Create'} Category
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Sub-category Modal */}
      {isSubcategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">{editingSubcategory ? 'Edit Sub-category' : 'Add Sub-category'}</h3>
              <button onClick={() => setIsSubcategoryModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubcategorySubmit} className="p-6 space-y-6 max-h-[90vh] overflow-y-auto">
              {/* Live Preview Card */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Live Preview</label>
                <div 
                  className={`w-full h-32 rounded-3xl flex flex-col items-center justify-center text-center p-4 shadow-sm border-4 border-gray-50 transition-all duration-300 ${getContrastColor(subcategoryForm.color_code)}`}
                  style={{ backgroundColor: subcategoryForm.color_code }}
                >
                  <h4 className="font-bold text-lg leading-tight">{subcategoryForm.name || 'Sub-category Name'}</h4>
                  <p className="text-xs font-medium opacity-80">{subcategoryForm.color_name || 'Color Name'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select 
                    required 
                    value={subcategoryForm.category_id}
                    onChange={e => setSubcategoryForm({ ...subcategoryForm, category_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none bg-white"
                  >
                    <option value="">Select Category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sub-category Name</label>
                  <input 
                    type="text" 
                    required 
                    value={subcategoryForm.name} 
                    onChange={e => setSubcategoryForm({ ...subcategoryForm, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                    placeholder="e.g. Silver Chapti Dori"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Advanced Color Picker */}
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">Advanced Picker</label>
                    <div className="custom-color-picker">
                      <HexColorPicker 
                        color={subcategoryForm.color_code} 
                        onChange={color => setSubcategoryForm({ ...subcategoryForm, color_code: color })}
                      />
                    </div>
                  </div>

                  {/* Search & Suggestions */}
                  <div className="flex-1 space-y-3">
                    <label className="block text-sm font-medium text-gray-700">Search & Suggestions</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                      <input 
                        type="text" 
                        placeholder="Search shades (e.g. pink, gold)..." 
                        value={colorSearch}
                        onChange={e => setColorSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1 border border-gray-50 rounded-xl bg-gray-50/50">
                      {filteredColors.map(c => (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => setSubcategoryForm({ ...subcategoryForm, color_name: c.name, color_code: c.code })}
                          className="group relative flex flex-col items-center"
                          title={c.name}
                        >
                          <div 
                            className={`w-10 h-10 rounded-xl border-2 transition-all flex items-center justify-center ${subcategoryForm.color_code.toLowerCase() === c.code.toLowerCase() ? 'border-primary scale-110 shadow-md' : 'border-white shadow-sm'}`}
                            style={{ backgroundColor: c.code }}
                          >
                            {subcategoryForm.color_code.toLowerCase() === c.code.toLowerCase() && (
                              <Check size={16} className={getContrastColor(c.code)} />
                            )}
                          </div>
                        </button>
                      ))}
                      {filteredColors.length === 0 && (
                        <div className="col-span-full py-8 text-center text-gray-400 text-xs">
                          No matching shades found. Use the picker!
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Color Name</label>
                    <input 
                      type="text" 
                      required 
                      value={subcategoryForm.color_name}
                      onChange={e => setSubcategoryForm({ ...subcategoryForm, color_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary"
                      placeholder="e.g. Metallic Pink"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Hex Code</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-400 font-mono">#</span>
                      <input 
                        type="text" 
                        required 
                        value={subcategoryForm.color_code.replace('#', '')}
                        onChange={e => {
                          const val = e.target.value.replace(/[^0-9A-Fa-f]/g, '').substring(0, 6);
                          setSubcategoryForm({ ...subcategoryForm, color_code: '#' + val });
                        }}
                        className="w-full pl-6 pr-4 py-2 border border-gray-200 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-primary uppercase"
                        placeholder="FFFFFF"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button type="submit" className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-primary-hover transition-colors flex items-center justify-center gap-2">
                <Save size={18} />
                {editingSubcategory ? 'Update' : 'Create'} Sub-category
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
