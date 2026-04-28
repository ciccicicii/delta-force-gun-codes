const API_DATA_PATH = "/api/data";
const STATIC_DATA_PATH = "./三角洲改枪码_步枪_全网合并.json";

const PRICE_TIERS = [
  { id: "all", label: "全部预算", predicate: () => true },
  { id: "budget", label: "20万内", predicate: (item) => item.hasPrice && item.priceValue <= 20 },
  { id: "value", label: "20-40万", predicate: (item) => item.hasPrice && item.priceValue > 20 && item.priceValue <= 40 },
  { id: "premium", label: "40-70万", predicate: (item) => item.hasPrice && item.priceValue > 40 && item.priceValue <= 70 },
  { id: "elite", label: "70万+", predicate: (item) => item.hasPrice && item.priceValue > 70 },
  { id: "unknown", label: "价格待补", predicate: (item) => !item.hasPrice }
];

const WEAPON_TYPE_OPTIONS = [
  { id: "all", label: "全部" },
  { id: "rifle", label: "步枪" },
  { id: "smg", label: "冲锋枪" },
  { id: "sniper", label: "狙击枪" },
  { id: "shotgun", label: "霰弹枪" },
  { id: "mg", label: "机枪" },
  { id: "other", label: "其他" }
];

const state = {
  items: [],
  search: "",
  weaponType: "all",
  weapon: "all",
  source: "all",
  tier: "all",
  includeUnknown: false,
  canWrite: false,
  dataMode: "static"
};

const elements = {
  syncDate: document.querySelector("#syncDate"),
  heroStats: document.querySelector("#heroStats"),
  openUploadModal: document.querySelector("#openUploadModal"),
  closeUploadModal: document.querySelector("#closeUploadModal"),
  uploadModal: document.querySelector("#uploadModal"),
  uploadModalBackdrop: document.querySelector("#uploadModalBackdrop"),
  uploadForm: document.querySelector("#uploadForm"),
  uploadStatus: document.querySelector("#uploadStatus"),
  uploadNote: document.querySelector("#uploadNote"),
  uploadReset: document.querySelector("#uploadReset"),
  uploadWeaponTypeSelect: document.querySelector("#uploadWeaponTypeSelect"),
  uploadWeaponSelect: document.querySelector("#uploadWeaponSelect"),
  uploadBuildCode: document.querySelector("#uploadBuildCode"),
  uploadDescription: document.querySelector("#uploadDescription"),
  uploadPrice: document.querySelector("#uploadPrice"),
  searchInput: document.querySelector("#searchInput"),
  weaponTypeFilter: document.querySelector("#weaponTypeFilter"),
  weaponSelect: document.querySelector("#weaponSelect"),
  sourceSelect: document.querySelector("#sourceSelect"),
  includeUnknown: document.querySelector("#includeUnknown"),
  tierFilter: document.querySelector("#tierFilter"),
  weaponRanking: document.querySelector("#weaponRanking"),
  budgetAdvice: document.querySelector("#budgetAdvice"),
  resultSummary: document.querySelector("#resultSummary"),
  results: document.querySelector("#results"),
  emptyState: document.querySelector("#emptyState"),
  clearFilters: document.querySelector("#clearFilters"),
  randomPick: document.querySelector("#randomPick"),
  template: document.querySelector("#resultCardTemplate")
};

const customSelects = {};

init();

async function init() {
  bindControls();
  renderUploadWeaponTypeSelect();
  renderTierFilter();
  renderWeaponTypeFilter();
  await loadItems();
}

