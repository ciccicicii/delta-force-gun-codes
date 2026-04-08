const DATA_PATH = "./三角洲改枪码_步枪_全网合并.json";

const PRICE_TIERS = [
  { id: "all", label: "全部预算", predicate: () => true },
  { id: "budget", label: "20万内", predicate: (item) => item.hasPrice && item.priceValue <= 20 },
  { id: "value", label: "20-40万", predicate: (item) => item.hasPrice && item.priceValue > 20 && item.priceValue <= 40 },
  { id: "premium", label: "40-70万", predicate: (item) => item.hasPrice && item.priceValue > 40 && item.priceValue <= 70 },
  { id: "elite", label: "70万+", predicate: (item) => item.hasPrice && item.priceValue > 70 },
  { id: "unknown", label: "价格待补", predicate: (item) => !item.hasPrice }
];

const state = {
  items: [],
  search: "",
  weapon: "all",
  source: "all",
  tier: "all",
  includeUnknown: false
};

const elements = {
  syncDate: document.querySelector("#syncDate"),
  heroStats: document.querySelector("#heroStats"),
  searchInput: document.querySelector("#searchInput"),
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
  renderTierFilter();

  try {
    const response = await fetch(DATA_PATH);
    const rawItems = await response.json();
    state.items = rawItems.map(normalizeItem).sort((a, b) => a.priceValue - b.priceValue);
    renderOverview();
    renderFilters();
    renderSidebar();
    renderResults();
  } catch (error) {
    elements.resultSummary.textContent = "数据读取失败，请确认 JSON 文件路径可访问。";
    console.error(error);
  }
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
    state.weapon = "all";
    state.source = "all";
    state.tier = "all";
    state.includeUnknown = false;
    elements.searchInput.value = "";
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

  document.addEventListener("click", (event) => {
    Object.values(customSelects).forEach((instance) => {
      if (!instance.root.contains(event.target)) {
        instance.root.classList.remove("open");
        instance.menu.hidden = true;
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      Object.values(customSelects).forEach((instance) => {
        instance.root.classList.remove("open");
        instance.menu.hidden = true;
      });
    }
  });
}

function normalizeItem(item) {
  const priceLabel = String(item["枪械价格"] || "未知").trim();
  const priceValue = Number.parseInt(priceLabel, 10) || 0;
  const description = String(item["改装描述"] || "无描述").trim();
  const rawWeaponName = String(item["枪械名称"] || "未知武器").trim();
  const source = String(item["来源"] || "aitags").trim();
  const isUnknownWeapon = rawWeaponName === "待识别" || rawWeaponName === "待识别 其他" || rawWeaponName === "待识别/其他";

  return {
    weaponName: isUnknownWeapon ? "待识别/其他" : rawWeaponName,
    buildCode: String(item["改枪码"] || "").trim(),
    description: description === "无描述" ? "通用方案" : description,
    priceLabel: priceValue ? `${priceValue}万` : "价格待补",
    priceValue,
    hasPrice: priceValue > 0,
    source,
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
    const pricePill = fragment.querySelector(".price-pill");
    pricePill.textContent = item.priceLabel;
    pricePill.classList.toggle("unknown", !item.hasPrice);
    fragment.querySelector(".build-title").textContent = item.description;
    fragment.querySelector(".build-code").textContent = item.buildCode;

    const sourcePill = document.createElement("span");
    sourcePill.className = "source-pill";
    sourcePill.textContent = formatSourceLabel(item.source);
    fragment.querySelector(".result-card").appendChild(sourcePill);

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
    const matchesWeapon = state.weapon === "all" || item.weaponName === state.weapon;
    const matchesSource = state.source === "all" || item.source === state.source;
    const matchesTier = PRICE_TIERS.find((tier) => tier.id === state.tier)?.predicate(item) ?? true;
    const haystack = `${item.weaponName} ${item.description} ${item.buildCode} ${item.source}`.toLowerCase();
    const matchesSearch = !state.search || haystack.includes(state.search);
    return visibleByKnownState && matchesWeapon && matchesSource && matchesTier && matchesSearch;
  });
}

function buildSummary(count) {
  const weaponLabel = state.weapon === "all" ? "全部武器" : state.weapon;
  const sourceLabel = state.source === "all" ? "全部来源" : formatSourceLabel(state.source);
  const tierLabel = PRICE_TIERS.find((tier) => tier.id === state.tier)?.label ?? "全部预算";
  return `${count} 条结果 · ${weaponLabel} · ${sourceLabel} · ${tierLabel}`;
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
  return state.items.filter((item) => state.includeUnknown || !item.isUnknownWeapon);
}

function formatSourceLabel(source) {
  const sourceMap = {
    aitags: "Aitags",
    upx8: "UPX8",
    "有力氪 官方推荐": "有力氪"
  };
  return sourceMap[source] || source;
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
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
