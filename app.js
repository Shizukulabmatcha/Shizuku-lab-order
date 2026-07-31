/* =========================================================
   SHIZUKU LAB — CUSTOMER ORDERING FLOW
   =========================================================

   Current Supabase schema:

   products
   option_groups
   options
   order_items
   order_item_options
   orders
   promo_codes
   store_settings

   IMPORTANT:
   options uses:
   option_group_id

   Bundle:
   Shizuku Duo = 2 drinks
   Each drink has:
   Ice + Sweetness
   ========================================================= */


/* =========================================================
   ICONS
========================================================= */

const ICONS = {

  bag: `
    <svg width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
      <path d="M3 6h18"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  `,

  back: `
    <svg width="14" height="14" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2.5"
      stroke-linecap="round" stroke-linejoin="round">
      <path d="m15 18-6-6 6-6"/>
    </svg>
  `,

  clock: `
    <svg width="15" height="15" viewBox="0 0 24 24"
      fill="none" stroke="#4B5D3A" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l4 2"/>
    </svg>
  `,

  check: `
    <svg width="26" height="26" viewBox="0 0 24 24"
      fill="none" stroke="#F3EEE3" stroke-width="3"
      stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  `,

  minus: `
    <svg width="14" height="14" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2.5"
      stroke-linecap="round">
      <path d="M5 12h14"/>
    </svg>
  `,

  plus: `
    <svg width="14" height="14" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2.5"
      stroke-linecap="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  `
};


/* =========================================================
   STATE
========================================================= */

const state = {

  menu: [],

  cart: {},

  screen: "menu",

  activeCategory: "All",

  optionGroups: [],

  options: [],

  selectedProduct: null,

  selectedOptions: {},

  /* Bundle-specific state */
  bundle: {
    drink1: null,
    drink2: null,

    drink1Options: {},
    drink2Options: {}
  },

  slots: [],

  store: {
    store_name: "Shizuku Lab",
    instagram: "shizukulab.matcha",

    paynow_name: "",
    paynow_number: "",
    paynow_url: "",

    collection_address:
      "Blk 130A drop off point, Near Creamier TPY, Toa Payoh Lorong 1, Singapore",

    saturday_collection_time:
      "10:00 AM - 12:00 PM",

    sunday_collection_time:
      "10:00 AM - 1:00 PM"
  },

  form: {
    name: "",
    phone: "",
    instagram: "",
    slotId: "",
    notes: "",
    promoCode: ""
  },

  promo: null,

  promoMsg: "",

  lastOrder: null,

  loading: true,

  loadError: null
};


/* =========================================================
   HELPERS
========================================================= */

function money(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}


