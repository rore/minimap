const FIXED_SECTIONS = ["Summary", "Why", "In Scope", "Out of Scope", "Done When", "Notes"];
const SCOPE_STORAGE_KEY = "roadmap-ui.scope-collapsed";

const state = {
  workspace: null,
  selectedItemId: null,
  currentItem: null,
  collapsedGroups: new Set(),
  scopeCollapsed: loadStoredScopePreference(),
};

const layoutElement = document.querySelector("#layout-shell");
const boardGroupsElement = document.querySelector("#board-groups");
const scopePanelElement = document.querySelector("#scope-panel");
const scopeContentElement = document.querySelector("#scope-content");
const scopeToggleButton = document.querySelector("#scope-toggle");
const roadmapPathElement = document.querySelector("#roadmap-path");
const workspaceSummaryElement = document.querySelector("#workspace-summary");
const repoNameElement = document.querySelector("#repo-name");
const editorTitleElement = document.querySelector("#editor-title");
const editorSubtitleElement = document.querySelector("#editor-subtitle");
const saveButton = document.querySelector("#save-button");
const refreshButton = document.querySelector("#refresh-button");
const statusBanner = document.querySelector("#status-banner");
const form = document.querySelector("#item-form");

const fields = {
  id: document.querySelector("#field-id"),
  title: document.querySelector("#field-title"),
  status: document.querySelector("#field-status"),
  priority: document.querySelector("#field-priority"),
  commitment: document.querySelector("#field-commitment"),
  Summary: document.querySelector("#section-summary"),
  Why: document.querySelector("#section-why"),
  "In Scope": document.querySelector("#section-in-scope"),
  "Out of Scope": document.querySelector("#section-out-of-scope"),
  "Done When": document.querySelector("#section-done-when"),
  Notes: document.querySelector("#section-notes"),
};

function loadStoredScopePreference() {
  try {
    return window.localStorage.getItem(SCOPE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function persistScopePreference() {
  try {
    window.localStorage.setItem(SCOPE_STORAGE_KEY, String(state.scopeCollapsed));
  } catch {
    // Ignore storage failures; the toggle still works for the session.
  }
}

function setBanner(message, tone = "info") {
  if (!message) {
    statusBanner.hidden = true;
    statusBanner.textContent = "";
    statusBanner.dataset.tone = "";
    return;
  }

  statusBanner.hidden = false;
  statusBanner.dataset.tone = tone;
  statusBanner.textContent = message;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function ensureSelectValue(select, value) {
  if (!Array.from(select.options).some((option) => option.value === value)) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }

  select.value = value;
}

function getBoardItems() {
  return state.workspace?.boardGroups.flatMap((group) => group.items) ?? [];
}

function renderBadges(item) {
  return [item.status, item.priority, item.commitment]
    .map((value) => `<span class="badge">${escapeHtml(value)}</span>`)
    .join("");
}

function updateDocumentTitle() {
  const repoName = state.workspace?.repoName || repoNameElement.textContent || "Roadmap";
  repoNameElement.textContent = repoName;
  document.title = `${repoName} Roadmap`;
}

function updateWorkspaceSummary() {
  const groups = state.workspace?.boardGroups.length ?? 0;
  const items = getBoardItems().length;
  workspaceSummaryElement.textContent = state.workspace ? `${items} items / ${groups} groups` : "Unavailable";
}

function renderScopeChrome() {
  layoutElement.dataset.scopeCollapsed = String(state.scopeCollapsed);
  scopePanelElement.classList.toggle("scope-collapsed", state.scopeCollapsed);
  scopeToggleButton.textContent = state.scopeCollapsed ? "Expand" : "Collapse";
  scopeToggleButton.setAttribute("aria-expanded", state.scopeCollapsed ? "false" : "true");
  scopeToggleButton.setAttribute("aria-label", state.scopeCollapsed ? "Expand scope panel" : "Collapse scope panel");
}

function syncWorkspaceChrome() {
  updateDocumentTitle();
  updateWorkspaceSummary();
  renderScopeChrome();
}

function toggleScopePanel() {
  state.scopeCollapsed = !state.scopeCollapsed;
  persistScopePreference();
  renderScopeChrome();
}

function toggleGroup(name) {
  if (state.collapsedGroups.has(name)) {
    state.collapsedGroups.delete(name);
  } else {
    state.collapsedGroups.add(name);
  }

  renderBoard();
}

function reorderGroups(groups, fromIndex, toIndex) {
  const nextGroups = [...groups];
  const [moved] = nextGroups.splice(fromIndex, 1);
  nextGroups.splice(toIndex, 0, moved);
  return nextGroups;
}

async function saveBoardGroups() {
  const groups = state.workspace.boardGroups.map((group) => ({
    name: group.name,
    itemIds: group.items.map((item) => item.id),
  }));

  const workspace = await fetchJson("/api/board", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ groups }),
  });

  state.workspace = workspace;
  syncWorkspaceChrome();
}

