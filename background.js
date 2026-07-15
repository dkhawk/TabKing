/**
 * TabKing Service Worker - Manifest V3 Background Script
 */

// Default rules installed on initial setup
const DEFAULT_RULES = [
  {
    id: 'rule_ai_search',
    name: 'Search & AI',
    pattern: '(google\\.com/search|bing\\.com|chatgpt\\.com|claude\\.ai|gemini\\.google\\.com|perplexity\\.ai)',
    type: 'regex',
    color: 'purple',
    enabled: true
  },
  {
    id: 'rule_dev',
    name: 'Dev & Code',
    pattern: '(github\\.com|gitlab\\.com|stackoverflow\\.com|npmjs\\.com|developer\\.|docs\\.|localhost)',
    type: 'regex',
    color: 'blue',
    enabled: true
  },
  {
    id: 'rule_social',
    name: 'Social & Media',
    pattern: '(youtube\\.com|x\\.com|twitter\\.com|reddit\\.com|linkedin\\.com|news\\.ycombinator\\.com)',
    type: 'regex',
    color: 'pink',
    enabled: true
  },
  {
    id: 'rule_workspace',
    name: 'Docs & Workspace',
    pattern: '(docs\\.google\\.com|sheets\\.google\\.com|slides\\.google\\.com|notion\\.so|figma\\.com|trello\\.com)',
    type: 'regex',
    color: 'green',
    enabled: true
  }
];

// Initialize default settings on installation
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    const existing = await chrome.storage.local.get(['rules', 'sessions', 'autoGroupOnLaunch']);
    if (!existing.rules) {
      await chrome.storage.local.set({
        rules: DEFAULT_RULES,
        sessions: {},
        autoGroupOnLaunch: false,
        groupByDomainFallback: true
      });
    }
  }
});

// Direct Launch: Open Full Visual Tab View directly when clicking extension toolbar icon
chrome.action.onClicked.addListener(async () => {
  await chrome.tabs.create({ url: chrome.runtime.getURL('finder/finder.html') });
});

// Auto-capture visible tab thumbnails when switching or updating tabs
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await captureTabThumbnail(activeInfo.tabId, activeInfo.windowId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    await captureTabThumbnail(tabId, tab.windowId);
  }
});

async function captureTabThumbnail(tabId, windowId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('chrome-extension://')) return;

    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 40 });
    if (dataUrl) {
      const { thumbnails = {} } = await chrome.storage.local.get('thumbnails');
      thumbnails[tab.url] = dataUrl;
      // Cap stored thumbnails to 100 entries to optimize memory
      const keys = Object.keys(thumbnails);
      if (keys.length > 100) {
        delete thumbnails[keys[0]];
      }
      await chrome.storage.local.set({ thumbnails });
    }
  } catch (err) {
    // Ignore capture errors for non-active or restricted tabs
  }
}

// Handle global keyboard command shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'auto-group-tabs') {
    await autoGroupTabsInWindow();
  }
});

// Message Listener for UI Popup & Options requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.action) {
        case 'CAPTURE_SNAPSHOTS': {
          const windows = await chrome.windows.getAll();
          for (const win of windows) {
            const [activeTab] = await chrome.tabs.query({ active: true, windowId: win.id });
            if (activeTab) {
              await captureTabThumbnail(activeTab.id, win.id);
            }
          }
          sendResponse({ success: true });
          break;
        }
        case 'AUTO_GROUP_TABS': {
          const count = await autoGroupTabsInWindow(message.windowId);
          sendResponse({ success: true, groupedCount: count });
          break;
        }
        case 'GROUP_BY_DOMAIN': {
          const count = await groupByDomain(message.windowId);
          sendResponse({ success: true, groupedCount: count });
          break;
        }
        case 'UNGROUP_ALL': {
          await ungroupAllTabs(message.windowId);
          sendResponse({ success: true });
          break;
        }
        case 'TOGGLE_COLLAPSE': {
          await toggleCollapseGroups(message.windowId, message.collapse);
          sendResponse({ success: true });
          break;
        }
        case 'SAVE_SESSION': {
          const session = await saveSession(message.sessionName, message.groupIds, message.closeTabs);
          sendResponse({ success: true, session });
          break;
        }
        case 'RESTORE_SESSION': {
          await restoreSession(message.sessionId);
          sendResponse({ success: true });
          break;
        }
        case 'DELETE_SESSION': {
          await deleteSession(message.sessionId);
          sendResponse({ success: true });
          break;
        }
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (err) {
      console.error('TabKing SW Action Error:', err);
      sendResponse({ success: false, error: err.message });
    }
  })();
  return true; // Keep message channel open for async response
});