function escapeHtml(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function uidCode() {

  return (
    "SL-" +
    Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()
  );
}


function normaliseTime(time) {

  if (!time) return "";

  return String(time)
    .replace(/\s+/g, " ")
    .trim();
}


function formatDateForDatabase(date) {

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function formatDateLabel(date) {

  return date.toLocaleDateString(
    undefined,
    {
      weekday: "short",
      month: "short",
      day: "numeric"
    }
  );
}


/* =========================================================
   PRODUCT HELPERS
========================================================= */

function isBundle(product) {

  if (!product) return false;

  return (
    String(product.name)
      .toLowerCase()
      .includes("shizuku duo") ||

    String(product.category)
      .toLowerCase()
      .includes("bundle")
  );
}


/*
  These are the drinks that can be selected
  inside Shizuku Duo.

  We intentionally exclude:
  - Shizuku Duo
  - Straight Matcha
  - Straight Hojicha

  because the Duo is designed as the two signature
  latte combination shown on your menu.
*/

function getBundleDrinkProducts() {

  return state.menu.filter(product => {

    if (!product.is_available) {
      return false;
    }

    if (isBundle(product)) {
      return false;
    }

    const name =
      String(product.name || "")
        .toLowerCase();

    return (
      name.includes("matcha latte") ||
      name.includes("houjicha latte")
    );
  });
}


/* =========================================================
   STORE SETTINGS
========================================================= */

async function loadStoreSettings() {

  if (!IS_CONFIGURED) return;

  const {
    data,
    error
  } = await db
    .from("store_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {

    console.warn(
      "Could not load store settings:",
      error.message
    );

    return;
  }

  if (data) {

    state.store = {
      ...state.store,
      ...data
    };
  }
}


/* =========================================================
   PICKUP SLOTS
========================================================= */

function getWeekendConfig() {

  return [

    {
      day: 6,
      label: "Saturday",
      time: normaliseTime(
        state.store
          .saturday_collection_time
      )
    },

    {
      day: 0,
      label: "Sunday",
      time: normaliseTime(
        state.store
          .sunday_collection_time
      )
    }

  ];
}


function computeSlots() {

  const now = new Date();

  return getWeekendConfig()
    .map(config => {

      let diff =
        (
          config.day -
          now.getDay() +
          7
        ) % 7;


      if (diff === 0) {

        const match =
          config.time.match(
            /(\d{1,2}):(\d{2})\s*(AM|PM)/i
          );

        if (match) {

          let hour =
            Number(match[1]);

          const minute =
            Number(match[2]);

          const period =
            match[3].toUpperCase();

          if (
            period === "PM" &&
            hour !== 12
          ) {
            hour += 12;
          }

          if (
            period === "AM" &&
            hour === 12
          ) {
            hour = 0;
          }

          const currentMinutes =
            now.getHours() * 60 +
            now.getMinutes();

          const closeMinutes =
            hour * 60 + minute;

          if (
            currentMinutes >=
            closeMinutes
          ) {
            diff = 7;
          }
        }
      }

      const date =
        new Date(now);

      date.setDate(
        now.getDate() + diff
      );

      return {

        id:
          `${config.label}-${formatDateForDatabase(date)}`,

        label:
          formatDateLabel(date),

        date:
          formatDateForDatabase(date),

        time:
          config.time
      };

    });
}


/* =========================================================
   LOAD PRODUCTS
========================================================= */

async function loadProducts() {

  const {
    data,
    error
  } = await db
    .from("products")
    .select("*")
    .eq("is_available", true)
    .order("category")
    .order("name");

  if (error) {
    throw error;
  }

  state.menu =
    (data || []).map(item => ({

      ...item,

      category:
        item.category ||
        "Other",

      name:
        item.name ||
        "Untitled",

      description:
        item.description ||
        "",

      price:
        Number(item.price || 0),

      stock:
        item.stock == null
          ? null
          : Number(item.stock)

    }));
}


/* =========================================================
   LOAD OPTIONS
========================================================= */

async function loadOptions() {

  const [
    groupsResult,
    optionsResult
  ] = await Promise.all([

    db
      .from("option_groups")
      .select("*")
      .order("id"),

    db
      .from("options")
      .select("*")
      .eq("is_available", true)
      .order("option_group_id")
      .order("id")

  ]);


  if (groupsResult.error) {
    throw groupsResult.error;
  }

  if (optionsResult.error) {
    throw optionsResult.error;
  }


  state.optionGroups =
    groupsResult.data || [];

  state.options =
    optionsResult.data || [];
}


/* =========================================================
   INIT
========================================================= */

async function init() {

  state.loading = true;

  state.loadError = null;

  state.slots =
    computeSlots();


  if (!IS_CONFIGURED) {

    state.loading = false;

    render();

    return;
  }


  try {

    await loadStoreSettings();

    state.slots =
      computeSlots();


    await Promise.all([

      loadProducts(),

      loadOptions()

    ]);

  } catch (error) {

    console.error(error);

    state.loadError =
      error?.message ||
      String(error);

    state.menu = [];
  }


  state.loading = false;

  render();
}


/* =========================================================
   CART
========================================================= */

function cartLines() {

  return Object.entries(
    state.cart
  )
    .filter(
      ([, item]) =>
        item &&
        item.qty > 0
    )
    .map(
      ([key, item]) => ({
        key,
        ...item
      })
    );
}


function cartCount() {

  return cartLines()
    .reduce(
      (sum, line) =>
        sum +
        Number(line.qty || 0),

      0
    );
}


function cartTotal() {

  return cartLines()
    .reduce(
      (sum, line) =>
        sum +
        Number(line.unitPrice || 0) *
        Number(line.qty || 0),

      0
    );
}


function orderTotal() {

  const discount =
    state.promo
      ? Number(
          state.promo.amount || 0
        )
      : 0;

  return Math.max(
    0,
    cartTotal() - discount
  );
}


/* =========================================================
   OPTIONS
========================================================= */

function getOptionsForGroup(groupId) {

  /*
    IMPORTANT:
    Your Supabase column is:
    option_group_id

    NOT:
    option_group
  */

  return state.options.filter(
    option =>
      String(
        option.option_group_id
      ) ===
      String(groupId)
  );
}


function getOptionGroupById(id) {

  return state.optionGroups.find(
    group =>
      String(group.id) ===
      String(id)
  );
}


/* =========================================================
   NORMAL PRODUCT OPTIONS
========================================================= */

function selectOption(
  groupId,
  optionId
) {

  const option =
    state.options.find(
      item =>
        String(item.id) ===
        String(optionId)
    );

  if (!option) return;

  state.selectedOptions[
    groupId
  ] = {

    productId:
      state.selectedProduct.id,

    optionId:
      option.id,

    optionName:
      option.name,

    price:
      Number(option.price || 0)
  };

  render();
}


function validateRequiredOptions() {

  for (
    const group
    of state.optionGroups
  ) {

    if (!group.required) {
      continue;
    }

    const selected =
      state.selectedOptions[
        group.id
      ];

    if (!selected) {

      alert(
        `Please choose an option for "${group.name}".`
      );

      return false;
    }
  }

  return true;
}


function getSelectedOptionsForProduct(
  productId
) {

  return Object.values(
    state.selectedOptions
  )
    .filter(
      selected =>
        String(
          selected.productId
        ) ===
        String(productId)
    );
}


function calculateProductPrice(
  product
) {

  let price =
    Number(product.price || 0);

  getSelectedOptionsForProduct(
    product.id
  ).forEach(selected => {

    price +=
      Number(
        selected.price || 0
      );

  });

  return price;
}


/* =========================================================
   NORMAL PRODUCT
========================================================= */

function openProductOptions(
  productId
) {

  const product =
    state.menu.find(
      item =>
        String(item.id) ===
        String(productId)
    );

  if (!product) return;


  state.selectedProduct =
    product;

  state.selectedOptions = {};


  /*
    Bundle gets a completely different
    selection screen.
  */

  if (isBundle(product)) {

    state.bundle = {

      drink1: null,

      drink2: null,

      drink1Options: {},

      drink2Options: {}

    };

    state.screen =
      "bundle";

  } else {

    state.screen =
      "options";
  }


  render();
}


/* =========================================================
   ADD NORMAL PRODUCT
========================================================= */

function addConfiguredProductToCart() {

  const product =
    state.selectedProduct;

  if (!product) return;


  if (
    !validateRequiredOptions()
  ) {
    return;
  }


  const selectedOptions =
    getSelectedOptionsForProduct(
      product.id
    );


  const optionsKey =
    selectedOptions
      .map(
        option =>
          String(
            option.optionId
          )
      )
      .sort()
      .join("-");


  const key =
    `${product.id}__${optionsKey}`;


  const unitPrice =
    calculateProductPrice(
      product
    );


  if (
    product.stock != null &&
    product.stock >= 0
  ) {

    const existingQty =
      state.cart[key]?.qty ||
      0;

    if (
      existingQty >=
      product.stock
    ) {

      alert(
        "Sorry, this item is sold out."
      );

      return;
    }
  }


  state.cart[key] = {

    productId:
      product.id,

    productName:
      product.name,

    imageUrl:
      product.image_url || "",

    unitPrice,

    basePrice:
      Number(product.price || 0),

    qty:
      (state.cart[key]?.qty || 0) +
      1,

    options:
      selectedOptions
  };


  state.selectedProduct =
    null;

  state.selectedOptions =
    {};

  state.screen =
    "menu";


  render();
}


/* =========================================================
   BUNDLE OPTIONS
========================================================= */

function selectBundleDrink(
  slot,
  productId
) {

  const product =
    state.menu.find(
      item =>
        String(item.id) ===
        String(productId)
    );

  if (!product) return;


  if (slot === 1) {

    state.bundle.drink1 =
      product;

    state.bundle.drink1Options =
      {};

  } else {

    state.bundle.drink2 =
      product;

    state.bundle.drink2Options =
      {};

  }

  render();
}


function selectBundleOption(
  drinkNumber,
  groupId,
  optionId
) {

  const option =
    state.options.find(
      item =>
        String(item.id) ===
        String(optionId)
    );

  if (!option) return;


  const value = {

    productId:
      drinkNumber === 1
        ? state.bundle.drink1.id
        : state.bundle.drink2.id,

    optionId:
      option.id,

    optionName:
      option.name,

    price:
      Number(option.price || 0)

  };


  if (drinkNumber === 1) {

    state.bundle
      .drink1Options[groupId] =
      value;

  } else {

    state.bundle
      .drink2Options[groupId] =
      value;
  }


  render();
}


function validateBundleDrink(
  drink,
  selectedOptions
) {

  if (!drink) {

    return false;
  }


  for (
    const group
    of state.optionGroups
  ) {

    if (!group.required) {
      continue;
    }


    if (
      !selectedOptions[group.id]
    ) {

      return false;
    }
  }


  return true;
}


function addBundleToCart() {

  const bundle =
    state.selectedProduct;


  if (!bundle) return;


  const drink1 =
    state.bundle.drink1;

  const drink2 =
    state.bundle.drink2;


  if (!drink1) {

    alert(
      "Please choose Drink 1."
    );

    return;
  }


  if (!drink2) {

    alert(
      "Please choose Drink 2."
    );

    return;
  }


  if (
    !validateBundleDrink(
      drink1,
      state.bundle.drink1Options
    )
  ) {

    alert(
      "Please complete the options for Drink 1."
    );

    return;
  }


  if (
    !validateBundleDrink(
      drink2,
      state.bundle.drink2Options
    )
  ) {

    alert(
      "Please complete the options for Drink 2."
    );

    return;
  }


  const drink1Options =
    Object.values(
      state.bundle
        .drink1Options
    );


  const drink2Options =
    Object.values(
      state.bundle
        .drink2Options
    );


  /*
    Bundle stays $10.50.

    We do NOT add the individual
    drink prices.
  */

  const unitPrice =
    Number(bundle.price || 10.50);


  const bundleOptions = [

    {
      drinkNumber: 1,

      productId:
        drink1.id,

      productName:
        drink1.name,

      options:
        drink1Options
    },

    {
      drinkNumber: 2,

      productId:
        drink2.id,

      productName:
        drink2.name,

      options:
        drink2Options
    }

  ];


  const key =
    `${bundle.id}__${drink1.id}-${drink2.id}__` +
    `${drink1Options.map(x => x.optionId).sort().join("-")}` +
    `__` +
    `${drink2Options.map(x => x.optionId).sort().join("-")}`;


  state.cart[key] = {

    productId:
      bundle.id,

    productName:
      bundle.name,

    imageUrl:
      bundle.image_url || "",

    unitPrice,

    basePrice:
      unitPrice,

    qty:
      (state.cart[key]?.qty || 0) +
      1,

    options:
      bundleOptions
  };


  state.selectedProduct =
    null;

  state.bundle = {

    drink1: null,

    drink2: null,

    drink1Options: {},

    drink2Options: {}

  };


  state.screen =
    "menu";


  render();
}


/* =========================================================
   CART QUANTITY
========================================================= */

function changeCartQty(
  key,
  delta
) {

  const item =
    state.cart[key];

  if (!item) return;


  const product =
    state.menu.find(
      p =>
        String(p.id) ===
        String(item.productId)
    );


  if (!product) return;


  const nextQty =
    Number(item.qty || 0) +
    delta;


  if (
    product.stock != null &&
    product.stock >= 0 &&
    nextQty > product.stock
  ) {

    alert(
      "Sorry, this item is sold out."
    );

    return;
  }


  item.qty =
    Math.max(
      0,
      nextQty
    );


  if (
    item.qty === 0
  ) {

    delete state.cart[key];
  }


  render();
}


/* =========================================================
   SCREEN
========================================================= */

function setScreen(
  screen
) {

  state.screen =
    screen;

  render();
}


function setCategory(
  category
) {

  state.activeCategory =
    category;

  render();
}


/* =========================================================
   PROMO
========================================================= */

async function applyPromoCode() {

  const code =
    (
      state.form.promoCode ||
      ""
    )
      .trim()
      .toUpperCase();


  if (!code) {

    state.promoMsg =
      "Please enter a promo code.";

    render();

    return;
  }


  if (
    !state.form.phone.trim()
  ) {

    state.promoMsg =
      "Please enter your phone number first.";

    render();

    return;
  }


  if (!IS_CONFIGURED) {

    state.promoMsg =
      "Connect Supabase to validate promo codes.";

    render();

    return;
  }


  const {
    data,
    error
  } = await db
    .from("promo_codes")
    .select("*")
    .eq("text", code)
    .eq("is_active", true)
    .limit(1);


  if (error) {

    state.promoMsg =
      "Could not check code: " +
      error.message;

    render();

    return;
  }


  const promo =
    data?.[0];


  if (!promo) {

    state.promo = null;

    state.promoMsg =
      "That promo code isn't valid.";

    render();

    return;
  }


  const now =
    new Date();


  if (
    promo.valid_from &&
    new Date(
      promo.valid_from
    ) > now
  ) {

    state.promo = null;

    state.promoMsg =
      "That promo code is not active yet.";

    render();

    return;
  }


  if (
    promo.valid_until &&
    new Date(
      promo.valid_until
    ) < now
  ) {

    state.promo = null;

    state.promoMsg =
      "That promo code has expired.";

    render();

    return;
  }


  const minimumSpend =
    Number(
      promo.min_spend || 0
    );


  if (
    cartTotal() <
    minimumSpend
  ) {

    state.promo = null;

    state.promoMsg =
      `Minimum spend is ${money(
        minimumSpend
      )}.`;

    render();

    return;
  }


  let amount = 0;


  if (
    String(
      promo.discount_type
    ).toLowerCase() ===
    "percent"
  ) {

    amount =
      cartTotal() *
      (
        Number(
          promo.discount_value || 0
        ) / 100
      );

  } else {

    amount =
      Number(
        promo.discount_value || 0
      );
  }


  amount =
    Math.min(
      cartTotal(),
      Math.max(
        0,
        amount
      )
    );


  state.promo = {

    id:
      promo.id,

    code:
      promo.text,

    discount_type:
      promo.discount_type,

    discount_value:
      Number(
        promo.discount_value || 0
      ),

    amount

  };


  state.promoMsg =
    `Applied — ${
      String(
        promo.discount_type
      ).toLowerCase() ===
      "percent"
        ? `${promo.discount_value}% off`
        : `${money(
            promo.discount_value
          )} off`
    }`;


  render();
}


function removePromoCode() {

  state.promo =
    null;

  state.promoMsg =
    "";

  state.form.promoCode =
    "";

  render();
}


/* =========================================================
   SUBMIT ORDER
========================================================= */

async function submitOrder() {

  const f =
    state.form;


  if (!f.name.trim()) {

    alert(
      "Please enter your name."
    );

    return;
  }


  if (!f.phone.trim()) {

    alert(
      "Please enter your phone number."
    );

    return;
  }


  if (!f.slotId) {

    alert(
      "Please select a pickup slot."
    );

    return;
  }


  if (
    cartLines().length === 0
  ) {

    alert(
      "Your cart is empty."
    );

    setScreen("menu");

    return;
  }


  const slot =
    state.slots.find(
      item =>
        item.id ===
        f.slotId
    );


  if (!slot) {

    alert(
      "Please select a valid pickup slot."
    );

    return;
  }


  const orderNumber =
    uidCode();


  const total =
    orderTotal();


  /*
    IMPORTANT:
    We removed customer_contact.

    Your Supabase orders table does NOT
    have that column according to the
    error you received.
  */

  const orderPayload = {

    order_number:
      orderNumber,

    customer_name:
      f.name.trim(),

    phone:
      f.phone.trim(),

    collection_date:
      slot.date,

    collection_time:
      slot.time,

    instagram:
      f.instagram
        ? f.instagram
            .trim()
            .replace(/^@/, "")
        : null,

    total,

    payment_status:
      "awaiting_payment",

    order_status:
      "pending",

    notes:
      f.notes.trim() ||
      null,

    payment_method:
      "PayNow",

    payment_reference:
      orderNumber
  };


  /*
    DEMO MODE
  */

  if (!IS_CONFIGURED) {

    state.lastOrder = {

      ...orderPayload,

      id: null,

      items:
        cartLines().map(
          line => ({
            ...line
          })
        ),

      slot
    };


    state.screen =
      "payment";

    render();

    return;
  }


  try {

    /* -----------------------------------------
       1. CREATE ORDER
    ----------------------------------------- */

    const {
      data: order,
      error: orderError
    } = await db
      .from("orders")
      .insert(
        orderPayload
      )
      .select("*")
      .single();


    if (orderError) {

      throw orderError;
    }


    /* -----------------------------------------
       2. CREATE ORDER ITEMS
    ----------------------------------------- */

    const orderItemsPayload =
      cartLines().map(
        line => ({

          order_id:
            order.id,

          product_id:
            line.productId,

          product_name:
            line.productName,

          quantity:
            Number(line.qty),

          unit_price:
            Number(line.unitPrice),

          subtotal:
            Number(line.unitPrice) *
            Number(line.qty)

        })
      );


    const {
      data: orderItems,
      error: itemError
    } = await db
      .from("order_items")
      .insert(
        orderItemsPayload
      )
      .select("*");


    if (itemError) {

      throw itemError;
    }


    /* -----------------------------------------
       3. SAVE OPTIONS
    ----------------------------------------- */

    const optionRows = [];


    cartLines().forEach(
      (line, index) => {

        const orderItem =
          orderItems[index];


        if (!orderItem) {
          return;
        }


        /*
          NORMAL DRINK
        */

        if (
          !isBundle(
            state.menu.find(
              p =>
                String(p.id) ===
                String(
                  line.productId
                )
            )
          )
        ) {

          (
            line.options ||
            []
          ).forEach(
            option => {

              optionRows.push({

                order_item_id:
                  orderItem.id,

                option_id:
                  option.optionId,

                option_name:
                  option.optionName,

                price:
                  Number(
                    option.price || 0
                  )

              });

            }
          );


          return;
        }


        /*
          BUNDLE

          Save:

          Drink 1
          - Matcha Latte
          - Less Ice
          - Normal Sweetness

          Drink 2
          - Hojicha Latte
          - Normal Ice
          - Less Sweet
        */

        (
          line.options ||
          []
        ).forEach(
          drink => {

            (
              drink.options ||
              []
            ).forEach(
              option => {

                optionRows.push({

                  order_item_id:
                    orderItem.id,

                  option_id:
                    option.optionId,

                  option_name:
                    `Drink ${drink.drinkNumber} · ${drink.productName} · ${option.optionName}`,

                  price:
                    Number(
                      option.price || 0
                    )

                });

              }
            );

          }
        );

      }
    );


    if (
      optionRows.length > 0
    ) {

      const {
        error:
          optionError
      } = await db
        .from(
          "order_item_options"
        )
        .insert(
          optionRows
        );


      if (optionError) {

        throw optionError;
      }
    }


    /* -----------------------------------------
       4. PROMO
    ----------------------------------------- */

    /*
      We do NOT update promo usage here.

      This avoids race conditions and keeps
      the order submission safer.

      You can later handle promo usage from
      admin/backend if needed.
    */


    /* -----------------------------------------
       5. SAVE LOCAL STATE
    ----------------------------------------- */

    state.lastOrder = {

      ...order,

      items:
        cartLines().map(
          line => ({
            ...line
          })
        ),

      slot
    };


    state.screen =
      "payment";


    render();

  } catch (error) {

    console.error(
      "Order submission error:",
      error
    );


    alert(
      "Something went wrong submitting your order. Please try again.\n\n" +
      (
        error?.message ||
        String(error)
      )
    );
  }
}


/* =========================================================
   MARK PAYMENT SENT
========================================================= */

async function markPaid() {

  if (!state.lastOrder) {
    return;
  }


  const order =
    state.lastOrder;


  if (
    IS_CONFIGURED &&
    order.id
  ) {

    const {
      error
    } = await db
      .from("orders")
      .update({

        payment_status:
          "submitted",

        order_status:
          "awaiting_confirmation"

      })
      .eq(
        "id",
        order.id
      );


    if (error) {

      alert(
        "Could not update payment status.\n" +
        error.message
      );

      return;
    }
  }


  state.lastOrder = {

    ...order,

    payment_status:
      "submitted",

    order_status:
      "awaiting_confirmation"

  };


  state.cart = {};


  state.screen =
    "confirmation";


  render();
}


/* =========================================================
   STORE INFO
========================================================= */

function storeInfoPanel() {

  return `

    <div class="store-panel">

      <img
        src="logo.png"
        class="store-logo"
        alt="${escapeHtml(
          state.store.store_name
        )} logo"
      >

      <a
        class="store-insta"
        href="https://instagram.com/${encodeURIComponent(
          state.store.instagram || ""
        )}"
        target="_blank"
        rel="noopener"
      >
        @${escapeHtml(
          state.store.instagram ||
          "shizukulab.matcha"
        )}
      </a>


      <div class="store-dropoff">

        ${escapeHtml(
          state.store
            .collection_address ||
          "Blk 130A drop off point, Near Creamier TPY, Toa Payoh Lorong 1, Singapore"
        )}

      </div>


      <div class="hours-card">

        <div class="hours-row">

          <span class="hours-label">
            COLLECTION
          </span>

          <span class="hours-status open">
            PRE-ORDER
          </span>

        </div>


        <div class="hours-day">
          Saturday
        </div>

        <div class="hours-time">

          ${escapeHtml(
            state.store
              .saturday_collection_time ||
            "10:00 AM - 12:00 PM"
          )}

        </div>


        <div
          class="hours-day"
          style="margin-top:8px;"
        >
          Sunday
        </div>

        <div class="hours-time">

          ${escapeHtml(
            state.store
              .sunday_collection_time ||
            "10:00 AM - 1:00 PM"
          )}

        </div>

      </div>

    </div>
  `;
}


/* =========================================================
   HEADER
========================================================= */

function header({
  showCart = false
} = {}) {

  /*
    IMPORTANT:
    No more product.name in the header.

    The header ALWAYS stays:

    Shizuku Lab
    雫ラボ · crafted drop by drop

    This is much cleaner.
  */

  return `

    <div class="header">

      <div class="header-row">

        <div>

          <div class="display brand-title">
            Shizuku Lab
          </div>

          <div class="brand-sub">
            雫ラボ · crafted drop by drop
          </div>

        </div>


        ${
          showCart
            ? `

          <button
            class="cart-btn"
            onclick="setScreen('cart')"
            aria-label="Cart"
          >

            ${ICONS.bag}

            ${
              cartCount() > 0
                ? `
                  <span class="cart-badge">
                    ${cartCount()}
                  </span>
                `
                : ""
            }

          </button>

        `
            : ""
        }

      </div>


      <svg
        class="drip-row"
        viewBox="0 0 300 30"
        aria-hidden="true"
      >

        <g>

          <circle
            class="drip"
            cx="40"
            cy="4"
            r="2.4"
            fill="#4B5D3A"
          />

          <ellipse
            class="ripple"
            cx="40"
            cy="26"
            rx="7"
            ry="2.4"
            fill="none"
            stroke="#8C9B6E"
            stroke-width="1"
          />

        </g>


        <g>

          <circle
            class="drip drip2"
            cx="150"
            cy="4"
            r="2.4"
            fill="#4B5D3A"
          />

          <ellipse
            class="ripple drip2"
            cx="150"
            cy="26"
            rx="7"
            ry="2.4"
            fill="none"
            stroke="#8C9B6E"
            stroke-width="1"
          />

        </g>


        <g>

          <circle
            class="drip drip3"
            cx="260"
            cy="4"
            r="2.4"
            fill="#4B5D3A"
          />

          <ellipse
            class="ripple drip3"
            cx="260"
            cy="26"
            rx="7"
            ry="2.4"
            fill="none"
            stroke="#8C9B6E"
            stroke-width="1"
          />

        </g>


        <line
          x1="0"
          y1="27"
          x2="300"
          y2="27"
          stroke="#E1D9C8"
          stroke-width="1"
        />

      </svg>

    </div>
  `;
}


/* =========================================================
   MENU
========================================================= */

function renderMenu() {

  const categories = [

    "All",

    ...Array.from(
      new Set(
        state.menu.map(
          item =>
            item.category
        )
      )
    )

  ];


  const items =
    state.activeCategory ===
    "All"

      ? state.menu

      : state.menu.filter(
          item =>
            item.category ===
            state.activeCategory
        );


  return `

    ${header({
      showCart: true
    })}


    ${storeInfoPanel()}


    ${
      state.loadError
        ? `

      <div
        class="setup-banner"
        style="
          border-color:#B33;
          background:#FBEAEA;
          color:#7a1f1f;
        "
      >

        Could not load products:

        <code>
          ${escapeHtml(
            state.loadError
          )}
        </code>

      </div>

    `
        : ""
    }


    <div class="cats">

      ${categories
        .map(
          category => `

          <button
            class="pill ${
              category ===
              state.activeCategory
                ? "active"
                : ""
            }"
            onclick="setCategory('${escapeHtml(
              category
            )}')"
          >

            ${escapeHtml(
              category
            )}

          </button>

        `
        )
        .join("")}

    </div>


    <div class="menu-list">

      ${
        items.length === 0

          ? `

            <div class="empty">
              No items available yet.
            </div>

          `

          : items
              .map(
                item => `

              <div class="item-card">

                <img
                  class="item-thumb"
                  src="${escapeHtml(
                    item.image_url ||
                    "matcha-lab.jpg"
                  )}"
                  alt="${escapeHtml(
                    item.name
                  )}"
                >


                <div class="item-info">

                  <div class="item-name">
                    ${escapeHtml(
                      item.name
                    )}
                  </div>


                  <div class="item-desc">
                    ${escapeHtml(
                      item.description
                    )}
                  </div>


                  <div class="item-row">

                    <div class="item-price">
                      ${money(
                        item.price
                      )}
                    </div>


                    ${
                      state.cart[
                        `${item.id}__`
                      ]?.qty > 0

                        ? stepper(
                            `${item.id}__`,
                            state.cart[
                              `${item.id}__`
                            ].qty
                          )

                        : `

                          <button
                            class="add-btn"
                            onclick="openProductOptions('${escapeHtml(
                              item.id
                            )}')"
                          >
                            Add
                          </button>

                        `
                    }

                  </div>

                </div>

              </div>

            `
              )
              .join("")
      }

    </div>


    ${
      cartCount() > 0
        ? `

      <div class="sticky-bar">

        <div class="sticky-bar-inner">

          <button
            class="primary-btn"
            onclick="setScreen('cart')"
          >

            ${ICONS.bag}

            View cart ·
            ${money(
              cartTotal()
            )}

          </button>

        </div>

      </div>

    `
        : ""
    }


    ${renderFAQ()}

  `;
}


