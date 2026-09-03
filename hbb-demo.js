(() => {
  /* =========================================================
     1. MARKET
  ========================================================= */

  const params = new URLSearchParams(window.location.search);
  const marketParam = String(params.get("market") || "").toUpperCase();

  const path = window.location.pathname.toLowerCase();

  const DEMO_MARKET =
    marketParam === "MY" ||
    path.includes("/demo/malaysia")
      ? "MY"
      : "SG";

  const isMalaysia = DEMO_MARKET === "MY";

  const MARKET = {
    SG: {
      country: "Singapore",
      currency: "SGD",
      symbol: "S$",
      storageKey: "slow-studio-hbb-demo-v1-sg",
      workspaceId: "hbb-demo-sg",
      payments: ["PayNow", "Bank Transfer", "Cash"],
    },

    MY: {
      country: "Malaysia",
      currency: "MYR",
      symbol: "RM",
      storageKey: "slow-studio-hbb-demo-v1-my",
      workspaceId: "hbb-demo-my",
      payments: ["Touch 'n Go", "Bank Transfer", "Cash"],
    },
  }[DEMO_MARKET];

  const KEY = MARKET.storageKey;
  const OWNER_KEY = "slow-studio-owner-console-v1";

  const querySuffix =
    DEMO_MARKET === "MY"
      ? "?market=MY"
      : "?market=SG";


  /* =========================================================
     2. LINKS
  ========================================================= */

  const isLocalFile =
    window.location.protocol === "file:";

  const adminHref = isLocalFile
    ? `hbb-demo.html${querySuffix}`
    : isMalaysia
      ? "/demo/malaysia"
      : "/demo/singapore";

  const storeHref = isLocalFile
    ? `hbb-demo-store.html${querySuffix}`
    : isMalaysia
      ? "/demo/malaysia/shop"
      : "/demo/singapore/shop";


  /* =========================================================
     3. SEED DATA

     SAME FEATURES
     DIFFERENT COUNTRY DATA
  ========================================================= */

  const seed = {
    store: {
      name: isMalaysia
        ? "Mori Bakehouse Malaysia"
        : "Mori Bakehouse Singapore",

      country: MARKET.country,
      currency: MARKET.currency,

      tagline:
        "Small-batch bakes, made for slow mornings.",

      email: isMalaysia
        ? "hello@moribakehouse.my"
        : "hello@moribakehouse.sg",

      phone: isMalaysia
        ? "+60 12-345 6789"
        : "+65 8123 4567",

      pickupNote:
        "Collection details will be sent after your order is confirmed.",

      visibility: "live",

      paymentMethods: [
        ...MARKET.payments,
      ],

      theme: "warm",
      font: "clean",
      bannerHeading: "Welcome to our store",
      bannerSubtitle: "",
      bannerButton: "Shop Now",
      announcement: "",
    },


    /* =====================================================
       PRODUCTS
    ===================================================== */

    products: [
      {
        id: "demo-1",
        name: "Brown Butter Financier",
        category: "Bakes",

        price: isMalaysia
          ? 14
          : 4.5,

        stock: 12,
        lowStockAt: 4,
        visible: true,
      },

      {
        id: "demo-2",
        name: "Matcha Madeleines",
        category: "Bakes",

        price: isMalaysia
          ? 21
          : 6.8,

        stock: 8,
        lowStockAt: 3,
        visible: true,
      },

      {
        id: "demo-3",
        name: "Weekend Cake Box",
        category: "Bundles",

        price: isMalaysia
          ? 76
          : 24,

        stock: 4,
        lowStockAt: 2,
        visible: true,
      },
    ],


    /* =====================================================
       COSTING
    ===================================================== */

    costing: [
      {
        id: "cost-1",
        productId: "demo-1",

        ingredientCost: isMalaysia
          ? 4.2
          : 1.35,

        packagingCost: isMalaysia
          ? 0.8
          : 0.3,

        labourCost: isMalaysia
          ? 1.2
          : 0.4,
      },

      {
        id: "cost-2",
        productId: "demo-2",

        ingredientCost: isMalaysia
          ? 6.5
          : 2.1,

        packagingCost: isMalaysia
          ? 1
          : 0.35,

        labourCost: isMalaysia
          ? 1.5
          : 0.5,
      },

      {
        id: "cost-3",
        productId: "demo-3",

        ingredientCost: isMalaysia
          ? 24
          : 7.6,

        packagingCost: isMalaysia
          ? 4
          : 1.2,

        labourCost: isMalaysia
          ? 5
          : 1.7,
      },
    ],


    /* =====================================================
       REVIEWS
    ===================================================== */

    reviews: [
      {
        id: "review-1",
        customer: "Amanda",
        rating: 5,

        comment:
          "Loved the madeleines — soft and buttery!",

        reply: "",
        status: "published",

        createdAt:
          new Date(
            Date.now() - 86400000
          ).toISOString(),
      },

      {
        id: "review-2",
        customer: "Rachel",
        rating: 4,

        comment:
          "The cake box was lovely for sharing.",

        reply:
          "Thank you so much 🤍",

        status: "published",

        createdAt:
          new Date(
            Date.now() - 172800000
          ).toISOString(),
      },
    ],


    /* =====================================================
       PROMO
    ===================================================== */

    promos: [
      {
        id: "promo-1",
        code: "FIRSTDROP",
        name: "First order treat",
        type: "percentage",
        value: 10,
        minimumSpend: 0,
        active: true,
        expiry: "",
      },

      {
        id: "promo-2",
        code: "WEEKEND5",
        name: "Weekend special",
        type: "fixed",

        value: isMalaysia
          ? 5
          : 2,

        minimumSpend: isMalaysia
          ? 40
          : 15,

        active: false,
        expiry: "",
      },
    ],


    /* =====================================================
       REWARDS
    ===================================================== */

    rewards: {
      enabled: true,

      mode: "stamps",

      stampsRequired: 8,

      rewardType: "fixed",

      rewardValue: isMalaysia
        ? 10
        : 5,

      pointsPerSpend: 1,

      minimumRedeemPoints: 100,

      welcomeReward: true,

      birthdayReward: false,
    },


    /* =====================================================
       AVAILABILITY
    ===================================================== */

    availability: {
      orderingOpen: true,

      preorderDays: 3,

      maxOrdersPerSlot: 12,

      slots: [
        {
          id: "slot-1",
          date: "",
          time: "11:00",
          label: "Morning collection",
          capacity: 12,
          enabled: true,
        },

        {
          id: "slot-2",
          date: "",
          time: "15:00",
          label: "Afternoon collection",
          capacity: 10,
          enabled: true,
        },
      ],
    },


    /* =====================================================
       NOTIFICATIONS
    ===================================================== */

    notifications: {
      newOrderEmail: true,
      orderConfirmation: true,
      lowStock: true,
      lowStockThreshold: 3,
      collectionReminder: true,
      promoReminder: false,
      reviewAlert: true,
    },


    /* =====================================================
       ACTIVITY
    ===================================================== */

    activity: [
      {
        text:
          `${MARKET.country} demo workspace opened`,

        at:
          new Date().toISOString(),
      },
    ],
  };


  /* =========================================================
     4. HELPERS
  ========================================================= */

  const clone = (value) =>
    JSON.parse(JSON.stringify(value));


  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[char])
    );


  const money = (value) =>
    `${MARKET.symbol}${Number(
      value || 0
    ).toFixed(2)}`;


  const fmt = (date) =>
    new Date(date).toLocaleString(
      [],
      {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }
    );


  const uid = (prefix) =>
    `${prefix}-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`;


  /* =========================================================
   PRODUCT IMAGE STORAGE
   IndexedDB · browser only
========================================================= */

const IMAGE_DB_NAME =
  `slow-studio-demo-images-${DEMO_MARKET.toLowerCase()}`;

const IMAGE_DB_VERSION = 1;

const IMAGE_STORE_NAME = "productImages";

let imageDbPromise = null;


/* -------------------------
   OPEN IMAGE DATABASE
------------------------- */

