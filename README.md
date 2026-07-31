# Shizuku Lab ordering website

This is a no-build static website. Upload these files to the same GitHub repository that Vercel already deploys, or deploy this folder as a static site.

## What is included

- Premium mobile-first Shizuku Lab storefront using the existing drink images
- Menu from the existing `products` table, including categories and stock
- Existing `option_groups` / `options` customisation flow (Ice, Sweetness, and future options)
- Cart, promo code, customer details, pickup date/time and notes
- PayNow details, official QR image support, transaction reference and private payment-proof upload
- Confirmation flow and a PIN-gated order dashboard
- Admin actions: view private proof, confirm payment, confirm order, mark collected; plus menu and store-settings editing

## Deploy

1. Unzip this file.
2. Replace the files in `shizukulabmatcha/shizuku-lab-order` with this folder's contents, keeping any new files you personally added in GitHub.
3. Commit and push. Vercel will deploy automatically.

There is no `npm install` and no build command.

## Supabase setup already used

This project deliberately keeps the existing table names and connection in `config.js`:

`products`, `option_groups`, `options`, `orders`, `order_items`, `order_item_options`, `promo_codes`, `promo_redemptions`, and `store_settings`.

The customer payment-proof process uses the private `payment-proofs` storage bucket. Anonymous visitors need **INSERT** access to this bucket only; do not make it public. The dashboard creates a one-minute signed link when you choose **View proof**.

## Add the official PayNow QR

1. In Supabase Storage, upload the QR image to the public `paynow` bucket.
2. Copy its public URL.
3. Open `admin.html`, unlock it with your shop PIN, then Settings.
4. Paste the URL into **PayNow QR image URL** and save.

Until then the checkout will show the PayNow name and number from `store_settings`, so customers can pay manually.

## Important security note

`SHOP_PIN` is a small-shop visual gate only because it is in browser code. It does not replace Supabase Authentication or secure row-level policies. Do not add a service-role key to this website.