/* =========================================================
   FAQ
========================================================= */

function renderFAQ() {

  return `

    <section class="faq-section">

      <div class="faq-title">
        FAQ
      </div>


      <details class="faq-item">

        <summary>
          Where is collection?
        </summary>

        <div class="faq-answer">

          Collection is at
          ${escapeHtml(
            state.store.collection_address ||
            "Toa Payoh Lorong 1, Singapore"
          )}.

        </div>

      </details>


      <details class="faq-item">

        <summary>
          When can I collect my drinks?
        </summary>

        <div class="faq-answer">

          Saturday:
          ${escapeHtml(
            state.store.saturday_collection_time ||
            "10:00 AM - 12:00 PM"
          )}

          <br><br>

          Sunday:
          ${escapeHtml(
            state.store.sunday_collection_time ||
            "10:00 AM - 1:00 PM"
          )}

        </div>

      </details>


      <details class="faq-item">

        <summary>
          Can I request less ice or less sweet?
        </summary>

        <div class="faq-answer">

          Yes. Please select your preferred
          option when ordering.

        </div>

      </details>


      <details class="faq-item">

        <summary>
          How do I pay?
        </summary>

        <div class="faq-answer">

          Payment is made via PayNow after
          submitting your order.

        </div>

      </details>


      <details class="faq-item">

        <summary>
          Can I change my order after payment?
        </summary>

        <div class="faq-answer">

          Please contact us as soon as possible
          if you need to make a change.

        </div>

      </details>

    </section>

  `;
}


