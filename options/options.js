/**
 * TabKing Options & Dashboard Script
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const rulesTableBody = document.getElementById('rulesTableBody');
  const addRuleBtn = document.getElementById('addRuleBtn');
  const optionsSessionsList = document.getElementById('optionsSessionsList');
  const domainFallbackToggle = document.getElementById('domainFallbackToggle');
  const exportDataBtn = document.getElementById('exportDataBtn');
  const importFileInput = document.getElementById('importFileInput');
  
  // Modal Elements
  const ruleModal = document.getElementById('ruleModal');
  const ruleModalTitle = document.getElementById('ruleModalTitle');
  const ruleNameInput = document.getElementById('ruleNameInput');
  const rulePatternInput = document.getElementById('rulePatternInput');
  const ruleColorSelect = document.getElementById('ruleColorSelect');
  const cancelRuleBtn = document.getElementById('cancelRuleBtn');
  const saveRuleBtn = document.getElementById('saveRuleBtn');

  const optionsStaleHoursInput = document.getElementById('optionsStaleHoursInput');
  const optionsStaleDirectionSelect = document.getElementById('optionsStaleDirectionSelect');

  let editingRuleId = null;

  // Initialize
  await loadState();

  // Load Saved Staleness Settings
  const { staleHours = 4, staleDirection = 'older' } = await chrome.storage.local.get(['staleHours', 'staleDirection']);
  if (optionsStaleHoursInput) optionsStaleHoursInput.value = staleHours;
  if (optionsStaleDirectionSelect) optionsStaleDirectionSelect.value = staleDirection;

  if (optionsStaleHoursInput) {
    optionsStaleHoursInput.addEventListener('change', async () => {
      await chrome.storage.local.set({ staleHours: parseFloat(optionsStaleHoursInput.value) || 4 });
    });
  }

  if (optionsStaleDirectionSelect) {
    optionsStaleDirectionSelect.addEventListener('change', async () => {
      await chrome.storage.local.set({ staleDirection: optionsStaleDirectionSelect.value });
    });
  }

  // Domain Fallback Switch Handler
  domainFallbackToggle.addEventListener('change', async () => {
    await chrome.storage.local.set({ groupByDomainFallback: domainFallbackToggle.checked });
  });

  // Modal Open for New Rule
  addRuleBtn.addEventListener('click', () => {
    editingRuleId = null;
    ruleModalTitle.textContent = 'Add Grouping Rule';
    ruleNameInput.value = '';
    rulePatternInput.value = '';
    ruleColorSelect.value = 'blue';
    ruleModal.showModal();
  });

  cancelRuleBtn.addEventListener('click', () => {
    ruleModal.close();
  });

  // Save Rule Handler
  saveRuleBtn.addEventListener('click', async () => {
    const name = ruleNameInput.value.trim();
    const pattern = rulePatternInput.value.trim();
    const color = ruleColorSelect.value;

    if (!name || !pattern) {
      alert('Please fill in both the group title name and the pattern.');
      return;
    }

    // Validate regex
    try {
      new RegExp(pattern, 'i');
    } catch {
      alert('Invalid Regex pattern! Please check your syntax.');
      return;
    }

    const { rules = [] } = await chrome.storage.local.get('rules');

    if (editingRuleId) {
      const idx = rules.findIndex((r) => r.id === editingRuleId);
      if (idx !== -1) {
        rules[idx].name = name;
        rules[idx].pattern = pattern;
        rules[idx].color = color;
      }
    } else {
      rules.push({
        id: 'rule_' + Date.now(),
        name,
        pattern,
        color,
        enabled: true
      });
    }

    await chrome.storage.local.set({ rules });
    ruleModal.close();
    await renderRulesTable();
  });

  // Data Export JSON
  exportDataBtn.addEventListener('click', async () => {
    const data = await chrome.storage.local.get(['rules', 'sessions', 'groupByDomainFallback']);
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `tabking-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Data Import JSON
  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (imported.rules && Array.isArray(imported.rules)) {
          await chrome.storage.local.set({
            rules: imported.rules,
            sessions: imported.sessions || {},
            groupByDomainFallback: imported.groupByDomainFallback ?? true
          });
          await loadState();
          alert('Configuration imported successfully!');
        } else {
          alert('Invalid TabKing backup file format.');
        }
      } catch (err) {
        alert('Failed to parse JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
  });

  /**
   * Loads all configuration from storage
   */
  async function loadState() {
    const { groupByDomainFallback = true } = await chrome.storage.local.get('groupByDomainFallback');
    domainFallbackToggle.checked = groupByDomainFallback;

    await renderRulesTable();
    await renderSavedSessions();
  }

  /**
   * Renders rules table
   */
  async function renderRulesTable() {
    const { rules = [] } = await chrome.storage.local.get('rules');
    rulesTableBody.innerHTML = '';

    if (rules.length === 0) {
      rulesTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-dim);">No rules defined yet. Click "+ Add Custom Rule" to create one.</td></tr>';
      return;
    }

    rules.forEach((rule) => {
      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>
          <label class="toggle-switch">
            <input type="checkbox" class="rule-enable-toggle" ${rule.enabled ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </td>
        <td><strong>${escapeHtml(rule.name)}</strong></td>
        <td><code class="pattern-code">${escapeHtml(rule.pattern)}</code></td>
        <td>
          <span class="color-badge">
            <span class="badge-dot ${rule.color || 'blue'}"></span>
            ${rule.color || 'blue'}
          </span>
        </td>
        <td>
          <button class="icon-action edit-rule-btn" title="Edit Rule">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="icon-action delete-rule-btn" title="Delete Rule">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </td>
      `;

      // Enable toggle listener
      tr.querySelector('.rule-enable-toggle').addEventListener('change', async (e) => {
        const updatedRules = rules.map((r) => (r.id === rule.id ? { ...r, enabled: e.target.checked } : r));
        await chrome.storage.local.set({ rules: updatedRules });
      });

      // Edit listener
      tr.querySelector('.edit-rule-btn').addEventListener('click', () => {
        editingRuleId = rule.id;
        ruleModalTitle.textContent = 'Edit Grouping Rule';
        ruleNameInput.value = rule.name;
        rulePatternInput.value = rule.pattern;
        ruleColorSelect.value = rule.color || 'blue';
        ruleModal.showModal();
      });

      // Delete listener
      tr.querySelector('.delete-rule-btn').addEventListener('click', async () => {
        if (confirm(`Delete rule "${rule.name}"?`)) {
          const updatedRules = rules.filter((r) => r.id !== rule.id);
          await chrome.storage.local.set({ rules: updatedRules });
          await renderRulesTable();
        }
      });

      rulesTableBody.appendChild(tr);
    });
  }

  /**
   * Renders saved sessions grid in Options page
   */
  async function renderSavedSessions() {
    const { sessions = {} } = await chrome.storage.local.get('sessions');
    const sessionList = Object.values(sessions).sort((a, b) => b.createdAt - a.createdAt);

    optionsSessionsList.innerHTML = '';

    if (sessionList.length === 0) {
      optionsSessionsList.innerHTML = '<div style="color: var(--text-dim); font-size: 13px;">No saved sessions found in storage.</div>';
      return;
    }

    sessionList.forEach((session) => {
      const block = document.createElement('div');
      block.className = 'session-block';

      const totalTabs = session.groups ? session.groups.reduce((acc, g) => acc + (g.tabs ? g.tabs.length : 0), 0) : 0;
      const dateStr = new Date(session.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

      block.innerHTML = `
        <div>
          <h4>${escapeHtml(session.name)}</h4>
          <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
            ${totalTabs} Tabs in ${session.groups ? session.groups.length : 0} Groups &bull; ${dateStr}
          </p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn secondary-btn restore-opt-btn" style="padding: 5px 12px; font-size: 12px;">Restore Session</button>
          <button class="btn tertiary-btn delete-opt-btn" style="padding: 5px 12px; font-size: 12px;">Delete</button>
        </div>
      `;

      block.querySelector('.restore-opt-btn').addEventListener('click', async () => {
        await chrome.runtime.sendMessage({ action: 'RESTORE_SESSION', sessionId: session.id });
      });

      block.querySelector('.delete-opt-btn').addEventListener('click', async () => {
        await chrome.runtime.sendMessage({ action: 'DELETE_SESSION', sessionId: session.id });
        block.remove();
      });

      optionsSessionsList.appendChild(block);
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
});
