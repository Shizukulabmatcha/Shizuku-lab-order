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

EMAIL NOTIFICATION + REQUIRED PAYMENT SCREENSHOT

Payment screenshot upload is required before a customer can submit payment.
The database function in supabase-email-notifications.sql also rejects an empty
screenshot path, so this is enforced beyond the button shown on the website.

To receive an email after a customer uploads payment proof:

1. Open script.google.com and create a new project.
2. Replace its contents with google-apps-script-email-notifications.gs.
3. Replace REPLACE_WITH_THE_SAME_LONG_RANDOM_SECRET with a private, long random
   phrase. Do not share it or put it in app.js/config.js.
4. Deploy → New deployment → Web app. Execute as Me; access: Anyone. Authorise
   Gmail access, deploy, then copy the /exec web app URL.
5. Open supabase-email-notifications.sql. Paste the /exec URL and the exact same
   private secret into the two marked placeholders.
6. Run the entire SQL file once in Supabase → SQL Editor.
7. Place a small test order and upload a screenshot. The notification is sent to
   tinghuioh29@gmail.com after the payment proof reaches Supabase successfully.

The email contains the order number, customer, pickup details, total, items,
options and notes. Open admin.html to view the private payment screenshot and
confirm the payment.