/* =========================================================
   OPTIONS SCREEN
========================================================= */

function renderOptions() {

  const product =
    state.selectedProduct;


  if (!product) {

    return renderMenu();
  }


  const price =
    calculateProductPrice(
      product
    );


  return `

    ${header()}


    <div class="screen">

      <button
        class="back-link"
        onclick="setScreen('menu')"
      >

        ${ICONS.back}

        Back to menu

      </button>


      <div class="item-card">

        <img
          class="item-thumb"
          src="${escapeHtml(
            product.image_url ||
            "matcha-lab.jpg"
          )}"
          alt="${escapeHtml(
            product.name
          )}"
        >


        <div class="item-info">

          <div class="item-name">
            ${escapeHtml(
              product.name
            )}
          </div>

          <div class="item-desc">
            ${escapeHtml(
              product.description
            )}
          </div>

        </div>

      </div>


      ${
        state.optionGroups.length === 0

          ? `

            <div class="hint">
              No customisation options available.
            </div>

          `

          : state.optionGroups
              .map(group => {

                const options =
                  getOptionsForGroup(
                    group.id
                  );

                const selected =
                  state.selectedOptions[
                    group.id
                  ];


                return `

                  <div
                    class="field"
                    style="margin-top:20px;"
                  >

                    <label>

                      ${escapeHtml(
                        group.name
                      )}

                      ${
                        group.required
                          ? " *"
                          : " (optional)"
                      }

                    </label>


                    <div>

                      ${options
                        .map(
                          option => `

                        <button
                          type="button"
                          class="slot ${
                            selected &&
                            String(
                              selected.optionId
                            ) ===
                              String(
                                option.id
                              )
                              ? "active"
                              : ""
                          }"
                          onclick="selectOption('${escapeHtml(
                            group.id
                          )}','${escapeHtml(
                            option.id
                          )}')"
                        >

                          <div>

                            <div class="slot-day">
                              ${escapeHtml(
                                option.name
                              )}
                            </div>

                            <div class="slot-time">

                              ${
                                Number(
                                  option.price ||
                                  0
                                ) > 0

                                  ? `+${money(
                                      option.price
                                    )}`

                                  : "Included"
                              }

                            </div>

                          </div>

                        </button>

                      `
                        )
                        .join("")}

                    </div>

                  </div>

                `;
              })
              .join("")
      }

    </div>


    <div class="sticky-bar">

      <div class="sticky-bar-inner">

        <button
          class="primary-btn"
          onclick="addConfiguredProductToCart()"
        >

          Add to cart ·
          ${money(price)}

        </button>

      </div>

    </div>

  `;
}


