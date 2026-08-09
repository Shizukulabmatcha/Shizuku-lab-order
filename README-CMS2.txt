SHIZUKU LAB — CMS 2.0 / REAL PUBLISH

ONE-TIME SETUP
1. Open Supabase -> SQL Editor.
2. Open SUPABASE-WEBSITE-CMS.sql from this folder, copy all, and Run.
3. Open cms.html. Click Cloud · Sign in and use the same admin login as the Orders dashboard.
4. Edit the website. Save Draft stores a cloud draft when signed in.
5. Publish Website writes the current website to Supabase website_live.
6. index.html reads website_live automatically. On Vercel, refresh the public site to see the published version.

IMPORTANT
- The first public visit before any publish still uses packaged site-data.js as a fallback.
- The CMS preview (?cms=1) intentionally ignores website_live so unsaved changes can preview immediately.
- Ordering CMS / Orders continue to use the existing Supabase shop tables.
- The publishable browser key is public by design; RLS protects writes. Never add a service_role key to browser files.

CMS 2.3 ADDITIONS
- Logo position pad now reaches from -25% to 125%, with exact X/Y number controls.
- Navigation/menu titles are editable under Brand & Logo and each has individual typography controls.
- Every website text field has an expandable Font & size control for desktop and mobile.
- Philosophy uses one rolling background image; the sentence selected by scrolling becomes bold.
- Photos gently zoom as their topic enters the screen. Mobile motion is intentionally smaller.

CMS 2.4 DEPLOYMENT FIX
- Desktop preview opens at 100% Actual size so font sizes match the live website. Use Fit only for a full-page overview.
- Image elements now have a packaged fallback image if an uploaded asset path is missing.
- Vercel must receive the WHOLE project folder. In particular, upload both assets/ and assets/uploads/ with all HTML, JS and CSS files.
- Publish Website updates Supabase content and settings; it does not upload packaged image files to Vercel.

CMS 2.5 IMAGE CORRECTION
- Removed the automatic substitute-photo mapping. CMS-uploaded photos are kept exactly as selected.
- The 25 original website photos remain in assets/uploads and are not replaced by similarly named legacy assets.
