/**
 * TabKing Tab Summarizer Engine
 * Extracts page content via chrome.scripting.executeScript and generates
 * rich, structured summaries with site-specific metadata and smart fallbacks.
 */

const TabSummarizer = {
  // In-memory cache to avoid re-summarizing the same tab repeatedly
  cache: new Map(),

  /**
   * Main entry point to get a summary for a tab
   * @param {chrome.tabs.Tab} tab
   * @returns {Promise<Object>} Summary object
   */
  async getSummary(tab) {
    if (!tab || !tab.id) {
      return this.getFallbackSummary(tab, 'Invalid tab');
    }

    // Check cache first (keyed by tabId + url)
    const cacheKey = `${tab.id}:${tab.url}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // 1. Check if it's a chrome:// or about: or edge:// URL where executeScript is forbidden
    if (this.isRestrictedUrl(tab.url)) {
      const summary = this.getRestrictedUrlSummary(tab);
      this.cache.set(cacheKey, summary);
      return summary;
    }

    // 2. Check if the tab is discarded (sleeping in RAM)
    if (tab.discarded) {
      const summary = this.getDiscardedTabSummary(tab);
      this.cache.set(cacheKey, summary);
      return summary;
    }

    // 3. Try to execute script on the tab to extract real DOM content
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractPageContent
      });

      if (result && result.result) {
        const summary = this.formatExtractedContent(tab, result.result);
        this.cache.set(cacheKey, summary);
        return summary;
      }
    } catch (err) {
      console.warn(`TabSummarizer: Could not execute script on tab ${tab.id} (${tab.url}):`, err.message);
    }

    // 4. Fallback if script execution failed (e.g. tab still loading, or restricted origin)
    const summary = this.getFallbackSummary(tab, 'Content not directly accessible');
    this.cache.set(cacheKey, summary);
    return summary;
  },

  /**
   * Checks if URL is restricted by Chrome security policy
   */
  isRestrictedUrl(url) {
    if (!url) return true;
    return (
      url.startsWith('chrome://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('edge://') ||
      url.startsWith('about:') ||
      url.startsWith('view-source:') ||
      url.startsWith('https://chrome.google.com/webstore') ||
      url.startsWith('https://chromewebstore.google.com')
    );
  },

  /**
   * Generates a summary for restricted Chrome/system URLs
   */
  getRestrictedUrlSummary(tab) {
    const url = tab.url || '';
    let overview = 'Chrome System & Security Page.';
    let category = 'System';

    if (url.startsWith('chrome://extensions')) {
      overview = 'Chrome Extension Manager: Interface for enabling, disabling, inspecting, and configuring installed browser extensions and developer mode.';
      category = 'Extension Management';
    } else if (url.startsWith('chrome://settings')) {
      overview = 'Chrome Settings: Configuration panel for browser privacy, security, appearance, search engines, and default behavior.';
      category = 'Settings';
    } else if (url.startsWith('chrome://history')) {
      overview = 'Chrome Browsing History: Searchable log of previously visited web pages across windows and devices.';
      category = 'History';
    } else if (url.startsWith('chrome://downloads')) {
      overview = 'Chrome Downloads Manager: List of active and completed file downloads with options to open or clear.';
      category = 'Downloads';
    } else if (url.startsWith('chrome://flags')) {
      overview = 'Chrome Experimental Flags: Advanced developer settings and experimental browser features.';
      category = 'Experimental';
    } else if (url.startsWith('chrome-extension://')) {
      overview = `Extension Page (${tab.title || 'TabKing'}): Internal page rendered by a Chrome extension.`;
      category = 'Extension';
    } else if (url.startsWith('about:blank')) {
      overview = 'Empty Browser Tab: Blank page with no loaded content.';
      category = 'Blank';
    }

    return {
      title: tab.title || 'System Page',
      url: tab.url,
      domain: 'Chrome System',
      overview,
      headings: [],
      insights: {
        wordCount: 0,
        readTime: 'Instant',
        contentType: category,
        hasForm: false
      },
      siteBadge: { text: `Chrome ${category}`, type: 'system' },
      status: 'restricted'
    };
  },

  /**
   * Generates a summary for discarded (sleeping) tabs without waking them
   */
  getDiscardedTabSummary(tab) {
    const domain = this.getDomain(tab.url);
    const overview = `Sleeping Tab (RAM Saved): This tab is currently suspended in memory. Title: "${tab.title || 'Untitled'}" at ${domain}.`;

    return {
      title: tab.title || 'Sleeping Tab',
      url: tab.url,
      domain,
      overview,
      headings: [],
      insights: {
        wordCount: 0,
        readTime: 'Sleeping',
        contentType: 'Suspended Tab',
        hasForm: false
      },
      siteBadge: { text: '💤 Sleeping in RAM', type: 'sleeping' },
      status: 'discarded'
    };
  },

  /**
   * Generates a fallback summary when DOM extraction is not possible
   */
  getFallbackSummary(tab, reason = '') {
    const domain = this.getDomain(tab.url);
    const overview = `Page Overview: "${tab.title || 'Untitled'}" on ${domain}. ${reason ? `(${reason})` : ''}`;

    return {
      title: tab.title || 'Web Page',
      url: tab.url,
      domain,
      overview,
      headings: [],
      insights: {
        wordCount: 0,
        readTime: 'N/A',
        contentType: 'Web Page',
        hasForm: false
      },
      siteBadge: null,
      status: 'fallback'
    };
  },

  /**
   * Formats raw extracted DOM content into a polished Summary object
   */
  formatExtractedContent(tab, data) {
    const domain = this.getDomain(tab.url);
    
    // 1. Build Overview (Prioritize visible viewport text & top-of-page text)
    let overview = '';
    if (data.viewportText && data.viewportText.length > 50) {
      overview = data.viewportText;
    } else if (data.topOfPageText && data.topOfPageText.length > 50) {
      overview = data.topOfPageText;
    } else if (data.metaDesc) {
      overview = data.metaDesc;
    } else if (data.paragraphs && data.paragraphs.length > 0) {
      overview = data.paragraphs.slice(0, 2).join(' ');
    } else if (data.headings && data.headings.length > 0) {
      overview = `Page covers: ${data.headings.slice(0, 4).join(', ')}.`;
    } else {
      overview = `Web page titled "${tab.title || 'Untitled'}" on ${domain}.`;
    }

    // Trim overview if too long to keep it crisp & readable
    if (overview.length > 340) {
      overview = overview.substring(0, 337) + '...';
    }

    // 2. Determine Content Type
    let contentType = 'Web Article';
    if (data.hasForm && data.wordCount < 300) {
      contentType = 'Interactive Form / App';
    } else if (data.wordCount > 1500) {
      contentType = 'Long-form Article / Docs';
    } else if (data.imageCount > 10 && data.wordCount < 400) {
      contentType = 'Visual / Gallery';
    } else if (data.wordCount < 150) {
      contentType = 'Landing Page / Portal';
    }

    // 3. Site-Specific Badges
    let siteBadge = null;
    if (data.siteData) {
      const s = data.siteData;
      if (s.type === 'github') {
        const parts = ['GitHub'];
        if (s.repo) parts.push(s.repo);
        if (s.stars) parts.push(`★ ${s.stars}`);
        if (s.prStatus) parts.push(`[${s.prStatus}]`);
        siteBadge = { text: parts.join(' • '), type: 'github' };
      } else if (s.type === 'youtube') {
        const parts = ['YouTube'];
        if (s.channel) parts.push(s.channel);
        if (s.views) parts.push(s.views);
        siteBadge = { text: parts.join(' • '), type: 'youtube' };
      } else if (s.type === 'stackoverflow') {
        const parts = ['StackOverflow'];
        if (s.score) parts.push(`Score: ${s.score}`);
        if (s.hasAccepted) parts.push('✓ Accepted Answer');
        siteBadge = { text: parts.join(' • '), type: 'stackoverflow' };
      } else if (s.type === 'reddit') {
        siteBadge = { text: `Reddit ${s.subreddit || ''}`, type: 'reddit' };
      } else if (s.type === 'wikipedia') {
        siteBadge = { text: 'Wikipedia Article', type: 'wikipedia' };
      }
    }

    return {
      title: tab.title || data.ogTitle || 'Web Page',
      url: tab.url,
      domain,
      overview,
      headings: data.headings || [],
      insights: {
        wordCount: data.wordCount || 0,
        readTime: `${data.readTimeMins || 1} min read`,
        contentType,
        hasForm: data.hasForm || false
      },
      siteBadge,
      status: 'success'
    };
  },

  getDomain(urlStr) {
    try {
      return new URL(urlStr).hostname.replace(/^www\./, '');
    } catch {
      return 'Web';
    }
  }
};

/**
 * Function injected into tab to extract DOM content
 */
function extractPageContent() {
  const getText = (selector) => {
    const el = document.querySelector(selector);
    return el ? el.textContent.trim() : '';
  };

  const getAttr = (selector, attr) => {
    const el = document.querySelector(selector);
    return el ? el.getAttribute(attr) || '' : '';
  };

  // 1. Meta Description & Keywords
  const metaDesc =
    getAttr('meta[name="description"]', 'content') ||
    getAttr('meta[property="og:description"]', 'content') ||
    getAttr('meta[name="twitter:description"]', 'content');

  const metaKeywords = getAttr('meta[name="keywords"]', 'content');
  const ogTitle = getAttr('meta[property="og:title"]', 'content');
  const ogSiteName = getAttr('meta[property="og:site_name"]', 'content');

  // 2. Headings
  const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
    .map((h) => h.textContent.trim().replace(/\s+/g, ' '))
    .filter((h) => h.length > 3 && h.length < 120)
    .slice(0, 6);

  // 3. Main Paragraphs
  const pElements = Array.from(document.querySelectorAll('article p, main p, .content p, #content p, p'))
    .map((p) => p.textContent.trim().replace(/\s+/g, ' '))
    .filter((p) => p.length > 40)
    .slice(0, 5);

  // 4. Viewport & Above-The-Fold Text Extraction
  let viewportText = '';
  let topOfPageText = '';

  try {
    // A. Viewport Text (what is currently visible on screen)
    const visibleTexts = [];
    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim().replace(/\s+/g, ' ');
        if (text.length > 15) {
          const parent = node.parentElement;
          if (parent && parent.offsetHeight > 0 && parent.offsetWidth > 0) {
            const rect = parent.getBoundingClientRect();
            // Check if element is inside the visible viewport
            if (rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0) {
              visibleTexts.push(text);
            }
          }
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();
        if (tag !== 'script' && tag !== 'style' && tag !== 'noscript' && tag !== 'svg' && tag !== 'canvas') {
          const style = window.getComputedStyle(node);
          if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
            for (const child of node.childNodes) {
              walk(child);
            }
          }
        }
      }
    };
    walk(document.body || document.documentElement);
    viewportText = visibleTexts.join(' ').trim();
  } catch {
    // Fallback if viewport calculation fails
  }

  try {
    // B. Top-of-Page / Above-The-Fold Text (first 1000 chars of main/body)
    const mainEl = document.querySelector('main, article, .content, #content, body');
    if (mainEl) {
      topOfPageText = mainEl.innerText.trim().replace(/\s+/g, ' ').substring(0, 1000);
    }
  } catch {
    // Fallback
  }

  // 5. Page Statistics
  const bodyText = document.body ? document.body.innerText || '' : '';
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
  const readTimeMins = Math.max(1, Math.round(wordCount / 200));

  const linkCount = document.querySelectorAll('a[href]').length;
  const imageCount = document.querySelectorAll('img').length;
  const hasForm = document.querySelectorAll('form').length > 0;

  // 6. Site-Specific Extractions
  const siteData = {};
  const hostname = window.location.hostname;

  if (hostname.includes('github.com')) {
    siteData.type = 'github';
    siteData.repo = getText('[itemprop="name"] a') || window.location.pathname.split('/').slice(1, 3).join('/');
    siteData.stars = getText('#repo-stars-counter-star') || getText('.js-social-count');
    siteData.forks = getText('#repo-network-counter');
    siteData.issues = getText('#issues-repo-tab-count');
    siteData.prTitle = getText('.js-issue-title');
    siteData.prStatus = getText('.State');
  } else if (hostname.includes('youtube.com')) {
    siteData.type = 'youtube';
    siteData.videoTitle = getText('h1.ytd-watch-metadata') || getText('h1.title');
    siteData.channel = getText('#channel-name a') || getText('.ytd-channel-name a');
    siteData.views = getText('#info span') || getText('.ytd-video-view-count-renderer');
  } else if (hostname.includes('stackoverflow.com') || hostname.includes('serverfault.com') || hostname.includes('superuser.com')) {
    siteData.type = 'stackoverflow';
    siteData.question = getText('#question-header h1');
    siteData.score = getText('#question .js-vote-count');
    siteData.hasAccepted = document.querySelectorAll('.accepted-answer').length > 0;
    siteData.answerCount = document.querySelectorAll('.answer').length;
  } else if (hostname.includes('reddit.com')) {
    siteData.type = 'reddit';
    siteData.subreddit = window.location.pathname.split('/')[2] ? `r/${window.location.pathname.split('/')[2]}` : '';
    siteData.postTitle = getText('h1') || getText('[data-test-id="post-content"] h1');
  } else if (hostname.includes('wikipedia.org')) {
    siteData.type = 'wikipedia';
    siteData.articleTitle = getText('#firstHeading');
    siteData.intro = pElements[0] || '';
  }

  return {
    metaDesc,
    metaKeywords,
    ogTitle,
    ogSiteName,
    headings,
    paragraphs: pElements,
    viewportText,
    topOfPageText,
    wordCount,
    readTimeMins,
    linkCount,
    imageCount,
    hasForm,
    siteData
  };
}
