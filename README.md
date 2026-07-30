# Shizuku Lab — ordering site

A plain HTML/CSS/JS site (no build step). `index.html` is the customer ordering
page, `admin.html` is your shop dashboard. Right now it runs in **demo mode**
with sample data — follow the steps below to connect it to a real database.

## 1. Set up Supabase (free, ~5 minutes)

1. Go to [supabase.com](https://supabase.com) → sign up → **New project** (free tier is enough).
2. Once it's created, open **SQL Editor** → **New query**, paste the entire contents of `schema.sql` from this folder, and click **Run**. This creates the `menu_items` and `orders` tables and loads your starting menu.
3. Go to **Project Settings → API**. Copy:
   - **Project URL**
   - **anon public** key (do **not** use the `service_role` key — that one must stay secret)
4. Open `js/config.js` and paste them in:
   ```js
   const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
   const SUPABASE_ANON_KEY = "eyJ....";
   ```
5. Save. Reload the site — the "demo mode" banner should disappear.

## 2. Put it on the internet

Any static host works. Easiest options:

**Netlify (drag and drop):**
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag the whole `shizuku-lab-site` folder onto the page
3. You'll get a live URL immediately (you can rename it or connect a custom domain later in Netlify settings)

**Vercel:**
1. Go to [vercel.com/new](https://vercel.com/new) → drag and drop the folder, or connect a GitHub repo containing this folder
2. Deploy — no build settings needed

Either way, share that URL with customers — that's the ordering link.

## 3. Change the shop PIN

Open `js/config.js` and change `SHOP_PIN` to whatever you like. This PIN only
gates the admin page UI, not the database (see the note at the bottom of
`schema.sql`) — fine for now, but worth upgrading to real Supabase Auth
before you scale up.

## 4. Add or swap product photos

Photos live in `images/`. To add a new one:
1. Upload the image file into the `images/` folder (via your host's file browser, or by re-deploying the whole folder with the new file added)
2. In the shop dashboard (`admin.html` → Menu tab → Edit), set **Image path or URL** to `images/your-filename.jpg`

You can also point `image_url` at any external image URL instead.

## 5. PayNow payments

The payment screen currently shows a placeholder QR pattern and asks
customers to transfer manually with the order code as reference, then tap
"I've sent payment." You confirm receipt in the shop dashboard. For a real
scannable PayNow QR, you can generate a static one from your bank's app and
replace `.qr-placeholder` in `css/style.css` with an `<img>` of that QR code.

## What's already assumed

The starting menu in `schema.sql` was assembled from the photos and
screenshots you shared — category names, a couple of prices, and which photo
matches which drink are best guesses (e.g. the Yakult, sakura, and citrus
photos were mapped to "Special" items I named). Everything is editable from
the shop dashboard, so feel free to rename, reprice, or delete anything
that's not right.
