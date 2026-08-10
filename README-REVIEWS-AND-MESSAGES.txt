SHIZUKU LAB — CUSTOMER REVIEWS + ORDER MESSAGES

This build also includes the latest payment screenshot recovery improvements:
pending-payment restore, Instagram/Facebook browser guidance, and Instagram
DM fallback. The separate camera-upload field has been removed.

ONE-TIME SUPABASE SETUP
1. Open Supabase > SQL Editor.
2. Run the full contents of supabase-customer-reviews.sql.
3. Run the full contents of supabase-order-messages.sql.
   Re-run this file when upgrading an existing installation; it adds the
   separate Live Chat email toggle and includes ordered products in emails.
4. Run the full contents of supabase-email-notifications.sql again so New
   Order and Payment Proof emails include product names and quantities.
5. Run the full contents of supabase-customer-product-stock.sql. This enables
   automatic remaining-stock calculation and overselling protection.
6. Replace the code in the existing Google Apps Script email project with
   google-apps-script-email-notifications.gs.
7. Keep SHARED_SECRET equal to the key at the end of your saved webhook URL,
   then deploy a NEW VERSION of the Google Apps Script web app.
8. Deploy this whole folder to Vercel.

CUSTOMER EXPERIENCE
- Customers open Track order and enter their order number + checkout phone.
- Message Shizuku Lab appears inside their verified order page.
- The conversation stays attached to that order.
- Track Order automatically refreshes order status and seller replies about
  every 15 seconds while the customer keeps the page open.
- After a paid order is marked Collected, the review form appears.
- Submitted reviews wait for seller approval before appearing publicly.

SELLER EXPERIENCE
- Admin > Messages shows every order conversation and an unread count.
- A new message alert appears while Admin is open; browser notifications are used when allowed.
- When Admin > Notifications is enabled, each new customer message also emails the configured owner address.
- Replying marks the customer messages in that conversation as read.
- Admin > Reviews can Publish, Hide or Delete reviews.
- Published reviews appear near the bottom of the customer menu page.

SECURITY
- Customer messages and review submission require a matching order number and phone.
- Reviews only open for paid + collected orders.
- Anonymous customers cannot directly read other conversations or moderate reviews.
- Seller moderation requires a non-anonymous Supabase login.
