SHIZUKU LAB · TRIAL 1–5

INSTALL
1. Supabase > SQL Editor: run supabase-shizuku-trial-1-to-5.sql once.
2. Google Apps Script: replace the existing code with google-apps-script-email-notifications.gs.
3. Keep your own RECIPIENT_EMAIL and SHARED_SECRET values in the Apps Script.
4. Apps Script > Deploy > Manage deployments > Edit > New version > Deploy.
5. Upload this whole ZIP to Vercel.

TRIAL FEATURES
1. Stock is reserved immediately. Unpaid reservations expire after 15 minutes
   when the storefront refreshes stock. Cancelled orders release stock.
2. Customers can enter an email and receive payment-submitted, confirmed,
   or rejected updates. Seller alerts continue as before.
3. Admin > Today's prep totals every paid drink scheduled today and can print.
4. Admin can reject a payment screenshot with a reason. Customer can open
   Track Order and upload a replacement screenshot.
5. Customer order chat listens for new seller messages through Supabase Realtime.

SAFE TEST
- Create a TEST product with stock 2 and a low price.
- Place one order without paying and observe stock decrease.
- After 15 minutes, reopen/refresh the customer shop and observe stock return.
- Submit a screenshot, reject it in Admin, then retry from Track Order.
