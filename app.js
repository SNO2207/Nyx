const REQUIRED_FILES = {
  ClassesInfo: "ClassesInfo.json",
  StructsInfo: "StructsInfo.json",
  EnumsInfo: "EnumsInfo.json",
  FunctionsInfo: "FunctionsInfo.json",
  OffsetsInfo: "OffsetsInfo.json"
};

const GLOBAL_FILTER_GROUPS = [
  {
    title: "Result types",
    options: [
      ["classes", "Classes"],
      ["structs", "Structs"],
      ["functions", "Functions"],
      ["enums", "Enums"],
      ["offsets", "Offsets"]
    ]
  },
  {
    title: "Deep fields",
    options: [
      ["classMembers", "Class members"],
      ["structMembers", "Struct members"],
      ["functionParams", "Function params"],
      ["functionFlags", "Function flags"],
      ["enumValues", "Enum values"],
      ["inheritance", "Inheritance"]
    ]
  }
];

const DEFAULT_GLOBAL_FILTERS = GLOBAL_FILTER_GROUPS
  .flatMap((group) => group.options)
  .reduce((filters, [id]) => {
    filters[id] = true;
    return filters;
  }, {});

let nextTabId = 1;

function createSelectedState() {
  return {
    classes: null,
    structs: null,
    functions: null,
    enums: null,
    offsets: null
  };
}

function createModeState() {
  return {
    classes: "struct",
    structs: "struct",
    functions: "params",
    enums: "values",
    offsets: "values"
  };
}

function createWorkspaceTab(overrides = {}) {
  const id = `tab-${nextTabId}`;
  nextTabId += 1;
  return {
    id,
    section: "classes",
    selected: createSelectedState(),
    mode: createModeState(),
    filter: "",
    globalQuery: "",
    globalFilters: { ...DEFAULT_GLOBAL_FILTERS },
    ...overrides
  };
}

const initialWorkspaceTab = createWorkspaceTab();

const state = {
  dump: null,
  defaultDumpDir: "",
  serverDir: "",
  loading: false,
  tabs: [initialWorkspaceTab],
  activeTabId: initialWorkspaceTab.id,
  section: initialWorkspaceTab.section,
  selected: { ...initialWorkspaceTab.selected },
  mode: { ...initialWorkspaceTab.mode },
  filter: initialWorkspaceTab.filter,
  globalQuery: initialWorkspaceTab.globalQuery,
  globalFilters: { ...initialWorkspaceTab.globalFilters }
};

const els = {
  dumpPath: document.querySelector("#dumpPath"),
  footerStats: document.querySelector("#footerStats"),
  tabList: document.querySelector("#tabList"),
  newTabButton: document.querySelector("#newTabButton"),
  shell: document.querySelector(".shell"),
  sidebar: document.querySelector("#sidebar"),
  sidebarTitle: document.querySelector("#sidebarTitle"),
  sectionCount: document.querySelector("#sectionCount"),
  filterInput: document.querySelector("#filterInput"),
  list: document.querySelector("#list"),
  content: document.querySelector("#content"),
  navButtons: [...document.querySelectorAll(".nav-button")],
  reloadButton: document.querySelector("#reloadButton"),
  uploadButton: document.querySelector("#uploadButton"),
  fileInput: document.querySelector("#fileInput")
};

const sectionLabels = {
  classes: "Classes",
  structs: "Structs",
  functions: "Functions",
  enums: "Enums",
  offsets: "Offsets",
  global: "Global Search"
};

init();

function init() {
  bindEvents();
  loadConfig();
  renderAll();
}

function bindEvents() {
  els.navButtons.forEach((button) => {
    button.addEventListener("click", () => setSection(button.dataset.section));
  });

  els.tabList.addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-close-tab]");
    if (closeButton) {
      closeWorkspaceTab(closeButton.dataset.closeTab);
      return;
    }

    const tabButton = event.target.closest("[data-tab-id]");
    if (tabButton) {
      activateWorkspaceTab(tabButton.dataset.tabId);
    }
  });

  els.newTabButton.addEventListener("click", () => addWorkspaceTab());

  document.addEventListener("keydown", (event) => {
    const modifier = event.ctrlKey || event.metaKey;
    if (!modifier || event.altKey) return;

    const key = event.key.toLowerCase();
    if (key === "t") {
      event.preventDefault();
      addWorkspaceTab();
    } else if (key === "w") {
      event.preventDefault();
      closeWorkspaceTab(state.activeTabId);
    } else if (event.key === "Tab") {
      event.preventDefault();
      activateAdjacentWorkspaceTab(event.shiftKey ? -1 : 1);
    }
  });

  els.filterInput.addEventListener("input", () => {
    state.filter = els.filterInput.value.trim().toLowerCase();
    saveActiveTab();
    renderSidebar();
    renderTabs();
  });

  els.reloadButton.addEventListener("click", () => {
    if (state.dump) {
      loadFromServer(state.serverDir || state.defaultDumpDir);
    } else {
      renderWelcome();
    }
  });
  els.uploadButton.addEventListener("click", () => chooseDumpFiles());
  els.fileInput.addEventListener("change", () => loadFromFiles(els.fileInput.files));
}

function activeTab() {
  return state.tabs.find((tab) => tab.id === state.activeTabId) || state.tabs[0] || null;
}

function saveActiveTab() {
  const tab = activeTab();
  if (!tab) return;

  tab.section = state.section;
  tab.selected = { ...state.selected };
  tab.mode = { ...state.mode };
  tab.filter = state.filter;
  tab.globalQuery = state.globalQuery;
  tab.globalFilters = { ...state.globalFilters };
}

function loadTabState(tab) {
  state.section = tab.section;
  state.selected = { ...tab.selected };
  state.mode = { ...tab.mode };
  state.filter = tab.filter;
  state.globalQuery = tab.globalQuery;
  state.globalFilters = { ...tab.globalFilters };
  els.filterInput.value = state.filter;
}

function addWorkspaceTab() {
  if (!state.dump || state.loading) return;

  saveActiveTab();
  const tab = createWorkspaceTab({
    section: state.section,
    selected: { ...state.selected },
    mode: { ...state.mode },
    filter: "",
    globalQuery: "",
    globalFilters: { ...state.globalFilters }
  });
  tab.selected = selectedStateForDump(state.dump, tab.selected);
  state.tabs.push(tab);
  state.activeTabId = tab.id;
  loadTabState(tab);
  renderAll();
}

function activateWorkspaceTab(tabId) {
  if (tabId === state.activeTabId) return;
  const tab = state.tabs.find((candidate) => candidate.id === tabId);
  if (!tab) return;

  saveActiveTab();
  state.activeTabId = tab.id;
  loadTabState(tab);
  renderAll();
}