/**
 * Groups open tabs in the active or target window based on configured rules.
 */
async function autoGroupTabsInWindow(targetWindowId) {
  const windowId = targetWindowId || (await chrome.windows.getLastFocused()).id;
  const { rules = DEFAULT_RULES, groupByDomainFallback = true } = await chrome.storage.local.get([
    'rules',
    'groupByDomainFallback'
  ]);
  const activeRules = rules.filter((r) => r.enabled);

  const tabs = await chrome.tabs.query({ windowId, pinned: false });
  let groupedCount = 0;
  const handledTabIds = new Set();

  // Apply configured rules
  for (const rule of activeRules) {
    if (!rule.pattern) continue;

    let regex;
    try {
      regex = new RegExp(rule.pattern, 'i');
    } catch (e) {
      console.warn(`Invalid regex pattern for rule "${rule.name}":`, rule.pattern);
      continue;
    }

    const matchedTabIds = tabs
      .filter((tab) => !handledTabIds.has(tab.id) && (regex.test(tab.url || '') || regex.test(tab.title || '')))
      .map((tab) => tab.id);

    if (matchedTabIds.length > 0) {
      const groupId = await chrome.tabs.group({ tabIds: matchedTabIds });
      await chrome.tabGroups.update(groupId, {
        title: rule.name,
        color: rule.color || 'blue'
      });
      matchedTabIds.forEach((id) => handledTabIds.add(id));
      groupedCount += matchedTabIds.length;
    }
  }

  // Fallback to domain grouping for unhandled tabs
  if (groupByDomainFallback) {
    const unhandledTabs = tabs.filter((t) => !handledTabIds.has(t.id));
    const domainMap = {};

    for (const tab of unhandledTabs) {
      try {
        if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) continue;
        const host = new URL(tab.url).hostname.replace(/^www\./, '');
        if (host) {
          (domainMap[host] ??= []).push(tab.id);
        }
      } catch {
        // Skip invalid URL
      }
    }

    const colors = ['cyan', 'orange', 'green', 'pink', 'purple', 'yellow', 'red', 'blue'];
    let colorIdx = 0;

    for (const [domain, tabIds] of Object.entries(domainMap)) {
      if (tabIds.length >= 2) { // Group if 2 or more tabs match domain
        const groupId = await chrome.tabs.group({ tabIds });
        await chrome.tabGroups.update(groupId, {
          title: domain,
          color: colors[colorIdx % colors.length]
        });
        colorIdx++;
        groupedCount += tabIds.length;
      }
    }
  }

  return groupedCount;
}

/**
 * Dynamic grouping strictly by hostname domain.
 */
async function groupByDomain(targetWindowId) {
  const windowId = targetWindowId || (await chrome.windows.getLastFocused()).id;
  const tabs = await chrome.tabs.query({ windowId, pinned: false });

  const domainMap = {};
  for (const tab of tabs) {
    try {
      if (!tab.url || tab.url.startsWith('chrome://')) continue;
      const host = new URL(tab.url).hostname.replace(/^www\./, '');
      if (host) {
        (domainMap[host] ??= []).push(tab.id);
      }
    } catch {
      // Ignore
    }
  }

  const colors = ['blue', 'cyan', 'green', 'yellow', 'orange', 'pink', 'purple', 'red'];
  let colorIdx = 0;
  let groupedCount = 0;

  for (const [domain, tabIds] of Object.entries(domainMap)) {
    if (tabIds.length >= 2) {
      const groupId = await chrome.tabs.group({ tabIds });
      await chrome.tabGroups.update(groupId, {
        title: domain,
        color: colors[colorIdx % colors.length]
      });
      colorIdx++;
      groupedCount += tabIds.length;
    }
  }

  return groupedCount;
}

/**
 * Ungroups all grouped tabs in the current window.
 */