function bindControls() {
  elements.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    renderResults();
  });

  elements.includeUnknown.addEventListener("change", (event) => {
    state.includeUnknown = event.target.checked;
    populateWeaponOptions();
    renderSidebar();
    renderResults();
  });

  elements.clearFilters.addEventListener("click", () => {
    state.search = "";
    state.weaponType = "all";
    state.weapon = "all";
    state.source = "all";
    state.tier = "all";
    state.includeUnknown = false;
    elements.searchInput.value = "";
    syncWeaponTypeButtons();
    setCustomSelectValue("weaponSelect", "all");
    setCustomSelectValue("sourceSelect", "all");
    elements.includeUnknown.checked = false;
    syncTierButtons();
    populateWeaponOptions();
    renderSidebar();
    renderResults();
  });

  elements.randomPick.addEventListener("click", () => {
    const filtered = getFilteredItems();
    if (!filtered.length) {
      return;
    }

    const randomItem = filtered[Math.floor(Math.random() * filtered.length)];
    state.search = randomItem.weaponName.toLowerCase();
    elements.searchInput.value = randomItem.weaponName;
    renderResults();
    document.querySelector("#codes")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  elements.openUploadModal.addEventListener("click", () => {
    openUploadModal();
  });

  elements.closeUploadModal.addEventListener("click", () => {
    closeUploadModal();
  });

  elements.uploadModalBackdrop.addEventListener("click", () => {
    closeUploadModal();
  });

  elements.uploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitUpload();
  });

  elements.uploadReset.addEventListener("click", () => {
    resetUploadForm();
    setUploadStatus("未提交", false);
  });

  document.addEventListener("click", (event) => {
    Object.values(customSelects).forEach((instance) => {
      if (!instance.root.contains(event.target)) {
        instance.root.classList.remove("open");
        instance.menu.hidden = true;
        instance.trigger.setAttribute("aria-expanded", "false");
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      Object.values(customSelects).forEach((instance) => {
        instance.root.classList.remove("open");
        instance.menu.hidden = true;
        instance.trigger.setAttribute("aria-expanded", "false");
      });
      closeUploadModal();
    }
  });
}

async function loadItems() {
  const dataSources = [
    { path: API_DATA_PATH, mode: "api" },
    { path: STATIC_DATA_PATH, mode: "static" }
  ];

  try {
    let rawItems = null;

    for (const source of dataSources) {
      const response = await fetch(source.path, { cache: "no-store" });
      if (!response.ok) {
        continue;
      }

      rawItems = await response.json();
      state.canWrite = source.mode === "api";
      state.dataMode = source.mode;
      break;
    }

    if (!rawItems) {
      throw new Error("无法读取数据源");
    }

    state.items = rawItems.map(normalizeItem).sort((a, b) => a.priceValue - b.priceValue);
    syncUploadAvailability();
    renderOverview();
    renderFilters();
    renderUploadWeaponSelect();
    renderSidebar();
    renderResults();
  } catch (error) {
    elements.resultSummary.textContent = "数据读取失败，请确认本地服务已启动。";
    syncUploadAvailability();
    console.error(error);
  }
}

function syncUploadAvailability() {
  if (state.canWrite) {
    elements.openUploadModal.disabled = false;
    elements.openUploadModal.title = "";
    elements.uploadNote.textContent = "当前版本会直接写入项目 JSON，提交后会立即并入当前列表。";
    if (elements.uploadStatus.textContent === "Pages 公开站点为只读模式，请在本地服务中上传。") {
      setUploadStatus("未提交", false);
    }
    return;
  }

  elements.openUploadModal.disabled = true;
  elements.openUploadModal.title = "GitHub Pages 只支持查询，不支持直接写入 JSON。";
  elements.uploadNote.textContent = "GitHub Pages 为只读模式。要上传改枪码，请在本地运行 server.py 后访问 127.0.0.1:8001。";
  setUploadStatus("Pages 公开站点为只读模式，请在本地服务中上传。", false);
}

function normalizeItem(item) {
  const priceLabel = String(item["枪械价格"] || "未知").trim();
  const priceValue = Number.parseInt(priceLabel, 10) || 0;
  const description = String(item["改装描述"] || "无描述").trim();
  const rawWeaponName = String(item["枪械名称"] || "未知武器").trim();
  const source = String(item["来源"] || "aitags").trim();
  const reviewStatus = String(item["审核状态"] || (source === "user_upload" ? "pending" : "approved")).trim();
  const itemId = String(item["ID"] || buildItemId(rawWeaponName, String(item["改枪码"] || "").trim(), source)).trim();
  const isUnknownWeapon = rawWeaponName === "待识别" || rawWeaponName === "待识别 其他" || rawWeaponName === "待识别/其他";
  const weaponType = String(item["武器大类"] || "").trim() || detectWeaponType(rawWeaponName);
  const canonicalWeaponName = isUnknownWeapon ? "待识别/其他" : canonicalizeWeaponName(rawWeaponName);

  return {
    id: itemId,
    weaponName: canonicalWeaponName,
    rawWeaponName,
    weaponType,
    buildCode: String(item["改枪码"] || "").trim(),
    description: description === "无描述" ? "通用方案" : description,
    priceLabel: priceValue ? `${priceValue}万` : "价格待补",
    priceValue,
    hasPrice: priceValue > 0,
    source,
    reviewStatus,
    isUserUpload: source === "user_upload",
    isUnknownWeapon
  };
}

function renderOverview() {
  const knownItems = state.items.filter((item) => !item.isUnknownWeapon);
  const weapons = [...new Set(knownItems.map((item) => item.weaponName))];
  const validPrices = knownItems.map((item) => item.priceValue).filter(Boolean);
  const avgPrice = validPrices.length ? Math.round(validPrices.reduce((sum, value) => sum + value, 0) / validPrices.length) : 0;
  const maxPrice = validPrices.length ? Math.max(...validPrices) : 0;
  const minPrice = validPrices.length ? Math.min(...validPrices) : 0;

  elements.syncDate.textContent = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  const stats = [
    { label: "条目", value: `${state.items.length}` },
    { label: "武器", value: `${weapons.length}` },
    { label: "均价", value: `${avgPrice}万` },
    { label: "区间", value: `${minPrice}-${maxPrice}万` }
  ];

  elements.heroStats.innerHTML = stats
    .map(
      (stat) => `
        <article class="stat-card">
          <span>${stat.label}</span>
          <strong>${stat.value}</strong>
        </article>
      `
    )
    .join("");
}

function renderFilters() {
  populateWeaponOptions();
  populateSourceOptions();
}

function renderUploadWeaponTypeSelect() {
  const options = WEAPON_TYPE_OPTIONS.filter((type) => type.id !== "all").map((type) => ({ value: type.id, label: type.label }));
  createOrUpdateCustomSelect("uploadWeaponTypeSelect", options, "rifle", (value) => {
    elements.uploadWeaponTypeSelect.dataset.value = value;
    renderUploadWeaponSelect(value);
  });
  elements.uploadWeaponTypeSelect.dataset.value = "rifle";
}

function renderUploadWeaponSelect(weaponType = elements.uploadWeaponTypeSelect.dataset.value || "rifle") {
  const weapons = [...new Set(state.items.filter((item) => item.weaponType === weaponType && !item.isUnknownWeapon).map((item) => item.weaponName))]
    .sort((a, b) => a.localeCompare(b, "zh-CN"));

  const options = weapons.map((weapon) => ({ value: weapon, label: weapon }));
  const selectedValue = options[0]?.value || "";

  createOrUpdateCustomSelect("uploadWeaponSelect", options, selectedValue, (value) => {
    elements.uploadWeaponSelect.dataset.value = value;
  });

  elements.uploadWeaponSelect.dataset.value = selectedValue;
}

function renderWeaponTypeFilter() {
  elements.weaponTypeFilter.innerHTML = WEAPON_TYPE_OPTIONS
    .map(
      (type) => `
        <button class="type-chip ${type.id === state.weaponType ? "active" : ""}" type="button" data-type="${type.id}">
          ${type.label}
        </button>
      `
    )
    .join("");

  elements.weaponTypeFilter.querySelectorAll("[data-type]").forEach((button) => {
    button.addEventListener("click", () => {
      state.weaponType = button.dataset.type;
      state.weapon = "all";
      syncWeaponTypeButtons();
      populateWeaponOptions();
      renderSidebar();
      renderResults();
    });
  });
}

function syncWeaponTypeButtons() {
  elements.weaponTypeFilter.querySelectorAll("[data-type]").forEach((button) => {
    button.classList.toggle("active", button.dataset.type === state.weaponType);
  });
}

function populateWeaponOptions() {
  const weapons = [...new Set(getVisibleBaseItems().map((item) => item.weaponName))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const options = [{ value: "all", label: "全部武器" }, ...weapons.map((weapon) => ({ value: weapon, label: weapon }))];
  createOrUpdateCustomSelect("weaponSelect", options, state.weapon, (value) => {
    state.weapon = value;
    renderResults();
  });
  if (!options.some((option) => option.value === state.weapon)) {
    state.weapon = "all";
    setCustomSelectValue("weaponSelect", "all");
  }
}

function populateSourceOptions() {
  const sources = [...new Set(state.items.map((item) => item.source))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const options = [{ value: "all", label: "全部来源" }, ...sources.map((source) => ({ value: source, label: formatSourceLabel(source) }))];
  createOrUpdateCustomSelect("sourceSelect", options, state.source, (value) => {
    state.source = value;
    renderResults();
  });
}

function renderTierFilter() {
  elements.tierFilter.innerHTML = PRICE_TIERS
    .map(
      (tier) => `
        <button class="tier-chip ${tier.id === state.tier ? "active" : ""}" type="button" data-tier="${tier.id}">
          ${tier.label}
        </button>
      `
    )
    .join("");

  elements.tierFilter.querySelectorAll("[data-tier]").forEach((button) => {
    button.addEventListener("click", () => {
      state.tier = button.dataset.tier;
      syncTierButtons();
      renderResults();
    });
  });
}

function syncTierButtons() {
  elements.tierFilter.querySelectorAll("[data-tier]").forEach((button) => {
    button.classList.toggle("active", button.dataset.tier === state.tier);
  });
}

function renderSidebar() {
  const grouped = groupByWeapon(getVisibleBaseItems());
  const topWeapons = Object.values(grouped)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  elements.weaponRanking.innerHTML = topWeapons
    .map(
      (entry, index) => `
        <article class="ranking-item">
          <strong>${index + 1}. ${escapeHtml(entry.weaponName)}</strong>
          <small>${entry.count} 条，主价格带 ${entry.minPrice}-${entry.maxPrice}万</small>
        </article>
      `
    )
    .join("");

  const advice = [
    { title: "20万内", copy: "适合低成本通用方案或小号过渡。" },
    { title: "20-40万", copy: "当前数据最密集，适合主力配置。" },
    { title: "70万+", copy: "更适合收藏高配或专项流派。" }
  ];

  elements.budgetAdvice.innerHTML = advice
    .map(
      (item) => `
        <article class="advice-item">
          <strong>${item.title}</strong>
          <small>${item.copy}</small>
        </article>
      `
    )
    .join("");
}

function renderResults() {
  const filtered = getFilteredItems();

  elements.resultSummary.textContent = buildSummary(filtered.length);
  elements.results.innerHTML = "";
  elements.emptyState.hidden = filtered.length > 0;

  filtered.forEach((item) => {
    const fragment = elements.template.content.cloneNode(true);
    fragment.querySelector(".weapon-name").textContent = item.weaponName;

    const statusPill = fragment.querySelector(".status-pill");
    statusPill.textContent = formatReviewStatus(item.reviewStatus);
    statusPill.classList.toggle("pending", item.reviewStatus === "pending");

    const pricePill = fragment.querySelector(".price-pill");
    pricePill.textContent = item.priceLabel;
    pricePill.classList.toggle("unknown", !item.hasPrice);

    fragment.querySelector(".build-title").textContent = item.description;
    fragment.querySelector(".build-code").textContent = item.buildCode;

    const meta = fragment.querySelector(".card-meta");
    const sourcePill = document.createElement("span");
    sourcePill.className = "source-pill";
    sourcePill.textContent = formatSourceLabel(item.source);
    meta.appendChild(sourcePill);

    if (item.isUserUpload && state.canWrite) {
      const deleteButton = document.createElement("button");
      deleteButton.className = "delete-button";
      deleteButton.type = "button";
      deleteButton.textContent = "删除上传";
      deleteButton.addEventListener("click", async () => {
        await deleteUserUpload(item.id);
      });
      meta.appendChild(deleteButton);
    }

    const copyButton = fragment.querySelector(".copy-button");
    copyButton.addEventListener("click", async () => {
      await copyText(item.buildCode);
      copyButton.textContent = "复制成功";
      copyButton.classList.add("copied");
      window.setTimeout(() => {
        copyButton.textContent = "复制改枪码";
        copyButton.classList.remove("copied");
      }, 1500);
    });

    elements.results.appendChild(fragment);
  });
}

function getFilteredItems() {
  return state.items.filter((item) => {
    const visibleByKnownState = state.includeUnknown || !item.isUnknownWeapon;
    const matchesWeaponType = state.weaponType === "all" || item.weaponType === state.weaponType;
    const matchesWeapon = state.weapon === "all" || item.weaponName === state.weapon;
    const matchesSource = state.source === "all" || item.source === state.source;
    const matchesTier = PRICE_TIERS.find((tier) => tier.id === state.tier)?.predicate(item) ?? true;
    const haystack = `${item.weaponName} ${item.rawWeaponName} ${item.description} ${item.buildCode} ${item.source}`.toLowerCase();
    const matchesSearch = !state.search || haystack.includes(state.search);
    return visibleByKnownState && matchesWeaponType && matchesWeapon && matchesSource && matchesTier && matchesSearch;
  });
}

function buildSummary(count) {
  const weaponTypeLabel = WEAPON_TYPE_OPTIONS.find((type) => type.id === state.weaponType)?.label ?? "全部";
  const weaponLabel = state.weapon === "all" ? "全部武器" : state.weapon;
  const sourceLabel = state.source === "all" ? "全部来源" : formatSourceLabel(state.source);
  const tierLabel = PRICE_TIERS.find((tier) => tier.id === state.tier)?.label ?? "全部预算";
  return `${count} 条结果 · ${weaponTypeLabel} · ${weaponLabel} · ${sourceLabel} · ${tierLabel}`;
}

function groupByWeapon(items) {
  return items.reduce((accumulator, item) => {
    if (!accumulator[item.weaponName]) {
      accumulator[item.weaponName] = {
        weaponName: item.weaponName,
        count: 0,
        minPrice: item.hasPrice ? item.priceValue : 0,
        maxPrice: item.priceValue
      };
    }

    const target = accumulator[item.weaponName];
    target.count += 1;

    if (item.hasPrice) {
      if (target.minPrice === 0) {
        target.minPrice = item.priceValue;
      } else {
        target.minPrice = Math.min(target.minPrice, item.priceValue);
      }
      target.maxPrice = Math.max(target.maxPrice, item.priceValue);
    }

    return accumulator;
  }, {});
}

function getVisibleBaseItems() {
  return state.items.filter((item) => {
    const visibleByKnownState = state.includeUnknown || !item.isUnknownWeapon;
    const matchesWeaponType = state.weaponType === "all" || item.weaponType === state.weaponType;
    return visibleByKnownState && matchesWeaponType;
  });
}

function formatSourceLabel(source) {
  const sourceMap = {
    aitags: "Aitags",
    upx8: "UPX8",
    "有力氪 官方推荐": "有力氪",
    user_upload: "用户上传"
  };
  return sourceMap[source] || source;
}

function formatReviewStatus(reviewStatus) {
  return reviewStatus === "approved" ? "已收录" : "待审核";
}

function canonicalizeWeaponName(rawWeaponName) {
  const aliasMap = {
    "AK-12突击步枪": "AK-12",
    "AKM突击步枪": "AKM",
    "AS Val突击步枪": "AS Val",
    "ASh-12战斗步枪": "ASh-12",
    "AUG突击步枪": "AUG",
    "G3战斗步枪": "G3",
    "K416突击步枪": "K416",
    "KC17突击步枪": "KC17",
    "MCX LT突击步枪": "MCX LT",
    "M16A4突击步枪": "M16A4",
    "M7战斗步枪": "M7",
    "MK47突击步枪": "MK47",
    "PTR-32突击步枪": "PTR-32",
    "QBZ95-1突击步枪": "QBZ95-1",
    "SCAR-H战斗步枪": "SCAR-H"
  };

  if (aliasMap[rawWeaponName]) {
    return aliasMap[rawWeaponName];
  }

  return rawWeaponName
    .replace(/紧凑突击步枪$/, "")
    .replace(/突击步枪$/, "")
    .replace(/战斗步枪$/, "")
    .replace(/射手步枪$/, "")
    .replace(/狙击步枪$/, "")
    .replace(/冲锋枪$/, "")
    .replace(/霰弹枪$/, "")
    .replace(/轻机枪$/, "")
    .replace(/通用机枪$/, "")
    .trim();
}

function detectWeaponType(rawWeaponName) {
  const typeMap = {
    "AS Val": "rifle",
    "ASh-12": "rifle",
    "K416": "rifle",
    "K437": "rifle",
    "KC17": "rifle",
    "AK-12": "rifle",
    "AKM": "rifle",
    "AKS-74U": "rifle",
    "M4A1": "rifle",
    "CAR-15": "rifle",
    "QBZ95-1": "rifle",
    "SCAR-H": "rifle",
    "SG552": "rifle",
    "PTR-32": "rifle",
    "腾龙突击步枪": "rifle",
    "AUG突击步枪": "rifle",
    "MCX LT突击步枪": "rifle",
    "M16A4突击步枪": "rifle",
    "MK47突击步枪": "rifle",
    "SR-3M紧凑突击步枪": "rifle",
    "M7战斗步枪": "rifle",
    "G3战斗步枪": "rifle",
    "ASh-12战斗步枪": "rifle",
    "K416突击步枪": "rifle",
    "KC17突击步枪": "rifle",
    "AK-12突击步枪": "rifle",
    "AKM突击步枪": "rifle",
    "AS Val突击步枪": "rifle",
    "PTR-32突击步枪": "rifle",
    "QBZ95-1突击步枪": "rifle",
    "SCAR-H战斗步枪": "rifle",
    "M700狙击步枪": "sniper",
    "AWM狙击步枪": "sniper",
    "R93狙击步枪": "sniper",
    "SVD狙击步枪": "sniper",
    "M14射手步枪": "sniper",
    "Mini-14射手步枪": "sniper",
    "PSG-1射手步枪": "sniper",
    "SR-25射手步枪": "sniper",
    "MP5冲锋枪": "smg",
    "MP7冲锋枪": "smg",
    "P90冲锋枪": "smg",
    "SMG-45冲锋枪": "smg",
    "Vector冲锋枪": "smg",
    "QCQ171冲锋枪": "smg",
    "野牛冲锋枪": "smg",
    "勇士冲锋枪": "smg",
    "MK4冲锋枪": "smg",
    "UZI冲锋枪": "smg",
    "M870霰弹枪": "shotgun",
    "M1014霰弹枪": "shotgun",
    "FS-12霰弹枪": "shotgun",
    "S12K霰弹枪": "shotgun",
    "725双管霰弹枪": "shotgun",
    "M249轻机枪": "mg",
    "QJB201轻机枪": "mg",
    "PKM通用机枪": "mg"
  };

  if (typeMap[rawWeaponName]) {
    return typeMap[rawWeaponName];
  }

  if (rawWeaponName.includes("冲锋枪")) {
    return "smg";
  }
  if (rawWeaponName.includes("狙击步枪") || rawWeaponName.includes("射手步枪")) {
    return "sniper";
  }
  if (rawWeaponName.includes("霰弹枪")) {
    return "shotgun";
  }
  if (rawWeaponName.includes("轻机枪") || rawWeaponName.includes("通用机枪")) {
    return "mg";
  }
  if (rawWeaponName.includes("步枪")) {
    return "rifle";
  }

  return "other";
}

function createOrUpdateCustomSelect(id, options, selectedValue, onChange) {
  let instance = customSelects[id];

  if (!instance) {
    const root = document.querySelector(`#${id}`);
    root.innerHTML = `
      <button class="custom-select-trigger" type="button" aria-haspopup="listbox" aria-expanded="false"></button>
      <div class="custom-select-menu" hidden></div>
    `;

    instance = {
      root,
      trigger: root.querySelector(".custom-select-trigger"),
      menu: root.querySelector(".custom-select-menu"),
      onChange
    };

    instance.trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = instance.root.classList.toggle("open");
      instance.menu.hidden = !isOpen;
      instance.trigger.setAttribute("aria-expanded", String(isOpen));
    });

    customSelects[id] = instance;
  } else {
    instance.onChange = onChange;
  }

  if (!options.length) {
    instance.menu.innerHTML = "";
    instance.trigger.textContent = "暂无可选项";
    instance.trigger.setAttribute("aria-expanded", "false");
    instance.trigger.disabled = true;
    instance.root.classList.remove("open");
    instance.menu.hidden = true;
    return;
  }

  instance.trigger.disabled = false;

  instance.menu.innerHTML = options
    .map(
      (option) => `
        <button
          class="custom-select-option ${option.value === selectedValue ? "active" : ""}"
          type="button"
          data-value="${escapeHtml(option.value)}"
        >
          ${escapeHtml(option.label)}
        </button>
      `
    )
    .join("");

  const selectedOption = options.find((option) => option.value === selectedValue) || options[0];
  instance.trigger.textContent = selectedOption.label;
  instance.trigger.setAttribute("aria-expanded", String(!instance.menu.hidden));

  instance.menu.querySelectorAll(".custom-select-option").forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.dataset.value;
      setCustomSelectValue(id, value);
      instance.onChange(value);
      instance.root.classList.remove("open");
      instance.menu.hidden = true;
      instance.trigger.setAttribute("aria-expanded", "false");
    });
  });
}

