SHIZUKU LAB — STOREFRONT UPDATE

1. In Supabase → SQL Editor, run supabase-storefront-upgrade.sql once.
   This creates editable product groups and the image-upload space.

2. Upload all the files in this folder to replace the matching files in GitHub.
   Keep all existing files too. The new files are:
   - index.html       (new welcome page)
   - order.html       (your existing ordering page, moved here)
   - welcome.js
   - app.js
   - admin.js
   - style.css

3. Your links after deployment:
   - https://shizuku-lab-order.vercel.app/ = Welcome page
   - https://shizuku-lab-order.vercel.app/order.html = Ordering page
   - https://shizuku-lab-order.vercel.app/admin.html = Shop Admin

4. In Admin:
   - Store settings: upload logo/banner, edit rolling text, optional website link.
   - Products: add/edit product groups, assign products to groups, hide products,
     upload product images, and set a Bundle of Two's selectable drinks.
   - FAQ: edit customer questions and answers separately.

If you leave the website link blank, the Welcome page only shows Enter ordering.
