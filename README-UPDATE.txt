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
The website submits the order only after the payment screenshot reaches
Supabase successfully.

To receive an email after a customer uploads payment proof:

1. Deploy the Gmail notification code in Google Apps Script as a Web app.
   Execute as Me; access: Anyone.
2. Copy its /exec URL, append the matching private ?key= value, and save the
   complete private URL in Admin → Notifications.
3. Turn on email alerts and save the notification settings.
4. Run supabase-email-notifications.sql once in Supabase → SQL Editor. This is
   the database trigger that calls the Google Web app.
5. Place a small test order and upload a screenshot. The notification is sent to
   tinghuioh29@gmail.com after the payment proof reaches Supabase successfully.

The email contains the order number, customer, pickup details, total and notes.
Open admin.html to view the private payment screenshot and confirm the payment.

CUSTOMER PRODUCT STOCK

1. In Supabase → SQL Editor, run supabase-customer-product-stock.sql once.
2. Set the starting Stock for every item in Admin → Products.
3. Customer stock is shown automatically as:
   Products Stock minus quantities in non-cancelled orders.
4. Cancelling an order releases its reserved stock automatically.
5. Sold-out items cannot be ordered. The database also blocks overselling if
   two customers try to order the last item at the same time.

PRODUCT-SPECIFIC PROMOS + WELCOME ANNOUNCEMENT

1. In Supabase → SQL Editor, run supabase-promo-products-announcement.sql once.
2. Upload app.js, admin.js, welcome.js, index.html and style.css to GitHub.
3. In Admin → Promos, tick the products that a new promo code applies to.
   Leave every product unticked when the promo should apply to the whole cart.
4. In Admin → Settings → Welcome announcement, add opening hours, a short
   update and/or a promo code, then turn it on and save settings.
5. The same announcement appears at most once per customer per day. Editing
   its content makes the updated announcement eligible to appear again.

The mobile rolling message now keeps moving smoothly even when the phone has
Reduce Motion enabled.
