"use strict";
// ── TYPES ──────────────────────────────────────────────────────────────────────
// ── HELPERS ───────────────────────────────────────────────────────────────────
function uid() {
    return Math.random().toString(36).slice(2, 10);
}
function getEl(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`Element #${id} not found`);
    return el;
}
function urlToTitle(url) {
    try {
        return new URL(url).hostname.replace("www.", "");
    }
    catch {
        return "New Tab";
    }
}
// ── SIDEBAR DATA ──────────────────────────────────────────────────────────────
const STORAGE_KEY = "poe-sidebar";
const TAB_STORAGE_KEY = "poe-tabs";
const defaultData = [
    {
        id: uid(),
        type: "page",
        name: "PoE Wiki",
        url: "https://www.poewiki.net/wiki/Path_of_Exile_Wiki",
    },
    {
        id: uid(),
        type: "folder",
        name: "Resources",
        open: true,
        children: [
            {
                id: uid(),
                type: "page",
                name: "PoE Trade",
                url: "https://www.pathofexile.com/trade",
            },
            {
                id: uid(),
                type: "page",
                name: "PoE Ninja",
                url: "https://poe.ninja",
            },
        ],
    },
];
let data = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") ?? defaultData;
function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
// ── TAB STATE ─────────────────────────────────────────────────────────────────
const tabs = [];
let activeTabId = null;
const tabList = getEl("tab-list");
const webviewContainer = getEl("webview-container");
function saveTabs() {
    const state = {
        tabs: tabs.map(t => ({ id: t.id, url: t.url, title: t.title })),
        activeId: activeTabId
    };
    localStorage.setItem(TAB_STORAGE_KEY, JSON.stringify(state));
}
function createTab(url, title, existingId) {
    const id = existingId || uid();
    const webview = document.createElement("webview");
    webview.src = url;
    webview.setAttribute("allowpopups", "true");
    webview.style.position = "absolute";
    webview.style.inset = "0";
    webview.style.width = "100%";
    webview.style.height = "100%";
    webview.style.display = "none";
    webviewContainer.appendChild(webview);
    const tab = { id, title, url, webview };
    tabs.push(tab);
    // Update tab title and save state
    webview.addEventListener("page-title-updated", (e) => {
        tab.title = e.title;
        const tabEl = tabList.querySelector(`.tab[data-id="${id}"]`);
        if (tabEl) {
            const titleEl = tabEl.querySelector(".tab-title");
            if (titleEl)
                titleEl.textContent = e.title;
        }
        saveTabs();
    });
    // Track the live URL and save state
    webview.addEventListener("did-navigate", (e) => {
        tab.url = e.url;
        saveTabs();
    });
    webview.addEventListener("did-navigate-in-page", (e) => {
        if (e.isMainFrame) {
            tab.url = e.url;
            saveTabs();
        }
    });
    // NEW: Context Menu Handler
    // Note: 'context-menu' is a special Electron event, not the standard DOM contextmenu
    webview.addEventListener("context-menu", (e) => {
        // The 'params' object contains linkURL, srcURL, selectionText, etc.
        window.electronAPI.showContextMenu(e.params);
    });
    return tab;
}
function openTab(url, title) {
    const tab = createTab(url, title ?? urlToTitle(url));
    setActiveTab(tab.id);
    saveTabs();
}
function closeTab(id) {
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx === -1)
        return;
    tabs[idx].webview.remove();
    tabs.splice(idx, 1);
    if (activeTabId === id) {
        activeTabId = tabs.length > 0
            ? tabs[Math.min(idx, tabs.length - 1)].id
            : null;
    }
    renderTabs();
    if (activeTabId) {
        const nextTab = tabs.find((t) => t.id === activeTabId);
        if (nextTab)
            nextTab.webview.style.display = "flex";
    }
    saveTabs();
}
function setActiveTab(id) {
    activeTabId = id;
    tabs.forEach((t) => {
        t.webview.style.display = t.id === id ? "flex" : "none";
    });
    renderTabs();
    saveTabs();
}
function restoreTabs() {
    const raw = localStorage.getItem(TAB_STORAGE_KEY);
    if (!raw)
        return;
    try {
        const state = JSON.parse(raw);
        if (state.tabs && Array.isArray(state.tabs)) {
            state.tabs.forEach(t => {
                createTab(t.url, t.title, t.id);
            });
        }
        if (state.activeId && tabs.find(t => t.id === state.activeId)) {
            setActiveTab(state.activeId);
        }
        else if (tabs.length > 0) {
            setActiveTab(tabs[0].id);
        }
    }
    catch (e) {
        console.error("Failed to restore tabs", e);
    }
}
function renderTabs() {
    let emptyState = document.getElementById("empty-state");
    if (tabs.length === 0) {
        tabList.innerHTML = "";
        if (!emptyState) {
            emptyState = document.createElement("div");
            emptyState.id = "empty-state";
            emptyState.innerHTML = `
        <span class="empty-icon">⚔️</span>
        <p>Click a page in the sidebar to open it</p>
      `;
            webviewContainer.appendChild(emptyState);
        }
        return;
    }
    emptyState?.remove();
    tabList.querySelectorAll(".tab").forEach((el) => {
        if (!tabs.find((t) => t.id === el.dataset["id"]))
            el.remove();
    });
    tabs.forEach((tab, i) => {
        const existing = tabList.querySelector(`.tab[data-id="${tab.id}"]`);
        if (existing) {
            existing.classList.toggle("active", tab.id === activeTabId);
            return;
        }
        const el = document.createElement("div");
        el.className = "tab" + (tab.id === activeTabId ? " active" : "");
        el.dataset["id"] = tab.id;
        const favicon = document.createElement("img");
        favicon.className = "tab-favicon";
        try {
            favicon.src = `${new URL(tab.url).origin}/favicon.ico`;
        }
        catch {
            favicon.style.display = "none";
        }
        favicon.onerror = () => { favicon.style.display = "none"; };
        const titleEl = document.createElement("span");
        titleEl.className = "tab-title";
        titleEl.textContent = tab.title;
        titleEl.title = tab.url;
        const closeEl = document.createElement("span");
        closeEl.className = "tab-close";
        closeEl.textContent = "×";
        closeEl.addEventListener("click", (e) => {
            e.stopPropagation();
            closeTab(tab.id);
        });
        el.addEventListener("click", () => setActiveTab(tab.id));
        el.append(favicon, titleEl, closeEl);
        if (i < tabList.children.length) {
            tabList.insertBefore(el, tabList.children[i]);
        }
        else {
            tabList.appendChild(el);
        }
    });
}
// ── SIDEBAR STATE ─────────────────────────────────────────────────────────────
let ctxTarget = null;
let modalMode = null;
let activePageId = null;
// ── ELEMENTS ──────────────────────────────────────────────────────────────────
const sidebar = getEl("sidebar");
const toggleTabEl = getEl("toggle-tab");
const treeEl = getEl("tree");
const ctxMenu = getEl("ctx-menu");
const modalOverlay = getEl("modal-overlay");
const modalTitle = getEl("modal-title");
const modalName = getEl("modal-name");
const modalUrl = getEl("modal-url");
const modalUrlField = getEl("modal-url-field");
// ── SIDEBAR TOGGLE + RESIZE ───────────────────────────────────────────────────
const SIDEBAR_MIN = 160;
const SIDEBAR_MAX = 500;
const DRAG_THRESHOLD = 4;
let sidebarWidth = 240;
let isDragging = false;
let dragStartX = 0;
let dragStartWidth = 0;
let dragMoved = 0;
function setSidebarWidth(width) {
    sidebarWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, width));
    sidebar.style.width = `${sidebarWidth}px`;
}
toggleTabEl.addEventListener("mousedown", (e) => {
    if (e.button !== 0)
        return;
    isDragging = false;
    dragMoved = 0;
    dragStartX = e.clientX;
    dragStartWidth = sidebar.classList.contains("open") ? sidebarWidth : 0;
    sidebar.style.transition = "none";
    const onMouseMove = (e) => {
        const delta = e.clientX - dragStartX;
        dragMoved = Math.abs(delta);
        if (dragMoved > DRAG_THRESHOLD) {
            isDragging = true;
            if (!sidebar.classList.contains("open") && delta > 0) {
                sidebar.classList.add("open");
                toggleTabEl.classList.add("open");
                dragStartWidth = SIDEBAR_MIN;
            }
            if (sidebar.classList.contains("open")) {
                setSidebarWidth(dragStartWidth + delta);
            }
        }
    };
    const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        sidebar.style.transition = "";
        if (!isDragging) {
            const isOpen = sidebar.classList.toggle("open");
            toggleTabEl.classList.toggle("open");
            if (isOpen) {
                setSidebarWidth(sidebarWidth || 240);
            }
            else {
                sidebar.style.width = "0";
            }
        }
        else {
            if (sidebarWidth <= SIDEBAR_MIN && dragStartWidth > SIDEBAR_MIN) {
                sidebar.classList.remove("open");
                toggleTabEl.classList.remove("open");
                sidebar.style.width = "0";
            }
        }
        isDragging = false;
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
});
// ── RENDER TREE ───────────────────────────────────────────────────────────────
function renderTree() {
    treeEl.innerHTML = "";
    renderNodes(data, treeEl, 0);
}
function renderNodes(nodes, container, depth) {
    nodes.forEach((node) => {
        const el = document.createElement("div");
        el.className = "tree-node" + (depth > 0 ? ` indent-${Math.min(depth, 4)}` : "");
        const row = document.createElement("div");
        row.className = "node-row" + (node.id === activePageId ? " active" : "");
        row.dataset["id"] = node.id;
        if (node.type === "folder") {
            const chev = document.createElement("span");
            chev.className = "node-icon chevron" + (node.open ? " open" : "");
            chev.textContent = "▶";
            const icon = document.createElement("span");
            icon.className = "node-icon folder";
            icon.textContent = node.open ? "📂" : "📁";
            const label = document.createElement("span");
            label.className = "node-label";
            label.textContent = node.name;
            row.append(chev, icon, label);
            row.addEventListener("click", () => {
                node.open = !node.open;
                save();
                renderTree();
            });
        }
        else {
            const spacer = document.createElement("span");
            spacer.style.cssText = "width:14px;flex-shrink:0";
            const icon = document.createElement("span");
            icon.className = "node-icon page";
            icon.textContent = "📄";
            const label = document.createElement("span");
            label.className = "node-label";
            label.textContent = node.name;
            row.append(spacer, icon, label);
            row.addEventListener("click", () => {
                activePageId = node.id;
                openTab(node.url, node.name);
                renderTree();
            });
        }
        row.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            e.stopPropagation();
            ctxTarget = { node, parentArray: findParent(data, node.id) ?? data };
            showCtxMenu(e.clientX, e.clientY, true);
        });
        el.appendChild(row);
        if (node.type === "folder") {
            const children = document.createElement("div");
            children.className = "node-children" + (node.open ? "" : " collapsed");
            if (node.open)
                children.style.maxHeight = "9999px";
            renderNodes(node.children ?? [], children, depth + 1);
            el.appendChild(children);
        }
        container.appendChild(el);
    });
}
function findParent(arr, id, parent = arr) {
    for (const n of arr) {
        if (n.id === id)
            return parent;
        if (n.type === "folder") {
            const found = findParent(n.children, id, n.children);
            if (found)
                return found;
        }
    }
    return null;
}
// ── CONTEXT MENU (SIDEBAR) ───────────────────────────────────────────────────
function showCtxMenu(x, y, onNode = false) {
    const hasNode = onNode && ctxTarget?.node != null;
    getEl("ctx-rename-sep").style.display = hasNode ? "" : "none";
    getEl("ctx-rename").style.display = hasNode ? "" : "none";
    getEl("ctx-delete").style.display = hasNode ? "" : "none";
    ctxMenu.style.left = `${x}px`;
    ctxMenu.style.top = `${y}px`;
    ctxMenu.classList.add("visible");
    requestAnimationFrame(() => {
        const rect = ctxMenu.getBoundingClientRect();
        if (rect.right > window.innerWidth)
            ctxMenu.style.left = `${x - rect.width}px`;
        if (rect.bottom > window.innerHeight)
            ctxMenu.style.top = `${y - rect.height}px`;
    });
}
function hideCtxMenu() {
    ctxMenu.classList.remove("visible");
}
document.addEventListener("click", hideCtxMenu);
document.addEventListener("contextmenu", (e) => {
    const target = e.target;
    if (sidebar.contains(target) && !target.closest(".node-row")) {
        e.preventDefault();
        ctxTarget = { parentArray: data, node: null };
        showCtxMenu(e.clientX, e.clientY, false);
    }
    else if (!ctxMenu.contains(target)) {
        hideCtxMenu();
    }
});
getEl("ctx-add-page").addEventListener("click", () => { hideCtxMenu(); openModal("add-page"); });
getEl("ctx-add-folder").addEventListener("click", () => { hideCtxMenu(); openModal("add-folder"); });
getEl("ctx-rename").addEventListener("click", () => { hideCtxMenu(); openModal("rename"); });
getEl("ctx-delete").addEventListener("click", () => {
    hideCtxMenu();
    if (!ctxTarget?.node)
        return;
    const idx = ctxTarget.parentArray.findIndex((n) => n.id === ctxTarget.node.id);
    if (idx !== -1)
        ctxTarget.parentArray.splice(idx, 1);
    save();
    renderTree();
});
// ── MODAL ─────────────────────────────────────────────────────────────────────
function openModal(mode) {
    modalMode = mode;
    modalName.value = "";
    modalUrl.value = "";
    if (mode === "add-page") {
        modalTitle.textContent = "New Page";
        modalUrlField.style.display = "";
        modalName.placeholder = "e.g. PoE Wiki";
        modalUrl.placeholder = "https://...";
    }
    else if (mode === "add-folder") {
        modalTitle.textContent = "New Folder";
        modalUrlField.style.display = "none";
        modalName.placeholder = "e.g. Resources";
    }
    else if (mode === "rename") {
        modalTitle.textContent = "Rename";
        modalUrlField.style.display = ctxTarget?.node?.type === "page" ? "" : "none";
        modalName.value = ctxTarget?.node?.name ?? "";
        modalUrl.value = ctxTarget?.node?.type === "page"
            ? ctxTarget.node.url : "";
    }
    modalOverlay.classList.add("visible");
    setTimeout(() => modalName.focus(), 50);
}
function closeModal() {
    modalOverlay.classList.remove("visible");
    modalMode = null;
}
getEl("modal-cancel").addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => { if (e.target === modalOverlay)
    closeModal(); });