function activateAdjacentWorkspaceTab(direction) {
  if (state.tabs.length < 2) return;
  const currentIndex = Math.max(0, state.tabs.findIndex((tab) => tab.id === state.activeTabId));
  const nextIndex = (currentIndex + direction + state.tabs.length) % state.tabs.length;
  activateWorkspaceTab(state.tabs[nextIndex].id);
}

function closeWorkspaceTab(tabId) {
  if (state.tabs.length <= 1) return;

  saveActiveTab();
  const tabIndex = state.tabs.findIndex((tab) => tab.id === tabId);
  if (tabIndex === -1) return;

  const wasActive = state.activeTabId === tabId;
  state.tabs.splice(tabIndex, 1);

  if (wasActive) {
    const nextTab = state.tabs[Math.min(tabIndex, state.tabs.length - 1)];
    state.activeTabId = nextTab.id;
    loadTabState(nextTab);
    renderAll();
  } else {
    renderTabs();
  }
}

async function loadConfig() {
  try {
    const response = await fetch("/api/config");
    const payload = await response.json();
    state.defaultDumpDir = payload.defaultDumpDir || "";
    state.serverDir = state.defaultDumpDir;
    renderAll();
  } catch (error) {
    state.defaultDumpDir = "";
    renderAll();
  }
}

async function loadFromServer(dir = state.defaultDumpDir) {
  showLoading();
  try {
    const response = await fetch(`/api/dump?dir=${encodeURIComponent(dir)}`);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(`${payload.error}: ${payload.detail}`);
    }
    state.serverDir = payload.dir;
    hydrateDump(payload.files, payload.dir, payload.loadedAt);
  } catch (error) {
    showError(error.message);
  }
}