async function persistGroupOrder(fromIndex, toIndex) {
  if (!state.workspace || fromIndex === toIndex) {
    return;
  }

  if (toIndex < 0 || toIndex >= state.workspace.boardGroups.length) {
    return;
  }

  const previousGroups = state.workspace.boardGroups;
  state.workspace = {
    ...state.workspace,
    boardGroups: reorderGroups(previousGroups, fromIndex, toIndex),
  };
  renderBoard();
  setBanner("Saving board order...");

  try {
    await saveBoardGroups();
    renderBoard();
    setBanner("Board order saved.", "success");
  } catch (error) {
    state.workspace = {
      ...state.workspace,
      boardGroups: previousGroups,
    };
    renderBoard();
    setBanner(error.message, "error");
  }
}

function renderBoard() {
  if (!state.workspace) {
    boardGroupsElement.innerHTML = "";
    return;
  }

  if (state.workspace.boardGroups.length === 0) {
    boardGroupsElement.innerHTML = '<div class="empty-state">No board groups found in board.md.</div>';
    return;
  }

  const html = state.workspace.boardGroups
    .map((group, index) => {
      const collapsed = state.collapsedGroups.has(group.name);
      const items = group.items
        .map((item) => {
          const active = item.id === state.selectedItemId ? " board-item-active" : "";
          return `
            <button class="board-item${active}" data-item-id="${escapeHtml(item.id)}" type="button" aria-pressed="${item.id === state.selectedItemId ? "true" : "false"}">
              <span class="board-item-top">
                <span class="board-item-title">${escapeHtml(item.title)}</span>
                <span class="board-item-kind">${escapeHtml(item.kind)}</span>
              </span>
              <span class="board-item-id">${escapeHtml(item.id)}</span>
              <span class="badge-row">${renderBadges(item)}</span>
            </button>
          `;
        })
        .join("");

      return `
        <section class="board-group${collapsed ? " board-group-collapsed" : ""}" data-group-index="${index}">
          <div class="board-group-header">
            <button class="collapse-toggle" data-group-toggle="${escapeHtml(group.name)}" type="button" aria-expanded="${collapsed ? "false" : "true"}">
              <span class="collapse-icon">${collapsed ? "+" : "-"}</span>
              <span class="group-name">${escapeHtml(group.name)}</span>
              <span class="group-count">${group.items.length}</span>
            </button>
            <div class="group-actions">
              <button class="order-button" data-move-group="up" data-group-index="${index}" type="button" aria-label="Move ${escapeHtml(group.name)} up" ${index === 0 ? "disabled" : ""}>Up</button>
              <button class="order-button" data-move-group="down" data-group-index="${index}" type="button" aria-label="Move ${escapeHtml(group.name)} down" ${index === state.workspace.boardGroups.length - 1 ? "disabled" : ""}>Down</button>
            </div>
          </div>
          <div class="board-item-list" ${collapsed ? "hidden" : ""}>${items}</div>
        </section>
      `;
    })
    .join("");

  boardGroupsElement.innerHTML = html;

  for (const button of boardGroupsElement.querySelectorAll("[data-item-id]")) {
    button.addEventListener("click", () => {
      void loadItem(button.dataset.itemId);
    });
  }

  for (const button of boardGroupsElement.querySelectorAll("[data-group-toggle]")) {
    button.addEventListener("click", () => {
      toggleGroup(button.dataset.groupToggle);
    });
  }

  for (const button of boardGroupsElement.querySelectorAll("[data-move-group]")) {
    button.addEventListener("click", () => {
      const fromIndex = Number(button.dataset.groupIndex);
      const toIndex = button.dataset.moveGroup === "up" ? fromIndex - 1 : fromIndex + 1;
      void persistGroupOrder(fromIndex, toIndex);
    });
  }
}