/* =========================================================
   BUNDLE SCREEN
========================================================= */

function renderBundle() {

  const bundle =
    state.selectedProduct;


  if (!bundle) {

    return renderMenu();
  }


  const drinks =
    getBundleDrinkProducts();


  const drink1 =
    state.bundle.drink1;

  const drink2 =
    state.bundle.drink2;


  return `

    ${header()}


    <div class="screen">

      <button
        class="back-link"
        onclick="setScreen('menu')"
      >

        ${ICONS.back}

        Back to menu

      </button>


      <div class="item-card">

        <img
          class="item-thumb"
          src="${escapeHtml(
            bundle.image_url ||
            "matcha-lab.jpg"
          )}"
          alt="Shizuku Duo"
        >


        <div class="item-info">

          <div class="item-name">
            Shizuku Duo
          </div>

          <div class="item-desc">
            Choose your Matcha Latte +
            Hojicha Latte combination.
          </div>

          <div class="item-price">
            ${money(
              bundle.price
            )}
          </div>

        </div>

      </div>


      <!-- DRINK 1 -->

      <div class="bundle-section">

        <div class="bundle-heading">
          Drink 1
        </div>

        <div class="bundle-subheading">
          Choose your drink
        </div>


        <div class="bundle-drinks">

          ${drinks
            .map(
              drink => `

              <button
                type="button"
                class="slot ${
                  drink1 &&
                  String(
                    drink1.id
                  ) ===
                    String(
                      drink.id
                    )
                    ? "active"
                    : ""
                }"
                onclick="selectBundleDrink(
                  1,
                  '${escapeHtml(
                    drink.id
                  )}'
                )"
              >

                <div>

                  <div class="slot-day">
                    ${escapeHtml(
                      drink.name
                    )}
                  </div>

                  <div class="slot-time">
                    ${money(
                      drink.price
                    )}
                  </div>

                </div>

              </button>

            `
            )
            .join("")}

        </div>


        ${
          drink1
            ? renderBundleDrinkOptions(
                1,
                drink1,
                state.bundle
                  .drink1Options
              )
            : ""
        }

      </div>


      <!-- DRINK 2 -->

      <div class="bundle-section">

        <div class="bundle-heading">
          Drink 2
        </div>

        <div class="bundle-subheading">
          Choose your drink
        </div>


        <div class="bundle-drinks">

          ${drinks
            .map(
              drink => `

              <button
                type="button"
                class="slot ${
                  drink2 &&
                  String(
                    drink2.id
                  ) ===
                    String(
                      drink.id
                    )
                    ? "active"
                    : ""
                }"
                onclick="selectBundleDrink(
                  2,
                  '${escapeHtml(
                    drink.id
                  )}'
                )"
              >

                <div>

                  <div class="slot-day">
                    ${escapeHtml(
                      drink.name
                    )}
                  </div>

                  <div class="slot-time">
                    ${money(
                      drink.price
                    )}
                  </div>

                </div>

              </button>

            `
            )
            .join("")}

        </div>


        ${
          drink2
            ? renderBundleDrinkOptions(
                2,
                drink2,
                state.bundle
                  .drink2Options
              )
            : ""
        }

      </div>

    </div>


    <div class="sticky-bar">

      <div class="sticky-bar-inner">

        <button
          class="primary-btn"
          onclick="addBundleToCart()"
        >

          Add Duo to cart ·
          ${money(
            bundle.price
          )}

        </button>

      </div>

    </div>

  `;
}