async function chooseDumpFiles() {
  if ("showDirectoryPicker" in window) {
    try {
      const dir = await window.showDirectoryPicker();
      const files = [];
      for (const fileName of Object.values(REQUIRED_FILES)) {
        const handle = await dir.getFileHandle(fileName);
        files.push(await handle.getFile());
      }
      await loadFromFiles(files, dir.name);
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  els.fileInput.click();
}

async function loadFromFiles(fileList, label = "Uploaded dump") {
  const files = [...fileList];
  if (!files.length) return;

  showLoading("Parsing uploaded dump files...");
  try {
    const parsed = {};
    for (const [key, fileName] of Object.entries(REQUIRED_FILES)) {
      const file = files.find((entry) => entry.name === fileName);
      if (!file) throw new Error(`Missing ${fileName}`);
      parsed[fileName] = JSON.parse(await file.text());
    }
    hydrateDump(parsed, label, new Date().toISOString());
  } catch (error) {
    showError(`Unable to parse uploaded files: ${error.message}`);
  } finally {
    els.fileInput.value = "";
  }
}

function hydrateDump(files, source, loadedAt) {
  const dump = {
    source,
    loadedAt,
    classes: parseEntities(files[REQUIRED_FILES.ClassesInfo], "class"),
    structs: parseEntities(files[REQUIRED_FILES.StructsInfo], "struct"),
    enums: parseEnums(files[REQUIRED_FILES.EnumsInfo]),
    functions: parseFunctions(files[REQUIRED_FILES.FunctionsInfo]),
    offsets: parseOffsets(files[REQUIRED_FILES.OffsetsInfo]),
    meta: {
      version: files[REQUIRED_FILES.ClassesInfo]?.version,
      updatedAt: files[REQUIRED_FILES.ClassesInfo]?.updated_at
    }
  };
  dump.classIndex = buildClassIndex(dump.classes);
  dump.symbolIndex = buildSymbolIndex(dump.classes, dump.structs);

  state.dump = dump;
  state.loading = false;
  state.tabs.forEach((tab) => {
    tab.selected = selectedStateForDump(dump, tab.selected);
  });
  loadTabState(activeTab());
  els.filterInput.value = state.filter;
  renderAll();
}

function selectedStateForDump(dump, selected = createSelectedState()) {
  return {
    classes: validOrPreferred(dump.classes, selected.classes, "AActor"),
    structs: validOrPreferred(dump.structs, selected.structs, "FVector"),
    functions: validOrPreferred(dump.functions, selected.functions, "AActor"),
    enums: validOrPreferred(dump.enums, selected.enums, "EObjectFlags"),
    offsets: validOrPreferred(dump.offsets, selected.offsets)
  };
}

function validOrPreferred(items, currentName, preferredName = "") {
  if (currentName && items.some((item) => item.name === currentName)) {
    return currentName;
  }
  return pickPreferred(items, preferredName);
}

function buildClassIndex(classes) {
  const byName = new Map();
  const childrenByParent = new Map();

  for (const item of classes) {
    byName.set(item.name, item);
  }

  for (const item of classes) {
    if (!item.parent) continue;
    if (!childrenByParent.has(item.parent)) {
      childrenByParent.set(item.parent, []);
    }
    childrenByParent.get(item.parent).push(item);
  }

  for (const children of childrenByParent.values()) {
    children.sort((a, b) => a.name.localeCompare(b.name));
  }

  return { byName, childrenByParent };
}

function buildSymbolIndex(classes, structs) {
  return {
    classes: new Map(classes.map((item) => [item.name, item])),
    structs: new Map(structs.map((item) => [item.name, item]))
  };
}

function parseEntities(json, kind) {
  return (json?.data || []).map((entry) => {
    const name = Object.keys(entry)[0];
    const rows = entry[name] || [];
    const meta = {
      inherit: [],
      size: 0
    };
    const members = [];

    for (const row of rows) {
      const key = Object.keys(row)[0];
      const value = row[key];
      if (key === "__InheritInfo") {
        meta.inherit = value || [];
      } else if (key === "__MDKClassSize") {
        meta.size = value || 0;
      } else {
        members.push({
          name: key,
          typeInfo: value[0],
          type: formatType(value[0]),
          kind: value[0]?.[1] || "",
          offset: value[1],
          size: value[2],
          arrayDim: value[3]
        });
      }
    }

    return {
      kind,
      name,
      parent: meta.inherit[0] || "",
      inherit: meta.inherit,
      size: meta.size,
      members
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

function parseEnums(json) {
  return (json?.data || []).map((entry) => {
    const name = Object.keys(entry)[0];
    const [valueRows = [], underlying = ""] = entry[name] || [];
    const values = valueRows.map((row) => {
      const key = Object.keys(row)[0];
      return { name: key, value: row[key] };
    });
    return {
      kind: "enum",
      name,
      underlying,
      values
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

function parseFunctions(json) {
  return (json?.data || []).map((entry) => {
    const owner = Object.keys(entry)[0];
    const functions = (entry[owner] || []).map((row) => {
      const name = Object.keys(row)[0];
      const value = row[name];
      const params = (value[1] || []).map((param) => ({
        typeInfo: param[0],
        type: formatType(param[0]),
        modifier: param[1] || "",
        name: param[2] || ""
      }));
      return {
        name,
        returnTypeInfo: value[0],
        returnType: formatType(value[0]),
        params,
        address: value[2],
        flags: value[3] || ""
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
    return {
      kind: "functionOwner",
      name: owner,
      count: functions.length,
      functions
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

function parseOffsets(json) {
  return (json?.data || []).map(([name, value]) => ({
    kind: "offset",
    name,
    value
  }));
}

function formatType(info) {
  if (!Array.isArray(info)) return "";
  const [base, typeKind, modifier, generics] = info;
  const suffix = modifier || "";
  const genericText = Array.isArray(generics) && generics.length
    ? `<${generics.map(formatType).join(", ")}>`
    : "";
  return `${base || ""}${genericText}${suffix}`;
}

function setSection(section) {
  state.section = section;
  state.filter = "";
  els.filterInput.value = "";
  renderAll();
}

function renderAll() {
  saveActiveTab();
  renderTop();
  renderTabs();
  const didRenderContent = renderSidebar();
  if (!didRenderContent) renderContent();
}

function renderTop() {
  els.navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.section === state.section);
    button.disabled = !state.dump;
  });

  const dump = state.dump;
  if (!dump) {
    els.dumpPath.textContent = state.loading ? "Loading dump..." : "No dump selected";
    els.footerStats.textContent = "Select Dumper7 JSON files to begin";
    return;
  }

  els.dumpPath.textContent = dump.source;
  els.footerStats.textContent = [
    `${dump.classes.length.toLocaleString()} classes`,
    `${dump.structs.length.toLocaleString()} structs`,
    `${totalFunctionCount().toLocaleString()} functions`,
    `${dump.enums.length.toLocaleString()} enums`
  ].join(" - ");
}

function renderTabs() {
  const canAddTabs = Boolean(state.dump) && !state.loading;
  els.newTabButton.disabled = !canAddTabs;
  els.newTabButton.title = canAddTabs ? "New tab" : "Load a dump to open tabs";

  els.tabList.innerHTML = state.tabs.map((tab) => {
    const summary = tabSummary(tab);
    const active = tab.id === state.activeTabId;
    const canClose = state.tabs.length > 1;
    return `
      <div class="workspace-tab ${active ? "active" : ""}" role="presentation">
        <button class="workspace-tab-main" role="tab" data-tab-id="${escapeAttr(tab.id)}" aria-selected="${active}" title="${escapeAttr(summary.title)}">
          <span class="tab-title">${escapeHtml(summary.title)}</span>
          <span class="tab-meta">${escapeHtml(summary.meta)}</span>
        </button>
        <button class="tab-close-button" data-close-tab="${escapeAttr(tab.id)}" title="Close tab" aria-label="Close ${escapeAttr(summary.title)}" ${canClose ? "" : "disabled"}>x</button>
      </div>
    `;
  }).join("");
}

function tabSummary(tab) {
  if (!state.dump) {
    return {
      title: "Start",
      meta: state.loading ? "Loading dump" : "Select dump"
    };
  }

  if (tab.section === "global") {
    return {
      title: tab.globalQuery ? `Search: ${tab.globalQuery}` : "Global Search",
      meta: "Search"
    };
  }

  if (tab.section === "offsets") {
    return {
      title: "Offsets",
      meta: labelMode(tab.mode.offsets || "values")
    };
  }

  const selectedName = tab.selected[tab.section] || sectionLabels[tab.section] || "Workspace";
  const mode = tab.mode[tab.section] || "";
  return {
    title: selectedName,
    meta: `${sectionLabels[tab.section] || "Workspace"}${mode ? ` / ${labelMode(mode)}` : ""}`
  };
}

function renderSidebar() {
  if (!state.dump) {
    els.shell.classList.add("welcome");
    els.shell.classList.remove("global");
    els.content.classList.add("welcome-content");
    els.content.classList.remove("global-content");
    els.sidebar.style.display = "none";
    return false;
  }

  const isGlobal = state.section === "global";
  els.shell.classList.remove("welcome");
  els.shell.classList.toggle("global", isGlobal);
  els.content.classList.toggle("global-content", isGlobal);
  els.content.classList.remove("welcome-content");
  els.sidebar.style.display = isGlobal ? "none" : "";
  if (isGlobal) {
    renderContent();
    return true;
  }

  const items = sectionItems(state.section);
  const filtered = filterItems(items, state.filter);
  els.sidebarTitle.textContent = sectionLabels[state.section];
  els.sectionCount.textContent = `${filtered.length.toLocaleString()} / ${items.length.toLocaleString()}`;

  const limit = 800;
  const visible = filtered.slice(0, limit);
  els.list.innerHTML = visible.map((item) => sidebarItemHtml(item)).join("") +
    (filtered.length > limit ? `<div class="list-item muted"><strong>${filtered.length - limit} more results</strong><span>Refine search to narrow the list</span></div>` : "");

  els.list.querySelectorAll("[data-name]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selected[state.section] = button.dataset.name;
      renderAll();
    });
  });
  return false;
}

function sidebarItemHtml(item) {
  const selected = state.selected[state.section] === item.name;
  const sub = sidebarSubtext(item);
  return `
    <button class="list-item ${selected ? "active" : ""}" data-name="${escapeAttr(item.name)}" role="option" aria-selected="${selected}">
      <strong>${escapeHtml(item.name)}</strong>
      ${sub ? `<span>${escapeHtml(sub)}</span>` : ""}
    </button>
  `;
}

function sidebarSubtext(item) {
  if (item.kind === "class" || item.kind === "struct") {
    return `${item.members.length} members - size ${hex(item.size)}`;
  }
  if (item.kind === "functionOwner") {
    return `${item.count} functions`;
  }
  if (item.kind === "enum") {
    return `${item.values.length} values - ${item.underlying}`;
  }
  if (item.kind === "offset") {
    return hex(item.value);
  }
  return "";
}

function filterItems(items, query) {
  if (!query) return items;
  return items.filter((item) => item.name.toLowerCase().includes(query));
}

function renderContent() {
  if (!state.dump) {
    if (!state.loading) renderWelcome();
    return;
  }

  if (state.section === "global") {
    renderGlobalSearch();
    return;
  }

  const item = selectedItem();
  if (!item) {
    els.content.innerHTML = `<div class="empty-state"><h2>No item selected</h2><p>Choose an entry from the list.</p></div>`;
    return;
  }

  if (state.section === "classes" || state.section === "structs") {
    renderEntity(item);
  } else if (state.section === "functions") {
    renderFunctions(item);
  } else if (state.section === "enums") {
    renderEnum(item);
  } else if (state.section === "offsets") {
    renderOffsets();
  }
}

function renderEntity(item) {
  const modes = state.section === "classes" ? ["overview", "struct", "graph", "mdk"] : ["overview", "struct", "mdk"];
  const mode = state.mode[state.section] || "struct";
  els.content.innerHTML = `
    ${detailHead(item, [
      ["Members", item.members.length.toLocaleString()],
      ["Size", hex(item.size)],
      ["Parent", item.parent || "None"]
    ])}
    ${modeTabs(modes, mode)}
    <div class="panel">${renderEntityMode(item, mode)}</div>
  `;
  bindModeButtons();
  bindClassJumpButtons();
  bindSymbolLinks();
}

function renderEntityMode(item, mode) {
  if (mode === "graph" && item.kind === "class") {
    return renderInheritanceGraph(item);
  }

  if (mode === "overview") {
    return `
      <div class="overview-grid">
        <div class="info-box">
          <h3>Inheritance</h3>
          ${item.inherit.length ? `<ul>${item.inherit.map((name) => `<li>${renderSymbolReference(name)}</li>`).join("")}</ul>` : "<p>None</p>"}
        </div>
        <div class="info-box">
          <h3>Layout</h3>
          <p>Members: ${item.members.length.toLocaleString()}</p>
          <p>MDK size: ${hex(item.size)} (${item.size.toLocaleString()} bytes)</p>
        </div>
        <div class="info-box">
          <h3>Largest Members</h3>
          ${topMembers(item).map((member) => `<p>${escapeHtml(member.name)} - ${hex(member.size)}</p>`).join("") || "<p>No members</p>"}
        </div>
      </div>
    `;
  }

  if (mode === "mdk") {
    return `<pre>${renderLinkedSymbolText(entityToMdk(item))}</pre>`;
  }

  return `
    <table>
      <thead>
        <tr>
          <th>Type</th>
          <th>Member</th>
          <th class="mono">Offset</th>
          <th class="mono">Size</th>
          <th class="mono">Array</th>
        </tr>
      </thead>
      <tbody>
        ${item.members.map((member) => `
          <tr>
            <td class="${typeClass(member.kind)}">${renderTypeInfo(member.typeInfo, member.type)}</td>
            <td>${escapeHtml(member.name)}</td>
            <td class="mono">${formatOffset(member.offset, member.name)}</td>
            <td class="mono">${hex(member.size)}</td>
            <td class="mono">${member.arrayDim}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderInheritanceGraph(item) {
  const index = state.dump.classIndex;
  const graph = buildInheritanceGraphLayout(item, index);
  const visibleRealNodes = graph.nodes.filter((node) => !node.summary).length;
  const descendantCount = countDescendants(item.name, index);
  const children = index.childrenByParent.get(item.name) || [];

  return `
    <div class="graph-view">
      <div class="graph-toolbar">
        <span class="stat">Direct children <strong>${children.length.toLocaleString()}</strong></span>
        <span class="stat">Descendants <strong>${descendantCount.toLocaleString()}</strong></span>
        <span class="stat">Visible nodes <strong>${visibleRealNodes.toLocaleString()}</strong></span>
      </div>
      <div class="graph-canvas" style="width: ${graph.width}px; height: ${graph.height}px;">
        <svg class="graph-edges" width="${graph.width}" height="${graph.height}" viewBox="0 0 ${graph.width} ${graph.height}" aria-hidden="true">
          ${graph.edges.map((edge) => graphEdgePath(edge, graph.nodesById)).join("")}
        </svg>
        ${graph.nodes.map(graphNode).join("")}
      </div>
    </div>
  `;
}

function buildInheritanceGraphLayout(item, index) {
  const nodeWidth = 230;
  const nodeHeight = 56;
  const columnGap = 295;
  const rowGap = 78;
  const groupGap = 18;
  const margin = 28;
  const maxDirectChildren = 64;
  const maxGrandchildren = 7;
  const nodes = [];
  const edges = [];
  const ancestors = [...(item.inherit || [])].reverse();
  const directChildren = index.childrenByParent.get(item.name) || [];
  const visibleChildren = directChildren.slice(0, maxDirectChildren);
  const hiddenChildren = Math.max(0, directChildren.length - visibleChildren.length);
  const selectedX = margin + ancestors.length * columnGap;
  let contentBottom = margin + nodeHeight;

  const addNode = (node) => {
    const fullNode = {
      width: nodeWidth,
      height: nodeHeight,
      ...node
    };
    nodes.push(fullNode);
    contentBottom = Math.max(contentBottom, fullNode.y + fullNode.height + margin);
    return fullNode;
  };
  const addEdge = (from, to) => edges.push({ from, to });

  let previousAncestorId = "";
  ancestors.forEach((name, indexInChain) => {
    const id = `ancestor-${indexInChain}`;
    const meta = indexInChain === ancestors.length - 1 ? "Parent" : `Level ${ancestors.length - indexInChain}`;
    addNode({
      id,
      name,
      meta,
      x: margin + indexInChain * columnGap,
      y: margin,
      role: "ancestor",
      clickable: index.byName.has(name)
    });
    if (previousAncestorId) addEdge(previousAncestorId, id);
    previousAncestorId = id;
  });

  addNode({
    id: "selected",
    name: item.name,
    meta: `${item.members.length.toLocaleString()} members - ${hex(item.size)}`,
    x: selectedX,
    y: margin,
    role: "current",
    clickable: false
  });
  if (previousAncestorId) addEdge(previousAncestorId, "selected");

  let yCursor = margin;
  visibleChildren.forEach((child, childIndex) => {
    const grandchildren = index.childrenByParent.get(child.name) || [];
    const visibleGrandchildren = grandchildren.slice(0, maxGrandchildren);
    const hiddenGrandchildren = Math.max(0, grandchildren.length - visibleGrandchildren.length);
    const rows = Math.max(1, visibleGrandchildren.length + (hiddenGrandchildren ? 1 : 0));
    const groupHeight = rows * rowGap - (rowGap - nodeHeight);
    const childId = `child-${childIndex}`;
    const childY = yCursor + Math.max(0, (groupHeight - nodeHeight) / 2);

    addNode({
      id: childId,
      name: child.name,
      meta: `${child.members.length.toLocaleString()} members`,
      x: selectedX + columnGap,
      y: Math.round(childY),
      role: "child",
      clickable: true
    });
    addEdge("selected", childId);

    visibleGrandchildren.forEach((grandchild, grandchildIndex) => {
      const grandchildId = `grandchild-${childIndex}-${grandchildIndex}`;
      addNode({
        id: grandchildId,
        name: grandchild.name,
        meta: `${grandchild.members.length.toLocaleString()} members`,
        x: selectedX + columnGap * 2,
        y: yCursor + grandchildIndex * rowGap,
        role: "grandchild",
        clickable: true
      });
      addEdge(childId, grandchildId);
    });

    if (hiddenGrandchildren) {
      const summaryId = `grandchild-more-${childIndex}`;
      addNode({
        id: summaryId,
        name: `+ ${hiddenGrandchildren.toLocaleString()} more`,
        meta: `children of ${child.name}`,
        x: selectedX + columnGap * 2,
        y: yCursor + visibleGrandchildren.length * rowGap,
        role: "summary",
        summary: true,
        clickable: false
      });
      addEdge(childId, summaryId);
    }

    yCursor += rows * rowGap + groupGap;
  });

  if (hiddenChildren) {
    const summaryId = "child-more";
    addNode({
      id: summaryId,
      name: `+ ${hiddenChildren.toLocaleString()} more`,
      meta: `direct children of ${item.name}`,
      x: selectedX + columnGap,
      y: yCursor,
      role: "summary",
      summary: true,
      clickable: false
    });
    addEdge("selected", summaryId);
  }

  if (!directChildren.length) {
    addNode({
      id: "no-children",
      name: "No child classes",
      meta: "leaf class",
      x: selectedX + columnGap,
      y: margin,
      role: "summary",
      summary: true,
      clickable: false
    });
    addEdge("selected", "no-children");
  }

  const nodesById = Object.fromEntries(nodes.map((node) => [node.id, node]));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width), selectedX + nodeWidth);

  return {
    nodes,
    nodesById,
    edges,
    width: maxX + margin,
    height: contentBottom
  };
}

function graphEdgePath(edge, nodesById) {
  const from = nodesById[edge.from];
  const to = nodesById[edge.to];
  if (!from || !to) return "";
  const startX = from.x + from.width;
  const startY = from.y + from.height / 2;
  const endX = to.x;
  const endY = to.y + to.height / 2;
  const midX = startX + Math.max(36, (endX - startX) / 2);
  return `<path class="graph-edge" d="M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}" />`;
}

function graphNode(node) {
  const tag = node.clickable ? "button" : "div";
  const action = node.clickable ? ` data-class-jump="${escapeAttr(node.name)}"` : "";
  const classes = ["graph-node", `graph-node-${node.role || "default"}`];
  if (node.role === "current") classes.push("current");
  if (node.summary) classes.push("summary");
  return `
    <${tag} class="${classes.join(" ")}"${action} style="left: ${node.x}px; top: ${node.y}px; width: ${node.width}px; height: ${node.height}px;">
      <strong>${escapeHtml(node.name)}</strong>
      <span>${escapeHtml(node.meta)}</span>
    </${tag}>
  `;
}

function countDescendants(name, index, seen = new Set()) {
  const children = index.childrenByParent.get(name) || [];
  let count = 0;
  for (const child of children) {
    if (seen.has(child.name)) continue;
    seen.add(child.name);
    count += 1 + countDescendants(child.name, index, seen);
  }
  return count;
}

function bindClassJumpButtons() {
  els.content.querySelectorAll("[data-class-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      state.section = "classes";
      state.selected.classes = button.dataset.classJump;
      state.filter = "";
      els.filterInput.value = "";
      renderAll();
    });
  });
}

function bindSymbolLinks() {
  els.content.querySelectorAll("[data-symbol-section][data-symbol-name]").forEach((button) => {
    button.addEventListener("click", () => {
      openSymbolInNewTab(button.dataset.symbolSection, button.dataset.symbolName);
    });
  });
}

function openSymbolInNewTab(section, name) {
  if (!state.dump || state.loading || !section || !name) return;
  if (!["classes", "structs"].includes(section)) return;

  const items = sectionItems(section);
  if (!items.some((item) => item.name === name)) return;

  saveActiveTab();
  const selected = { ...state.selected, [section]: name };
  const tab = createWorkspaceTab({
    section,
    selected,
    mode: { ...state.mode },
    filter: "",
    globalQuery: "",
    globalFilters: { ...state.globalFilters }
  });
  tab.selected = selectedStateForDump(state.dump, tab.selected);
  state.tabs.push(tab);
  state.activeTabId = tab.id;
  loadTabState(tab);
  renderAll();
}

function symbolTarget(name, typeKind = "") {
  if (!state.dump?.symbolIndex || !name) return null;

  if (typeKind === "C") {
    return state.dump.symbolIndex.classes.has(name) ? { section: "classes", name } : null;
  }
  if (typeKind === "S") {
    return state.dump.symbolIndex.structs.has(name) ? { section: "structs", name } : null;
  }

  if (state.dump.symbolIndex.classes.has(name)) return { section: "classes", name };
  if (state.dump.symbolIndex.structs.has(name)) return { section: "structs", name };
  return null;
}

function renderSymbolReference(name, typeKind = "", extraClass = "") {
  const target = symbolTarget(name, typeKind);
  if (!target) return escapeHtml(name);

  const typeStyle = target.section === "classes" ? "type-class" : "type-struct";
  const classes = ["symbol-link", typeStyle, extraClass].filter(Boolean).join(" ");
  return `<button type="button" class="${classes}" data-symbol-section="${escapeAttr(target.section)}" data-symbol-name="${escapeAttr(target.name)}" title="Open ${escapeAttr(target.name)} in a new tab">${escapeHtml(name)}</button>`;
}

function renderTypeInfo(info, fallback = "") {
  if (!Array.isArray(info)) return escapeHtml(fallback);

  const [base, typeKind, modifier, generics] = info;
  const baseText = base ? renderSymbolReference(base, typeKind) : "";
  const genericText = Array.isArray(generics) && generics.length
    ? `&lt;${generics.map((generic) => renderTypeInfo(generic)).join(", ")}&gt;`
    : "";
  return `${baseText}${genericText}${escapeHtml(modifier || "")}`;
}

function renderFunctionSignature(fn) {
  const params = fn.params.map(renderFunctionParam).join(", ");
  return `${renderTypeInfo(fn.returnTypeInfo, fn.returnType)} ${escapeHtml(fn.name)}(${params});`;
}

function renderFunctionParam(param) {
  return [
    renderTypeInfo(param.typeInfo, param.type),
    param.modifier ? escapeHtml(param.modifier) : "",
    param.name ? escapeHtml(param.name) : ""
  ].filter(Boolean).join(" ");
}

function renderLinkedSymbolText(text) {
  const value = String(text ?? "");
  const tokenPattern = /\b[A-Za-z_][A-Za-z0-9_]*\b/g;
  let result = "";
  let lastIndex = 0;

  for (const match of value.matchAll(tokenPattern)) {
    const token = match[0];
    const index = match.index || 0;
    result += escapeHtml(value.slice(lastIndex, index));
    result += symbolTarget(token) ? renderSymbolReference(token) : escapeHtml(token);
    lastIndex = index + token.length;
  }

  return result + escapeHtml(value.slice(lastIndex));
}

function renderFunctions(owner) {
  const mode = state.mode.functions || "params";
  const modes = ["params", "list", "mdk"];
  const first = owner.functions[0];

  els.content.innerHTML = `
    ${detailHead(owner, [
      ["Functions", owner.functions.length.toLocaleString()],
      ["First RVA", first ? hex(first.address) : "None"]
    ])}
    ${modeTabs(modes, mode)}
    <div class="panel">${renderFunctionsMode(owner, mode)}</div>
  `;
  bindModeButtons();
  bindSymbolLinks();
}

function renderFunctionsMode(owner, mode) {
  if (mode === "mdk") {
    return `<pre>${renderLinkedSymbolText(functionsToMdk(owner))}</pre>`;
  }

  if (mode === "list") {
    return `
      <table>
        <thead>
          <tr>
            <th>Return</th>
            <th>Function</th>
            <th class="mono">RVA</th>
            <th>Flags</th>
          </tr>
        </thead>
        <tbody>
          ${owner.functions.map((fn) => `
            <tr>
              <td class="${typeClass(fn.returnTypeInfo?.[1])}">${renderTypeInfo(fn.returnTypeInfo, fn.returnType)}</td>
              <td>${escapeHtml(fn.name)}</td>
              <td class="mono">${hex(fn.address)}</td>
              <td>${escapeHtml(fn.flags)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  return owner.functions.map((fn) => `
    <section class="function-signature">
      <code>${renderFunctionSignature(fn)}</code>
      <div class="stats-row">
        <span class="stat">RVA <strong>${hex(fn.address)}</strong></span>
        <span class="stat">Params <strong>${fn.params.length}</strong></span>
      </div>
      <div class="flags">${fn.flags.split("|").filter(Boolean).map((flag) => `<span class="flag">${escapeHtml(flag)}</span>`).join("")}</div>
    </section>
  `).join("");
}

function renderEnum(item) {
  const mode = state.mode.enums || "values";
  els.content.innerHTML = `
    ${detailHead(item, [
      ["Values", item.values.length.toLocaleString()],
      ["Underlying", item.underlying || "Unknown"]
    ])}
    ${modeTabs(["values", "mdk"], mode)}
    <div class="panel">
      ${mode === "mdk" ? `<pre>${escapeHtml(enumToMdk(item))}</pre>` : enumTable(item)}
    </div>
  `;
  bindModeButtons();
}

function enumTable(item) {
  return `
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th class="mono">Value</th>
          <th class="mono">Hex</th>
        </tr>
      </thead>
      <tbody>
        ${item.values.map((value) => `
          <tr>
            <td>${escapeHtml(value.name)}</td>
            <td class="mono">${value.value}</td>
            <td class="mono">${hex(value.value)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderOffsets() {
  const offsets = state.dump.offsets;
  els.content.innerHTML = `
    <div class="detail-head">
      <div class="title-block">
        <div class="title-line"><h2>Offsets</h2><span class="badge">${offsets.length} entries</span></div>
        <div class="stats-row"><span class="stat">Dumper <strong>${escapeHtml(String(offsets.find((o) => o.name === "Dumper")?.value ?? "7"))}</strong></span></div>
      </div>
    </div>
    ${modeTabs(["values", "mdk"], state.mode.offsets || "values")}
    <div class="panel">
      ${(state.mode.offsets || "values") === "mdk" ? `<pre>${escapeHtml(offsetsToMdk(offsets))}</pre>` : offsetsTable(offsets)}
    </div>
  `;
  bindModeButtons();
}

function offsetsTable(offsets) {
  return `
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th class="mono">Value</th>
          <th class="mono">Hex</th>
        </tr>
      </thead>
      <tbody>
        ${offsets.map((offset) => `
          <tr>
            <td>${escapeHtml(offset.name)}</td>
            <td class="mono">${offset.value}</td>
            <td class="mono">${hex(offset.value)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderGlobalSearch() {
  const query = state.globalQuery;
  const normalizedQuery = normalizeSearch(query);
  const results = normalizedQuery.length >= 2 ? globalSearch(query) : { items: [], total: 0 };

  els.content.innerHTML = `
    <div class="global-layout">
      <div class="global-header">
        <div class="global-bar">
          <label class="searchbox">
            <span aria-hidden="true">/</span>
            <input id="globalInput" type="search" placeholder="Search names, members, params, inheritance..." value="${escapeAttr(query)}" autocomplete="off" />
          </label>
          <button id="clearGlobal" class="ghost-button">Clear</button>
        </div>
        <div class="global-filter-panel">
          ${GLOBAL_FILTER_GROUPS.map(searchFilterGroupHtml).join("")}
        </div>
        <div class="global-summary">
          ${normalizedQuery.length < 2 ? "Select scopes, then type at least two characters." : `${results.total.toLocaleString()} matches${results.total > results.items.length ? ` - showing first ${results.items.length.toLocaleString()}` : ""}`}
        </div>
      </div>
      <div class="global-results">
        ${normalizedQuery.length < 2 ? `<div class="empty-state"><h2>Global Search</h2><p>Use the checkboxes to combine class, struct, function, enum, offset, member, parameter, flag, and inheritance searches.</p></div>` : globalResultsHtml(results.items)}
      </div>
    </div>
  `;

  const input = document.querySelector("#globalInput");
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
  input.addEventListener("input", () => {
    state.globalQuery = input.value;
    saveActiveTab();
    renderTabs();
    renderGlobalSearch();
  });
  document.querySelector("#clearGlobal").addEventListener("click", () => {
    state.globalQuery = "";
    saveActiveTab();
    renderTabs();
    renderGlobalSearch();
  });
  document.querySelectorAll("[data-global-filter]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      state.globalFilters[checkbox.dataset.globalFilter] = checkbox.checked;
      saveActiveTab();
      renderGlobalSearch();
    });
  });
  document.querySelectorAll("[data-result-section]").forEach((button) => {
    button.addEventListener("click", () => {
      state.section = button.dataset.resultSection;
      state.selected[state.section] = button.dataset.resultName;
      state.filter = "";
      els.filterInput.value = "";
      renderAll();
    });
  });
}

function searchFilterGroupHtml(group) {
  return `
    <fieldset class="filter-group">
      <legend>${escapeHtml(group.title)}</legend>
      <div class="check-grid">
        ${group.options.map(([id, label]) => `
          <label class="check-pill">
            <input type="checkbox" data-global-filter="${escapeAttr(id)}" ${state.globalFilters[id] ? "checked" : ""} />
            <span>${escapeHtml(label)}</span>
          </label>
        `).join("")}
      </div>
    </fieldset>
  `;
}

function globalResultsHtml(results) {
  if (!results.length) {
    return `<div class="empty-state"><h2>No matches</h2><p>Try a type, member, function, or enum name.</p></div>`;
  }

  return results.map((result) => `
    <button class="result-item" data-result-section="${result.section}" data-result-name="${escapeAttr(result.target)}">
      <span class="result-kind">${escapeHtml(result.kind)}</span>
      <span class="result-name">${escapeHtml(result.name)}</span>
      <span class="result-meta">${escapeHtml(result.meta)}</span>
    </button>
  `).join("");
}

function globalSearch(rawQuery) {
  const query = normalizeSearch(rawQuery);
  const filters = state.globalFilters;
  const results = [];
  const add = (section, kind, name, target, meta, matched, priority) => {
    results.push({
      section,
      kind,
      name,
      target,
      meta,
      score: searchScore(name, matched || name, query, priority)
    });
  };

  for (const item of state.dump.classes) {
    if (filters.classes && matchesSearch(item.name, query)) {
      add("classes", "class", item.name, item.name, `${item.members.length} members - ${hex(item.size)}`, item.name, 10);
    }
    if (filters.inheritance && item.inherit.some((name) => matchesSearch(name, query))) {
      const matched = item.inherit.find((name) => matchesSearch(name, query));
      add("classes", "inherits", item.name, item.name, `inherits ${matched}`, matched, 28);
    }
    if (filters.classMembers) {
      for (const member of item.members) {
        if (matchesSearch(member.name, query) || matchesSearch(member.type, query)) {
          add("classes", "class member", `${item.name}.${member.name}`, item.name, `${member.type} @ ${formatOffset(member.offset, member.name)}`, `${member.name} ${member.type}`, 34);
        }
      }
    }
  }

  for (const item of state.dump.structs) {
    if (filters.structs && matchesSearch(item.name, query)) {
      add("structs", "struct", item.name, item.name, `${item.members.length} members - ${hex(item.size)}`, item.name, 12);
    }
    if (filters.structMembers) {
      for (const member of item.members) {
        if (matchesSearch(member.name, query) || matchesSearch(member.type, query)) {
          add("structs", "struct member", `${item.name}.${member.name}`, item.name, `${member.type} @ ${formatOffset(member.offset, member.name)}`, `${member.name} ${member.type}`, 36);
        }
      }
    }
  }

  for (const owner of state.dump.functions) {
    if (filters.functions && matchesSearch(owner.name, query)) {
      add("functions", "owner", owner.name, owner.name, `${owner.count} functions`, owner.name, 18);
    }
    for (const fn of owner.functions) {
      if (filters.functions && matchesSearch(fn.name, query)) {
        add("functions", "function", `${owner.name}.${fn.name}`, owner.name, `${fn.returnType} - ${hex(fn.address)}`, fn.name, 16);
      }
      if (filters.functionParams) {
        for (const param of fn.params) {
          const haystack = `${param.name} ${param.type} ${param.modifier}`;
          if (matchesSearch(haystack, query)) {
            add("functions", "param", `${owner.name}.${fn.name}(${param.name || param.type})`, owner.name, `${param.type} ${param.name}`.trim(), haystack, 32);
          }
        }
      }
      if (filters.functionFlags && matchesSearch(fn.flags, query)) {
        add("functions", "flags", `${owner.name}.${fn.name}`, owner.name, fn.flags, fn.flags, 44);
      }
    }
  }

  for (const item of state.dump.enums) {
    if (filters.enums && matchesSearch(item.name, query)) {
      add("enums", "enum", item.name, item.name, `${item.values.length} values - ${item.underlying}`, item.name, 20);
    }
    if (filters.enumValues) {
      for (const value of item.values) {
        if (matchesSearch(value.name, query) || String(value.value) === query) {
          add("enums", "enum value", `${item.name}.${value.name}`, item.name, String(value.value), `${value.name} ${value.value}`, 38);
        }
      }
    }
  }

  if (filters.offsets) {
    for (const offset of state.dump.offsets) {
      if (matchesSearch(offset.name, query) || matchesSearch(hex(offset.value), query) || String(offset.value) === query) {
        add("offsets", "offset", offset.name, offset.name, hex(offset.value), `${offset.name} ${offset.value} ${hex(offset.value)}`, 24);
      }
    }
  }

  results.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  return {
    items: results.slice(0, 500),
    total: results.length
  };
}

function normalizeSearch(value) {
  return String(value ?? "").trim().toLowerCase();
}

function matchesSearch(value, query) {
  return normalizeSearch(value).includes(query);
}

function searchScore(name, matched, query, priority) {
  const normalizedName = normalizeSearch(name);
  const normalizedMatch = normalizeSearch(matched);
  let score = priority;

  if (normalizedMatch === query) score -= 30;
  else if (normalizedMatch.startsWith(query)) score -= 20;
  else if (normalizedMatch.includes(query)) score -= 10;

  if (normalizedName === query) score -= 8;
  else if (normalizedName.startsWith(query)) score -= 4;

  return score;
}

function detailHead(item, stats) {
  const inherit = item.inherit || [];
  return `
    <div class="detail-head">
      <div class="title-block">
        <div class="title-line">
          <h2>${escapeHtml(item.name)}</h2>
          <span class="badge">${escapeHtml(item.kind)}</span>
        </div>
        ${inherit.length ? `<div class="crumbs">${inherit.map((name, index) => `<span class="crumb">${index ? "&lt;- " : ""}${renderSymbolReference(name)}</span>`).join("")}</div>` : ""}
        <div class="stats-row">
          ${stats.map(([label, value]) => `<span class="stat">${escapeHtml(label)} <strong>${statValueHtml(item, label, value)}</strong></span>`).join("")}
        </div>
      </div>
    </div>
  `;
}

function statValueHtml(item, label, value) {
  if (label === "Parent" && item.parent) {
    return renderSymbolReference(item.parent);
  }
  return escapeHtml(String(value));
}

function modeTabs(modes, active) {
  return `
    <div class="mode-tabs">
      ${modes.map((mode) => `<button class="mode-button ${mode === active ? "active" : ""}" data-mode="${mode}">${escapeHtml(labelMode(mode))}</button>`).join("")}
    </div>
  `;
}

function bindModeButtons() {
  els.content.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mode[state.section] = button.dataset.mode;
      saveActiveTab();
      renderTabs();
      renderContent();
    });
  });
}

function sectionItems(section) {
  return state.dump?.[section] || [];
}

function selectedItem() {
  const items = sectionItems(state.section);
  const selected = state.selected[state.section];
  return items.find((item) => item.name === selected) || items[0] || null;
}

function pickPreferred(items, name) {
  return (items.find((item) => item.name === name) || items[0])?.name || null;
}

function topMembers(item) {
  return [...item.members].sort((a, b) => b.size - a.size).slice(0, 5);
}

function functionSignature(fn) {
  const params = fn.params.map((param) => `${param.type}${param.modifier ? ` ${param.modifier}` : ""} ${param.name}`.trim()).join(", ");
  return `${fn.returnType} ${fn.name}(${params});`;
}

function entityToMdk(item) {
  const keyword = item.kind === "class" ? "class" : "struct";
  const parent = item.parent ? ` : public ${item.parent}` : "";
  const lines = [`${keyword} ${item.name}${parent}`, "{"];
  for (const member of item.members) {
    const arraySuffix = member.arrayDim > 1 ? `[${member.arrayDim}]` : "";
    const pad = " ".repeat(Math.max(1, 44 - member.type.length));
    lines.push(`    ${member.type}${pad}${member.name}${arraySuffix}; // ${formatOffset(member.offset, member.name)} (${hex(member.size)})`);
  }
  lines.push(`}; // Size: ${hex(item.size)}`);
  return lines.join("\n");
}

function functionsToMdk(owner) {
  const lines = [`// Functions for ${owner.name}`];
  for (const fn of owner.functions) {
    lines.push(`${functionSignature(fn)} // ${hex(fn.address)} ${fn.flags}`);
  }
  return lines.join("\n");
}

function enumToMdk(item) {
  const lines = [`enum class ${item.name} : ${item.underlying}`, "{"];
  for (const value of item.values) {
    lines.push(`    ${value.name} = ${value.value},`);
  }
  lines.push("};");
  return lines.join("\n");
}

function offsetsToMdk(offsets) {
  return offsets.map((offset) => `constexpr uintptr_t ${offset.name} = ${hex(offset.value)};`).join("\n");
}

function labelMode(mode) {
  return {
    overview: "Overview",
    struct: "Struct",
    graph: "Graph",
    mdk: "MDK",
    params: "Params",
    list: "List",
    values: "Values"
  }[mode] || mode;
}

function totalFunctionCount() {
  return state.dump.functions.reduce((sum, owner) => sum + owner.functions.length, 0);
}

function formatOffset(offset, name = "") {
  const bit = String(name).match(/:\s*(\d+)$/);
  return bit ? `${hex(offset)} : ${bit[1]}` : hex(offset);
}

function hex(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return String(value ?? "");
  return `0x${value.toString(16).toUpperCase()}`;
}

function typeClass(kind) {
  return {
    C: "type-class",
    S: "type-struct",
    E: "type-enum"
  }[kind] || "type-default";
}

function showLoading(message = "Reading classes, structs, functions, enums, and offsets from disk.") {
  state.loading = true;
  els.shell.classList.add("welcome");
  els.shell.classList.remove("global");
  els.content.classList.add("welcome-content");
  els.content.classList.remove("global-content");
  els.sidebar.style.display = "none";
  renderTop();
  renderTabs();
  els.content.innerHTML = `<div class="empty-state"><h2>Loading Dumper7 data</h2><p>${escapeHtml(message)}</p></div>`;
}

function showError(message) {
  state.loading = false;
  state.dump = null;
  els.dumpPath.textContent = "Dump failed to load";
  els.footerStats.textContent = "No dump loaded";
  renderTabs();
  els.content.innerHTML = `
    <div class="error-state">
      <h2>Unable to load dump</h2>
      <p>${escapeHtml(message)}</p>
      <button id="backToPicker" class="primary-button">Pick Dump Location</button>
    </div>
  `;
  document.querySelector("#backToPicker")?.addEventListener("click", () => renderWelcome());
}

function renderWelcome() {
  els.shell.classList.add("welcome");
  els.shell.classList.remove("global");
  els.content.classList.add("welcome-content");
  els.content.classList.remove("global-content");
  els.sidebar.style.display = "none";
  renderTop();
  renderTabs();

  const defaultDir = state.serverDir || state.defaultDumpDir || "";
  els.content.innerHTML = `
    <div class="welcome-panel">
      <div class="welcome-copy">
        <span class="eyebrow">Nyx Dumper7 viewer</span>
        <h2>Select a Dump Folder</h2>
        <p>Nyx reads the five Dumper7 JSON files from a local path or directly from a folder you choose in the browser.</p>
      </div>

      <form id="pathForm" class="path-form">
        <label for="dumpDirInput">Server-side dump path</label>
        <div class="path-row">
          <input id="dumpDirInput" type="text" value="${escapeAttr(defaultDir)}" placeholder="C:/Dumper-7/.../Dumpspace" autocomplete="off" />
          <button class="primary-button" type="submit">Load Path</button>
        </div>
      </form>

      <div class="picker-actions">
        <button id="chooseFolderButton" class="ghost-button" type="button">Choose Folder</button>
        <button id="chooseFilesButton" class="ghost-button" type="button">Choose JSON Files</button>
      </div>

      <div class="required-files">
        <h3>Required files</h3>
        <ul>
          ${Object.values(REQUIRED_FILES).map((fileName) => `<li>${escapeHtml(fileName)}</li>`).join("")}
        </ul>
      </div>
    </div>
  `;

  document.querySelector("#pathForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.querySelector("#dumpDirInput");
    const dir = input.value.trim();
    if (dir) loadFromServer(dir);
  });

  document.querySelector("#chooseFolderButton").addEventListener("click", () => chooseDumpFiles());
  document.querySelector("#chooseFilesButton").addEventListener("click", () => els.fileInput.click());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