async function ungroupAllTabs(targetWindowId) {
  const windowId = targetWindowId || (await chrome.windows.getLastFocused()).id;
  const tabs = await chrome.tabs.query({ windowId });
  const groupedTabIds = tabs.filter((t) => t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE).map((t) => t.id);
  if (groupedTabIds.length > 0) {
    await chrome.tabs.ungroup(groupedTabIds);
  }
}

/**
 * Toggle collapse/expand for all groups in window.
 */
async function toggleCollapseGroups(targetWindowId, collapseState) {
  const windowId = targetWindowId || (await chrome.windows.getLastFocused()).id;
  const tabs = await chrome.tabs.query({ windowId });
  const groupIds = [...new Set(tabs.map((t) => t.groupId).filter((gId) => gId !== chrome.tabGroups.TAB_GROUP_ID_NONE))];

  for (const gId of groupIds) {
    await chrome.tabGroups.update(gId, { collapsed: collapseState });
  }
}

/**
 * Saves specific tab groups or active window state as a restored session object.
 */
async function saveSession(sessionName, targetGroupIds, closeTabsAfterSave = false) {
  const windowId = (await chrome.windows.getLastFocused()).id;
  const allTabs = await chrome.tabs.query({ windowId });
  const allGroups = await chrome.tabGroups.query({ windowId });

  const savedGroups = [];
  const tabIdsToClose = [];

  const groupsToProcess = targetGroupIds && targetGroupIds.length > 0
    ? allGroups.filter((g) => targetGroupIds.includes(g.id))
    : allGroups;

  for (const grp of groupsToProcess) {
    const groupTabs = allTabs.filter((t) => t.groupId === grp.id);
    const tabUrls = groupTabs.map((t) => ({ url: t.url, title: t.title, pinned: t.pinned }));

    savedGroups.push({
      title: grp.title || 'Saved Group',
      color: grp.color,
      tabs: tabUrls
    });

    if (closeTabsAfterSave) {
      groupTabs.forEach((t) => tabIdsToClose.push(t.id));
    }
  }

  // If no native tab groups exist, save ungrouped tabs as a fallback group
  if (savedGroups.length === 0) {
    const activeTabs = allTabs.map((t) => ({ url: t.url, title: t.title, pinned: t.pinned }));
    savedGroups.push({
      title: sessionName || 'General Workspace',
      color: 'grey',
      tabs: activeTabs
    });
    if (closeTabsAfterSave) {
      allTabs.forEach((t) => tabIdsToClose.push(t.id));
    }
  }

  const sessionObj = {
    id: 'session_' + Date.now(),
    name: sessionName || `Workspace ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    createdAt: Date.now(),
    groups: savedGroups
  };

  const { sessions = {} } = await chrome.storage.local.get('sessions');
  sessions[sessionObj.id] = sessionObj;
  await chrome.storage.local.set({ sessions });

  if (closeTabsAfterSave && tabIdsToClose.length > 0) {
    // Keep at least one new tab open if closing all tabs
    if (tabIdsToClose.length === allTabs.length) {
      await chrome.tabs.create({ active: true });
    }
    await chrome.tabs.remove(tabIdsToClose);
  }

  return sessionObj;
}

/**
 * Restores a saved session by creating new tabs and placing them back in native groups.
 */
async function restoreSession(sessionId) {
  const { sessions = {} } = await chrome.storage.local.get('sessions');
  const session = sessions[sessionId];
  if (!session || !session.groups) return;

  for (const groupDef of session.groups) {
    const createdTabIds = [];
    for (const tabInfo of groupDef.tabs) {
      if (!tabInfo.url) continue;
      const tab = await chrome.tabs.create({ url: tabInfo.url, active: false, pinned: tabInfo.pinned || false });
      createdTabIds.push(tab.id);
    }

    if (createdTabIds.length > 0) {
      const newGroupId = await chrome.tabs.group({ tabIds: createdTabIds });
      await chrome.tabGroups.update(newGroupId, {
        title: groupDef.title,
        color: groupDef.color || 'blue'
      });
    }
  }
}

/**
 * Deletes a session from local storage.
 */
async function deleteSession(sessionId) {
  const { sessions = {} } = await chrome.storage.local.get('sessions');
  delete sessions[sessionId];
  await chrome.storage.local.set({ sessions });
}