/* =========================================================
   BUNDLE DRINK OPTIONS
========================================================= */

function renderBundleDrinkOptions(
  drinkNumber,
  drink,
  selectedOptions
) {

  return `

    <div
      class="bundle-customisation"
      style="margin-top:18px;"
    >

      <div class="bundle-selected">
        ${escapeHtml(
          drink.name
        )}
      </div>


      ${state.optionGroups
        .map(group => {

          const options =
            getOptionsForGroup(
              group.id
            );

          const selected =
            selectedOptions[
              group.id
            ];


          return `

            <div
              class="field"
              style="margin-top:16px;"
            >

              <label>

                ${escapeHtml(
                  group.name
                )}

                ${
                  group.required
                    ? " *"
                    : ""
                }

              </label>


              <div>

                ${options
                  .map(
                    option => `

                    <button
                      type="button"
                      class="slot ${
                        selected &&
                        String(
                          selected.optionId
                        ) ===
                          String(
                            option.id
                          )
                          ? "active"
                          : ""
                      }"
                      onclick="selectBundleOption(
                        ${drinkNumber},
                        '${escapeHtml(
                          group.id
                        )}',
                        '${escapeHtml(
                          option.id
                        )}'
                      )"
                    >

                      <div>

                        <div class="slot-day">
                          ${escapeHtml(
                            option.name
                          )}
                        </div>

                        <div class="slot-time">
                          ${
                            Number(
                              option.price ||
                              0
                            ) > 0

                              ? `+${money(
                                  option.price
                                )}`

                              : "Included"
                          }
                        </div>

                      </div>

                    </button>

                  `
                  )
                  .join("")}

              </div>

            </div>

          `;

        })
        .join("")}

    </div>

  `;
}


/* =========================================================
   STEPPER
========================================================= */

function stepper(
  key,
  qty
) {

  return `

    <div class="stepper">

      <button
        onclick="changeCartQty(
          '${escapeHtml(key)}',
          -1
        )"
      >

        ${ICONS.minus}

      </button>


      <span>
        ${qty}
      </span>


      <button
        onclick="changeCartQty(
          '${escapeHtml(key)}',
          1
        )"
      >

        ${ICONS.plus}

      </button>

    </div>

  `;
}