function renderScope() {
  scopeContentElement.textContent = state.workspace?.scopeText ?? "";
}

function resetEditor() {
  editorTitleElement.textContent = "Item";
  editorSubtitleElement.textContent = "Choose an item from the board.";
  saveButton.disabled = true;
  form.reset();
}

function renderItem(item) {
  state.currentItem = item;
  saveButton.disabled = false;
  editorTitleElement.textContent = item.metadata.title;
  editorSubtitleElement.textContent = item.filePath;
  fields.id.value = item.metadata.id || "";
  fields.title.value = item.metadata.title || "";
  ensureSelectValue(fields.status, item.metadata.status || "queued");
  ensureSelectValue(fields.priority, item.metadata.priority || "medium");
  ensureSelectValue(fields.commitment, item.metadata.commitment || "uncommitted");

  for (const sectionName of FIXED_SECTIONS) {
    fields[sectionName].value = item.sections[sectionName] || "";
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message || "Request failed.");
  }

  return payload;
}

async function loadWorkspace(preferredItemId = state.selectedItemId) {
  try {
    const workspace = await fetchJson("/api/workspace");
    state.workspace = workspace;
    roadmapPathElement.textContent = workspace.roadmapPath;
    syncWorkspaceChrome();
    renderBoard();
    renderScope();
    setBanner("");

    const firstItemId = workspace.boardGroups.flatMap((group) => group.items).at(0)?.id;
    const itemIdToLoad = preferredItemId || firstItemId;

    if (itemIdToLoad) {
      await loadItem(itemIdToLoad, false);
    } else {
      resetEditor();
    }
  } catch (error) {
    state.workspace = null;
    roadmapPathElement.textContent = "Unavailable";
    syncWorkspaceChrome();
    boardGroupsElement.innerHTML = "";
    scopeContentElement.textContent = "";
    resetEditor();
    setBanner(error.message, "error");
  }
}

async function loadItem(itemId, rerenderBoard = true) {
  try {
    const item = await fetchJson(`/api/items/${encodeURIComponent(itemId)}`);
    state.selectedItemId = itemId;
    renderItem(item);
    if (rerenderBoard) {
      renderBoard();
    }
    setBanner("");
  } catch (error) {
    setBanner(error.message, "error");
  }
}

function collectPayload() {
  return {
    metadata: {
      id: fields.id.value,
      title: fields.title.value,
      status: fields.status.value,
      priority: fields.priority.value,
      commitment: fields.commitment.value,
    },
    sections: {
      Summary: fields.Summary.value,
      Why: fields.Why.value,
      "In Scope": fields["In Scope"].value,
      "Out of Scope": fields["Out of Scope"].value,
      "Done When": fields["Done When"].value,
      Notes: fields.Notes.value,
    },
  };
}

async function saveCurrentItem() {
  if (!state.selectedItemId) {
    return;
  }

  saveButton.disabled = true;
  setBanner("Saving item...");

  try {
    const payload = collectPayload();
    await fetchJson(`/api/items/${encodeURIComponent(state.selectedItemId)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    await loadWorkspace(state.selectedItemId);
    setBanner("Saved.", "success");
  } catch (error) {
    setBanner(error.message, "error");
  } finally {
    saveButton.disabled = false;
  }
}

saveButton.addEventListener("click", () => {
  void saveCurrentItem();
});

refreshButton.addEventListener("click", () => {
  void loadWorkspace();
});

scopeToggleButton.addEventListener("click", () => {
  toggleScopePanel();
});

resetEditor();
renderScopeChrome();
void loadWorkspace();

