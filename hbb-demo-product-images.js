(() => {
  const ctx = window.HBBDemoContext;

  if (!ctx) {
    console.error("HBBDemoContext is required before loading product images module.");
    return;
  }

  const market = ctx.market;
  const DB_NAME = `slow-studio-demo-images-${String(market).toLowerCase()}`;
  const DB_VERSION = 1;
  const STORE_NAME = "productImages";

  let dbPromise = null;
  let previewUrl = "";
  let pendingBlob = null;

  const urlCache = new Map();

  function openDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return dbPromise;
  }

  async function putImage(productId, blob) {
    if (!productId || !blob) return;

    const db = await openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(blob, productId);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getImage(productId) {
    if (!productId) return null;

    const db = await openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(productId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function deleteImage(productId) {
    if (!productId) return;

    const db = await openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(productId);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function clearAll() {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();

      tx.oncomplete = () => {
        urlCache.forEach((url) => {
          if (url) URL.revokeObjectURL(url);
        });

        urlCache.clear();
        resolve();
      };

      tx.onerror = () => reject(tx.error);
    });
  }

  async function compress(file) {
    const MAX_SIZE = 1400;
    const QUALITY = 0.82;

    const image = await createImageBitmap(file);

    let width = image.width;
    let height = image.height;

    if (width > MAX_SIZE || height > MAX_SIZE) {
      const scale = Math.min(
        MAX_SIZE / width,
        MAX_SIZE / height
      );

      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    context.drawImage(
      image,
      0,
      0,
      width,
      height
    );

    image.close?.();

    const blob = await new Promise((resolve) => {
      canvas.toBlob(
        resolve,
        "image/jpeg",
        QUALITY
      );
    });

    if (!blob) {
      throw new Error("Could not prepare image.");
    }

    return blob;
  }

  async function choose(input) {
    const file = input?.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      input.value = "";
      alert("Please choose an image file.");
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      input.value = "";
      alert("Please choose an image smaller than 12MB.");
      return;
    }

    try {
      pendingBlob = await compress(file);

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      previewUrl = URL.createObjectURL(pendingBlob);

      const preview = document.getElementById("productImagePreview");
      const empty = document.getElementById("productImageEmpty");
      const removeButton = document.getElementById("removeProductImageButton");

      if (preview) {
        preview.src = previewUrl;
        preview.hidden = false;
      }

      if (empty) {
        empty.hidden = true;
      }

      if (removeButton) {
        removeButton.hidden = false;
      }

    } catch (error) {
      console.error(error);
      alert("Could not prepare this photo.");
    }
  }

  async function savePending(productId) {
    if (!pendingBlob || !productId) return;

    await putImage(productId, pendingBlob);

    const oldUrl = urlCache.get(productId);

    if (oldUrl) {
      URL.revokeObjectURL(oldUrl);
    }

    urlCache.delete(productId);

    pendingBlob = null;

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = "";
    }
  }

  async function getImageUrl(productId) {
    if (!productId) return "";

    if (urlCache.has(productId)) {
      return urlCache.get(productId) || "";
    }

    const blob = await getImage(productId);

    if (!blob) {
      urlCache.set(productId, "");
      return "";
    }

    const url = URL.createObjectURL(blob);

    urlCache.set(productId, url);

    return url;
  }

  async function loadPreview(productId) {
    pendingBlob = null;

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = "";
    }

    if (!productId) return "";

    const url = await getImageUrl(productId);

    previewUrl = url || "";

    return previewUrl;
  }

  async function remove(productId) {
    pendingBlob = null;

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = "";
    }

    if (productId) {
      await deleteImage(productId);

      const cached = urlCache.get(productId);

      if (cached) {
        URL.revokeObjectURL(cached);
      }

      urlCache.delete(productId);
    }

    const preview = document.getElementById("productImagePreview");
    const empty = document.getElementById("productImageEmpty");
    const removeButton = document.getElementById("removeProductImageButton");

    if (preview) {
      preview.hidden = true;
      preview.removeAttribute("src");
    }

    if (empty) {
      empty.hidden = false;
    }

    if (removeButton) {
      removeButton.hidden = true;
    }
  }

  window.HBBDemoProductImages = {
    choose,
    savePending,
    loadPreview,
    getImageUrl,
    remove,
    clearAll
  };
})();