/* =========================================================
   CART
========================================================= */

function renderCart() {

  const lines =
    cartLines();


  return `

    ${header({
      showCart: true
    })}


    <div class="screen">

      <button
        class="back-link"
        onclick="setScreen('menu')"
      >

        ${ICONS.back}

        Continue browsing

      </button>


      ${
        lines.length === 0

          ? `

            <div class="empty">
              Your cart is empty —
              the whisk is waiting.
            </div>

          `

          : lines
              .map(
                line => `

                <div class="item-card">

                  <img
                    class="item-thumb"
                    src="${escapeHtml(
                      line.imageUrl ||
                      "matcha-lab.jpg"
                    )}"
                    alt="${escapeHtml(
                      line.productName
                    )}"
                  >


                  <div class="item-info">

                    <div class="item-name">
                      ${escapeHtml(
                        line.productName
                      )}
                    </div>


                    ${
                      line.options?.length

                        ? `

                          <div
                            class="item-desc"
                          >

                            ${
                              isBundle(
                                state.menu.find(
                                  p =>
                                    String(p.id) ===
                                    String(
                                      line.productId
                                    )
                                )
                              )

                                ? line.options
                                    .map(
                                      drink =>
                                        `<div>
                                          Drink ${drink.drinkNumber}:
                                          ${escapeHtml(
                                            drink.productName
                                          )}

                                          ${
                                            drink.options
                                              ?.length
                                              ? ` · ${drink.options
                                                  .map(
                                                    option =>
                                                      escapeHtml(
                                                        option.optionName
                                                      )
                                                  )
                                                  .join(
                                                    " · "
                                                  )}`
                                              : ""
                                          }

                                        </div>`
                                    )
                                    .join("")

                                : line.options
                                    .map(
                                      option =>
                                        escapeHtml(
                                          option.optionName
                                        )
                                    )
                                    .join(
                                      " · "
                                    )
                            }

                          </div>

                        `

                        : ""
                    }


                    <div class="item-price">
                      ${money(
                        line.unitPrice
                      )}
                    </div>

                  </div>


                  ${stepper(
                    line.key,
                    line.qty
                  )}

                </div>

              `
              )
              .join("")
      }

    </div>


    ${
      lines.length > 0

        ? `

          <div class="sticky-bar">

            <div class="sticky-bar-inner">

              <button
                class="primary-btn"
                onclick="setScreen('checkout')"
              >

                Checkout ·
                ${money(
                  cartTotal()
                )}

              </button>

            </div>

          </div>

        `

        : ""
    }

  `;
}


/* =========================================================
   CHECKOUT
========================================================= */

function renderCheckout() {

  const f =
    state.form;


  const canSubmit =
    f.name.trim() &&
    f.phone.trim() &&
    f.slotId;


  return `

    ${header()}


    <div class="screen">

      <button
        class="back-link"
        onclick="setScreen('cart')"
      >

        ${ICONS.back}

        Back to cart

      </button>


      <div class="field">

        <label>
          Name
        </label>

        <input
          id="f-name"
          value="${escapeHtml(
            f.name
          )}"
          placeholder="Your name"
          oninput="onFormInput(
            'name',
            this.value
          )"
        >

      </div>


      <div class="field">

        <label>
          Phone
        </label>

        <input
          id="f-phone"
          value="${escapeHtml(
            f.phone
          )}"
          placeholder="For pickup updates"
          inputmode="tel"
          oninput="onFormInput(
            'phone',
            this.value
          )"
        >

      </div>


      <div class="field">

        <label>
          Instagram (optional)
        </label>

        <input
          id="f-instagram"
          value="${escapeHtml(
            f.instagram
          )}"
          placeholder="@yourhandle"
          oninput="onFormInput(
            'instagram',
            this.value
          )"
        >

      </div>


      <div class="field">

        <label>
          Pickup slot
        </label>

      </div>


      ${state.slots
        .map(
          slot => `

          <button
            class="slot ${
              f.slotId ===
              slot.id
                ? "active"
                : ""
            }"
            onclick="onFormInput(
              'slotId',
              '${escapeHtml(
                slot.id
              )}'
            )"
          >

            ${ICONS.clock}


            <div>

              <div class="slot-day">
                ${escapeHtml(
                  slot.label
                )}
              </div>

              <div class="slot-time">
                ${escapeHtml(
                  slot.time
                )}
              </div>

            </div>

          </button>

        `
        )
        .join("")}


      <div class="field">

        <label>
          Notes (optional)
        </label>

        <textarea
          id="f-notes"
          rows="2"
          placeholder="Less ice, allergies, etc."
          oninput="onFormInput(
            'notes',
            this.value
          )"
        >${escapeHtml(
          f.notes
        )}</textarea>

      </div>


      <div class="field">

        <label>
          Promo code (optional)
        </label>


        ${
          state.promo

            ? `

              <div
                class="slot active"
                style="
                  justify-content:space-between;
                "
              >

                <span>

                  <b>
                    ${escapeHtml(
                      state.promo.code
                    )}
                  </b>

                  applied

                </span>


                <button
                  class="link-btn"
                  style="
                    border:none;
                    background:none;
                    color:#B33;
                  "
                  onclick="removePromoCode()"
                >
                  Remove
                </button>

              </div>

            `

            : `

              <div
                style="
                  display:flex;
                  gap:8px;
                "
              >

                <input
                  id="f-promo"
                  value="${escapeHtml(
                    f.promoCode
                  )}"
                  placeholder="e.g. WELCOME10"
                  style="flex:1;"
                  oninput="onFormInput(
                    'promoCode',
                    this.value
                  )"
                >


                <button
                  class="btn-primary"
                  style="
                    flex:none;
                    padding:0 18px;
                  "
                  onclick="applyPromoCode()"
                >
                  Apply
                </button>

              </div>

            `
        }


        ${
          state.promoMsg

            ? `

              <div class="ref-note">
                ${escapeHtml(
                  state.promoMsg
                )}
              </div>

            `

            : ""
        }

      </div>


      <div class="summary-card">

        ${cartLines()
          .map(
            line => `

            <div class="row">

              <span class="label">

                ${escapeHtml(
                  line.productName
                )}

                × ${line.qty}

              </span>


              <span>
                ${money(
                  line.unitPrice *
                  line.qty
                )}
              </span>

            </div>


            ${
              line.options?.length

                ? `

                  <div
                    class="hint"
                    style="
                      margin-top:-4px;
                      margin-bottom:8px;
                    "
                  >

                    ${
                      isBundle(
                        state.menu.find(
                          p =>
                            String(p.id) ===
                            String(
                              line.productId
                            )
                        )
                      )

                        ? line.options
                            .map(
                              drink =>
                                `Drink ${drink.drinkNumber}: ${escapeHtml(
                                  drink.productName
                                )}`
                            )
                            .join("<br>")

                        : line.options
                            .map(
                              option =>
                                escapeHtml(
                                  option.optionName
                                )
                            )
                            .join(
                              " · "
                            )
                    }

                  </div>

                `

                : ""
            }

          `
          )
          .join("")}


        ${
          state.promo

            ? `

              <div class="row">

                <span class="label">
                  Discount
                  (${escapeHtml(
                    state.promo.code
                  )})
                </span>

                <span>
                  -
                  ${money(
                    state.promo.amount
                  )}
                </span>

              </div>

            `

            : ""
        }


        <div class="divider"></div>


        <div class="row bold">

          <span class="label">
            Total
          </span>

          <span>
            ${money(
              orderTotal()
            )}
          </span>

        </div>

      </div>

    </div>


    <div class="sticky-bar">

      <div class="sticky-bar-inner">

        <button
          class="primary-btn"
          id="checkout-btn"
          ${
            canSubmit
              ? ""
              : "disabled"
          }
          onclick="submitOrder()"
        >

          Continue to payment ·
          ${money(
            orderTotal()
          )}

        </button>

      </div>

    </div>

  `;
}


