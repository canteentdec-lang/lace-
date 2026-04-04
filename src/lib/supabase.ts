import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = () => {
  if (supabaseInstance) return supabaseInstance;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  console.log('Initializing Supabase client with URL:', supabaseUrl);

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration is missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.');
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseInstance;
};

// For backward compatibility with existing imports, but we should move to getSupabase()
// We'll use a Proxy to handle the lazy initialization for the exported 'supabase' object
export const supabase = new Proxy({} as SupabaseClient, {
  get: (target, prop, receiver) => {
    const instance = getSupabase();
    const value = Reflect.get(instance, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
  getPrototypeOf: () => {
    return Object.getPrototypeOf(getSupabase());
  },
  getOwnPropertyDescriptor: (target, prop) => {
    return Object.getOwnPropertyDescriptor(getSupabase(), prop);
  },
  has: (target, prop) => {
    return Reflect.has(getSupabase(), prop);
  },
  ownKeys: () => {
    return Reflect.ownKeys(getSupabase());
  }
});
