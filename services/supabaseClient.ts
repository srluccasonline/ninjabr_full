import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants';

let supabaseInstance: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  if (supabaseInstance) return supabaseInstance;

  try {
    // Use the hardcoded key from constants
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      return supabaseInstance;
    }
  } catch (error) {
    console.error("Failed to initialize Supabase:", error);
    return null;
  }
  
  return null;
};

export const isClientConfigured = (): boolean => {
    return !!SUPABASE_ANON_KEY;
}