function openImageDB() {
  if (imageDbPromise) {
    return imageDbPromise;
  }

  imageDbPromise = new Promise((resolve, reject) => {
    const request =
      indexedDB.open(
        IMAGE_DB_NAME,
        IMAGE_DB_VERSION
      );

    request.onupgradeneeded = () => {
      const db = request.result;

      if (
        !db.objectStoreNames.contains(
          IMAGE_STORE_NAME
        )
      ) {
        db.createObjectStore(
          IMAGE_STORE_NAME
        );
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });

  return imageDbPromise;
}


/* -------------------------
   SAVE PRODUCT IMAGE
------------------------- */

async function saveProductImage(
  productId,
  blob
) {
  if (!productId || !blob) {
    return;
  }

  const db =
    await openImageDB();

  return new Promise(
    (resolve, reject) => {
      const transaction =
        db.transaction(
          IMAGE_STORE_NAME,
          "readwrite"
        );

      const store =
        transaction.objectStore(
          IMAGE_STORE_NAME
        );

      store.put(
        blob,
        productId
      );

      transaction.oncomplete =
        () => resolve();

      transaction.onerror =
        () =>
          reject(
            transaction.error
          );
    }
  );
}


/* -------------------------
   GET PRODUCT IMAGE
------------------------- */

async function getProductImage(
  productId
) {
  if (!productId) {
    return null;
  }

  const db =
    await openImageDB();

  return new Promise(
    (resolve, reject) => {
      const transaction =
        db.transaction(
          IMAGE_STORE_NAME,
          "readonly"
        );

      const store =
        transaction.objectStore(
          IMAGE_STORE_NAME
        );

      const request =
        store.get(productId);

      request.onsuccess =
        () =>
          resolve(
            request.result ||
            null
          );

      request.onerror =
        () =>
          reject(
            request.error
          );
    }
  );
}


/* -------------------------
   DELETE PRODUCT IMAGE
------------------------- */

async function deleteProductImage(
  productId
) {
  if (!productId) {
    return;
  }

  const db =
    await openImageDB();

  return new Promise(
    (resolve, reject) => {
      const transaction =
        db.transaction(
          IMAGE_STORE_NAME,
          "readwrite"
        );

      transaction
        .objectStore(
          IMAGE_STORE_NAME
        )
        .delete(productId);

      transaction.oncomplete =
        () => resolve();

      transaction.onerror =
        () =>
          reject(
            transaction.error
          );
    }
  );
}


/* -------------------------
   CLEAR ALL PRODUCT IMAGES
   FOR CURRENT MARKET
------------------------- */

async function clearProductImages() {
  const db =
    await openImageDB();

  return new Promise(
    (resolve, reject) => {
      const transaction =
        db.transaction(
          IMAGE_STORE_NAME,
          "readwrite"
        );

      transaction
        .objectStore(
          IMAGE_STORE_NAME
        )
        .clear();

      transaction.oncomplete =
        () => resolve();

      transaction.onerror =
        () =>
          reject(
            transaction.error
          );
    }
  );
}


/* =========================================================
   IMAGE COMPRESSION

   Mobile camera photos can be huge.
   Resize before storing them in IndexedDB.
========================================================= */

async function compressProductImage(
  file
) {
  const MAX_SIZE = 1400;
  const QUALITY = 0.82;

  const image =
    await createImageBitmap(file);

  let width =
    image.width;

  let height =
    image.height;

  if (
    width > MAX_SIZE ||
    height > MAX_SIZE
  ) {
    const scale =
      Math.min(
        MAX_SIZE / width,
        MAX_SIZE / height
      );

    width =
      Math.round(
        width * scale
      );

    height =
      Math.round(
        height * scale
      );
  }

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width = width;
  canvas.height = height;

  const ctx =
    canvas.getContext("2d");

  ctx.drawImage(
    image,
    0,
    0,
    width,
    height
  );

  image.close?.();

  const blob =
    await new Promise(
      (resolve) => {
        canvas.toBlob(
          resolve,
          "image/jpeg",
          QUALITY
        );
      }
    );

  if (!blob) {
    throw new Error(
      "Could not prepare image."
    );
  }

  return blob;
}

  /* =========================================================
     5. LOAD + OLD DEMO MIGRATION
  ========================================================= */

  function load() {
    try {
      const saved =
        JSON.parse(
          localStorage.getItem(KEY) ||
          "null"
        );


      if (!saved) {
        return clone(seed);
      }


      return {
        ...clone(seed),
        ...saved,


        store: {
          ...clone(seed.store),
          ...(saved.store || {}),

          country:
            MARKET.country,

          currency:
            MARKET.currency,

          paymentMethods:
            Array.isArray(
              saved.store?.paymentMethods
            )
              ? saved.store.paymentMethods
              : clone(
                  seed.store
                    .paymentMethods
                ),
        },


        products:
          Array.isArray(saved.products)
            ? saved.products
            : clone(seed.products),


        costing:
          Array.isArray(saved.costing)
            ? saved.costing
            : clone(seed.costing),


        reviews:
          Array.isArray(saved.reviews)
            ? saved.reviews
            : clone(seed.reviews),


        promos:
          Array.isArray(saved.promos)
            ? saved.promos
            : clone(seed.promos),


        rewards: {
          ...clone(seed.rewards),
          ...(saved.rewards || {}),
        },


        availability: {
          ...clone(
            seed.availability
          ),
          ...(saved.availability ||
            {}),

          slots:
            Array.isArray(
              saved.availability
                ?.slots
            )
              ? saved.availability
                  .slots
              : clone(
                  seed.availability
                    .slots
                ),
        },


        notifications: {
          ...clone(
            seed.notifications
          ),
          ...(saved.notifications ||
            {}),
        },


        activity:
          Array.isArray(
            saved.activity
          )
            ? saved.activity
            : clone(seed.activity),
      };

    } catch (_) {
      return clone(seed);
    }
  }


  let state = load();

  let panel = "overview";

  let productDraft = null;

let pendingProductImage = null;

let pendingProductImageUrl = "";

const productImageUrlCache =
  new Map();
  

  function save() {
    localStorage.setItem(
      KEY,
      JSON.stringify(state)
    );
  }


  function activity(text) {
    state.activity.unshift({
      text,
      at:
        new Date().toISOString(),
    });

    state.activity =
      state.activity.slice(0, 30);

    save();
  }


  /* =========================================================
     6. NAV
  ========================================================= */

  function setPanel(next) {
    panel = next;

    renderAdmin();
  }


  const NAV = [
    ["overview", "Home"],
    ["orders", "Orders"],
    ["products", "My Store"],
    ["inventory", "Inventory"],
    ["costing", "Costing"],
    ["reviews", "Reviews"],
    ["promo", "Promo"],
    ["rewards", "Rewards"],
    ["availability", "Availability"],
    ["notifications", "Notifications"],
    ["store", "Store Details"],
    ["design", "Design"],
    ["help", "Help & issues"],
  ];


  /* =========================================================
     7. STORE
  ========================================================= */

  function setStore(
    field,
    value
  ) {
    state.store[field] =
      value;

    save();

    renderAdmin();

    renderStore();
  }


  function togglePayment(
    method,
    checked
  ) {
    const list =
      state.store
        .paymentMethods || [];


    if (
      checked &&
      !list.includes(method)
    ) {
      list.push(method);
    }


    if (!checked) {
      state.store
        .paymentMethods =
        list.filter(
          (item) =>
            item !== method
        );
    }


    save();

    renderAdmin();
  }


  /* =========================================================
     8. PRODUCTS
  ========================================================= */

  function openProduct(id) {
    productDraft = id
      ? clone(
          state.products.find(
            (item) =>
              item.id === id
          )
        )
      : {
          id: "",
          name: "",
          category: "Bakes",
          price: 0,
          stock: 0,
          lowStockAt: 3,
          visible: true,
        };


    renderAdmin();


    document
      .getElementById(
        "productDialog"
      )
      ?.showModal();
  }


  function productDraftField(
    field,
    value
  ) {
    if (!productDraft) {
      return;
    }


    if (
      [
        "price",
        "stock",
        "lowStockAt",
      ].includes(field)
    ) {
      productDraft[field] =
        Number(value || 0);

      return;
    }


    if (
      field === "visible"
    ) {
      productDraft[field] =
        value === "true";

      return;
    }


    productDraft[field] =
      value;
  }

  /* =========================================================
   PRODUCT IMAGE UPLOAD
========================================================= */

async function uploadProductImage(
  input
) {
  const file =
    input?.files?.[0];

  if (!file) {
    return;
  }


  if (
    !file.type.startsWith(
      "image/"
    )
  ) {
    input.value = "";

    return alert(
      "Please choose an image file."
    );
  }


  /*
   12MB limit before compression
  */

  if (
    file.size >
    12 * 1024 * 1024
  ) {
    input.value = "";

    return alert(
      "This photo is too large. Please choose an image smaller than 12MB."
    );
  }


  try {
    const blob =
      await compressProductImage(
        file
      );


    pendingProductImage =
      blob;


    /*
     Clear previous preview URL
    */

    if (
      pendingProductImageUrl
    ) {
      URL.revokeObjectURL(
        pendingProductImageUrl
      );
    }


    pendingProductImageUrl =
      URL.createObjectURL(
        blob
      );


    /*
     Part 1B will contain this preview element.
    */

    const preview =
      document.getElementById(
        "productImagePreview"
      );


    if (preview) {
      preview.src =
        pendingProductImageUrl;

      preview.hidden =
        false;
    }


    const empty =
      document.getElementById(
        "productImageEmpty"
      );


    if (empty) {
      empty.hidden =
        true;
    }


    const removeButton =
      document.getElementById(
        "removeProductImageButton"
      );


    if (removeButton) {
      removeButton.hidden =
        false;
    }

  } catch (error) {
    console.error(
      "Product image error:",
      error
    );


    alert(
      "Could not prepare this photo. Please try another image."
    );
  }
}

async function removeProductImage() {
  if (!productDraft) {
    return;
  }

  pendingProductImage = null;

  if (
    pendingProductImageUrl
  ) {
    URL.revokeObjectURL(
      pendingProductImageUrl
    );

    pendingProductImageUrl = "";
  }

  if (productDraft.id) {
    try {
      await deleteProductImage(
        productDraft.id
      );

      productImageUrlCache.delete(
        productDraft.id
      );
    } catch (error) {
      console.error(
        "Could not remove image:",
        error
      );
    }
  }

  const preview =
    document.getElementById(
      "productImagePreview"
    );

  const empty =
    document.getElementById(
      "productImageEmpty"
    );

  const button =
    document.getElementById(
      "removeProductImageButton"
    );

  if (preview) {
    preview.src = "";
    preview.hidden = true;
  }

  if (empty) {
    empty.hidden = false;
  }

  if (button) {
    button.hidden = true;
  }
}  

async function uploadHeroImage(input) {
  const file =
    input?.files?.[0];

  if (!file) {
    return;
  }

  if (
    !file.type.startsWith(
      "image/"
    )
  ) {
    input.value = "";

    return alert(
      "Please choose an image file."
    );
  }

  if (
    file.size >
    12 * 1024 * 1024
  ) {
    input.value = "";

    return alert(
      "This photo is too large. Please choose an image smaller than 12MB."
    );
  }

  try {
    const blob =
      await compressProductImage(
        file
      );

    await saveProductImage(
      "hero-banner",
      blob
    );

    const preview =
      document.getElementById(
        "heroImagePreview"
      );

    const empty =
      document.getElementById(
        "heroImageEmpty"
      );

    const removeButton =
      document.getElementById(
        "removeHeroImageButton"
      );

    if (preview) {
      preview.src =
        URL.createObjectURL(blob);

      preview.hidden =
        false;
    }

    if (empty) {
      empty.hidden = true;
    }

    if (removeButton) {
      removeButton.hidden =
        false;
    }

    activity(
      "Homepage hero image updated"
    );

  } catch (error) {
    console.error(
      "Hero image error:",
      error
    );

    alert(
      "Could not save hero image."
    );
  }
}


async function removeHeroImage() {
 try {
    await deleteProductImage(
      "hero-banner"
    );

    const preview =
      document.getElementById(
        "heroImagePreview"
      );

    const empty =
      document.getElementById(
        "heroImageEmpty"
      );

    const button =
      document.getElementById(
        "removeHeroImageButton"
      );

    if (preview) {
      preview.src = "";
      preview.hidden = true;
    }

    if (empty) {
      empty.hidden = false;
    }

    if (button) {
      button.hidden = true;
    }

    activity(
      "Homepage hero image removed"
    );

  } catch (error) {
    console.error(
      "Could not remove hero image:",
      error
    );
  }
}  
  
  async function saveProduct() {
  if (
    !productDraft ||
    !String(
      productDraft.name || ""
    ).trim()
  ) {
    return alert(
      "Enter a product name."
    );
  }

  let isNew = false;

  if (productDraft.id) {
    const index =
      state.products.findIndex(
        item =>
          item.id ===
          productDraft.id
      );

    if (index >= 0) {
      state.products[index] =
        clone(productDraft);
    }
  } else {
    isNew = true;

    productDraft.id =
      uid("product");

    state.products.push(
      clone(productDraft)
    );

    state.costing.push({
      id: uid("cost"),
      productId:
        productDraft.id,
      ingredientCost: 0,
      packagingCost: 0,
      labourCost: 0,
    });
  }

  const productId =
    productDraft.id;

  if (pendingProductImage) {
    try {
      await saveProductImage(
        productId,
        pendingProductImage
      );

      productImageUrlCache.delete(
        productId
      );
    } catch (error) {
      console.error(
        "Could not save product image:",
        error
      );

      return alert(
        "Product details were prepared, but the photo could not be saved."
      );
    }
  }

  activity(
    `${productDraft.name} saved`
  );

  if (
    pendingProductImageUrl
  ) {
    URL.revokeObjectURL(
      pendingProductImageUrl
    );
  }

  pendingProductImage = null;
  pendingProductImageUrl = "";
  productDraft = null;

  save();

  renderAdmin();
  renderStore();
}


  function removeProduct(id) {
    const product =
      state.products.find(
        (item) =>
          item.id === id
      );


    if (!product) {
      return;
    }


    if (
      !confirm(
        `Remove ${product.name}?`
      )
    ) {
      return;
    }


    state.products =
      state.products.filter(
        (item) =>
          item.id !== id
      );


    state.costing =
      state.costing.filter(
        (item) =>
          item.productId !== id
      );


    activity(
      `${product.name} removed`
    );


    renderAdmin();

    renderStore();
  }


  /* =========================================================
     9. INVENTORY
  ========================================================= */

  function updateInventory(
    id,
    field,
    value
  ) {
    const product =
      state.products.find(
        (item) =>
          item.id === id
      );


    if (!product) {
      return;
    }


    product[field] =
      Number(value || 0);


    save();

    renderAdmin();
  }


  /* =========================================================
     10. COSTING
  ========================================================= */

  function getCosting(
    productId
  ) {
    let item =
      state.costing.find(
        (row) =>
          row.productId ===
          productId
      );


    if (!item) {
      item = {
        id: uid("cost"),
        productId,
        ingredientCost: 0,
        packagingCost: 0,
        labourCost: 0,
      };


      state.costing.push(
        item
      );


      save();
    }


    return item;
  }


  function updateCosting(
    productId,
    field,
    value
  ) {
    const item =
      getCosting(
        productId
      );


    item[field] =
      Number(value || 0);


    save();

    renderAdmin();
  }


  /* =========================================================
     11. REVIEWS
  ========================================================= */

  function addReview() {
    state.reviews.unshift({
      id: uid("review"),
      customer:
        "Demo customer",
      rating: 5,
      comment:
        "Loved it!",
      reply: "",
      status:
        "published",
      createdAt:
        new Date().toISOString(),
    });


    activity(
      "Demo review added"
    );


    renderAdmin();
  }


  function updateReview(
    id,
    field,
    value
  ) {
    const review =
      state.reviews.find(
        (item) =>
          item.id === id
      );


    if (!review) {
      return;
    }


    review[field] =
      field === "rating"
        ? Number(value)
        : value;


    save();

    renderAdmin();
  }


  function removeReview(id) {
    if (
      !confirm(
        "Delete this review?"
      )
    ) {
      return;
    }


    state.reviews =
      state.reviews.filter(
        (item) =>
          item.id !== id
      );


    activity(
      "Review removed"
    );


    renderAdmin();
  }


  /* =========================================================
     12. PROMO
  ========================================================= */

  function addPromo() {
    state.promos.unshift({
      id: uid("promo"),
      code: "NEWCODE",
      name: "New promotion",
      type:
        "percentage",
      value: 10,
      minimumSpend: 0,
      active: true,
      expiry: "",
    });


    activity(
      "Promotion added"
    );


    renderAdmin();
  }


  function updatePromo(
    id,
    field,
    value
  ) {
    const promo =
      state.promos.find(
        (item) =>
          item.id === id
      );


    if (!promo) {
      return;
    }


    if (
      [
        "value",
        "minimumSpend",
      ].includes(field)
    ) {
      promo[field] =
        Number(value || 0);

    } else if (
      field === "active"
    ) {
      promo[field] =
        value === "true";

    } else {
      promo[field] =
        value;
    }


    save();

    renderAdmin();
  }


  function removePromo(id) {
    if (
      !confirm(
        "Delete this promotion?"
      )
    ) {
      return;
    }


    state.promos =
      state.promos.filter(
        (item) =>
          item.id !== id
      );


    activity(
      "Promotion removed"
    );


    renderAdmin();
  }


  /* =========================================================
     13. REWARDS
  ========================================================= */

  function setReward(
    field,
    value
  ) {
    if (
      [
        "stampsRequired",
        "rewardValue",
        "pointsPerSpend",
        "minimumRedeemPoints",
      ].includes(field)
    ) {
      state.rewards[field] =
        Number(value || 0);

    } else if (
      [
        "enabled",
        "welcomeReward",
        "birthdayReward",
      ].includes(field)
    ) {
      state.rewards[field] =
        value === "true";

    } else {
      state.rewards[field] =
        value;
    }


    save();

    renderAdmin();
  }


  /* =========================================================
     14. AVAILABILITY
  ========================================================= */

  function setAvailability(
    field,
    value
  ) {
    if (
      [
        "preorderDays",
        "maxOrdersPerSlot",
      ].includes(field)
    ) {
      state.availability[field] =
        Number(value || 0);

    } else if (
      field ===
      "orderingOpen"
    ) {
      state.availability[field] =
        value === "true";

    } else {
      state.availability[field] =
        value;
    }


    save();

    renderAdmin();
  }


  function addSlot() {
    state.availability
      .slots.push({
        id: uid("slot"),
        date: "",
        time: "12:00",
        label:
          "New collection slot",
        capacity:
          state.availability
            .maxOrdersPerSlot ||
          10,
        enabled: true,
      });


    activity(
      "Collection slot added"
    );


    renderAdmin();
  }


  function updateSlot(
    id,
    field,
    value
  ) {
    const slot =
      state.availability
        .slots.find(
          (item) =>
            item.id === id
        );


    if (!slot) {
      return;
    }


    if (
      field === "capacity"
    ) {
      slot[field] =
        Number(value || 0);

    } else if (
      field === "enabled"
    ) {
      slot[field] =
        value === "true";

    } else {
      slot[field] =
        value;
    }


    save();

    renderAdmin();
  }


  function removeSlot(id) {
    state.availability
      .slots =
      state.availability
        .slots.filter(
          (item) =>
            item.id !== id
        );


    activity(
      "Collection slot removed"
    );


    renderAdmin();
  }


  /* =========================================================
     15. NOTIFICATIONS
  ========================================================= */

  function setNotification(
    field,
    value
  ) {
    if (
      field ===
      "lowStockThreshold"
    ) {
      state.notifications[field] =
        Number(value || 0);

    } else {
      state.notifications[field] =
        value === "true";
    }


    save();

    renderAdmin();
  }


  /* =========================================================
     16. RESET
  ========================================================= */

  function reset() {
    if (
      !confirm(
        `Reset the ${MARKET.country} demo on this device?`
      )
    ) {
      return;
    }


    state =
      clone(seed);


    save();

    renderAdmin();

    renderStore();
  }


  /* =========================================================
     17. ISSUES
  ========================================================= */

  function reportIssue() {
    document
      .getElementById(
        "issueDialog"
      )
      ?.showModal();
  }


  function submitIssue() {
    const title =
      document
        .getElementById(
          "issueTitle"
        )
        ?.value
        .trim();


    const detail =
      document
        .getElementById(
          "issueDetail"
        )
        ?.value
        .trim();


    const page =
      document
        .getElementById(
          "issuePage"
        )
        ?.value ||
      "Demo";


    if (!title) {
      return alert(
        "Describe the problem first."
      );
    }


    let owner;


    try {
      owner =
        JSON.parse(
          localStorage.getItem(
            OWNER_KEY
          ) || "null"
        );

    } catch (_) {}


    if (
      !owner ||
      !Array.isArray(
        owner.issues
      )
    ) {
      owner = {
        workspaces: [],
        issues: [],
        activity: [],
      };
    }


    owner.issues.unshift({
      id:
        uid("demo-issue"),

      workspaceId:
        MARKET.workspaceId,

      severity:
        "medium",

      title,

      detail:
        detail ||
        "No extra detail provided.",

      page,

      status:
        "open",

      note: "",

      createdAt:
        new Date().toISOString(),
    });


    owner.activity =
      Array.isArray(
        owner.activity
      )
        ? owner.activity
        : [];


    owner.activity.unshift({
      text:
        `${MARKET.country} HBB demo reported: ${title}`,

      at:
        new Date().toISOString(),
    });


    localStorage.setItem(
      OWNER_KEY,
      JSON.stringify(owner)
    );


    activity(
      `Issue sent to Slow Studio owner: ${title}`
    );


    document
      .getElementById(
        "issueDialog"
      )
      ?.close();


    alert(
      "Saved in the Slow Studio owner issue inbox on this device."
    );
  }


  /* =========================================================
     18. RENDER HELPERS
  ========================================================= */

  function productRows() {
    return state.products
      .map(
        (item) => `
          <tr>

            <td>
              <div class="demo-product-name">

                <span class="demo-thumb">
                  ${esc(
                    item.name.slice(0, 1)
                  )}
                </span>

                <div>
                  <b>
                    ${esc(item.name)}
                  </b>

                  <br>

                  <small>
                    ${esc(item.category)}
                  </small>
                </div>

              </div>
            </td>

            <td>
              ${money(item.price)}
            </td>

            <td>
              ${Number(item.stock)}
            </td>

            <td>
              <span
                class="
                  demo-status
                  ${
                    item.visible
                      ? ""
                      : "hidden"
                  }
                "
              >
                ${
                  item.visible
                    ? "Visible"
                    : "Hidden"
                }
              </span>
            </td>

            <td>
              <div class="demo-actions">

                <button
                  class="demo-btn"
                  onclick="
                    HBBDemo.openProduct(
                      '${esc(item.id)}'
                    )
                  "
                >
                  Edit
                </button>

                <button
                  class="
                    demo-btn
                    danger
                  "
                  onclick="
                    HBBDemo.removeProduct(
                      '${esc(item.id)}'
                    )
                  "
                >
                  Delete
                </button>

              </div>
            </td>

          </tr>
        `
      )
      .join("");
  }


  function inventoryRows() {
    return state.products
      .map((item) => {
        const low =
          Number(item.stock) <=
          Number(
            item.lowStockAt || 0
          );


        return `
          <tr>

            <td>
              <b>
                ${esc(item.name)}
              </b>
            </td>

            <td>

              <input
                class="demo-inline-input"
                type="number"
                min="0"
                step="1"

                value="${
                  Number(item.stock)
                }"

                onchange="
                  HBBDemo.updateInventory(
                    '${esc(item.id)}',
                    'stock',
                    this.value
                  )
                "
              >

            </td>

            <td>

              <input
                class="demo-inline-input"
                type="number"
                min="0"
                step="1"

                value="${
                  Number(
                    item.lowStockAt || 0
                  )
                }"

                onchange="
                  HBBDemo.updateInventory(
                    '${esc(item.id)}',
                    'lowStockAt',
                    this.value
                  )
                "
              >

            </td>

            <td>
              <span
                class="
                  demo-status
                  ${low ? "hidden" : ""}
                "
              >
                ${
                  low
                    ? "Low stock"
                    : "Healthy"
                }
              </span>
            </td>

          </tr>
        `;
      })
      .join("");
  }


  function costingRows() {
    return state.products
      .map((product) => {
        const item =
          getCosting(
            product.id
          );


        const ingredients =
          Number(
            item.ingredientCost ||
            0
          );


        const packaging =
          Number(
            item.packagingCost ||
            0
          );


        const labour =
          Number(
            item.labourCost ||
            0
          );


        const total =
          ingredients +
          packaging +
          labour;


        const selling =
          Number(
            product.price || 0
          );


        const profit =
          selling - total;


        const margin =
          selling > 0
            ? (
                profit /
                selling *
                100
              )
            : 0;


        return `
          <tr>

            <td>
              <b>
                ${esc(
                  product.name
                )}
              </b>
            </td>

            <td>
              ${money(selling)}
            </td>

            <td>
              <input
                class="demo-inline-input"
                type="number"
                step=".10"
                min="0"

                value="${ingredients}"

                onchange="
                  HBBDemo.updateCosting(
                    '${esc(product.id)}',
                    'ingredientCost',
                    this.value
                  )
                "
              >
            </td>

            <td>
              <input
                class="demo-inline-input"
                type="number"
                step=".10"
                min="0"

                value="${packaging}"

                onchange="
                  HBBDemo.updateCosting(
                    '${esc(product.id)}',
                    'packagingCost',
                    this.value
                  )
                "
              >
            </td>

            <td>
              <input
                class="demo-inline-input"
                type="number"
                step=".10"
                min="0"

                value="${labour}"

                onchange="
                  HBBDemo.updateCosting(
                    '${esc(product.id)}',
                    'labourCost',
                    this.value
                  )
                "
              >
            </td>

            <td>
              ${money(total)}
            </td>

            <td>
              <b>
                ${money(profit)}
              </b>
            </td>

            <td>
              <b>
                ${margin.toFixed(1)}%
              </b>
            </td>

          </tr>
        `;
      })
      .join("");
  }


  function reviewCards() {
    return state.reviews
      .map(
        (review) => `
          <article
            class="demo-card"
            style="margin-bottom:16px"
          >

            <div class="demo-card-head">

              <div>

                <h3>
                  ${esc(
                    review.customer
                  )}
                </h3>

                <p>
                  ${fmt(
                    review.createdAt
                  )}
                </p>

              </div>


              <div class="demo-actions">

                <select
                  onchange="
                    HBBDemo.updateReview(
                      '${review.id}',
                      'status',
                      this.value
                    )
                  "
                >

                  <option
                    value="published"
                    ${
                      review.status ===
                      "published"
                        ? "selected"
                        : ""
                    }
                  >
                    Published
                  </option>

                  <option
                    value="hidden"
                    ${
                      review.status ===
                      "hidden"
                        ? "selected"
                        : ""
                    }
                  >
                    Hidden
                  </option>

                </select>


                <button
                  class="
                    demo-btn
                    danger
                  "
                  onclick="
                    HBBDemo.removeReview(
                      '${review.id}'
                    )
                  "
                >
                  Delete
                </button>

              </div>

            </div>


            <div class="demo-form-grid">

              <div class="demo-field">

                <label>
                  Customer
                </label>

                <input
                  value="${esc(
                    review.customer
                  )}"

                  onchange="
                    HBBDemo.updateReview(
                      '${review.id}',
                      'customer',
                      this.value
                    )
                  "
                >

              </div>


              <div class="demo-field">

                <label>
                  Rating
                </label>

                <select
                  onchange="
                    HBBDemo.updateReview(
                      '${review.id}',
                      'rating',
                      this.value
                    )
                  "
                >

                  ${[5,4,3,2,1]
                    .map(
                      (rating) => `
                        <option
                          value="${rating}"
                          ${
                            Number(
                              review.rating
                            ) === rating
                              ? "selected"
                              : ""
                          }
                        >
                          ${rating}
                          star${
                            rating > 1
                              ? "s"
                              : ""
                          }
                        </option>
                      `
                    )
                    .join("")}

                </select>

              </div>


              <div
                class="
                  demo-field
                  wide
                "
              >

                <label>
                  Customer review
                </label>

                <textarea
                  rows="3"

                  onchange="
                    HBBDemo.updateReview(
                      '${review.id}',
                      'comment',
                      this.value
                    )
                  "
                >${esc(
                  review.comment
                )}</textarea>

              </div>


              <div
                class="
                  demo-field
                  wide
                "
              >

                <label>
                  Your reply
                </label>

                <textarea
                  rows="3"

                  placeholder="
                    Reply to customer...
                  "

                  onchange="
                    HBBDemo.updateReview(
                      '${review.id}',
                      'reply',
                      this.value
                    )
                  "
                >${esc(
                  review.reply || ""
                )}</textarea>

              </div>

            </div>

          </article>
        `
      )
      .join("");
  }


  function promoCards() {
    return state.promos
      .map(
        (promo) => `
          <article
            class="demo-card"
            style="margin-bottom:16px"
          >

            <div class="demo-card-head">

              <div>

                <h3>
                  ${esc(
                    promo.code
                  )}
                </h3>

                <p>
                  ${esc(
                    promo.name
                  )}
                </p>

              </div>


              <button
                class="
                  demo-btn
                  danger
                "
                onclick="
                  HBBDemo.removePromo(
                    '${promo.id}'
                  )
                "
              >
                Delete
              </button>

            </div>


            <div class="demo-form-grid">

              <div class="demo-field">

                <label>
                  Promo code
                </label>

                <input
                  value="${esc(
                    promo.code
                  )}"

                  onchange="
                    HBBDemo.updatePromo(
                      '${promo.id}',
                      'code',
                      this.value
                    )
                  "
                >

              </div>


              <div class="demo-field">

                <label>
                  Campaign name
                </label>

                <input
                  value="${esc(
                    promo.name
                  )}"

                  onchange="
                    HBBDemo.updatePromo(
                      '${promo.id}',
                      'name',
                      this.value
                    )
                  "
                >

              </div>


              <div class="demo-field">

                <label>
                  Discount type
                </label>

                <select
                  onchange="
                    HBBDemo.updatePromo(
                      '${promo.id}',
                      'type',
                      this.value
                    )
                  "
                >

                  <option
                    value="percentage"
                    ${
                      promo.type ===
                      "percentage"
                        ? "selected"
                        : ""
                    }
                  >
                    Percentage
                  </option>

                  <option
                    value="fixed"
                    ${
                      promo.type ===
                      "fixed"
                        ? "selected"
                        : ""
                    }
                  >
                    Fixed amount
                  </option>

                </select>

              </div>


              <div class="demo-field">

                <label>
                  Value
                </label>

                <input
                  type="number"
                  min="0"
                  step=".10"

                  value="${Number(
                    promo.value || 0
                  )}"

                  onchange="
                    HBBDemo.updatePromo(
                      '${promo.id}',
                      'value',
                      this.value
                    )
                  "
                >

              </div>


              <div class="demo-field">

                <label>
                  Minimum spend
                </label>

                <input
                  type="number"
                  min="0"
                  step=".10"

                  value="${Number(
                    promo.minimumSpend ||
                    0
                  )}"

                  onchange="
                    HBBDemo.updatePromo(
                      '${promo.id}',
                      'minimumSpend',
                      this.value
                    )
                  "
                >

              </div>


              <div class="demo-field">

                <label>
                  Expiry
                </label>

                <input
                  type="date"

                  value="${esc(
                    promo.expiry || ""
                  )}"

                  onchange="
                    HBBDemo.updatePromo(
                      '${promo.id}',
                      'expiry',
                      this.value
                    )
                  "
                >

              </div>


              <div class="demo-field">

                <label>
                  Status
                </label>

                <select
                  onchange="
                    HBBDemo.updatePromo(
                      '${promo.id}',
                      'active',
                      this.value
                    )
                  "
                >

                  <option
                    value="true"
                    ${
                      promo.active
                        ? "selected"
                        : ""
                    }
                  >
                    Active
                  </option>

                  <option
                    value="false"
                    ${
                      !promo.active
                        ? "selected"
                        : ""
                    }
                  >
                    Paused
                  </option>

                </select>

              </div>

            </div>

          </article>
        `
      )
      .join("");
  }


  function slotCards() {
    return state.availability
      .slots
      .map(
        (slot) => `
          <article
            class="demo-card"
            style="margin-bottom:14px"
          >

            <div class="demo-form-grid">

              <div class="demo-field">

                <label>
                  Date
                </label>

                <input
                  type="date"
                  value="${esc(
                    slot.date
                  )}"

                  onchange="
                    HBBDemo.updateSlot(
                      '${slot.id}',
                      'date',
                      this.value
                    )
                  "
                >

              </div>


              <div class="demo-field">

                <label>
                  Time
                </label>

                <input
                  type="time"
                  value="${esc(
                    slot.time
                  )}"

                  onchange="
                    HBBDemo.updateSlot(
                      '${slot.id}',
                      'time',
                      this.value
                    )
                  "
                >

              </div>


              <div class="demo-field">

                <label>
                  Slot name
                </label>

                <input
                  value="${esc(
                    slot.label
                  )}"

                  onchange="
                    HBBDemo.updateSlot(
                      '${slot.id}',
                      'label',
                      this.value
                    )
                  "
                >

              </div>


              <div class="demo-field">

                <label>
                  Capacity
                </label>

                <input
                  type="number"
                  min="1"

                  value="${Number(
                    slot.capacity
                  )}"

                  onchange="
                    HBBDemo.updateSlot(
                      '${slot.id}',
                      'capacity',
                      this.value
                    )
                  "
                >

              </div>


              <div class="demo-field">

                <label>
                  Status
                </label>

                <select
                  onchange="
                    HBBDemo.updateSlot(
                      '${slot.id}',
                      'enabled',
                      this.value
                    )
                  "
                >

                  <option
                    value="true"
                    ${
                      slot.enabled
                        ? "selected"
                        : ""
                    }
                  >
                    Available
                  </option>

                  <option
                    value="false"
                    ${
                      !slot.enabled
                        ? "selected"
                        : ""
                    }
                  >
                    Sold out / closed
                  </option>

                </select>

              </div>


              <div
                class="demo-field"
                style="
                  align-self:end
                "
              >

                <button
                  class="
                    demo-btn
                    danger
                  "
                  onclick="
                    HBBDemo.removeSlot(
                      '${slot.id}'
                    )
                  "
                >
                  Remove slot
                </button>

              </div>

            </div>

          </article>
        `
      )
      .join("");
  }


  /* =========================================================
     19. TITLES
  ========================================================= */

const pageTitles = {
  overview:
    "Good day, demo owner.",

  orders:
    "Orders",

  products:
    "My Store",

    inventory:
      "Inventory",

    costing:
      "Costing",

    reviews:
      "Reviews",

    promo:
      "Promo",

    rewards:
      "Rewards",

    availability:
      "Availability",

    notifications:
      "Notifications",

    store:
      "Store Details",

    design:
      "Design",

    help:
      "Help & issues",
  };


  const pageDescriptions = {
    overview:
      "Try running a small home-based business workspace safely.",

    orders:
  "Manage demo orders and try each order status.",

    products:
      "Manage products, prices and customer visibility.",

    inventory:
      "Update stock and set low-stock levels.",

    costing:
      "Edit product costs and see profit margin instantly.",

    reviews:
      "Manage customer reviews, replies and visibility.",

    promo:
      "Create and edit discount codes for your customers.",

    rewards:
      "Choose how customers earn and redeem rewards.",

    availability:
      "Control ordering status and collection slots.",

    notifications:
      "Choose which business alerts you want to receive.",

    store:
      "Manage business contact details, payments and collection information.",

    design:
      "Change the customer-facing wording and storefront appearance.",

    help:
      "Send a clear issue to the Slow Studio owner inbox.",
  };


  /* =========================================================
     20. RENDER ADMIN
  ========================================================= */

  function renderAdmin() {
    const root =
      document.getElementById(
        "demoApp"
      );


    if (!root) {
      return;
    }


    const visibleProducts =
      state.products.filter(
        (item) =>
          item.visible
      );


    const units =
      state.products.reduce(
        (sum, item) =>
          sum +
          Number(
            item.stock || 0
          ),
        0
      );


    const stockValue =
      state.products.reduce(
        (sum, item) =>
          sum +
          Number(
            item.stock || 0
          ) *
          Number(
            item.price || 0
          ),
        0
      );


    const lowStockCount =
      state.products.filter(
        (item) =>
          Number(item.stock) <=
          Number(
            item.lowStockAt || 0
          )
      ).length;


    root.innerHTML = `

      <div class="demo-shell">

        <aside class="demo-side">

          <div class="demo-brand">

            ${esc(
              state.store.name
            )}

            <small>
              Slow Studio HBB demo
            </small>

          </div>


          <div class="demo-badge">
            ${MARKET.country.toUpperCase()}
            · DEMO
          </div>


          <div class="demo-safe">
            This demo stays on this device.
            No Supabase and no real customer data.
          </div>


          <nav class="demo-nav">

            ${NAV
              .map(
                ([key, label]) => `
                  <button
                    class="${
                      panel === key
                        ? "active"
                        : ""
                    }"

                    onclick="
                      HBBDemo.setPanel(
                        '${key}'
                      )
                    "
                  >
                    ${label}
                  </button>
                `
              )
              .join("")}

          </nav>


          <div class="demo-side-bottom">

  <button
    class="demo-btn"
    onclick="HBBDemo.reportIssue()"
  >
    Need Help?
  </button>

  <button
    class="demo-btn danger"
    onclick="HBBDemo.reset()"
  >
    Reset Demo
  </button>

</div>

        </aside>


        <main class="demo-main">

          <header class="demo-top">

            <div>

              <div class="demo-eyebrow">
                ${MARKET.country}
                ·
                ${MARKET.currency}
                ·
                HBB trial workspace
              </div>


              <h1>
                ${
                  pageTitles[
                    panel
                  ] ||
                  "Slow Studio"
                }
              </h1>


              <p>
                ${
                  pageDescriptions[
                    panel
                  ] || ""
                }
              </p>

            </div>


            <div class="demo-actions">

              <a
                class="demo-btn"
                href="${storeHref}"
                target="_blank"
              >
                View demo shop ↗
              </a>


              ${
                panel ===
                "products"
                  ? `
                    <button
                      class="
                        demo-btn
                        primary
                      "
                      onclick="
                        HBBDemo.openProduct()
                      "
                    >
                      + Add product
                    </button>
                  `
                  : ""
              }

            </div>

          </header>


          <!-- ==========================================
               HOME
          =========================================== -->

          <section
            class="
              demo-panel
              ${
                panel ===
                "overview"
                  ? "active"
                  : ""
              }
            "
          >

 ${
    window.HBBDemoDashboard
      ? window.HBBDemoDashboard.panelHtml()
      : `
        <section class="demo-card">
          <p>
            Dashboard is loading...
          </p>
        </section>
      `
  }

</section>

            <div class="demo-kpis">

              <div class="demo-kpi">

                <span>
                  Products
                </span>

                <strong>
                  ${
                    state.products
                      .length
                  }
                </strong>

                <small>
                  ${
                    visibleProducts
                      .length
                  }
                  visible
                </small>

              </div>


              <div class="demo-kpi">

                <span>
                  Units available
                </span>

                <strong>
                  ${units}
                </strong>

                <small>
                  Demo stock only
                </small>

              </div>


              <div class="demo-kpi">

                <span>
                  Stock value
                </span>

                <strong>
                  ${money(
                    stockValue
                  )}
                </strong>

                <small>
                  Price × stock
                </small>

              </div>


              <div class="demo-kpi">

                <span>
                  Low stock
                </span>

                <strong>
                  ${lowStockCount}
                </strong>

                <small>
                  Need attention
                </small>

              </div>

            </div>


            <section class="demo-card">

              <div class="demo-card-head">

                <div>

                  <h2>
                    Workspace overview
                  </h2>

                  <p>
                    Try each area exactly
                    like an HBB owner.
                  </p>

                </div>

              </div>


              <div class="demo-permission-grid">

                ${[
                  [
                    "My Store",
                    "Inventory,
                    "Costing"，
                    "Reviews"，
                    "Promo"，
                    "Rewards"，
                    "Availability",
                    "Notifications"，
                ]
                  .map(
                    ([title, text]) => `
                      <article
                        class="demo-permission"
                      >
                        <h3>
                          ${title}
                        </h3>

                        <p>
                          ${text}
                        </p>
                      </article>
                    `
                  )
                  .join("")}

              </div>

            </section>


            <section class="demo-card">

              <div class="demo-card-head">

                <div>

                  <h2>
                    Recent activity
                  </h2>

                  <p>
                    Saved only on this browser.
                  </p>

                </div>

              </div>


              ${state.activity
                .slice(0, 8)
                .map(
                  (item) => `
                    <div class="demo-activity">

                      <b>
                        ${esc(
                          item.text
                        )}
                      </b>

                      <span>
                        ${fmt(
                          item.at
                        )}
                      </span>

                    </div>
                  `
                )
                .join("")}

            </section>

          </section>


          <!-- ==========================================
               ORDERS
          =========================================== -->

          <section
            class="
              demo-panel
              ${
                panel === "orders"
                  ? "active"
                  : ""
              }
            "
          >
            ${
              window.HBBDemoOrders
                ? window.HBBDemoOrders.panelHtml()
                : `
                  <section class="demo-card">
                    <p>Orders module is loading...</p>
                  </section>
                `
            }
          </section>



          <!-- ==========================================
               PRODUCTS
          =========================================== -->

          <section
            class="
              demo-panel
              ${
                panel ===
                "products"
                  ? "active"
                  : ""
              }
            "
          >

            <section class="demo-card">

              <div class="demo-card-head">

                <div>

                  <h2>
                    Products
                  </h2>

                  <p>
                    ${
                      MARKET.country
                    }
                    prices are shown in
                    ${
                      MARKET.symbol
                    }.
                  </p>

                </div>


                <button
                  class="
                    demo-btn
                    primary
                  "
                  onclick="
                    HBBDemo.openProduct()
                  "
                >
                  + Add product
                </button>

              </div>


              <div class="demo-table-wrap">

                <table class="demo-table">

                  <thead>
                    <tr>
                      <th>
                        Product
                      </th>

                      <th>
                        Price
                      </th>

                      <th>
                        Stock
                      </th>

                      <th>
                        Shop
                      </th>

                      <th>
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    ${productRows()}
                  </tbody>

                </table>

              </div>

            </section>

          </section>


          <!-- ==========================================
               INVENTORY
          =========================================== -->

          <section
            class="
              demo-panel
              ${
                panel ===
                "inventory"
                  ? "active"
                  : ""
              }
            "
          >

            <section class="demo-card">

              <div class="demo-card-head">

                <div>
                  <h2>
                    Inventory
                  </h2>

                  <p>
                    Edit stock directly
                    and choose when Slow
                    Studio should flag a
                    product as low.
                  </p>
                </div>

              </div>


              <div class="demo-table-wrap">

                <table class="demo-table">

                  <thead>
                    <tr>
                      <th>
                        Product
                      </th>

                      <th>
                        Current stock
                      </th>

                      <th>
                        Low stock at
                      </th>

                      <th>
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    ${inventoryRows()}
                  </tbody>

                </table>

              </div>

            </section>

          </section>


          <!-- ==========================================
               COSTING
          =========================================== -->

          <section
            class="
              demo-panel
              ${
                panel ===
                "costing"
                  ? "active"
                  : ""
              }
            "
          >

            <section class="demo-card">

              <div class="demo-card-head">

                <div>
                  <h2>
                    Product costing
                  </h2>

                  <p>
                    Change a cost and
                    Slow Studio recalculates
                    total cost, profit and
                    margin.
                  </p>
                </div>

              </div>


              <div class="demo-table-wrap">

                <table class="demo-table">

                  <thead>
                    <tr>

                      <th>
                        Product
                      </th>

                      <th>
                        Selling
                      </th>

                      <th>
                        Ingredients
                      </th>

                      <th>
                        Packaging
                      </th>

                      <th>
                        Labour
                      </th>

                      <th>
                        Total cost
                      </th>

                      <th>
                        Profit
                      </th>

                      <th>
                        Margin
                      </th>

                    </tr>
                  </thead>

                  <tbody>
                    ${costingRows()}
                  </tbody>

                </table>

              </div>

            </section>

          </section>


          <!-- ==========================================
               REVIEWS
          =========================================== -->

          <section
            class="
              demo-panel
              ${
                panel ===
                "reviews"
                  ? "active"
                  : ""
              }
            "
          >

            <section class="demo-card">

              <div class="demo-card-head">

                <div>
                  <h2>
                    Customer reviews
                  </h2>

                  <p>
                    Reply, edit,
                    publish or hide
                    feedback.
                  </p>
                </div>


                <button
                  class="
                    demo-btn
                    primary
                  "
                  onclick="
                    HBBDemo.addReview()
                  "
                >
                  + Add demo review
                </button>

              </div>

            </section>


            ${reviewCards()}

          </section>


          <!-- ==========================================
               PROMO
          =========================================== -->

          <section
            class="
              demo-panel
              ${
                panel ===
                "promo"
                  ? "active"
                  : ""
              }
            "
          >

            <section class="demo-card">

              <div class="demo-card-head">

                <div>
                  <h2>
                    Promotions
                  </h2>

                  <p>
                    Create percentage or
                    fixed-value promo codes.
                  </p>
                </div>


                <button
                  class="
                    demo-btn
                    primary
                  "
                  onclick="
                    HBBDemo.addPromo()
                  "
                >
                  + New promo
                </button>

              </div>

            </section>


            ${promoCards()}

          </section>


          <!-- ==========================================
               REWARDS
          =========================================== -->

          <section
            class="
              demo-panel
              ${
                panel ===
                "rewards"
                  ? "active"
                  : ""
              }
            "
          >

            <section class="demo-card">

              <div class="demo-card-head">

                <div>
                  <h2>
                    Rewards programme
                  </h2>

                  <p>
                    Let customers earn
                    stamps or points and
                    redeem a reward.
                  </p>
                </div>

              </div>


              <div class="demo-form-grid">

                <div class="demo-field">

                  <label>
                    Rewards status
                  </label>

                  <select
                    onchange="
                      HBBDemo.setReward(
                        'enabled',
                        this.value
                      )
                    "
                  >
                    <option
                      value="true"
                      ${
                        state.rewards
                          .enabled
                          ? "selected"
                          : ""
                      }
                    >
                      Enabled
                    </option>

                    <option
                      value="false"
                      ${
                        !state.rewards
                          .enabled
                          ? "selected"
                          : ""
                      }
                    >
                      Disabled
                    </option>
                  </select>

                </div>


                <div class="demo-field">

                  <label>
                    Reward system
                  </label>

                  <select
                    onchange="
                      HBBDemo.setReward(
                        'mode',
                        this.value
                      )
                    "
                  >

                    <option
                      value="stamps"
                      ${
                        state.rewards
                          .mode ===
                        "stamps"
                          ? "selected"
                          : ""
                      }
                    >
                      Stamps
                    </option>

                    <option
                      value="points"
                      ${
                        state.rewards
                          .mode ===
                        "points"
                          ? "selected"
                          : ""
                      }
                    >
                      Points
                    </option>

                  </select>

                </div>


                <div class="demo-field">

                  <label>
                    Stamps required
                  </label>

                  <input
                    type="number"
                    min="1"

                    value="${
                      Number(
                        state.rewards
                          .stampsRequired
                      )
                    }"

                    onchange="
                      HBBDemo.setReward(
                        'stampsRequired',
                        this.value
                      )
                    "
                  >

                </div>


                <div class="demo-field">

                  <label>
                    Reward value
                    (${MARKET.symbol})
                  </label>

                  <input
                    type="number"
                    min="0"
                    step=".10"

                    value="${
                      Number(
                        state.rewards
                          .rewardValue
                      )
                    }"

                    onchange="
                      HBBDemo.setReward(
                        'rewardValue',
                        this.value
                      )
                    "
                  >

                </div>


                <div class="demo-field">

                  <label>
                    Welcome reward
                  </label>

                  <select
                    onchange="
                      HBBDemo.setReward(
                        'welcomeReward',
                        this.value
                      )
                    "
                  >

                    <option
                      value="true"
                      ${
                        state.rewards
                          .welcomeReward
                          ? "selected"
                          : ""
                      }
                    >
                      On
                    </option>

                    <option
                      value="false"
                      ${
                        !state.rewards
                          .welcomeReward
                          ? "selected"
                          : ""
                      }
                    >
                      Off
                    </option>

                  </select>

                </div>


                <div class="demo-field">

                  <label>
                    Birthday reward
                  </label>

                  <select
                    onchange="
                      HBBDemo.setReward(
                        'birthdayReward',
                        this.value
                      )
                    "
                  >

                    <option
                      value="true"
                      ${
                        state.rewards
                          .birthdayReward
                          ? "selected"
                          : ""
                      }
                    >
                      On
                    </option>

                    <option
                      value="false"
                      ${
                        !state.rewards
                          .birthdayReward
                          ? "selected"
                          : ""
                      }
                    >
                      Off
                    </option>

                  </select>

                </div>

              </div>


              <div class="demo-note">

                Example:
                after
                ${
                  state.rewards
                    .stampsRequired
                }
                stamps,
                customer can redeem
                ${money(
                  state.rewards
                    .rewardValue
                )}.

              </div>

            </section>

          </section>


          <!-- ==========================================
               AVAILABILITY
          =========================================== -->

          <section
            class="
              demo-panel
              ${
                panel ===
                "availability"
                  ? "active"
                  : ""
              }
            "
          >

            <section class="demo-card">

              <div class="demo-card-head">

                <div>
                  <h2>
                    Ordering availability
                  </h2>

                  <p>
                    Open or close ordering
                    and control collection
                    slots.
                  </p>
                </div>


                <button
                  class="
                    demo-btn
                    primary
                  "
                  onclick="
                    HBBDemo.addSlot()
                  "
                >
                  + Add slot
                </button>

              </div>


              <div class="demo-form-grid">

                <div class="demo-field">

                  <label>
                    Ordering
                  </label>

                  <select
                    onchange="
                      HBBDemo.setAvailability(
                        'orderingOpen',
                        this.value
                      )
                    "
                  >

                    <option
                      value="true"
                      ${
                        state.availability
                          .orderingOpen
                          ? "selected"
                          : ""
                      }
                    >
                      Open
                    </option>

                    <option
                      value="false"
                      ${
                        !state.availability
                          .orderingOpen
                          ? "selected"
                          : ""
                      }
                    >
                      Closed
                    </option>

                  </select>

                </div>


                <div class="demo-field">

                  <label>
                    Pre-order window
                  </label>

                  <input
                    type="number"
                    min="0"

                    value="${
                      Number(
                        state.availability
                          .preorderDays
                      )
                    }"

                    onchange="
                      HBBDemo.setAvailability(
                        'preorderDays',
                        this.value
                      )
                    "
                  >

                </div>


                <div class="demo-field">

                  <label>
                    Default slot capacity
                  </label>

                  <input
                    type="number"
                    min="1"

                    value="${
                      Number(
                        state.availability
                          .maxOrdersPerSlot
                      )
                    }"

                    onchange="
                      HBBDemo.setAvailability(
                        'maxOrdersPerSlot',
                        this.value
                      )
                    "
                  >

                </div>

              </div>

            </section>


            ${slotCards()}

          </section>


<!-- ==========================================
     EMAIL NOTIFICATIONS
========================================== -->

<section
  class="demo-panel ${panel==='notifications'?'active':''}"
>

  <section class="demo-card">

    <div class="demo-card-head">

      <div>

        <h2>Email Notifications</h2>

        <p>
          Preview how Slow Studio automatically keeps
          business owners and customers updated.
          Demo mode only — no emails will actually be sent.
        </p>

      </div>

    </div>

    <div class="demo-email-list">

      <!-- New Order -->

      <article class="demo-email-item">

        <div class="demo-email-copy">

          <h3>📧 New Order Received</h3>

          <p>
            When a customer places an order,
            the business owner automatically
            receives an email notification.
          </p>

        </div>

        <button
          class="demo-btn"
          onclick="alert('Demo only.\n\nThis is a preview of the email that would be sent to the business owner.')"
        >
          View Sample Email
        </button>

      </article>


      <!-- Order Confirmed -->

      <article class="demo-email-item">

        <div class="demo-email-copy">

          <h3>📧 Order Confirmed</h3>

          <p>
            Once the owner clicks
            <b>Confirm Order</b>,
            the customer automatically
            receives an order confirmation email.
          </p>

        </div>

        <button
          class="demo-btn"
          onclick="alert('Demo only.\n\nCustomer receives:\\n\\nSubject: Your order has been confirmed.')"
        >
          View Sample Email
        </button>

      </article>


      <!-- Ready -->

      <article class="demo-email-item">

        <div class="demo-email-copy">

          <h3>📧 Ready for Collection</h3>

          <p>
            Once the owner clicks
            <b>Ready for Collection</b>,
            the customer receives an email letting them know
            their order is ready for collection.
          </p>

        </div>

        <button
          class="demo-btn"
          onclick="alert('Demo only.\n\nCustomer receives:\\n\\nSubject: Your order is ready for collection!')"
        >
          View Sample Email
        </button>

      </article>

    </div>

    <div class="demo-note">

      <strong>Email Flow</strong>

      <br><br>

      Customer places order

      <br>↓

      📧 Business owner receives
      <b>New Order</b>

      <br><br>

      Owner clicks
      <b>Confirm Order</b>

      <br>↓

      📧 Customer receives
      <b>Order Confirmed</b>

      <br><br>

      Owner clicks
      <b>Ready for Collection</b>

      <br>↓

      📧 Customer receives
      <b>Ready for Collection</b>

      <br><br>

      <small>
        Demo preview only.
        No emails are actually sent.
      </small>

    </div>

  </section>

</section>

          <!-- ==========================================
               STORE DETAILS
          =========================================== -->

          <section
            class="
              demo-panel
              ${
                panel ===
                "store"
                  ? "active"
                  : ""
              }
            "
          >

            <section class="demo-card">

              <div class="demo-card-head">

                <div>
                  <h2>
                    Store details
                  </h2>

                  <p>
                    Business information
                    shown throughout your
                    workspace and storefront.
                  </p>
                </div>

              </div>


              <div class="demo-form-grid">

                <div class="demo-field">

                  <label>
                    Store name
                  </label>

                  <input
                    value="${esc(
                      state.store.name
                    )}"

                    onchange="
                      HBBDemo.setStore(
                        'name',
                        this.value
                      )
                    "
                  >

                </div>


                <div class="demo-field">

                  <label>
                    Country
                  </label>

                  <input
                    value="${esc(
                      MARKET.country
                    )}"
                    disabled
                  >

                </div>


                <div class="demo-field">

                  <label>
                    Currency
                  </label>

                  <input
                    value="
                      ${
                        MARKET.currency
                      }
                      ·
                      ${
                        MARKET.symbol
                      }
                    "
                    disabled
                  >

                </div>


                <div class="demo-field">

                  <label>
                    Email
                  </label>

                  <input
                    type="email"

                    value="${esc(
                      state.store.email
                    )}"

                    onchange="
                      HBBDemo.setStore(
                        'email',
                        this.value
                      )
                    "
                  >

                </div>


                <div class="demo-field">

                  <label>
                    Phone
                  </label>

                  <input
                    value="${esc(
                      state.store.phone
                    )}"

                    onchange="
                      HBBDemo.setStore(
                        'phone',
                        this.value
                      )
                    "
                  >

                </div>


               <div
  class="
    demo-field
    wide
  "
>

  <label>
    Hero Banner
  </label>

  <div
    class="
      demo-hero-image-editor
    "
  >

    <div
      class="
        demo-hero-image-preview
      "
    >

      <img
        id="heroImagePreview"
        alt="Homepage hero preview"
        hidden
      >

      <div
        id="heroImageEmpty"
        class="
          demo-hero-image-empty
        "
      >
        No hero image yet
      </div>

    </div>


    <div
      class="demo-actions"
    >

      <label
        class="
          demo-btn
          primary
        "
      >
        Upload Hero

        <input
          type="file"
          accept="image/*"
          hidden
          onchange="
            HBBDemo.uploadHeroImage(
              this
            )
          "
        >
      </label>


      <button
        id="removeHeroImageButton"
        type="button"
        class="
          demo-btn
          danger
        "
        hidden
        onclick="
          HBBDemo.removeHeroImage()
        "
      >
        Remove
      </button>

    </div>

    <small>
      Recommended:
      landscape image,
      around 1600 × 800px.
    </small>

  </div>

</div>

                  <label>
                    Collection note
                  </label>

                  <textarea
                    rows="3"

                    onchange="
                      HBBDemo.setStore(
                        'pickupNote',
                        this.value
                      )
                    "
                  >${esc(
                    state.store
                      .pickupNote
                  )}</textarea>

                </div>

              </div>


              <div
                class="demo-note"
                style="
                  margin-top:18px
                "
              >

                <b>
                  Payment methods
                </b>

                <div
                  class="demo-actions"
                  style="
                    margin-top:12px
                  "
                >

                  ${MARKET.payments
                    .map(
                      (method) => `
                        <label>

                          <input
                            type="checkbox"

                            ${
                              state.store
                                .paymentMethods
                                .includes(
                                  method
                                )
                                ? "checked"
                                : ""
                            }

                            onchange="
                              HBBDemo.togglePayment(
                                '${esc(
                                  method
                                )}',
                                this.checked
                              )
                            "
                          >

                          ${esc(method)}

                        </label>
                      `
                    )
                    .join("")}

                </div>

              </div>

            </section>

          </section>


          <!-- ==========================================
               DESIGN
          =========================================== -->

          <section
            class="
              demo-panel
              ${
                panel ===
                "design"
                  ? "active"
                  : ""
              }
            "
          >

            <section class="demo-card">

              <div class="demo-card-head">

                <div>
                  <h2>
                    Storefront design
                  </h2>

                  <p>
                    Edit customer-facing
                    content without touching
                    the product data.
                  </p>
                </div>

              </div>


              <div class="demo-form-grid">

                <div
                  class="
                    demo-field
                    wide
                  "
                >

                  <label>
                    Tagline
                  </label>

                  <textarea
                    rows="3"
                    
<hr>                  

<h3>Homepage</h3>

<div class="demo-form-grid">

  <div class="demo-field wide">

    <label>
      Homepage Heading
    </label>

    <input
      value="${esc(state.store.bannerHeading || '')}"
      onchange="
        HBBDemo.setStore(
          'bannerHeading',
          this.value
        )
      "
    >

  </div>

  <div class="demo-field wide">

    <label>
      Homepage Subtitle
    </label>

    <textarea
      rows="2"
      onchange="
        HBBDemo.setStore(
          'bannerSubtitle',
          this.value
        )
      "
    >${esc(state.store.bannerSubtitle || '')}</textarea>

  </div>

  <div class="demo-field">

    <label>
      Button Text
    </label>

    <input
      value="${esc(state.store.bannerButton || '')}"
      onchange="
        HBBDemo.setStore(
          'bannerButton',
          this.value
        )
      "
    >

  </div>

  <div class="demo-field">

    <label>
      Announcement
    </label>

    <input
      value="${esc(state.store.announcement || '')}"
      onchange="
        HBBDemo.setStore(
          'announcement',
          this.value
        )
      "
    >

  </div>

</div>

                    onchange="
                      HBBDemo.setStore(
                        'tagline',
                        this.value
                      )
                    "
                  >${esc(
                    state.store.tagline
                  )}</textarea>

                </div>


                <div class="demo-field">

                  <label>
                    Website status
                  </label>

                  <select
                    onchange="
                      HBBDemo.setStore(
                        'visibility',
                        this.value
                      )
                    "
                  >

                    <option
                      value="live"
                      ${
                        state.store
                          .visibility ===
                        "live"
                          ? "selected"
                          : ""
                      }
                    >
                      Live
                    </option>

                    <option
                      value="hidden"
                      ${
                        state.store
                          .visibility ===
                        "hidden"
                          ? "selected"
                          : ""
                      }
                    >
                      Hidden
                    </option>

                  </select>

                </div>


                <div class="demo-field">

                  <label>
                    Theme
                  </label>

                  <select
                    onchange="
                      HBBDemo.setStore(
                        'theme',
                        this.value
                      )
                    "
                  >

                    <option
                      value="warm"
                      ${
                        state.store
                          .theme ===
                        "warm"
                          ? "selected"
                          : ""
                      }
                    >
                      Warm minimal
                    </option>

                    <option
                      value="light"
                      ${
                        state.store
                          .theme ===
                        "light"
                          ? "selected"
                          : ""
                      }
                    >
                      Clean light
                    </option>

                    <option
                      value="dark"
                      ${
                        state.store
                          .theme ===
                        "dark"
                          ? "selected"
                          : ""
                      }
                    >
                      Dark
                    </option>

                  </select>

                </div>


                <div class="demo-field">

                  <label>
                    Font style
                  </label>

                  <select
                    onchange="
                      HBBDemo.setStore(
                        'font',
                        this.value
                      )
                    "
                  >

                    <option
                      value="clean"
                      ${
                        state.store
                          .font ===
                        "clean"
                          ? "selected"
                          : ""
                      }
                    >
                      Clean
                    </option>

                    <option
                      value="editorial"
                      ${
                        state.store
                          .font ===
                        "editorial"
                          ? "selected"
                          : ""
                      }
                    >
                      Editorial
                    </option>

                    <option
                      value="soft"
                      ${
                        state.store
                          .font ===
                        "soft"
                          ? "selected"
                          : ""
                      }
                    >
                      Soft
                    </option>

                  </select>

                </div>

              </div>

            </section>

          </section>


          <!-- ==========================================
               HELP
          =========================================== -->

          <section
            class="
              demo-panel
              ${
                panel ===
                "help"
                  ? "active"
                  : ""
              }
            "
          >

            <section class="demo-card">

              <div class="demo-card-head">

                <div>
                  <h2>
                    Report an issue
                  </h2>

                  <p>
                   Send feedback directly to the Slow Studio support team.
                  </p>
                </div>


                <button
                  class="
                    demo-btn
                    primary
                  "
                  onclick="
                    HBBDemo.reportIssue()
                  "
                >
                  Report issue
                </button>

              </div>

            </section>

          </section>

        </main>

      </div>


      <!-- ==========================================
           PRODUCT DIALOG
      =========================================== -->

      <dialog id="productDialog">

        <div class="demo-dialog">

          <h2>
            ${
              productDraft?.id
                ? "Edit product"
                : "Add product"
            }
          </h2>


          <div class="demo-form-grid">

           <div
  class="
    demo-field
    wide
  "
>

  <label>
    Product photo
  </label>

  <div
    class="
      demo-product-image-editor
    "
  >

    <div
      class="
        demo-product-image-preview
      "
    >

      <img
        id="productImagePreview"
        alt="Product preview"
        hidden
      >

      <div
        id="productImageEmpty"
        class="
          demo-product-image-empty
        "
      >
        No photo yet
      </div>

    </div>

    <div
      class="demo-actions"
    >

      <label
        class="
          demo-btn
          primary
        "
      >
        Upload photo

        <input
          type="file"
          accept="image/*"
          hidden
          onchange="
            HBBDemo.uploadProductImage(
              this
            )
          "
        >
      </label>

      <button
        id="removeProductImageButton"
        type="button"
        class="
          demo-btn
          danger
        "
        hidden
        onclick="
          HBBDemo.removeProductImage()
        "
      >
        Remove photo
      </button>

    </div>

    <small>
      JPG, PNG or mobile photo.
      Maximum 12MB.
    </small>

  </div>

</div>

              <label>
                Product name
              </label>

              <input
                value="${esc(
                  productDraft
                    ?.name || ""
                )}"

                oninput="
                  HBBDemo.productDraftField(
                    'name',
                    this.value
                  )
                "
              >

            </div>


            <div class="demo-field">

              <label>
                Category
              </label>

              <input
                value="${esc(
                  productDraft
                    ?.category ||
                  "Bakes"
                )}"

                oninput="
                  HBBDemo.productDraftField(
                    'category',
                    this.value
                  )
                "
              >

            </div>


            <div class="demo-field">

              <label>
                Price
                (${MARKET.symbol})
              </label>

              <input
                type="number"
                min="0"
                step=".10"

                value="${
                  Number(
                    productDraft
                      ?.price || 0
                  )
                }"

                oninput="
                  HBBDemo.productDraftField(
                    'price',
                    this.value
                  )
                "
              >

            </div>


            <div class="demo-field">

              <label>
                Stock
              </label>

              <input
                type="number"
                min="0"

                value="${
                  Number(
                    productDraft
                      ?.stock || 0
                  )
                }"

                oninput="
                  HBBDemo.productDraftField(
                    'stock',
                    this.value
                  )
                "
              >

            </div>


            <div class="demo-field">

              <label>
                Low stock warning
              </label>

              <input
                type="number"
                min="0"

                value="${
                  Number(
                    productDraft
                      ?.lowStockAt ||
                    0
                  )
                }"

                oninput="
                  HBBDemo.productDraftField(
                    'lowStockAt',
                    this.value
                  )
                "
              >

            </div>


            <div class="demo-field">

              <label>
                Customer shop
              </label>

              <select
                onchange="
                  HBBDemo.productDraftField(
                    'visible',
                    this.value
                  )
                "
              >

                <option
                  value="true"
                  ${
                    productDraft
                      ?.visible !==
                    false
                      ? "selected"
                      : ""
                  }
                >
                  Visible
                </option>

                <option
                  value="false"
                  ${
                    productDraft
                      ?.visible ===
                    false
                      ? "selected"
                      : ""
                  }
                >
                  Hidden
                </option>

              </select>

            </div>

          </div>


          <div
            class="demo-actions"
            style="
              margin-top:20px
            "
          >

            <button
              class="demo-btn"
              onclick="
                this
                  .closest('dialog')
                  .close()
              "
            >
              Cancel
            </button>


            <button
              class="
                demo-btn
                primary
              "
              onclick="
                HBBDemo.saveProduct()
              "
            >
              Save product
            </button>

          </div>

        </div>

      </dialog>


      <!-- ==========================================
           ISSUE DIALOG
      =========================================== -->

      <dialog id="issueDialog">

        <div class="demo-dialog">

          <h2>
            Report an issue
          </h2>


          <div class="demo-form-grid">

            <div class="demo-field">

              <label>
                Page
              </label>

              <select id="issuePage">

                ${NAV
                  .filter(
                    ([key]) =>
                      key !==
                      "overview"
                  )
                  .map(
                    ([, label]) => `
                      <option>
                        ${label}
                      </option>
                    `
                  )
                  .join("")}

              </select>

            </div>


            <div class="demo-field">

              <label>
                Short title
              </label>

              <input
                id="issueTitle"

                placeholder="
                  What is not working?
                "
              >

            </div>


            <div
              class="
                demo-field
                wide
              "
            >

              <label>
                What happened?
              </label>

              <textarea
                id="issueDetail"

                rows="5"

                placeholder="
                  Tell Slow Studio
                  what you clicked
                  and what you expected.
                "
              ></textarea>

            </div>

          </div>


          <div
            class="demo-actions"
            style="
              margin-top:20px
            "
          >

            <button
              class="demo-btn"

              onclick="
                this
                  .closest('dialog')
                  .close()
              "
            >
              Cancel
            </button>


            <button
              class="
                demo-btn
                primary
              "

              onclick="
                HBBDemo.submitIssue()
              "
            >
              Send to owner inbox
            </button>

          </div>

        </div>

      </dialog>
    `;
  }


  /* =========================================================
     21. CUSTOMER STORE
  ========================================================= */

  function renderStore() {
    const root =
      document.getElementById(
        "demoStore"
      );


    if (!root) {
      return;
    }


    if (
      state.store.visibility !==
      "live"
    ) {
      root.innerHTML = `
        <main class="store-hidden">

          <article>

            <div class="store-demo-pill">
              DEMO WEBSITE HIDDEN
            </div>

            <h1>
              We’ll be back soon.
            </h1>

            <p>
              ${esc(
                state.store.name
              )}
              is preparing its
              next opening.
            </p>

          </article>

        </main>
      `;

      return;
    }


    const products =
      state.products.filter(
        (item) =>
          item.visible
      );


    const activePromos =
      state.promos.filter(
        (promo) =>
          promo.active
      );


    root.innerHTML = `

      <header class="store-top">

        <div class="store-brand">
          ${esc(
            state.store.name
          )}
        </div>


        <span class="store-demo-pill">

          ${MARKET.country.toUpperCase()}
          ·
          DEMO
          ·
          NO CHECKOUT

        </span>

      </header>


      <section class="store-hero">

        <div class="demo-eyebrow">
          Small-batch HBB demo
        </div>

        <h1>
          Made for slow mornings.
        </h1>

        <p>
          ${esc(
            state.store.tagline
          )}
        </p>

      </section>


      ${
        activePromos.length
          ? `
            <section
              class="demo-card"
              style="
                max-width:1100px;
                margin:0 auto 28px;
              "
            >

              <b>
                Current offer
              </b>

              <p>
                Use
                <strong>
                  ${esc(
                    activePromos[0]
                      .code
                  )}
                </strong>
                ·
                ${
                  activePromos[0]
                    .type ===
                  "percentage"
                    ? `${
                        activePromos[0]
                          .value
                      }% off`
                    : `${money(
                        activePromos[0]
                          .value
                      )} off`
                }
              </p>

            </section>
          `
          : ""
      }


      <section class="store-grid">

        ${
          products
            .map(
              (item) => `
                <article
                  class="store-product"
                >

                  <div
                    class="
                      store-product-photo
                    "
                  >
                    ${esc(
                      item.name.slice(
                        0,
                        1
                      )
                    )}
                  </div>


                  <div
                    class="
                      store-product-copy
                    "
                  >

                    <h2>
                      ${esc(
                        item.name
                      )}
                    </h2>

                    <p>
                      ${esc(
                        item.category
                      )}
                      ·
                      ${Number(
                        item.stock
                      )}
                      available
                    </p>

                    <span
                      class="store-price"
                    >
                      ${money(
                        item.price
                      )}
                    </span>

                  </div>

                </article>
              `
            )
            .join("")

          ||

          `
            <div class="store-empty">
              No visible products yet.
            </div>
          `
        }

      </section>


      <section
        class="demo-card"
        style="
          max-width:1100px;
          margin:32px auto;
        "
      >

        <h2>
          Store information
        </h2>

        <p>
          ${esc(
            state.store.pickupNote
          )}
        </p>

        <p>
          Payment:
          ${state.store
            .paymentMethods
            .map(esc)
            .join(" · ")}
        </p>

      </section>
    `;
  }


  /* =========================================================
     22. PUBLIC FUNCTIONS
  ========================================================= */

 /* =========================================================
   DEMO MODULE BRIDGE
   Shared by SG + MY external modules
========================================================= */