function setCustomSelectValue(id, value) {
  const instance = customSelects[id];
  if (!instance) {
    return;
  }

  instance.menu.querySelectorAll(".custom-select-option").forEach((button) => {
    const isActive = button.dataset.value === value;
    button.classList.toggle("active", isActive);
    if (isActive) {
      instance.trigger.textContent = button.textContent;
    }
  });
}

async function submitUpload() {
  if (!state.canWrite) {
    setUploadStatus("当前页面是只读模式，请在本地服务中上传。", true);
    return;
  }

  const weaponType = elements.uploadWeaponTypeSelect.dataset.value || "rifle";
  const weaponName = elements.uploadWeaponSelect.dataset.value || "";
  const buildCode = elements.uploadBuildCode.value.trim();
  const description = elements.uploadDescription.value.trim();
  const price = elements.uploadPrice.value.trim();

  if (!weaponName || !buildCode) {
    setUploadStatus("请先选择武器名称并填写改枪码。", true);
    return;
  }

  try {
    const response = await fetch("/api/uploads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        weaponType,
        weaponName,
        buildCode,
        description,
        price
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "上传失败");
    }

    await loadItems();
    resetUploadForm();
    state.search = weaponName.toLowerCase();
    elements.searchInput.value = weaponName;
    renderResults();
    setUploadStatus(`已上传：${weaponName}`, false);
    closeUploadModal();
    document.querySelector("#codes")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    setUploadStatus(error.message || "上传失败", true);
  }
}

