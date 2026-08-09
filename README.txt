SLOW STUDIO CMS — SHIZUKU LAB WORKSPACE (PROTOTYPE v0.1)

Open:
1. cms.html — Slow Studio CMS workspace
2. index.html — Shizuku Lab website preview
3. order-preview.html — Shizuku Lab ordering preview

What works in this prototype:
- Website / Ordering workspace switch
- Desktop / Tablet / Mobile preview sizes
- Click a Website/Ordering topic and preview navigates to that section
- Website data editing with immediate preview
- Logo colour, size and desktop/mobile position controls
- Page-by-page typography and paper colours
- Add/delete/reorder: tea, Why Us, library topics, cultivars, atlas regions, menu, updates
- Japan Matcha Atlas restored using assets/japan-map.svg
- Cultivar gallery retained
- Hot Whisk vs Cold Whisk knowledge topic included
- Menu colour cards retained
- Uploaded photos from site-data-3.js extracted into assets/uploads (25 images)
- Per-image Desktop/Mobile drag position + zoom for normal content images
- Chasen desktop cursor + click whisk animation
- Ordering preview editor: brand, products, drink options, collection times, promo
- Save Draft uses IndexedDB (local browser storage)
- Export Backup creates one JSON backup
- Publish currently publishes only to local prototype storage

Important:
- Supabase is NOT connected in this prototype because project URL / anon key / auth details were not supplied.
- Once preview behaviour is confirmed, the next step is replacing local Save/Publish with Supabase Database + Storage + Auth.
- Do not delete assets/uploads; those are the photos recovered from the large site-data file.
