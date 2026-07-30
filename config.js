// Fill these in from Supabase → Project Settings → API
// SUPABASE_URL looks like: https://xxxxxxxxxxxx.supabase.co
// SUPABASE_ANON_KEY is the long "anon public" key (NOT the service_role key)
const SUPABASE_URL = "https://ohgfmmvsxckayamlzdlj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_6l6Jp0etNJyGUgFc1UUg4w_FfJnLZd1";

// Shop PIN to gate the admin.html dashboard (see schema.sql note: this only
// gates the page, not the database — fine for a small pre-order shop).
const SHOP_PIN = "0130";

const IS_CONFIGURED = SUPABASE_URL !== "YOUR_SUPABASE_URL" && SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";
const db = IS_CONFIGURED ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