/* =========================================================
   FORM INPUT
========================================================= */

function onFormInput(
  key,
  value
) {

  state.form[key] =
    value;


  if (
    state.screen !==
    "checkout"
  ) {
    return;
  }


  const canSubmit =
    state.form.name.trim() &&
    state.form.phone.trim() &&
    state.form.slotId;


  const button =
    document.getElementById(
      "checkout-btn"
    );


  if (button) {

    button.toggleAttribute(
      "disabled",
      !canSubmit
    );


    button.textContent =
      `Continue to payment · ${money(
        orderTotal()
      )}`;
  }


  if (
    key === "slotId"
  ) {

    render();
  }
}


/* =========================================================
   PAYMENT
========================================================= */

function renderPayment() {

  const order =
    state.lastOrder;


  if (!order) {

    return renderMenu();
  }


  const paynowName =
    state.store.paynow_name ||
    state.store.store_name ||
    "Shizuku Lab";


  const paynowNumber =
    state.store.paynow_number ||
    "";


  return `

    ${header()}


    <div class="screen">

      <div class="summary-card">

        ${
          state.store.paynow_url

            ? `

              <div class="qr-box">

                <img
                  src="${escapeHtml(
                    state.store.paynow_url
                  )}"
                  alt="PayNow QR"
                  style="
                    max-width:220px;
                    width:100%;
                    height:auto;
                  "
                >

              </div>

            `

            : `

              <div class="qr-box">
                <div class="qr-placeholder"></div>
              </div>

            `
        }


        <div class="hint">

          Scan with your banking app,
          or PayNow to

          <b>
            ${escapeHtml(
              paynowName
            )}
          </b>


          ${
            paynowNumber

              ? `

                <br>
                ${escapeHtml(
                  paynowNumber
                )}

              `

              : ""
          }

        </div>


        <div class="divider"></div>


        <div class="row">

          <span class="label">
            Order
          </span>

          <span class="mono">

            ${escapeHtml(
              order.order_number ||
              order.id ||
              ""
            )}

          </span>

        </div>


        <div class="row bold">

          <span class="label">
            Amount
          </span>

          <span>
            ${money(
              order.total
            )}
          </span>

        </div>


        <div class="ref-note">

          Enter

          <b>
            ${escapeHtml(
              order.order_number ||
              order.id ||
              ""
            )}
          </b>

          as the payment reference.

        </div>

      </div>

    </div>


    <div class="sticky-bar">

      <div class="sticky-bar-inner">

        <button
          class="primary-btn"
          onclick="markPaid()"
        >

          I've sent payment

        </button>


        <div
          class="hint"
          style="
            margin-top:8px;
            margin-bottom:0;
          "
        >

          We'll confirm your order once
          payment is verified.

        </div>

      </div>

    </div>

  `;
}


/* =========================================================
   CONFIRMATION
========================================================= */

function renderConfirmation() {

  const order =
    state.lastOrder;


  if (!order) {

    return renderMenu();
  }


  return `

    ${header()}


    <div class="screen center">

      <div class="check-circle">
        ${ICONS.check}
      </div>


      <div
        class="display"
        style="
          font-size:20px;
          margin-bottom:4px;
        "
      >

        Thanks,
        ${escapeHtml(
          (
            order.customer_name ||
            "there"
          )
            .split(" ")[0]
        )}

      </div>


      <div
        class="hint"
        style="
          margin-bottom:20px;
        "
      >

        We've received your payment
        submission and will confirm
        shortly.

      </div>


      <div class="code-box">

        <div class="mono code-text">

          ${escapeHtml(
            order.order_number ||
            order.id ||
            ""
          )}

        </div>


        <div class="divider"></div>


        <div class="row">

          <span class="label">
            Pickup
          </span>

          <span>

            ${escapeHtml(
              order.collection_date ||
              ""
            )}

            ·

            ${escapeHtml(
              order.collection_time ||
              ""
            )}

          </span>

        </div>


        <div class="row">

          <span class="label">
            Status
          </span>

          <span>
            Payment sent —
            pending confirmation
          </span>

        </div>


        <div class="row">

          <span class="label">
            Total
          </span>

          <span>
            ${money(
              order.total
            )}
          </span>

        </div>

      </div>


      <button
        class="primary-btn"
        style="
          margin-top:22px;
        "
        onclick="setScreen('menu')"
      >

        Back to menu

      </button>

    </div>

  `;
}


/* =========================================================
   MAIN RENDER
========================================================= */

function render() {

  const app =
    document.getElementById(
      "app"
    );


  if (!app) return;


  if (state.loading) {

    app.innerHTML = `

      <div class="loading">
        Loading Shizuku Lab…
      </div>

    `;

    return;
  }


  let html = "";


  if (
    state.screen ===
    "menu"
  ) {

    html =
      renderMenu();

  }

  else if (
    state.screen ===
    "options"
  ) {

    html =
      renderOptions();

  }

  else if (
    state.screen ===
    "bundle"
  ) {

    html =
      renderBundle();

  }

  else if (
    state.screen ===
    "cart"
  ) {

    html =
      renderCart();

  }

  else if (
    state.screen ===
    "checkout"
  ) {

    html =
      renderCheckout();

  }

  else if (
    state.screen ===
    "payment"
  ) {

    html =
      renderPayment();

  }

  else if (
    state.screen ===
    "confirmation"
  ) {

    html =
      renderConfirmation();

  }

  else {

    html =
      renderMenu();

  }


  html += `

    <div class="footer-link">

      <a href="admin.html">

        <button>
          Shop login
        </button>

      </a>

    </div>

  `;


  app.innerHTML =
    html;
}


/* =========================================================
   START
========================================================= */

init();
