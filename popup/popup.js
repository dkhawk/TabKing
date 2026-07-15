/**
 * TabKing Popup Script
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const openOptionsBtn = document.getElementById('openOptionsBtn');
  const openFinderBtn = document.getElementById('openFinderBtn');
  const autoGroupBtn = document.getElementById('autoGroupBtn');
  const groupByDomainBtn = document.getElementById('groupByDomainBtn');
  const ungroupAllBtn = document.getElementById('ungroupAllBtn');
  const saveSessionBtn = document.getElementById('saveSessionBtn');
  const collapseGroupsBtn = document.getElementById('collapseGroupsBtn');
  const expandGroupsBtn = document.getElementById('expandGroupsBtn');
  
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  
  const tabOpenView = document.getElementById('tabOpenView');
  const tabSavedView = document.getElementById('tabSavedView');
  const viewOpenWorkspace = document.getElementById('viewOpenWorkspace');
  const viewSavedSessions = document.getElementById('viewSavedSessions');
  
  const tabsContainer = document.getElementById('tabsContainer');
  const sessionsContainer = document.getElementById('sessionsContainer');
  
  const closeStalePopupBtn = document.getElementById('closeStalePopupBtn');
  const staleTabsCountEl = document.getElementById('staleTabsCount');
  
  const totalTabsCountEl = document.getElementById('totalTabsCount');
  const activeGroupsCountEl = document.getElementById('activeGroupsCount');
  const savedSessionsCountEl = document.getElementById('savedSessionsCount');
  
  // Save Session Modal Elements
  const saveModal = document.getElementById('saveModal');
  const sessionNameInput = document.getElementById('sessionNameInput');
  const closeTabsCheck = document.getElementById('closeTabsCheck');
  const cancelSaveBtn = document.getElementById('cancelSaveBtn');
  const confirmSaveBtn = document.getElementById('confirmSaveBtn');

  let currentWindowId = null;

  // Initialize
  const windowInfo = await chrome.windows.getLastFocused();
  currentWindowId = windowInfo.id;
  await refreshState();

  // Navigation Tabs Switching
  tabOpenView.addEventListener('click', () => {
    tabOpenView.classList.add('active');
    tabSavedView.classList.remove('active');
    viewOpenWorkspace.classList.add('active');
    viewSavedSessions.classList.remove('active');
  });

  tabSavedView.addEventListener('click', () => {
    tabSavedView.classList.add('active');
    tabOpenView.classList.remove('active');
    viewSavedSessions.classList.add('active');
    viewOpenWorkspace.classList.remove('active');
    renderSavedSessions();
  });

  if (openOptionsBtn) {
    openOptionsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  const openFullTabViewBtn = document.getElementById('openFullTabViewBtn');

  if (openFinderBtn) {
    openFinderBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('finder/finder.html') });
    });
  }

  if (openFullTabViewBtn) {
    openFullTabViewBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('finder/finder.html') });
    });
  }

  if (autoGroupBtn) {
    autoGroupBtn.addEventListener('click', async () => {
      autoGroupBtn.disabled = true;
      try {
        await chrome.runtime.sendMessage({ action: 'AUTO_GROUP_TABS', windowId: currentWindowId });
        await refreshState();
      } finally {
        autoGroupBtn.disabled = false;
      }
    });
  }

  if (closeStalePopupBtn) {
    closeStalePopupBtn.addEventListener('click', async () => {
      const { staleHours = 4, staleDirection = 'older' } = await chrome.storage.local.get(['staleHours', 'staleDirection']);
      const allTabs = await chrome.tabs.query({ windowId: currentWindowId });
      const STALE_THRESHOLD_MS = staleHours * 60 * 60 * 1000;

      const staleTabIds = allTabs
        .filter((t) => {
          if (t.pinned || t.active || !t.lastAccessed) return false;
          const diffMs = Date.now() - t.lastAccessed;
          return staleDirection === 'older' ? (diffMs >= STALE_THRESHOLD_MS) : (diffMs <= STALE_THRESHOLD_MS);
        })
        .map((t) => t.id);

      const dirStr = staleDirection === 'older' ? 'older than' : 'newer than';

      if (staleTabIds.length === 0) {
        alert(`No tabs inactive ${dirStr} ${staleHours} hours found in this window.`);
        return;
      }

      if (confirm(`Close ${staleTabIds.length} tabs ${dirStr} ${staleHours} hours in this window?`)) {
        await chrome.tabs.remove(staleTabIds);
        await refreshState();
      }
    });
  }

  if (groupByDomainBtn) {
    groupByDomainBtn.addEventListener('click', async () => {
      groupByDomainBtn.disabled = true;
      try {
        await chrome.runtime.sendMessage({ action: 'GROUP_BY_DOMAIN', windowId: currentWindowId });
        await refreshState();
      } finally {
        groupByDomainBtn.disabled = false;
      }
    });
  }

  if (ungroupAllBtn) {
    ungroupAllBtn.addEventListener('click', async () => {
      await chrome.runtime.sendMessage({ action: 'UNGROUP_ALL', windowId: currentWindowId });
      await refreshState();
    });
  }

  if (collapseGroupsBtn) {
    collapseGroupsBtn.addEventListener('click', async () => {
      await chrome.runtime.sendMessage({ action: 'TOGGLE_COLLAPSE', windowId: currentWindowId, collapse: true });
      await refreshState();
    });
  }

  if (expandGroupsBtn) {
    expandGroupsBtn.addEventListener('click', async () => {
      await chrome.runtime.sendMessage({ action: 'TOGGLE_COLLAPSE', windowId: currentWindowId, collapse: false });
      await refreshState();
    });
  }

  // Save Session Modal Flow
  if (saveSessionBtn) {
    saveSessionBtn.addEventListener('click', () => {
      sessionNameInput.value = `Session ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      saveModal.showModal();
    });
  }

  if (cancelSaveBtn) {
    cancelSaveBtn.addEventListener('click', () => {
      saveModal.close();
    });
  }

  if (confirmSaveBtn) {
    confirmSaveBtn.addEventListener('click', async () => {
      const sessionName = sessionNameInput.value.trim();
      const closeTabs = closeTabsCheck.checked;
      confirmSaveBtn.disabled = true;
      try {
        await chrome.runtime.sendMessage({
          action: 'SAVE_SESSION',
          sessionName,
          closeTabs
        });
        saveModal.close();
        await refreshState();
      } finally {
        confirmSaveBtn.disabled = false;
      }
    });
  }

  // Search Filter
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim().toLowerCase();
      if (clearSearchBtn) clearSearchBtn.classList.toggle('hidden', query.length === 0);
      renderOpenTabs(query);
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      clearSearchBtn.classList.add('hidden');
      renderOpenTabs('');
    });
  }

  /**
   * Refreshes tabs, groups, stats, and saved sessions UI state
   */
  async function refreshState() {
    await renderOpenTabs(searchInput.value.trim().toLowerCase());
    await renderSavedSessions();
  }

  /**
   * Renders open tab groups and tabs list
   */
  async function renderOpenTabs(filterQuery = '') {
    const tabs = await chrome.tabs.query({ windowId: currentWindowId });
    const groups = await chrome.tabGroups.query({ windowId: currentWindowId });

    const { staleHours = 4, staleDirection = 'older' } = await chrome.storage.local.get(['staleHours', 'staleDirection']);
    const STALE_THRESHOLD_MS = staleHours * 60 * 60 * 1000;
    const staleCount = tabs.filter((t) => {
      if (t.pinned || t.active || !t.lastAccessed) return false;
      const diffMs = Date.now() - t.lastAccessed;
      return staleDirection === 'older' ? (diffMs >= STALE_THRESHOLD_MS) : (diffMs <= STALE_THRESHOLD_MS);
    }).length;

    totalTabsCountEl.textContent = tabs.length;
    if (staleTabsCountEl) staleTabsCountEl.textContent = staleCount;
    activeGroupsCountEl.textContent = groups.length;

    // Filter tabs if search query present
    const filteredTabs = filterQuery
      ? tabs.filter((t) => (t.title && t.title.toLowerCase().includes(filterQuery)) || (t.url && t.url.toLowerCase().includes(filterQuery)))
      : tabs;

    if (filteredTabs.length === 0) {
      tabsContainer.innerHTML = filterQuery
        ? '<div class="empty-state">No tabs matching your search query.</div>'
        : '<div class="empty-state">No open tabs found in workspace.</div>';
      return;
    }

    tabsContainer.innerHTML = '';

    // Group mapping
    const groupMap = new Map();
    groups.forEach((g) => groupMap.set(g.id, g));

    const groupedTabs = new Map();
    const ungroupedTabs = [];

    filteredTabs.forEach((tab) => {
      if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE && groupMap.has(tab.groupId)) {
        if (!groupedTabs.has(tab.groupId)) {
          groupedTabs.set(tab.groupId, []);
        }
        groupedTabs.get(tab.groupId).push(tab);
      } else {
        ungroupedTabs.push(tab);
      }
    });

    // Render Native Chrome Tab Groups
    for (const [groupId, groupTabList] of groupedTabs.entries()) {
      const groupObj = groupMap.get(groupId);
      const groupCard = document.createElement('div');
      groupCard.className = `group-card ${groupObj.collapsed ? 'collapsed' : ''}`;

      const header = document.createElement('div');
      header.className = 'group-header';
      header.innerHTML = `
        <div class="group-title-badge">
          <span class="group-dot ${groupObj.color || 'blue'}"></span>
          <span class="group-name">${escapeHtml(groupObj.title || 'Group')}</span>
        </div>
        <span class="group-count">${groupTabList.length} tabs</span>
      `;

      header.addEventListener('click', async () => {
        const nextState = !groupObj.collapsed;
        await chrome.tabGroups.update(groupId, { collapsed: nextState });
        groupCard.classList.toggle('collapsed', nextState);
      });

      const itemsContainer = document.createElement('div');
      itemsContainer.className = 'group-items';

      groupTabList.forEach((tab) => {
        itemsContainer.appendChild(createTabRow(tab));
      });

      groupCard.appendChild(header);
      groupCard.appendChild(itemsContainer);
      tabsContainer.appendChild(groupCard);
    }

    // Render Ungrouped Tabs
    if (ungroupedTabs.length > 0) {
      const ungroupedCard = document.createElement('div');
      ungroupedCard.className = 'group-card';

      if (groupedTabs.size > 0) {
        const header = document.createElement('div');
        header.className = 'group-header';
        header.innerHTML = `
          <div class="group-title-badge">
            <span class="group-dot grey"></span>
            <span class="group-name">Ungrouped Tabs</span>
          </div>
          <span class="group-count">${ungroupedTabs.length} tabs</span>
        `;
        ungroupedCard.appendChild(header);
      }

      const itemsContainer = document.createElement('div');
      itemsContainer.className = 'group-items';

      ungroupedTabs.forEach((tab) => {
        itemsContainer.appendChild(createTabRow(tab));
      });

      ungroupedCard.appendChild(itemsContainer);
      tabsContainer.appendChild(ungroupedCard);
    }
  }

  /**
   * Helper to construct individual Tab DOM element row
   */
  function createTabRow(tab) {
    const row = document.createElement('div');
    row.className = `tab-item ${tab.active ? 'active-tab' : ''}`;

    const main = document.createElement('div');
    main.className = 'tab-main';

    const favicon = document.createElement('img');
    favicon.className = 'tab-favicon';
    favicon.src = tab.favIconUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
    favicon.onerror = () => {
      favicon.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
    };

    const info = document.createElement('div');
    info.className = 'tab-info';

    const title = document.createElement('div');
    title.className = 'tab-title';
    title.textContent = tab.title || tab.url || 'New Tab';

    const url = document.createElement('div');
    url.className = 'tab-url';
    url.textContent = tab.url || '';

    info.appendChild(title);
    info.appendChild(url);
    main.appendChild(favicon);
    main.appendChild(info);

    // Jump to tab on click
    main.addEventListener('click', async () => {
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
    });

    const actions = document.createElement('div');
    actions.className = 'tab-actions';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'action-icon close-icon';
    closeBtn.title = 'Close tab';
    closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

    closeBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await chrome.tabs.remove(tab.id);
      row.remove();
      refreshState();
    });

    actions.appendChild(closeBtn);
    row.appendChild(main);
    row.appendChild(actions);

    return row;
  }

  /**
   * Renders saved session cards
   */
  async function renderSavedSessions() {
    const { sessions = {} } = await chrome.storage.local.get('sessions');
    const sessionList = Object.values(sessions).sort((a, b) => b.createdAt - a.createdAt);

    savedSessionsCountEl.textContent = sessionList.length;

    if (sessionList.length === 0) {
      sessionsContainer.innerHTML = '<div class="empty-state">No saved tab sessions. Click "Save Session" above to store your workspace!</div>';
      return;
    }

    sessionsContainer.innerHTML = '';

    sessionList.forEach((session) => {
      const card = document.createElement('div');
      card.className = 'session-card';

      const totalTabsInSession = session.groups ? session.groups.reduce((acc, g) => acc + (g.tabs ? g.tabs.length : 0), 0) : 0;
      const createdDateStr = new Date(session.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

      card.innerHTML = `
        <div class="session-info">
          <div class="session-name">${escapeHtml(session.name)}</div>
          <div class="session-meta">${totalTabsInSession} tabs &bull; ${session.groups ? session.groups.length : 0} groups &bull; ${createdDateStr}</div>
        </div>
        <div class="session-actions">
          <button class="btn secondary-btn restore-btn" style="padding: 5px 10px;">Restore</button>
          <button class="action-icon close-icon delete-btn" title="Delete session" style="padding: 6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `;

      card.querySelector('.restore-btn').addEventListener('click', async () => {
        await chrome.runtime.sendMessage({ action: 'RESTORE_SESSION', sessionId: session.id });
        await refreshState();
      });

      card.querySelector('.delete-btn').addEventListener('click', async () => {
        await chrome.runtime.sendMessage({ action: 'DELETE_SESSION', sessionId: session.id });
        card.remove();
        await renderSavedSessions();
      });

      sessionsContainer.appendChild(card);
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
});
