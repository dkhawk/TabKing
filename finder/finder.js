/**
 * TabKing Visual Tab Finder & Advanced Search Script
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const regexToggle = document.getElementById('regexToggle');
  const matchUrlToggle = document.getElementById('matchUrlToggle');
  const windowScopeSelect = document.getElementById('windowScopeSelect');
  const regexErrorMsg = document.getElementById('regexErrorMsg');
  const regexErrorText = document.getElementById('regexErrorText');
  
  // Age Slider Elements
  const ageDirectionSelect = document.getElementById('ageDirectionSelect');
  const ageSlider = document.getElementById('ageSlider');
  const ageReadoutBadge = document.getElementById('ageReadoutBadge');
  
  const filterChipsBar = document.getElementById('filterChipsBar');
  const chipStaleBtn = filterChipsBar ? filterChipsBar.querySelector('.chip-stale') : null;
  const refreshSnapshotsBtn = document.getElementById('refreshSnapshotsBtn');
  const closeStaleBtn = document.getElementById('closeStaleBtn');
  const staleCloseCountEl = document.getElementById('staleCloseCount');
  
  const viewGridBtn = document.getElementById('viewGridBtn');
  const viewListBtn = document.getElementById('viewListBtn');
  const tabsGrid = document.getElementById('tabsGrid');
  const resultsCountText = document.getElementById('resultsCountText');
  
  // Count Elements
  const countAllEl = document.getElementById('countAll');
  const countStaleEl = document.getElementById('countStale');
  const countGroupedEl = document.getElementById('countGrouped');
  const countUngroupedEl = document.getElementById('countUngrouped');
  const countThumbnailsEl = document.getElementById('countThumbnails');

  let openTabs = [];
  let nativeGroupsMap = new Map();
  let thumbnailsMap = {};
  let activeFilterCategory = 'all';
  let isGridView = true;
  let currentWindowId = null;

  // Load Saved Inactivity Age Settings
  const { staleHours = 4, staleDirection = 'older' } = await chrome.storage.local.get(['staleHours', 'staleDirection']);
  if (ageSlider) ageSlider.value = staleHours;
  if (ageDirectionSelect) ageDirectionSelect.value = staleDirection;

  // Initial Load
  const currentWin = await chrome.windows.getCurrent();
  currentWindowId = currentWin.id;
  await loadWorkspaceTabs();

  // Search Input & Options Listeners
  searchInput.addEventListener('input', () => {
    const hasText = searchInput.value.length > 0;
    clearSearchBtn.classList.toggle('hidden', !hasText);
    renderCards();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.classList.add('hidden');
    regexErrorMsg.classList.add('hidden');
    renderCards();
  });

  regexToggle.addEventListener('change', () => renderCards());
  matchUrlToggle.addEventListener('change', () => renderCards());
  windowScopeSelect.addEventListener('change', () => renderCards());

  // Age Filter Slider Listeners
  if (ageSlider && ageDirectionSelect) {
    const saveAgeSettings = () => {
      chrome.storage.local.set({
        staleHours: parseFloat(ageSlider.value),
        staleDirection: ageDirectionSelect.value
      });
    };

    ageSlider.addEventListener('input', () => {
      updateAgeReadout();
      updateCounts();
      renderCards();
      saveAgeSettings();
    });

    ageDirectionSelect.addEventListener('change', () => {
      updateAgeReadout();
      updateCounts();
      renderCards();
      saveAgeSettings();
    });

    updateAgeReadout();
  }

  // View Switcher
  viewGridBtn.addEventListener('click', () => {
    isGridView = true;
    viewGridBtn.classList.add('active');
    viewListBtn.classList.remove('active');
    tabsGrid.classList.remove('list-view');
  });

  viewListBtn.addEventListener('click', () => {
    isGridView = false;
    viewListBtn.classList.add('active');
    viewGridBtn.classList.remove('active');
    tabsGrid.classList.add('list-view');
  });

  const refreshTabsBtn = document.getElementById('refreshTabsBtn');

  // Manual Refresh Action
  if (refreshTabsBtn) {
    refreshTabsBtn.addEventListener('click', async () => {
      refreshTabsBtn.disabled = true;
      try {
        await loadWorkspaceTabs();
      } finally {
        refreshTabsBtn.disabled = false;
      }
    });
  }

  // Automatic Real-Time Sync: Refresh page live whenever tabs or groups are closed, opened, or changed
  chrome.tabs.onRemoved.addListener(() => loadWorkspaceTabs());
  chrome.tabs.onCreated.addListener(() => loadWorkspaceTabs());
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'complete' || changeInfo.title || changeInfo.favIconUrl) {
      loadWorkspaceTabs();
    }
  });
  chrome.tabs.onMoved.addListener(() => loadWorkspaceTabs());

  if (chrome.tabGroups) {
    chrome.tabGroups.onCreated.addListener(() => loadWorkspaceTabs());
    chrome.tabGroups.onRemoved.addListener(() => loadWorkspaceTabs());
    chrome.tabGroups.onUpdated.addListener(() => loadWorkspaceTabs());
  }

  // Refresh Snapshots Action
  refreshSnapshotsBtn.addEventListener('click', async () => {
    refreshSnapshotsBtn.disabled = true;
    refreshSnapshotsBtn.querySelector('span').textContent = 'Capturing...';
    try {
      await chrome.runtime.sendMessage({ action: 'CAPTURE_SNAPSHOTS' });
      await new Promise((r) => setTimeout(r, 600));
      await loadWorkspaceTabs();
    } finally {
      refreshSnapshotsBtn.disabled = false;
      refreshSnapshotsBtn.querySelector('span').textContent = 'Refresh Snapshots';
    }
  });

  // Bulk Close Stale Tabs Action
  closeStaleBtn.addEventListener('click', async () => {
    const staleTabsToClose = getDisplayedMatchingTabs().filter(isMatchingAgeFilter);
    if (staleTabsToClose.length === 0) return;

    const directionText = ageDirectionSelect.value === 'older' ? 'older than' : 'newer than';
    const hoursVal = ageSlider.value;

    if (confirm(`Are you sure you want to close ${staleTabsToClose.length} tabs ${directionText} ${hoursVal} hours?`)) {
      const ids = staleTabsToClose.map((t) => t.id);
      try {
        await chrome.tabs.remove(ids);
      } catch {
        // Ignore tabs already closed
      }
      await loadWorkspaceTabs();
    }
  });

  // Filter Chips Listener
  filterChipsBar.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;

    filterChipsBar.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    activeFilterCategory = chip.dataset.filter;
    renderCards();
  });

  /**
   * Updates readout badge and stale chip title when slider changes
   */
  function updateAgeReadout() {
    if (!ageSlider || !ageReadoutBadge) return;
    const hours = parseFloat(ageSlider.value);
    const direction = ageDirectionSelect.value;
    const formattedVal = hours >= 1 ? `${hours} hours` : `${hours * 60} mins`;
    const labelStr = direction === 'older' ? `Older than ${formattedVal}` : `Newer than ${formattedVal}`;

    ageReadoutBadge.textContent = labelStr;

    if (chipStaleBtn) {
      const dirSymbol = direction === 'older' ? '>' : '<';
      chipStaleBtn.childNodes[0].nodeValue = `⌛ Inactive ${dirSymbol}${formattedVal} (`;
    }
  }

  /**
   * Loads all open tabs across windows, native groups, and thumbnail screenshots
   */
  async function loadWorkspaceTabs() {
    openTabs = await chrome.tabs.query({});
    const groups = await chrome.tabGroups.query({});
    
    nativeGroupsMap.clear();
    groups.forEach((g) => nativeGroupsMap.set(g.id, g));

    const { thumbnails = {} } = await chrome.storage.local.get('thumbnails');
    thumbnailsMap = thumbnails;

    updateAgeReadout();
    updateCounts();
    renderDomainFilterChips();
    renderCards();
  }

  /**
   * Evaluates if a tab matches the selected age threshold slider filter
   */
  function isMatchingAgeFilter(tab) {
    if (tab.pinned || tab.active) return false;
    if (!tab.lastAccessed) return false;

    const inactiveMs = Date.now() - tab.lastAccessed;
    const hours = parseFloat(ageSlider ? ageSlider.value : 4);
    const thresholdMs = hours * 60 * 60 * 1000;
    const direction = ageDirectionSelect ? ageDirectionSelect.value : 'older';

    return direction === 'older' ? (inactiveMs >= thresholdMs) : (inactiveMs <= thresholdMs);
  }

  /**
   * Helper to format human readable staleness time
   */
  function formatRelativeTime(lastAccessed) {
    if (!lastAccessed) return '';
    const diffMs = Date.now() - lastAccessed;
    const mins = Math.floor(diffMs / (1000 * 60));
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  /**
   * Updates chip count metrics
   */
  function updateCounts() {
    countAllEl.textContent = openTabs.length;
    
    const staleCount = openTabs.filter(isMatchingAgeFilter).length;
    countStaleEl.textContent = staleCount;

    const groupedCount = openTabs.filter((t) => t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE).length;
    countGroupedEl.textContent = groupedCount;
    countUngroupedEl.textContent = openTabs.length - groupedCount;

    const thumbCount = openTabs.filter((t) => thumbnailsMap[t.url]).length;
    countThumbnailsEl.textContent = thumbCount;
  }

  /**
   * Renders dynamic domain filter pills in the filter bar
   */
  function renderDomainFilterChips() {
    const domainCounts = {};
    openTabs.forEach((tab) => {
      try {
        if (!tab.url || tab.url.startsWith('chrome://')) return;
        const domain = new URL(tab.url).hostname.replace(/^www\./, '');
        if (domain) {
          domainCounts[domain] = (domainCounts[domain] || 0) + 1;
        }
      } catch {
        // Skip
      }
    });

    filterChipsBar.querySelectorAll('.chip-domain').forEach((c) => c.remove());

    const topDomains = Object.entries(domainCounts)
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    topDomains.forEach(([domain, count]) => {
      const chip = document.createElement('button');
      chip.className = 'chip chip-domain';
      chip.dataset.filter = `domain:${domain}`;
      chip.textContent = `${domain} (${count})`;
      filterChipsBar.appendChild(chip);
    });
  }

  /**
   * Calculate match relevance score to sort top matches first as user types
   */
  function calculateMatchScore(tab, query, isRegex, matchUrl, regexPattern) {
    if (!query) {
      return tab.lastAccessed || 0;
    }

    const title = (tab.title || '').toLowerCase();
    const url = (tab.url || '').toLowerCase();
    const domain = getTabDomain(tab.url).toLowerCase();
    const qLower = query.toLowerCase();

    let score = 0;

    if (isRegex && regexPattern) {
      if (regexPattern.test(tab.title || '')) score += 100;
      else if (matchUrl && regexPattern.test(tab.url || '')) score += 50;
    } else {
      if (title === qLower) score += 200;
      else if (title.startsWith(qLower)) score += 150;
      else if (title.includes(qLower)) score += 100;
      else if (domain.includes(qLower)) score += 70;
      else if (matchUrl && url.includes(qLower)) score += 50;
    }

    if (tab.lastAccessed) {
      score += (tab.lastAccessed / 1e12);
    }

    return score;
  }

  /**
   * Returns current matching tabs sorted by match score (best matching tabs at top)
   */
  function getDisplayedMatchingTabs() {
    const query = searchInput.value.trim();
    const isRegex = regexToggle.checked;
    const matchUrl = matchUrlToggle.checked;
    const scopeWindow = windowScopeSelect.value;

    regexErrorMsg.classList.add('hidden');
    let regexPattern = null;

    if (query && isRegex) {
      try {
        regexPattern = new RegExp(query, 'i');
      } catch (err) {
        regexErrorText.textContent = `Regex Error: ${err.message}`;
        regexErrorMsg.classList.remove('hidden');
      }
    }

    const filtered = openTabs.filter((tab) => {
      // 0. Window Scope Filter
      if (scopeWindow === 'current' && tab.windowId !== currentWindowId) return false;

      // 1. Category Chip Filter
      if (activeFilterCategory === 'stale' && !isMatchingAgeFilter(tab)) return false;
      if (activeFilterCategory === 'grouped' && tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) return false;
      if (activeFilterCategory === 'ungrouped' && tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) return false;
      if (activeFilterCategory === 'thumbnails' && !thumbnailsMap[tab.url]) return false;
      if (activeFilterCategory.startsWith('domain:')) {
        const domainTarget = activeFilterCategory.split(':')[1];
        try {
          const tabDomain = new URL(tab.url).hostname.replace(/^www\./, '');
          if (tabDomain !== domainTarget) return false;
        } catch {
          return false;
        }
      }

      // 2. Search Query Filter
      if (!query) return true;

      const title = tab.title || '';
      const url = tab.url || '';

      if (isRegex) {
        if (!regexPattern) return true;
        return regexPattern.test(title) || (matchUrl && regexPattern.test(url));
      } else {
        const qLower = query.toLowerCase();
        return title.toLowerCase().includes(qLower) || (matchUrl && url.toLowerCase().includes(qLower));
      }
    });

    // Sort matching tabs so the best matches float right to the top!
    return filtered.sort((a, b) => {
      const scoreA = calculateMatchScore(a, query, isRegex, matchUrl, regexPattern);
      const scoreB = calculateMatchScore(b, query, isRegex, matchUrl, regexPattern);
      return scoreB - scoreA;
    });
  }

  /**
   * Main Render function
   */
  function renderCards() {
    const filteredTabs = getDisplayedMatchingTabs();
    const matchingStaleTabs = filteredTabs.filter(isMatchingAgeFilter);

    if (matchingStaleTabs.length > 0) {
      staleCloseCountEl.textContent = matchingStaleTabs.length;
      closeStaleBtn.classList.remove('hidden');
    } else {
      closeStaleBtn.classList.add('hidden');
    }

    resultsCountText.textContent = `Showing ${filteredTabs.length} of ${openTabs.length} open tabs`;
    tabsGrid.innerHTML = '';

    if (filteredTabs.length === 0) {
      tabsGrid.innerHTML = '<div class="empty-state-grid">No matching tabs found. Try adjusting your search query, age slider, or scope filters.</div>';
      return;
    }

    filteredTabs.forEach((tab) => {
      tabsGrid.appendChild(createVisualTabCard(tab));
    });
  }

  /**
   * Helper to construct a single visual tab preview card with clean 6-line hierarchy
   */
  function createVisualTabCard(tab) {
    const card = document.createElement('div');
    card.className = `tab-preview-card ${tab.active ? 'active-tab-card' : ''}`;

    const thumbnailDataUrl = thumbnailsMap[tab.url];
    const group = nativeGroupsMap.get(tab.groupId);
    const isAgeMatch = isMatchingAgeFilter(tab);
    const domainStr = getTabDomain(tab.url) || 'Browser Tab';
    const urlObj = parseUrl(tab.url);
    const pathOnly = getUrlPathOnly(tab.url);
    const isOtherWindow = tab.windowId !== currentWindowId;

    // 1. Line 1: Top Domain Header Bar
    const domainHeader = document.createElement('div');
    domainHeader.className = 'card-domain-header';

    const tagsHtml = [];
    if (tab.lastAccessed) {
      if (isAgeMatch) {
        tagsHtml.push(`<span class="detail-badge badge-age-stale">⌛ Inactive ${formatRelativeTime(tab.lastAccessed)}</span>`);
      } else {
        tagsHtml.push(`<span class="detail-badge">🕒 ${formatRelativeTime(tab.lastAccessed)}</span>`);
      }
    }
    if (group) {
      tagsHtml.push(`
        <span class="card-group-pill-inline">
          <span class="pill-dot ${group.color || 'blue'}"></span>
          <span>${escapeHtml(group.title || 'Group')}</span>
        </span>
      `);
    }
    if (isOtherWindow) {
      tagsHtml.push(`<span class="window-tag-inline">Window #${tab.windowId}</span>`);
    }

    domainHeader.innerHTML = `
      <div class="domain-brand">
        <img class="tab-favicon-icon" src="${tab.favIconUrl || '../icons/icon-16.png'}">
        <span class="domain-title-text">${escapeHtml(domainStr)}</span>
      </div>
      <div class="card-header-tags">
        ${tagsHtml.join('')}
      </div>
    `;

    const domainFavicon = domainHeader.querySelector('.tab-favicon-icon');
    if (domainFavicon) {
      domainFavicon.addEventListener('error', () => {
        domainFavicon.src = '../icons/icon-16.png';
      });
    }

    // 2. Line 2: Thumbnail Preview Window / Visual Banner
    const thumbWindow = document.createElement('div');
    thumbWindow.className = 'thumbnail-window';

    if (thumbnailDataUrl) {
      const img = document.createElement('img');
      img.className = 'thumb-img';
      img.src = thumbnailDataUrl;
      img.alt = tab.title || 'Tab Preview';
      thumbWindow.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'placeholder-thumb-rich';
      placeholder.innerHTML = `
        <button class="capture-tab-btn" title="Focus tab & capture screenshot preview">📸 Snapshot</button>
      `;

      placeholder.querySelector('.capture-tab-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await chrome.tabs.update(tab.id, { active: true });
          await chrome.windows.update(tab.windowId, { focused: true });
        } catch {
          // Ignore closed tabs
        }
        await chrome.runtime.sendMessage({ action: 'CAPTURE_SNAPSHOTS' });
        await new Promise((r) => setTimeout(r, 600));
        await loadWorkspaceTabs();
      });

      thumbWindow.appendChild(placeholder);
    }

    // 3. Lines 3-5: Card Body Content (Title, Path excluding domain, Badges)
    const body = document.createElement('div');
    body.className = 'card-body';

    // Line 5: Details Badges Row
    const badgesHtml = [];

    // Memory State Badge
    if (tab.discarded) {
      badgesHtml.push(`<span class="detail-badge badge-sleeping-ram">💤 Sleeping (RAM Saved)</span>`);
    } else {
      badgesHtml.push(`<span class="detail-badge badge-active-ram">⚡ Active Memory</span>`);
    }

    // Audio State Badge
    if (tab.audible) {
      badgesHtml.push(`<span class="detail-badge badge-audio">🔊 Playing Audio</span>`);
    } else if (tab.mutedInfo && tab.mutedInfo.muted) {
      badgesHtml.push(`<span class="detail-badge">🔇 Muted</span>`);
    }

    // Pinned Badge
    if (tab.pinned) {
      badgesHtml.push(`<span class="detail-badge badge-pinned">📌 Pinned</span>`);
    }

    // Protocol Badge
    if (urlObj.protocol) {
      badgesHtml.push(`<span class="detail-badge badge-protocol">${urlObj.protocol.toUpperCase()}</span>`);
    }

    body.innerHTML = `
      <h3 class="tab-card-title">${escapeHtml(tab.title || tab.url || 'Tab')}</h3>
      <div class="tab-card-path" title="${escapeHtml(tab.url || '')}">${escapeHtml(tab.url || '')}</div>
      <div class="card-badges-row">
        ${badgesHtml.join('')}
      </div>
    `;

    // Click Card Body to Jump to Tab
    card.addEventListener('click', async (e) => {
      if (e.target.closest('.card-footer') || e.target.closest('button')) return;
      try {
        await chrome.tabs.update(tab.id, { active: true });
        await chrome.windows.update(tab.windowId, { focused: true });
      } catch {
        // Tab no longer exists
      }
    });

    // 4. Line 6: Card Footer Controls
    const footer = document.createElement('div');
    footer.className = 'card-footer';

    const switchBtn = document.createElement('button');
    switchBtn.className = 'action-btn';
    switchBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg> Jump';
    switchBtn.addEventListener('click', async () => {
      try {
        await chrome.tabs.update(tab.id, { active: true });
        await chrome.windows.update(tab.windowId, { focused: true });
      } catch {
        // Tab no longer exists
      }
    });

    const closeBtn = document.createElement('button');
    closeBtn.className = 'action-btn danger';
    closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Close';
    closeBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await chrome.tabs.remove(tab.id);
      } catch {
        // Tab already removed
      }
      card.remove();
      openTabs = openTabs.filter((t) => t.id !== tab.id);
      updateCounts();
      renderCards();
    });

    footer.appendChild(switchBtn);
    footer.appendChild(closeBtn);

    card.appendChild(domainHeader);
    card.appendChild(thumbWindow);
    card.appendChild(body);
    card.appendChild(footer);

    return card;
  }

  function getUrlPathOnly(urlStr) {
    try {
      const u = new URL(urlStr);
      return u.pathname + u.search + u.hash || '/';
    } catch {
      return urlStr;
    }
  }

  function getTabDomain(urlStr) {
    try {
      return new URL(urlStr).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  function parseUrl(urlStr) {
    try {
      const u = new URL(urlStr);
      return {
        protocol: u.protocol.replace(':', ''),
        hostname: u.hostname,
        pathname: u.pathname
      };
    } catch {
      return { protocol: '', hostname: '', pathname: '' };
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
});
