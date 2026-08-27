import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ifltsrndyquvumitbjuh.supabase.co/rest/v1/";
const supabaseAnonKey = "sb_publishable_gCk5wG5Sn3efLlp_bpJW2w_NM2fvERx";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);