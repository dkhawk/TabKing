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

  // Selection & Summary State
  const selectedTabIds = new Set();
  const openSummaryTabIds = new Set();
  let currentFilteredTabs = [];

  // Selection Elements
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  const selectedCountBadge = document.getElementById('selectedCountBadge');
  const selectionActionBar = document.getElementById('selectionActionBar');
  const closeSelectedBtn = document.getElementById('closeSelectedBtn');
  const closeSelectedCount = document.getElementById('closeSelectedCount');
  const deselectAllBtn = document.getElementById('deselectAllBtn');

  let currentWindowId = null;

  // Initialize
  const windowInfo = await chrome.windows.getLastFocused();
  currentWindowId = windowInfo.id;
  await refreshState();

  // Selection Toolbar Event Listeners
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', () => {
      const isChecked = selectAllCheckbox.checked;
      currentFilteredTabs.forEach((t) => {
        if (isChecked) {
          selectedTabIds.add(t.id);
        } else {
          selectedTabIds.delete(t.id);
        }
      });
      renderOpenTabs(searchInput.value.trim().toLowerCase());
    });
  }

  if (deselectAllBtn) {
    deselectAllBtn.addEventListener('click', () => {
      selectedTabIds.clear();
      renderOpenTabs(searchInput.value.trim().toLowerCase());
    });
  }

  if (closeSelectedBtn) {
    closeSelectedBtn.addEventListener('click', async () => {
      if (selectedTabIds.size === 0) return;
      const idsToClose = Array.from(selectedTabIds);
      const count = idsToClose.length;
      if (confirm(`Close ${count} selected tab${count > 1 ? 's' : ''}?`)) {
        await chrome.tabs.remove(idsToClose);
        selectedTabIds.clear();
        await refreshState();
      }
    });
  }

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
   * Updates Select All checkbox state, count badge, and bulk action bar
   */
  function updateSelectionUI(filteredTabs = []) {
    const selectedFilteredCount = filteredTabs.filter((t) => selectedTabIds.has(t.id)).length;
    const totalSelected = selectedTabIds.size;

    if (selectAllCheckbox) {
      if (filteredTabs.length === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
        selectAllCheckbox.disabled = true;
      } else {
        selectAllCheckbox.disabled = false;
        selectAllCheckbox.checked = selectedFilteredCount === filteredTabs.length;
        selectAllCheckbox.indeterminate = selectedFilteredCount > 0 && selectedFilteredCount < filteredTabs.length;
      }
    }

    if (selectedCountBadge) {
      if (totalSelected > 0) {
        selectedCountBadge.textContent = `${totalSelected} selected`;
        selectedCountBadge.classList.remove('hidden');
      } else {
        selectedCountBadge.classList.add('hidden');
      }
    }

    if (selectionActionBar) {
      if (totalSelected > 0) {
        selectionActionBar.classList.remove('hidden');
        if (closeSelectedCount) closeSelectedCount.textContent = totalSelected;
      } else {
        selectionActionBar.classList.add('hidden');
      }
    }
  }

  /**
   * Renders open tab groups and tabs list
   */
  async function renderOpenTabs(filterQuery = '') {
    const tabs = await chrome.tabs.query({ windowId: currentWindowId });
    const groups = await chrome.tabGroups.query({ windowId: currentWindowId });

    // Prune selectedTabIds and openSummaryTabIds for tabs that no longer exist
    const allTabIds = new Set(tabs.map((t) => t.id));
    selectedTabIds.forEach((id) => {
      if (!allTabIds.has(id)) selectedTabIds.delete(id);
    });
    openSummaryTabIds.forEach((id) => {
      if (!allTabIds.has(id)) openSummaryTabIds.delete(id);
    });

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

    currentFilteredTabs = filteredTabs;
    updateSelectionUI(filteredTabs);

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
    const isSelected = selectedTabIds.has(tab.id);
    row.className = `tab-item ${tab.active ? 'active-tab' : ''} ${isSelected ? 'selected-tab' : ''}`;

    // Selection Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'tab-select-checkbox';
    checkbox.checked = isSelected;
    checkbox.title = 'Select tab';

    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selectedTabIds.add(tab.id);
        row.classList.add('selected-tab');
      } else {
        selectedTabIds.delete(tab.id);
        row.classList.remove('selected-tab');
      }
      updateSelectionUI(currentFilteredTabs);
    });

    const main = document.createElement('div');
    main.className = 'tab-main';

    const favicon = document.createElement('img');
    favicon.className = 'tab-favicon';
    favicon.src = tab.favIconUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"/></svg>';
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

    // Summary Button & Panel
    const summaryBtn = document.createElement('button');
    summaryBtn.className = 'action-icon summary-icon';
    summaryBtn.title = 'Get tab content summary';
    summaryBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>';

    const summaryPanel = document.createElement('div');
    summaryPanel.className = 'tab-summary-panel hidden';

    // If this tab's summary was previously opened, restore its state on re-render!
    if (openSummaryTabIds.has(tab.id)) {
      summaryPanel.classList.remove('hidden');
      summaryBtn.classList.add('active');
      const cached = TabSummarizer.cache.get(`${tab.id}:${tab.url}`);
      if (cached) {
        renderSummaryPanel(cached, summaryPanel);
      } else {
        summaryPanel.innerHTML = '<div class="summary-loading"><span class="spinner"></span> Summarizing...</div>';
        TabSummarizer.getSummary(tab).then((summary) => {
          renderSummaryPanel(summary, summaryPanel);
        }).catch((err) => {
          summaryPanel.innerHTML = `<div class="summary-loading" style="color: var(--danger-color);">Failed to summarize: ${escapeHtml(err.message)}</div>`;
        });
      }
    }

    summaryBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const isHidden = summaryPanel.classList.contains('hidden');
      if (!isHidden) {
        summaryPanel.classList.add('hidden');
        summaryBtn.classList.remove('active');
        openSummaryTabIds.delete(tab.id);
        return;
      }

      openSummaryTabIds.add(tab.id);
      summaryPanel.innerHTML = '<div class="summary-loading"><span class="spinner"></span> Summarizing...</div>';
      summaryPanel.classList.remove('hidden');
      summaryBtn.classList.add('active');

      try {
        const summary = await TabSummarizer.getSummary(tab);
        renderSummaryPanel(summary, summaryPanel);
      } catch (err) {
        summaryPanel.innerHTML = `<div class="summary-loading" style="color: var(--danger-color);">Failed to summarize: ${escapeHtml(err.message)}</div>`;
      }
    });

    const closeBtn = document.createElement('button');
    closeBtn.className = 'action-icon close-icon';
    closeBtn.title = 'Close tab';
    closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

    closeBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      selectedTabIds.delete(tab.id);
      await chrome.tabs.remove(tab.id);
      row.remove();
      summaryPanel.remove();
      refreshState();
    });

    actions.appendChild(summaryBtn);
    actions.appendChild(closeBtn);
    row.appendChild(checkbox);
    row.appendChild(main);
    row.appendChild(actions);

    const wrapper = document.createDocumentFragment();
    wrapper.appendChild(row);
    wrapper.appendChild(summaryPanel);

    return wrapper;
  }

  /**
   * Renders the summary content inside a tab's summaryPanel in popup
   */
  function renderSummaryPanel(summary, container) {
    const headingsHtml = summary.headings && summary.headings.length > 0
      ? `<div class="summary-section">
           <span class="summary-section-title">Key Topics:</span>
           <ul class="summary-headings-list">
             ${summary.headings.slice(0, 3).map((h) => `<li>${escapeHtml(h)}</li>`).join('')}
           </ul>
         </div>`
      : '';

    const badgeHtml = summary.siteBadge
      ? `<span class="detail-badge badge-site-special">${escapeHtml(summary.siteBadge.text)}</span>`
      : '';

    container.innerHTML = `
      <div class="summary-content">
        <div class="summary-header-row">
          <span class="summary-label">✨ Summary</span>
          <div class="summary-badges">
            ${badgeHtml}
            <span class="detail-badge">${escapeHtml(summary.insights.contentType)}</span>
          </div>
        </div>
        <p class="summary-overview-text">${escapeHtml(summary.overview)}</p>
        ${headingsHtml}
      </div>
    `;
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