function resetUploadForm() {
  elements.uploadForm.reset();
  setCustomSelectValue("uploadWeaponTypeSelect", "rifle");
  elements.uploadWeaponTypeSelect.dataset.value = "rifle";
  renderUploadWeaponSelect("rifle");
}

function setUploadStatus(message, isError) {
  elements.uploadStatus.textContent = message;
  elements.uploadStatus.classList.toggle("error", isError);
}

function openUploadModal() {
  elements.uploadModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeUploadModal() {
  elements.uploadModal.hidden = true;
  document.body.classList.remove("modal-open");
}

async function deleteUserUpload(itemId) {
  if (!state.canWrite) {
    alert("当前页面是只读模式，请在本地服务中删除上传内容。");
    return;
  }

  try {
    const response = await fetch(`/api/uploads/${encodeURIComponent(itemId)}`, {
      method: "DELETE"
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "删除失败");
    }
    await loadItems();
  } catch (error) {
    console.error(error);
    alert(error.message || "删除失败");
  }
}

function buildItemId(weaponName, buildCode, source) {
  const safeWeaponName = normalizeBuildCode(weaponName).replace(/\s+/g, "-");
  const safeBuildCode = normalizeBuildCode(buildCode).replace(/\s+/g, "-");
  return `${source}-${safeWeaponName}-${safeBuildCode}`;
}

function normalizeBuildCode(buildCode) {
  return String(buildCode).trim().toLowerCase();
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