window.HBBDemoContext = {
  get market() {
    return DEMO_MARKET;
  },

  get marketConfig() {
    return MARKET;
  },

  get state() {
    return state;
  },

  save() {
    save();
  },

  money(value) {
    return money(value);
  },

  uid(prefix) {
    return uid(prefix);
  },

  activity(text) {
    activity(text);
  },

  refresh() {
    renderAdmin();
    renderStore();
  },

  refreshAdmin() {
    renderAdmin();
  },

  refreshStore() {
    renderStore();
  },

  get storageKey() {
    return KEY;
  }
}; 
  
  window.HBBDemo = {
    setPanel,

    setStore,
    togglePayment,

    openProduct,
    productDraftField,

    uploadProductImage,
    removeProductImage,

    uploadHeroImage,
    removeHeroImage,

    saveProduct,

    saveProduct,
    removeProduct,

    updateInventory,

    updateCosting,

    addReview,
    updateReview,
    removeReview,

    addPromo,
    updatePromo,
    removePromo,

    setReward,

    setAvailability,
    addSlot,
    updateSlot,
    removeSlot,

    setNotification,

    reset,

    reportIssue,
    submitIssue,
  };


  /* =========================================================
     23. START
  ========================================================= */

  save();

  renderAdmin();

  renderStore();

})();
