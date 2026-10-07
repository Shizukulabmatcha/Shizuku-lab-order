(() => {
  const cards = [
    { market: "Brand", title: "Brand Website", caption: "Open the Shizuku Lab brand website.", url: "/shizuku-website.html" },
    { market: "Malaysia", title: "Malaysia Admin", caption: "Manage Malaysia orders, products and MYR settings.", url: "/workspace/shizuku-lab-my?market=MY" },
    { market: "Malaysia", title: "Malaysia Store", caption: "Open the live Malaysia customer store in MYR.", url: "/my" },
    { market: "Singapore", title: "Singapore Admin", caption: "Manage Singapore orders, products and SGD settings.", url: "/workspace/shizuku-lab-sg?market=SG" },
    { market: "Singapore", title: "Singapore Store", caption: "Open the live Singapore customer store in SGD.", url: "/" },
    { market: "Demo", title: "Malaysia Demo", caption: "Explore the Malaysia workflow with local demo data.", url: "/demo/malaysia/" },
    { market: "Demo", title: "Singapore Demo", caption: "Explore the Singapore workflow with local demo data.", url: "/demo/singapore/" }
  ];
  const entries = document.getElementById("entries");
  entries.innerHTML = cards.map((card) => `<article class="card"><div class="card-market">${card.market}</div><h2>${card.title}</h2><p>${card.caption}</p><a class="open" href="${card.url}">Open →</a></article>`).join("");
})();