getEl("modal-confirm").addEventListener("click", () => {
    const name = modalName.value.trim();
    const url = modalUrl.value.trim();
    if (!name) {
        modalName.focus();
        return;
    }
    if (modalMode === "add-page") {
        insertNode({ id: uid(), type: "page", name, url: url || "about:blank" });
    }
    else if (modalMode === "add-folder") {
        insertNode({ id: uid(), type: "folder", name, open: true, children: [] });
    }
    else if (modalMode === "rename" && ctxTarget?.node) {
        ctxTarget.node.name = name;
        if (ctxTarget.node.type === "page" && url) {
            ctxTarget.node.url = url;
        }
    }
    save();
    renderTree();
    closeModal();
});
modalOverlay.addEventListener("keydown", (e) => {
    if (e.key === "Enter")
        getEl("modal-confirm").click();
    if (e.key === "Escape")
        closeModal();
});
function insertNode(node) {
    var _a;
    if (!ctxTarget) {
        data.push(node);
        return;
    }
    const { parentArray, node: targetNode } = ctxTarget;
    if (targetNode?.type === "folder") {
        (_a = targetNode).children ?? (_a.children = []);
        targetNode.children.push(node);
        targetNode.open = true;
    }
    else {
        (parentArray ?? data).push(node);
    }
}
// ── INIT ──────────────────────────────────────────────────────────────────────
window.electronAPI.onOpenInNewTab((url) => {
    openTab(url, urlToTitle(url));
});
renderTree();
restoreTabs(); // Restore previous session
renderTabs();
