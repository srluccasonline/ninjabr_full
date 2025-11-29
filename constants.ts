// Configuration constants
export const APP_NAME = "NINJABR";
export const SUPABASE_PROJECT_ID = "nvukznijjllgyuyrswhy";
export const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`;
export const ADMIN_USERS_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/user-management`;
export const SHARED_OTPS_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/shared-otps`;

// Hardcoded Key as requested
export const SUPABASE_ANON_KEY = "sb_publishable_C3QyvlDHZRSidZWtbE2k3g_47ldrdW_";

// Local storage keys (kept just in case, but primary auth is now hardcoded)
export const LS_SUPABASE_KEY = "ninjabr_supabase_anon_key";