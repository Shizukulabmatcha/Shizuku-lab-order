// Fill these in from Supabase → Project Settings → API
// SUPABASE_URL looks like: https://xxxxxxxxxxxx.supabase.co
// SUPABASE_ANON_KEY is the long "anon public" key (NOT the service_role key)
const SUPABASE_URL = "https://ohgfmmvsxckayamlzdlj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_6l6Jp0etNJyGUgFc1UUg4w_FfJnLZd1";

// Shop PIN to gate the admin.html dashboard (see schema.sql note: this only
// gates the page, not the database — fine for a small pre-order shop).
const SHOP_PIN = "0130";

// ---- Store info — edit these any time, no code changes needed elsewhere ----
const STORE_INFO = {
  instagram: "shizukulab.matcha", // without the @
  dropOffPoints: [
    "Blk 130A Toa Payoh Lorong 1",
    "Near Creamier, Toa Payoh",
  ],
  paynowNumber: "+65 9454 0513",
};

// Opening hours — each entry is one day you open, with 24h start/end time.
// day: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
// To change your hours or add/remove a day, just edit this list.
const STORE_HOURS = [
  { day: 6, label: "Saturday", open: "10:00", close: "12:00" },
  { day: 0, label: "Sunday", open: "10:00", close: "13:00" },
];

const IS_CONFIGURED = SUPABASE_URL !== "YOUR_SUPABASE_URL" && SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";
const db = IS_CONFIGURED ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
