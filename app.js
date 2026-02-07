// Argos — Personal operations dashboard
// https://github.com/laydros/argos

// Default configuration (overridden by config.json)
let TASK_OWNERS = ['work', 'personal', 'agent'];
const TASK_BUCKETS = ['active', 'backlog', 'someday'];
let VAULT_TASK_FILES = {
  work: '/data/obnotes/work/work-tasks.md',
  personal: '/data/obnotes/personal/personal-tasks.md',
  agent: '/data/obnotes/agent/agent-tasks.md'
};
let VAULT_INBOX_FILE = '/data/obnotes/inbox.md';
let WEATHER_LOCATION = ''; // Set in config.json (e.g., "NewYork,NY")

const TAB_STORAGE_KEY = 'argos-dashboard-tab';
const FILES_STORAGE_KEY = 'argos-dashboard-files-path';
const PROJECT_FILTER_STORAGE_KEY = 'argos-dashboard-project-filter';
const TAB_KEYS = ['home', 'tasks', 'completed', 'files', 'openclaw'];
let DATA_PREFIX = '/data';
let FILES_ROOT = `${DATA_PREFIX}/`;
const ARGOS_CONFIG_PATH = '/data/config/argos.json';
const LEGACY_CONFIG_PATH = '/data/config/dashboard.json';
const CONFIG_PATHS = [ARGOS_CONFIG_PATH, LEGACY_CONFIG_PATH];
let STATUS_PATH = `${DATA_PREFIX}/status.json`;
const DASHBOARD_VERSION = document.documentElement.dataset.dashboardVersion || 'dev';
let currentFilesPath = FILES_ROOT;
let currentViewerPath = null;
let currentViewerContent = '';
let openclawToken = '';
let openclawEnabled = false;

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function isDoneStatus(status) {
  if (!status) return false;
  if (status.includes('✅')) return true;
  if (/\bdone\b/i.test(status)) return true;
  return /\bcomplete(d)?\b/i.test(status);
}

function isDoneTitle(title) {
  if (!title) return false;
  return title.trim().startsWith('✅');
}

function isDoneTask(task) {
  if (!task) return false;
  if (task.state === 'done' || task.state === 'cancelled') return true;
  if (task.doneSection) return true;
  if (isDoneTitle(task.title)) return true;
  return isDoneStatus(task.status || null);
}
let currentViewerIsMarkdown = false;
let activeTab = 'home';
let tabLoadToken = 0;
const HIGHLIGHT_LANGUAGE_MAP = {
  md: 'markdown',
  markdown: 'markdown',
  json: 'json',
  yml: 'yaml',
  yaml: 'yaml',
  js: 'javascript',
  cjs: 'javascript',
  mjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  html: 'xml',
  htm: 'xml',
  css: 'css',
  py: 'python',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  toml: 'toml',
  rs: 'rust',
  go: 'go'
};

const taskDetailLookup = new Map();

// Task data cache
let taskData = {
  work: { active: [], backlog: [], someday: [] },
  personal: { active: [], backlog: [], someday: [] },
  agent: { active: [], backlog: [], someday: [] },
  inbox: []
};

let projectRegistry = [];

function setOpenclawEnabled(enabled) {
  openclawEnabled = enabled;
  const tabButton = document.querySelector('.tab-button[data-tab="openclaw"]');
  const panel = document.getElementById('tab-openclaw');
  const launchButton = document.getElementById('openclaw-button');

  if (tabButton) {
    tabButton.style.display = enabled ? '' : 'none';
    tabButton.setAttribute('aria-disabled', enabled ? 'false' : 'true');
  }
  if (panel) {
    panel.hidden = !enabled;
  }
  if (launchButton) {
    launchButton.disabled = !enabled;
  }
}

async function loadDashboardConfig() {
  let data = null;

  for (const configPath of CONFIG_PATHS) {
    try {
      const resp = await fetch(cacheBust(configPath));
      if (!resp.ok) continue;
      data = await resp.json();
      break;
    } catch (err) {
      // try next path
    }
  }

  if (!data) {
    openclawToken = '';
    setOpenclawEnabled(false);
    return;
  }

  // OpenClaw token (optional)
  const token = typeof data.openclawToken === 'string' ? data.openclawToken.trim() : '';
  openclawToken = token;
  setOpenclawEnabled(Boolean(token));

  // Weather location (optional)
  if (typeof data.weatherLocation === 'string' && data.weatherLocation.trim()) {
    WEATHER_LOCATION = data.weatherLocation.trim();
  }

  // Data prefix (optional override)
  if (typeof data.dataPrefix === 'string' && data.dataPrefix.trim()) {
    const prefix = data.dataPrefix.trim().replace(/\/+$/, '') || '/data';
    DATA_PREFIX = prefix;
    FILES_ROOT = `${DATA_PREFIX}/`;
    STATUS_PATH = `${DATA_PREFIX}/status.json`;
    if (!currentFilesPath.startsWith(FILES_ROOT)) currentFilesPath = FILES_ROOT;
  }

  // Vault task paths (optional overrides)
  if (data.vaultPaths) {
    if (data.vaultPaths.work) VAULT_TASK_FILES.work = data.vaultPaths.work;
    if (data.vaultPaths.personal) VAULT_TASK_FILES.personal = data.vaultPaths.personal;
    if (data.vaultPaths.agent) VAULT_TASK_FILES.agent = data.vaultPaths.agent;
  }
  if (data.inboxPath) VAULT_INBOX_FILE = data.inboxPath;

  // Task owners (optional override)
  if (Array.isArray(data.taskOwners)) TASK_OWNERS = data.taskOwners;
}

function normalizeProjectKey(name) {
  return (name || '').trim().toLowerCase();
}

function nextTabLoadToken(tab) {
  if (tab) activeTab = tab;
  tabLoadToken += 1;
  return tabLoadToken;
}

function isTabActive(tab, token) {
  return tab === activeTab && token === tabLoadToken;
}

function parseProjectRegistry(markdown) {
  const projects = [];
  const sections = markdown.split(/\n## /);
  sections.shift();

  sections.forEach(section => {
    const lines = section.trim().split('\n');
    if (!lines.length) return;

    const name = lines[0].trim();
    let status = 'Active';
    let description = '';
    const notes = [];

    for (const line of lines.slice(1)) {
      const statusMatch = line.match(/^\*\*Status:\*\*\s*(.+)/i);
      if (statusMatch) {
        status = statusMatch[1].trim();
        continue;
      }
      const descriptionMatch = line.match(/^\*\*Description:\*\*\s*(.+)/i);
      if (descriptionMatch) {
        description = descriptionMatch[1].trim();
        continue;
      }
      notes.push(line);
    }

    projects.push({
      name,
      status,
      description,
      notes: notes.join('\n').trim()
    });
  });

  return projects;
}

async function loadProjectRegistry() {
  try {
    const resp = await fetch(cacheBust('/data/tasks/projects.md'));
    if (!resp.ok) {
      projectRegistry = [];
      return projectRegistry;
    }
    const text = await resp.text();
    projectRegistry = parseProjectRegistry(text);
    return projectRegistry;
  } catch (err) {
    projectRegistry = [];
    return projectRegistry;
  }
}

function getTaskProject(task) {
  if (task.project) return task.project;
  // Fallback for old-format tasks
  if (task.details && task.details.length) {
    const fields = extractTaskFields(task);
    return fields.project || null;
  }
  return null;
}

function collectProjects() {
  const projects = new Set();
  const owners = ['work', 'personal', 'agent'];
  const buckets = ['active', 'backlog', 'someday'];

  for (const owner of owners) {
    for (const bucket of buckets) {
      for (const task of taskData[owner][bucket]) {
        const project = getTaskProject(task);
        if (project) projects.add(project);
      }
    }
  }

  for (const task of taskData.inbox) {
    const project = getTaskProject(task);
    if (project) projects.add(project);
  }

  return Array.from(projects).sort((a, b) => a.localeCompare(b));
}

function getProjectFilterValue() {
  const select = document.getElementById('project-filter');
  if (!select) return 'All';
  return select.value || 'All';
}

function setProjectFilterValue(value) {
  localStorage.setItem(PROJECT_FILTER_STORAGE_KEY, value);
}

function updateProjectFilterOptions() {
  const select = document.getElementById('project-filter');
  if (!select) return;

  const registryNames = projectRegistry.map(project => project.name);
  const projects = [...new Set([...collectProjects(), ...registryNames])];
  const options = ['All', ...projects];
  const saved = localStorage.getItem(PROJECT_FILTER_STORAGE_KEY) || 'All';

  select.innerHTML = '';
  options.forEach(optionValue => {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = optionValue;
    select.appendChild(option);
  });

  select.value = options.includes(saved) ? saved : 'All';
  setProjectFilterValue(select.value);
}

function taskMatchesProject(task, selectedProject) {
  if (!selectedProject || selectedProject === 'All') return true;
  return normalizeProjectKey(getTaskProject(task)) === normalizeProjectKey(selectedProject);
}

// Parse markdown into tasks (splits on ## headers)
function parseTasks(markdown) {
  const tasks = [];
  const lines = markdown.split('\n');
  let current = null;
  let inDoneSection = false;

  const finalizeCurrent = () => {
    if (!current) return;
    current.isDone = isDoneTask(current);
    tasks.push(current);
    current = null;
  };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      const title = line.slice(3).trim();
      if (title.toLowerCase() === 'done') {
        finalizeCurrent();
        inDoneSection = true;
        continue;
      }
      finalizeCurrent();
      current = {
        title,
        details: [],
        urgent: /⚠️|URGENT|urgent/i.test(title),
        status: null,
        due: null,
        project: null,
        doneSection: inDoneSection
      };
    } else if (current) {
      const statusMatch = line.match(/\*\*Status[:\*]*\*?\s*(.+)/i);
      if (statusMatch) {
        current.status = statusMatch[1].replace(/\*+$/, '').trim();
        continue;
      }
      const projectMatch = line.match(/\*\*Project[:\*]*\*?\s*(.+)/i);
      if (projectMatch) {
        current.project = projectMatch[1].replace(/\*+$/, '').trim();
        continue;
      }
      const dueMatch = line.match(/\*\*Due[:\*]*\*?\s*(.+)/i);
      if (dueMatch) {
        current.due = dueMatch[1].replace(/\*+$/, '').trim();
        continue;
      }
      current.details.push(line);
    }
  }
  finalizeCurrent();

  return tasks;
}

// Parse vault-format tasks (Dataview checkbox format)
// Returns array of task objects with: title, state, section, tags, due, project, priority, done, created, description, urgent
function parseVaultTasks(markdown) {
  const tasks = [];
  const lines = markdown.split('\n');
  let inFrontmatter = false;
  let frontmatterDone = false;
  let currentSection = 'Active'; // default section
  let currentTask = null;

  const CHECKBOX_RE = /^- \[([ x\/\-])\]\s+(.+)$/;
  const INLINE_FIELD_RE = /\[([a-zA-Z_]+)::\s*([^\]]*)\]/g;
  const TAG_RE = /#([a-zA-Z0-9_-]+)/g;

  const finalizeTask = () => {
    if (currentTask) {
      // Trim trailing empty description lines
      while (currentTask.description.length > 0 && currentTask.description[currentTask.description.length - 1].trim() === '') {
        currentTask.description.pop();
      }
      tasks.push(currentTask);
      currentTask = null;
    }
  };

  for (const line of lines) {
    // Handle YAML frontmatter
    if (!frontmatterDone && line.trim() === '---') {
      if (!inFrontmatter) {
        inFrontmatter = true;
        continue;
      } else {
        inFrontmatter = false;
        frontmatterDone = true;
        continue;
      }
    }
    if (inFrontmatter) continue;

    // Track section headers
    if (line.startsWith('## ')) {
      finalizeTask();
      currentSection = line.slice(3).trim();
      continue;
    }

    // Skip top-level headers and non-task content before first checkbox
    if (line.startsWith('# ')) continue;

    // Check for checkbox line
    const checkMatch = line.match(CHECKBOX_RE);
    if (checkMatch) {
      finalizeTask();

      const stateChar = checkMatch[1];
      let rawTitle = checkMatch[2];

      // Map checkbox state
      let state = 'todo';
      let statusLabel = null;
      if (stateChar === 'x') { state = 'done'; statusLabel = 'Done'; }
      else if (stateChar === '/') { state = 'in_progress'; statusLabel = 'In Progress'; }
      else if (stateChar === '-') { state = 'cancelled'; statusLabel = 'Cancelled'; }

      // Extract inline fields from the title line
      const fields = {};
      let fieldMatch;
      const fieldRegex = new RegExp(INLINE_FIELD_RE.source, 'g');
      while ((fieldMatch = fieldRegex.exec(rawTitle)) !== null) {
        fields[fieldMatch[1].toLowerCase()] = fieldMatch[2].trim();
      }
      // Remove inline fields from display title
      let cleanTitle = rawTitle.replace(/\[[a-zA-Z_]+::\s*[^\]]*\]/g, '').trim();

      // Extract tags
      const tags = [];
      const tagRegex = new RegExp(TAG_RE.source, 'g');
      let tagMatch;
      while ((tagMatch = tagRegex.exec(cleanTitle)) !== null) {
        tags.push(tagMatch[1]);
      }
      // Remove tags from display title
      cleanTitle = cleanTitle.replace(/#[a-zA-Z0-9_-]+/g, '').trim();
      // Clean up extra spaces
      cleanTitle = cleanTitle.replace(/\s{2,}/g, ' ').trim();

      currentTask = {
        title: cleanTitle,
        state: state,
        status: statusLabel,
        section: currentSection,
        tags: tags,
        due: fields.due || null,
        project: fields.project || null,
        priority: fields.priority || null,
        done: fields.done || null,
        created: fields.created || null,
        description: [],
        urgent: !!(fields.priority === 'high' || /⚠️|URGENT|urgent/i.test(cleanTitle)),
        // Compatibility: details array for existing renderDetails/extractTaskFields
        details: [],
        doneSection: currentSection.toLowerCase() === 'done'
      };
      continue;
    }

    // Indented description lines (2+ spaces) belong to current task
    if (currentTask && (line.startsWith('  ') || line.trim() === '')) {
      const descLine = line.startsWith('  ') ? line.slice(2) : line;
      currentTask.description.push(descLine);
      currentTask.details.push(descLine);
      continue;
    }

    // Non-checkbox, non-indented lines (like paragraph text between sections)
    // These don't belong to any task, skip them
    if (currentTask && line.trim() !== '') {
      // If it's not indented and not a checkbox, finalize current task
      finalizeTask();
    }
  }

  finalizeTask();
  return tasks;
}

// Split parsed vault tasks into bucket arrays by section name
function splitVaultTasksBySection(tasks) {
  const result = { active: [], backlog: [], someday: [], done: [] };
  for (const task of tasks) {
    const sectionKey = task.section.toLowerCase();
    if (sectionKey === 'active') result.active.push(task);
    else if (sectionKey === 'backlog') result.backlog.push(task);
    else if (sectionKey === 'someday') result.someday.push(task);
    else if (sectionKey === 'done') result.done.push(task);
    else result.active.push(task); // default unknown sections to active
  }
  return result;
}

function extractCompletedFields(task) {
  const fields = {
    completed: null,
    from: null,
    owner: null,
    bucket: null
  };

  for (const line of task.details) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const completedMatch = trimmed.match(/^\*{0,2}(Done|Completed)[:\*]*\s*(.+)/i);
    if (completedMatch) {
      fields.completed = completedMatch[2].replace(/\*+$/, '').trim();
      continue;
    }

    const fromMatch = trimmed.match(/^\*{0,2}From[:\*]*\s*(.+)/i);
    if (fromMatch) {
      fields.from = fromMatch[1].replace(/\*+$/, '').trim();
      const ownerToken = fields.from.split('/')[0].trim().toLowerCase();
      if (TASK_OWNERS.includes(ownerToken)) {
        fields.owner = ownerToken;
        fields.bucket = fields.from.split('/').slice(1).join('/').trim() || null;
      }
    }
  }

  if (!fields.owner) fields.owner = 'Other';
  return fields;
}

function extractCompletedBody(details) {
  return details.filter(line => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    return !/^\*{0,2}(status|completed|done|from)[:\*]/i.test(trimmed);
  });
}

function renderCompletedNotes(details) {
  const notesHtml = renderDetails(details);
  if (!notesHtml) return '<p class="subtle">No notes yet.</p>';
  return `<div class="task-notes">${notesHtml}</div>`;
}

// Render task details as HTML
function renderDetails(details) {
  const text = details.join('\n').trim();
  if (!text) return '';
  
  if (typeof marked !== 'undefined') {
    return marked.parse(text);
  }
  return `<p>${text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
}

function extractTaskFields(task) {
  const fields = {
    status: task.status || null,
    project: task.project || null,
    due: task.due || null,
    priority: task.priority || null,
    created: task.created || null,
    done: task.done || null,
    tags: task.tags || [],
    notes: []
  };

  // For vault tasks, description/details are already clean
  // For old-format tasks, parse fields from details lines
  if (task.details && task.details.length) {
    for (const line of task.details) {
      const trimmed = line.trim();
      if (!trimmed) {
        fields.notes.push(line);
        continue;
      }

      // Old-format field extraction (backward compat)
      const statusMatch = trimmed.match(/^\*{0,2}Status[:\*]*\s*(.+)/i);
      if (statusMatch) {
        if (!fields.status) {
          fields.status = statusMatch[1].replace(/\*+$/, '').trim();
        }
        continue;
      }

      const projectMatch = trimmed.match(/^\*{0,2}Project[:\*]*\s*(.+)/i);
      if (projectMatch) {
        if (!fields.project) {
          fields.project = projectMatch[1].replace(/\*+$/, '').trim();
        }
        continue;
      }

      const dueMatch = trimmed.match(/^\*{0,2}Due[:\*]*\s*(.+)/i);
      if (dueMatch) {
        if (!fields.due) {
          fields.due = dueMatch[1].replace(/\*+$/, '').trim();
        }
        continue;
      }

      fields.notes.push(line);
    }
  }

  return fields;
}

function renderTaskMeta(fields) {
  const rows = [];

  if (fields.status) {
    rows.push(`
      <div class="task-detail-row">
        <span class="task-detail-label">Status</span>
        <span class="task-detail-value">${escapeHtml(fields.status)}</span>
      </div>
    `);
  }
  if (fields.project) {
    rows.push(`
      <div class="task-detail-row">
        <span class="task-detail-label">Project</span>
        <span class="task-detail-value">${escapeHtml(fields.project)}</span>
      </div>
    `);
  }
  if (fields.due) {
    rows.push(`
      <div class="task-detail-row">
        <span class="task-detail-label">Due</span>
        <span class="task-detail-value">${escapeHtml(fields.due)}</span>
      </div>
    `);
  }
  if (fields.priority) {
    rows.push(`
      <div class="task-detail-row">
        <span class="task-detail-label">Priority</span>
        <span class="task-detail-value">${escapeHtml(fields.priority)}</span>
      </div>
    `);
  }
  if (fields.tags && fields.tags.length > 0) {
    rows.push(`
      <div class="task-detail-row">
        <span class="task-detail-label">Tags</span>
        <span class="task-detail-value">${fields.tags.map(t => `<span class="tag-badge">#${escapeHtml(t)}</span>`).join(' ')}</span>
      </div>
    `);
  }
  if (fields.created) {
    rows.push(`
      <div class="task-detail-row">
        <span class="task-detail-label">Created</span>
        <span class="task-detail-value">${escapeHtml(fields.created)}</span>
      </div>
    `);
  }
  if (fields.done) {
    rows.push(`
      <div class="task-detail-row">
        <span class="task-detail-label">Completed</span>
        <span class="task-detail-value">${escapeHtml(fields.done)}</span>
      </div>
    `);
  }

  if (rows.length === 0) return '';
  return `<div class="task-detail-meta">${rows.join('')}</div>`;
}

function renderTaskNotes(fields) {
  const notesHtml = renderDetails(fields.notes);
  if (!notesHtml) {
    return '<p class="subtle">No notes yet.</p>';
  }
  return `<div class="task-notes">${notesHtml}</div>`;
}

function renderTaskDetailBlock(task) {
  const fields = extractTaskFields(task);
  const metaHtml = renderTaskMeta(fields);
  const notesHtml = renderTaskNotes(fields);

  return `${metaHtml}${notesHtml}`;
}

function clearTaskLookup(listId) {
  const prefix = `${listId}:`;
  for (const key of taskDetailLookup.keys()) {
    if (key.startsWith(prefix)) taskDetailLookup.delete(key);
  }
}

// Render active tasks as cards (grouped by owner)
function renderActiveCards(selectedProject) {
  const container = document.getElementById('active-list');
  const count = document.getElementById('active-count');
  
  const allActive = [
    ...taskData.work.active.map(t => ({ ...t, owner: 'work' })),
    ...taskData.personal.active.map(t => ({ ...t, owner: 'personal' })),
    ...taskData.agent.active.map(t => ({ ...t, owner: 'agent' }))
  ].filter(task => taskMatchesProject(task, selectedProject));
  
  count.textContent = allActive.length;
  
  if (allActive.length === 0) {
    container.innerHTML = '<p class="subtle">No active tasks</p>';
    return;
  }

  container.innerHTML = allActive.map(task => `
    <div class="card${task.urgent ? ' urgent' : ''}" data-owner="${task.owner}">
      <span class="card-owner" data-owner="${task.owner}">${task.owner}</span>
      <h3>${task.title}</h3>
      ${task.status ? `<span class="status">${task.status}</span>` : ''}
      <div class="details">${renderDetails(task.details)}</div>
    </div>
  `).join('');
}

// Render tasks as list items (with optional owner badge)
function renderList(tasks, listId, countId, options = {}) {
  const { showOwner = false, enableDetails = false, skipGroupHeaders = false } = options;
  const container = document.getElementById(listId);
  const count = document.getElementById(countId);
  
  count.textContent = tasks.length;
  
  if (tasks.length === 0) {
    container.innerHTML = '<li class="subtle">Empty</li>';
    return;
  }

  if (!enableDetails) {
    container.innerHTML = tasks.map(task => `
      <li class="task-row${task.isDone ? ' is-done' : ''}">
        ${showOwner && task.owner ? `<span class="list-owner" data-owner="${task.owner}">${task.owner}</span>` : ''}
        <span class="title">${task.title}</span>
        ${task.isDone ? '<span class="done-badge">Done</span>' : ''}
        ${task.status ? `<span class="meta">${task.status}</span>` : ''}
      </li>
    `).join('');
    return;
  }

  clearTaskLookup(listId);

  // Group tasks by owner for visual separation
  const grouped = { work: [], personal: [], agent: [], inbox: [] };
  tasks.forEach((task, index) => {
    const taskKey = `${listId}:${index}`;
    taskDetailLookup.set(taskKey, task);
    const owner = task.owner || 'inbox';
    if (!grouped[owner]) grouped[owner] = [];
    grouped[owner].push({ ...task, taskKey });
  });

  const selectedProject = getProjectFilterValue();
  const showProjectBadge = selectedProject === 'All';

  const renderTaskItem = (task) => {
    const project = getTaskProject(task);
    const hasSecondRow = task.due || (showProjectBadge && project);
    return `
    <li class="task-item${task.isDone ? ' is-done' : ''}" data-task-key="${task.taskKey}" data-owner="${task.owner || ''}">
      <div class="task-summary" role="button" tabindex="0" aria-expanded="false">
        <span class="expand-icon" aria-hidden="true">▶</span>
        <div class="task-summary-content">
          <div class="task-summary-row task-summary-top">
            ${showOwner && task.owner ? `<span class="list-owner" data-owner="${task.owner}">${task.owner}</span>` : ''}
            <span class="task-title">${task.title}</span>
            ${task.isDone ? '<span class="done-badge">Done</span>' : ''}
            ${task.status ? `<span class="task-meta">${task.status}</span>` : ''}
          </div>
          ${hasSecondRow ? `<div class="task-due-row"><span>${task.due ? `📅 ${task.due}` : ''}</span>${showProjectBadge && project ? `<span class="task-project-badge">${project}</span>` : ''}</div>` : ''}
        </div>
      </div>
      <div class="task-details" hidden>
        <div class="task-details-content">
          ${renderTaskDetailBlock(task)}
        </div>
        <button class="open-full-view" type="button">Open full view</button>
      </div>
    </li>
  `;
  };

  const sections = [];
  if (grouped.work.length > 0) {
    if (!skipGroupHeaders) sections.push(`<li class="task-group-header" data-owner="work">Work</li>`);
    sections.push(...grouped.work.map(renderTaskItem));
  }
  if (grouped.personal.length > 0) {
    if (!skipGroupHeaders) sections.push(`<li class="task-group-header" data-owner="personal">Personal</li>`);
    sections.push(...grouped.personal.map(renderTaskItem));
  }
  if (grouped.agent.length > 0) {
    if (!skipGroupHeaders) sections.push(`<li class="task-group-header" data-owner="agent">Agent</li>`);
    sections.push(...grouped.agent.map(renderTaskItem));
  }
  if (grouped.inbox.length > 0) {
    if (!skipGroupHeaders) sections.push(`<li class="task-group-header" data-owner="inbox">Inbox</li>`);
    sections.push(...grouped.inbox.map(renderTaskItem));
  }

  container.innerHTML = sections.join('');
}

// Cache buster for fresh fetches
function cacheBust(url) {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}_=${Date.now()}`;
}

function formatCodexWindow(minutes) {
  if (typeof minutes !== 'number' || Number.isNaN(minutes)) return '';
  if (minutes % 10080 === 0) {
    const weeks = minutes / 10080;
    return `${weeks}w`;
  }
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return `${days}d`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours}h`;
  }
  return `${minutes}m`;
}

function formatCodexUsage(codex) {
  if (!codex) return null;
  let percentText = '';
  if (typeof codex.usedPercent === 'number' && !Number.isNaN(codex.usedPercent)) {
    percentText = `${Math.round(codex.usedPercent)}%`;
  } else if (typeof codex.usedPercent === 'string' && codex.usedPercent.trim()) {
    percentText = `${codex.usedPercent.trim()}%`;
  }

  const resetText = typeof codex.resetDescription === 'string' ? codex.resetDescription.trim() : '';
  const windowText = formatCodexWindow(codex.windowMinutes);
  const parts = [];
  if (windowText) parts.push(`${windowText} window`);
  if (resetText) parts.push(`resets ${resetText}`);

  if (percentText && parts.length) return `${percentText} (${parts.join(', ')})`;
  if (percentText) return percentText;
  if (parts.length) return parts.join(', ');
  return null;
}

function formatStatusTime(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function classifyMetric(value, warn, critical) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  if (value >= critical) return 'critical';
  if (value >= warn) return 'warn';
  return null;
}

function buildMetricDisplay(value, severity) {
  if (!value) return { text: 'Unknown', severity: null };
  if (severity === 'critical') return { text: `❗ ${value}`, severity };
  if (severity === 'warn') return { text: `⚠️ ${value}`, severity };
  return { text: value, severity: null };
}

function parseNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

async function loadStatusWidget() {
  const container = document.getElementById('status-rows');
  const updatedLabel = document.getElementById('status-updated');
  if (!container) return;

  container.innerHTML = `
    <div class="status-row">
      <span class="status-label">Status</span>
      <span class="status-value subtle">Loading...</span>
    </div>
  `;
  if (updatedLabel) updatedLabel.textContent = 'Updated --';

  let data = null;
  try {
    const resp = await fetch(cacheBust(STATUS_PATH));
    if (resp.ok) {
      data = await resp.json();
    }
  } catch (err) {
    data = null;
  }

  const claudeValue = formatCodexUsage(data && data.claude);
  const claudeWeeklyValue = formatCodexUsage(data && data.claudeWeekly);
  const codexValue = formatCodexUsage(data && data.codex);
  const codexWeeklyValue = formatCodexUsage(data && data.codexWeekly);
  const openclawVersion = data && data.openclaw ? data.openclaw.version : null;
  const gatewayUptime = data && data.openclaw ? data.openclaw.gatewayUptime : null;
  const zag = data && data.zag ? data.zag : null;
  const zagUptime = zag ? zag.uptime : null;

  const ramPercent = zag && typeof zag.ramUsedBytes === 'number' && typeof zag.ramTotalBytes === 'number'
    ? (zag.ramUsedBytes / Math.max(zag.ramTotalBytes, 1)) * 100
    : null;
  const swapPercent = zag && typeof zag.swapUsedBytes === 'number' && typeof zag.swapTotalBytes === 'number'
    ? (zag.swapUsedBytes / Math.max(zag.swapTotalBytes, 1)) * 100
    : null;
  const diskPercent = zag && typeof zag.diskPercent === 'number'
    ? zag.diskPercent
    : null;
  const loadAvg = parseNumber(zag && zag.loadAvg);

  const ramDisplay = buildMetricDisplay(zag && zag.ram, classifyMetric(ramPercent, 80, 90));
  const swapDisplay = buildMetricDisplay(zag && zag.swap, classifyMetric(swapPercent, 20, 50));
  const diskDisplay = buildMetricDisplay(zag && zag.disk, classifyMetric(diskPercent, 80, 90));
  const loadDisplay = buildMetricDisplay(zag && zag.loadAvg, classifyMetric(loadAvg, 1.0, 2.0));

  const rows = [
    { label: 'OpenClaw', value: openclawVersion || 'Unknown' },
    { label: 'Dashboard', value: DASHBOARD_VERSION },
    { label: 'Gateway Uptime', value: gatewayUptime || 'Unknown' },
    { label: 'Zag Uptime', value: zagUptime || 'Unknown' },
    { label: 'RAM', value: ramDisplay.text, severity: ramDisplay.severity },
    { label: 'Swap', value: swapDisplay.text, severity: swapDisplay.severity },
    { label: 'Disk', value: diskDisplay.text, severity: diskDisplay.severity },
    { label: 'CPU Load', value: loadDisplay.text, severity: loadDisplay.severity },
    { label: 'Claude Weekly', value: claudeValue || 'Unknown' },
    { label: 'Codex', value: codexValue || 'Unknown' },
    { label: 'Codex Weekly', value: codexWeeklyValue || 'Unknown' }
  ];

  container.innerHTML = rows.map(row => `
    <div class="status-row">
      <span class="status-label">${row.label}</span>
      <span class="status-value${row.severity ? ` ${row.severity}` : ''}">${row.value}</span>
    </div>
  `).join('');

  if (updatedLabel) {
    const timeText = formatStatusTime(data && data.updated);
    updatedLabel.textContent = timeText ? `Updated ${timeText}` : 'Updated --';
  }
}

// Fetch all vault task files and cache them
async function loadAllTasks() {
  const fetches = [];

  // Fetch vault files (one per owner, contains all sections)
  for (const owner of TASK_OWNERS) {
    const path = VAULT_TASK_FILES[owner];
    if (!path) {
      console.warn(`No vault path configured for owner "${owner}", skipping`);
      continue;
    }
    fetches.push(
      fetch(cacheBust(path))
        .then(r => r.ok ? r.text() : '')
        .then(text => {
          const allTasks = parseVaultTasks(text);
          const bySection = splitVaultTasksBySection(allTasks);
          return { owner, bySection };
        })
        .catch(() => ({ owner, bySection: { active: [], backlog: [], someday: [], done: [] } }))
    );
  }

  // Fetch inbox
  fetches.push(
    fetch(cacheBust(VAULT_INBOX_FILE))
      .then(r => r.ok ? r.text() : '')
      .then(text => {
        const allTasks = parseVaultTasks(text);
        return { owner: 'inbox', tasks: allTasks };
      })
      .catch(() => ({ owner: 'inbox', tasks: [] }))
  );

  const results = await Promise.all(fetches);

  // Update cache
  for (const result of results) {
    if (result.owner === 'inbox') {
      taskData.inbox = result.tasks;
    } else {
      const { owner, bySection } = result;
      // Filter out done tasks from active buckets
      taskData[owner].active = bySection.active.filter(t => !isDoneTask(t));
      taskData[owner].backlog = bySection.backlog.filter(t => !isDoneTask(t));
      taskData[owner].someday = bySection.someday.filter(t => !isDoneTask(t));
      // Store done tasks for history tab
      taskData[owner]._done = bySection.done || [];
    }
  }

  return taskData;
}

function applyProjectFilter() {
  const selectedProject = getProjectFilterValue();

  // Render active (all owners combined)
  const allActive = [
    ...taskData.work.active.map(t => ({ ...t, owner: 'work' })),
    ...taskData.personal.active.map(t => ({ ...t, owner: 'personal' })),
    ...taskData.agent.active.map(t => ({ ...t, owner: 'agent' }))
  ].filter(task => taskMatchesProject(task, selectedProject));
  renderList(allActive, 'active-list', 'active-count', {
    showOwner: true,
    enableDetails: true,
    skipGroupHeaders: true
  });

  // Render backlog (combined with owner badges)
  const allBacklog = [
    ...taskData.work.backlog.map(t => ({ ...t, owner: 'work' })),
    ...taskData.personal.backlog.map(t => ({ ...t, owner: 'personal' })),
    ...taskData.agent.backlog.map(t => ({ ...t, owner: 'agent' }))
  ].filter(task => taskMatchesProject(task, selectedProject));
  renderList(allBacklog, 'backlog-list', 'backlog-count', {
    showOwner: true,
    enableDetails: true
  });

  // Render someday (combined with owner badges)
  const allSomeday = [
    ...taskData.work.someday.map(t => ({ ...t, owner: 'work' })),
    ...taskData.personal.someday.map(t => ({ ...t, owner: 'personal' })),
    ...taskData.agent.someday.map(t => ({ ...t, owner: 'agent' }))
  ].filter(task => taskMatchesProject(task, selectedProject));
  renderList(allSomeday, 'someday-list', 'someday-count', {
    showOwner: true,
    enableDetails: true
  });
}

// Render tasks tab
async function loadTasks(token) {
  const status = document.getElementById('status');
  const hint = document.getElementById('hint');
  
  if (!isTabActive('tasks', token)) return;
  status.textContent = 'Loading tasks...';
  if (hint) hint.style.display = 'none';

  try {
    await loadAllTasks();
    await loadProjectRegistry();

    if (!isTabActive('tasks', token)) return;
    updateProjectFilterOptions();
    applyProjectFilter();
    
    // Render inbox
    renderList(taskData.inbox, 'inbox-list', 'inbox-count', { enableDetails: true, skipGroupHeaders: true });
    
    const now = new Date();
    status.textContent = `Updated ${now.toLocaleTimeString()}`;

  } catch (err) {
    console.error('Error loading tasks:', err);
    status.textContent = 'Could not load tasks';
    if (hint) hint.style.display = 'block';
  }
}

function renderCompletedSections(entries) {
  const container = document.getElementById('completed-content');
  const totalCount = document.getElementById('completed-total');
  if (!container || !totalCount) return;

  totalCount.textContent = entries.length;

  if (entries.length === 0) {
    container.innerHTML = '<p class="subtle">No history yet. Knock one out and it will show up here.</p>';
    return;
  }

  const grouped = {
    work: [],
    personal: [],
    agent: [],
    Other: []
  };

  entries.forEach(entry => {
    const ownerKey = entry.owner || 'Other';
    if (!grouped[ownerKey]) grouped[ownerKey] = [];
    grouped[ownerKey].push(entry);
  });

  const order = ['work', 'personal', 'agent', 'Other'];
  const sectionHtml = order
    .filter(key => grouped[key] && grouped[key].length > 0)
    .map(key => {
      const label = key === 'Other' ? 'Other' : `${key[0].toUpperCase()}${key.slice(1)}`;
      const items = grouped[key].map(entry => {
        const completedText = entry.completed ? `✅ ${escapeHtml(entry.completed)}` : '✅';
        const detailsHtml = renderCompletedNotes(entry.details || []);
        return `
          <li class="task-item completed-item" data-owner="${key === 'Other' ? '' : key}">
            <div class="task-summary" role="button" tabindex="0" aria-expanded="false">
              <span class="expand-icon" aria-hidden="true">▶</span>
              <div class="task-summary-content">
                <div class="task-summary-row">
                  <span class="completed-title">${escapeHtml(entry.title)}</span>
                </div>
                <div class="completed-meta">
                  <span class="completed-time">${completedText}</span>
                </div>
              </div>
            </div>
            <div class="task-details" hidden>
              <div class="task-details-content">
                ${detailsHtml}
              </div>
            </div>
          </li>
        `;
      }).join('');

      return `
        <section class="section completed-section">
          <div class="section-header">
            <h2>${label}</h2>
            <span class="count">${grouped[key].length}</span>
          </div>
          <ul class="list completed-list">
            ${items}
          </ul>
        </section>
      `;
    })
    .join('');

  container.innerHTML = sectionHtml;
}

async function loadCompleted(token) {
  const status = document.getElementById('status');
  if (!isTabActive('completed', token)) return;
  if (status) status.textContent = 'Loading history...';

  try {
    // Load tasks if not already loaded (reuses cache from loadAllTasks)
    if (!taskData.work._done) {
      await loadAllTasks();
    }

    if (!isTabActive('completed', token)) return;

    // Collect done tasks from all owners
    const entries = [];
    for (const owner of TASK_OWNERS) {
      const doneTasks = taskData[owner]._done || [];
      for (const task of doneTasks) {
        entries.push({
          title: task.title,
          completed: task.done || null,
          from: null,
          owner: owner,
          details: task.details || []
        });
      }
    }

    // Sort by done date (newest first)
    entries.sort((a, b) => {
      if (a.completed && b.completed) return b.completed.localeCompare(a.completed);
      if (a.completed) return -1;
      if (b.completed) return 1;
      return 0;
    });

    renderCompletedSections(entries);

    const now = new Date();
    if (status) status.textContent = `Updated ${now.toLocaleTimeString()}`;
  } catch (err) {
    console.error('Error loading history:', err);
    renderCompletedSections([]);
    if (status) status.textContent = 'Could not load history';
  }
}

// Get task counts for stats
function getTaskCounts() {
  const active = taskData.work.active.length + 
                 taskData.personal.active.length + 
                 taskData.agent.active.length;
  const backlog = taskData.work.backlog.length + 
                  taskData.personal.backlog.length + 
                  taskData.agent.backlog.length;
  const inbox = taskData.inbox.length;
  
  return { active, backlog, inbox };
}

// Load home tab data
async function loadHome(token) {
  const status = document.getElementById('status');
  if (!isTabActive('home', token)) return;
  status.textContent = 'Loading...';
  
  // Load tasks first (needed for stats and active list)
  await loadAllTasks();

  if (!isTabActive('home', token)) return;
  
  const now = new Date();
  status.textContent = `Updated ${now.toLocaleTimeString()}`;
  
  // Update stats
  const counts = getTaskCounts();
  document.getElementById('stat-active').textContent = counts.active;
  document.getElementById('stat-backlog').textContent = counts.backlog;
  document.getElementById('stat-inbox').textContent = counts.inbox;
  
  // Render active tasks on home page
  const allActive = [
    ...taskData.work.active.map(t => ({ ...t, owner: 'work' })),
    ...taskData.personal.active.map(t => ({ ...t, owner: 'personal' })),
    ...taskData.agent.active.map(t => ({ ...t, owner: 'agent' }))
  ];
  renderList(allActive, 'home-active-list', 'home-active-count', { showOwner: true, enableDetails: true, skipGroupHeaders: true });
  
  // Load today's brief
  loadBrief(token);
  
  // Load context (recent memory)
  loadContext(token);
  
  // Load calendar (if available)
  loadCalendar(token);
  
  // Load projects status
  loadProjects(token);
  
  // Load weather
  loadWeather(token);
}

function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function loadContext(token) {
  const container = document.getElementById('context-content');
  if (!isTabActive('home', token)) return;
  
  try {
    // Try to load recent memory file
    const today = getLocalDateString();
    const memoryPath = `/data/memory/${today}.md`;
    
    const resp = await fetch(cacheBust(memoryPath));
    if (!isTabActive('home', token)) return;
    if (resp.ok) {
      const text = await resp.text();
      // Get first section after the header
      const lines = text.split('\n');
      let summary = [];
      let inSection = false;
      
      for (const line of lines) {
        if (line.startsWith('## ') && !inSection) {
          inSection = true;
          summary.push(`<strong>${line.slice(3)}</strong>`);
        } else if (line.startsWith('## ') && inSection) {
          break;
        } else if (inSection && line.trim()) {
          summary.push(line);
        }
        if (summary.length > 5) break;
      }
      
      if (summary.length > 0) {
        container.innerHTML = `<p>${summary.join('<br>')}</p>
          <p class="subtle"><a href="#" class="view-memory-log" data-path="/data/memory/${today}.md">View full log →</a></p>`;
      } else {
        container.innerHTML = '<p class="subtle">No context logged today yet.</p>';
      }
    } else {
      container.innerHTML = '<p class="subtle">No memory file for today.</p>';
    }
  } catch (err) {
    container.innerHTML = '<p class="subtle">Could not load context.</p>';
  }
}

async function loadBrief(token) {
  const container = document.getElementById('brief-content');
  if (!container) return;
  if (!isTabActive('home', token)) return;
  
  try {
    const today = getLocalDateString();
    const briefPath = `/data/memory/briefs/${today}.md`;
    
    const resp = await fetch(cacheBust(briefPath));
    if (!isTabActive('home', token)) return;
    if (resp.ok) {
      const text = await resp.text();
      // Show first ~500 chars or first few sections
      const lines = text.split('\n');
      let preview = [];
      let charCount = 0;
      
      for (const line of lines) {
        if (line.startsWith('# ')) continue; // Skip main header
        if (charCount > 400) break;
        preview.push(line);
        charCount += line.length;
      }
      
      const previewHtml = typeof marked !== 'undefined' 
        ? marked.parse(preview.join('\n'))
        : preview.join('<br>');
      
      container.innerHTML = `
        <div class="brief-preview">${previewHtml}</div>
        <p class="subtle"><a href="#" class="view-brief-log" data-path="${briefPath}">View full brief →</a></p>
      `;
    } else {
      container.innerHTML = '<p class="subtle">No brief yet today. Check back after 6:30 AM.</p>';
    }
  } catch (err) {
    container.innerHTML = '<p class="subtle">Could not load brief.</p>';
  }
}

async function loadCalendar(token) {
  const container = document.getElementById('calendar-content');
  if (!isTabActive('home', token)) return;
  
  try {
    const resp = await fetch('/data/calendar-today.json?t=' + Date.now());
    if (!isTabActive('home', token)) return;
    
    if (!resp.ok) {
      container.innerHTML = '<p class="subtle">Calendar data not available.</p>';
      return;
    }
    
    const data = await resp.json();
    if (!isTabActive('home', token)) return;
    
    if (!data.events || data.events.length === 0) {
      container.innerHTML = '<p class="subtle">No upcoming events.</p>';
      return;
    }
    
    // Group events by date
    const eventsByDate = {};
    data.events.forEach(event => {
      if (!eventsByDate[event.date]) {
        eventsByDate[event.date] = [];
      }
      eventsByDate[event.date].push(event);
    });
    
    // Render events grouped by date
    let html = '';
    const today = new Date().toISOString().split('T')[0];
    
    Object.keys(eventsByDate).sort().forEach(date => {
      const dateLabel = date === today ? 'Today' : 
                       date === new Date(Date.now() + 86400000).toISOString().split('T')[0] ? 'Tomorrow' :
                       new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      
      html += `<div class="calendar-date-group"><strong>${dateLabel}</strong></div>`;
      
      eventsByDate[date].forEach(event => {
        const timeStr = event.start && event.end ? `${event.start}–${event.end}` : '';
        const calendarClass = event.calendar.toLowerCase().replace(/[^a-z0-9]/g, '-');
        html += `
          <div class="calendar-event">
            <span class="calendar-badge calendar-${calendarClass}">${event.calendar}</span>
            <span class="event-title">${escapeHtml(event.title)}</span>
            ${timeStr ? `<span class="event-time">${timeStr}</span>` : ''}
          </div>
        `;
      });
    });
    
    container.innerHTML = html;
    
  } catch (err) {
    console.error('Calendar load error:', err);
    container.innerHTML = '<p class="subtle">Could not load calendar.</p>';
  }
}

async function loadWeather(token) {
  const container = document.getElementById('weather-content');
  if (!isTabActive('home', token)) return;
  
  if (!WEATHER_LOCATION) {
    container.innerHTML = '<p class="subtle">Set weatherLocation in config to enable.</p>';
    return;
  }

  try {
    const loc = encodeURIComponent(WEATHER_LOCATION);
    const resp = await fetch(`https://wttr.in/${loc}?format=%c+%t+%C&u`);
    if (!isTabActive('home', token)) return;
    if (resp.ok) {
      const text = await resp.text();
      container.innerHTML = `
        <p style="font-size: 18px;">${text.trim()}</p>
        <p class="subtle"><a href="https://wttr.in/${loc}" target="_blank">Full forecast →</a></p>
      `;
    } else {
      container.innerHTML = '<p class="subtle">Could not load weather.</p>';
    }
  } catch (err) {
    container.innerHTML = '<p class="subtle">Weather unavailable.</p>';
  }
}

async function loadProjects(token) {
  const container = document.getElementById('projects-content');
  if (!isTabActive('home', token)) return;

  await loadProjectRegistry();

  if (!isTabActive('home', token)) return;
  if (!projectRegistry.length) {
    container.innerHTML = '<p class="subtle">No projects in registry.</p>';
    return;
  }

  const counts = new Map();
  const allTasks = [
    ...taskData.work.active,
    ...taskData.work.backlog,
    ...taskData.work.someday,
    ...taskData.personal.active,
    ...taskData.personal.backlog,
    ...taskData.personal.someday,
    ...taskData.agent.active,
    ...taskData.agent.backlog,
    ...taskData.agent.someday,
    ...taskData.inbox
  ];

  for (const task of allTasks) {
    const project = getTaskProject(task);
    if (!project) continue;
    const key = normalizeProjectKey(project);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const statusClass = status => {
    const normalized = (status || '').toLowerCase();
    if (normalized === 'active') return 'status-active';
    if (normalized === 'on hold') return 'status-hold';
    if (normalized === 'completed') return 'status-completed';
    return 'status-active';
  };

  container.innerHTML = projectRegistry.map(project => {
    const key = normalizeProjectKey(project.name);
    const total = counts.get(key) || 0;
    const countLabel = total === 1 ? '1 task' : `${total} tasks`;
    return `
      <button class="project-item" type="button" data-project="${project.name}">
        <span class="project-status-dot ${statusClass(project.status)}" title="${project.status}"></span>
        <span class="project-name">${project.name}</span>
        <span class="project-detail">${countLabel}</span>
      </button>
    `;
  }).join('');

  container.querySelectorAll('.project-item').forEach(item => {
    item.addEventListener('click', () => {
      const projectName = item.dataset.project;
      if (!projectName) return;
      setProjectFilterValue(projectName);
      setActiveTab('tasks');
    });
  });
}

// Collapse someday by default
function collapseSomeday() {
  const details = document.getElementById('someday-section');
  if (details) details.open = false;
}

function expandTaskDetails(details, item, summary) {
  details.hidden = false;
  details.style.maxHeight = '0px';
  requestAnimationFrame(() => {
    details.style.maxHeight = `${details.scrollHeight}px`;
  });
  item.classList.add('is-expanded');
  summary.setAttribute('aria-expanded', 'true');
}

function collapseTaskDetails(details, item, summary) {
  details.style.maxHeight = `${details.scrollHeight}px`;
  requestAnimationFrame(() => {
    details.style.maxHeight = '0px';
  });
  item.classList.remove('is-expanded');
  summary.setAttribute('aria-expanded', 'false');

  const handleEnd = event => {
    if (event.target !== details) return;
    if (details.style.maxHeight === '0px') {
      details.hidden = true;
    }
    details.removeEventListener('transitionend', handleEnd);
  };

  details.addEventListener('transitionend', handleEnd);
}

function toggleTaskItem(item) {
  const details = item.querySelector('.task-details');
  const summary = item.querySelector('.task-summary');
  if (!details || !summary) return;

  if (details.hidden) {
    expandTaskDetails(details, item, summary);
  } else {
    collapseTaskDetails(details, item, summary);
  }
}

function handleTaskListClick(event) {
  const fullViewButton = event.target.closest('.open-full-view');
  if (fullViewButton) {
    const item = event.target.closest('.task-item');
    if (item) openTaskModal(item.dataset.taskKey);
    return;
  }

  const summary = event.target.closest('.task-summary');
  if (!summary) return;
  const item = summary.closest('.task-item');
  if (!item) return;
  toggleTaskItem(item);
}

function handleTaskListKeydown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const summary = event.target.closest('.task-summary');
  if (!summary) return;
  event.preventDefault();
  const item = summary.closest('.task-item');
  if (!item) return;
  toggleTaskItem(item);
}

const modalState = {
  isOpen: false,
  lastFocused: null
};

function getModalElements() {
  return {
    modal: document.getElementById('task-modal'),
    dialog: document.getElementById('task-modal-dialog'),
    title: document.getElementById('task-modal-title'),
    meta: document.getElementById('task-modal-meta'),
    notes: document.getElementById('task-modal-notes'),
    close: document.getElementById('task-modal-close')
  };
}

function getFocusableElements(container) {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ).filter(el => !el.disabled);
}

function openTaskModal(taskKey) {
  const task = taskDetailLookup.get(taskKey);
  if (!task) return;

  const { modal, dialog, title, meta, notes, close } = getModalElements();
  if (!modal || !dialog || !title || !meta || !notes) return;

  const fields = extractTaskFields(task);
  const ownerBadge = task.owner ? `<span class="modal-owner" data-owner="${task.owner}">${task.owner}</span> ` : '';
  title.innerHTML = ownerBadge + task.title;
  meta.innerHTML = renderTaskMeta(fields);
  notes.innerHTML = renderTaskNotes(fields);
  
  // Set modal owner for border accent
  modal.dataset.owner = task.owner || '';

  modal.hidden = false;
  modalState.isOpen = true;
  modalState.lastFocused = document.activeElement;
  document.body.classList.add('modal-open');

  if (close) close.focus();
  else dialog.focus();

  document.addEventListener('keydown', handleModalKeydown);
}

function closeTaskModal() {
  const { modal } = getModalElements();
  if (!modal) return;

  modal.hidden = true;
  modalState.isOpen = false;
  document.body.classList.remove('modal-open');
  document.removeEventListener('keydown', handleModalKeydown);

  if (modalState.lastFocused) {
    modalState.lastFocused.focus();
    modalState.lastFocused = null;
  }
}

function handleModalKeydown(event) {
  if (!modalState.isOpen) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeTaskModal();
    return;
  }

  if (event.key !== 'Tab') return;
  const { dialog } = getModalElements();
  const focusable = getFocusableElements(dialog);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

// File viewer modal
const fileModalState = {
  isOpen: false,
  lastFocused: null,
  content: '',
  isMarkdown: false,
  mode: 'preview'
};

function setFileModalMode(mode) {
  fileModalState.mode = mode;
  const preview = document.getElementById('file-modal-preview');
  const raw = document.getElementById('file-modal-raw');
  
  if (!preview || !raw) return;
  
  if (mode === 'preview' && fileModalState.isMarkdown) {
    preview.hidden = false;
    raw.hidden = true;
  } else {
    preview.hidden = true;
    raw.hidden = false;
  }
  
  document.querySelectorAll('.file-modal-toggle').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
}

async function openFileModal(path) {
  const modal = document.getElementById('file-modal');
  const dialog = document.getElementById('file-modal-dialog');
  const title = document.getElementById('file-modal-title');
  const preview = document.getElementById('file-modal-preview');
  const raw = document.getElementById('file-modal-raw');
  const rawLink = document.getElementById('file-modal-raw-link');
  const close = document.getElementById('file-modal-close');
  
  if (!modal || !preview || !raw) return;

  const filename = path.split('/').pop();
  title.textContent = filename;
  rawLink.href = path;
  preview.innerHTML = '<p class="subtle">Loading...</p>';
  raw.querySelector('code').textContent = '';

  fileModalState.isMarkdown = isMarkdownFile(path);
  
  modal.hidden = false;
  fileModalState.isOpen = true;
  fileModalState.lastFocused = document.activeElement;
  document.body.classList.add('modal-open');

  if (close) close.focus();
  else dialog.focus();

  document.addEventListener('keydown', handleFileModalKeydown);

  try {
    const resp = await fetch(cacheBust(path));
    if (!resp.ok) throw new Error('Failed to load');
    const text = await resp.text();
    fileModalState.content = text;
    
    if (fileModalState.isMarkdown && typeof marked !== 'undefined') {
      preview.innerHTML = marked.parse(text);
    } else {
      preview.innerHTML = `<pre><code>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
    }
    raw.querySelector('code').textContent = text;
    
    setFileModalMode(fileModalState.isMarkdown ? 'preview' : 'raw');
  } catch (err) {
    preview.innerHTML = '<p class="subtle">Could not load file.</p>';
    setFileModalMode('preview');
  }
}

function closeFileModal() {
  const modal = document.getElementById('file-modal');
  if (!modal) return;

  modal.hidden = true;
  fileModalState.isOpen = false;
  document.body.classList.remove('modal-open');
  document.removeEventListener('keydown', handleFileModalKeydown);

  if (fileModalState.lastFocused) {
    fileModalState.lastFocused.focus();
    fileModalState.lastFocused = null;
  }
}

function handleFileModalKeydown(event) {
  if (!fileModalState.isOpen) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeFileModal();
  }
}

function setActiveTab(tab) {
  const candidate = TAB_KEYS.includes(tab) ? tab : 'home';
  const safeTab = candidate === 'openclaw' && !openclawEnabled ? 'home' : candidate;
  const loadToken = nextTabLoadToken(safeTab);
  const panels = {
    home: document.getElementById('tab-home'),
    tasks: document.getElementById('tab-tasks'),
    completed: document.getElementById('tab-completed'),
    files: document.getElementById('tab-files'),
    openclaw: document.getElementById('tab-openclaw')
  };

  const titles = {
    home: 'Home - Argos',
    tasks: 'Tasks - Argos',
    completed: 'History - Argos',
    files: 'Files - Argos',
    openclaw: 'OpenClaw - Argos'
  };

  const eyebrows = {
    home: 'Welcome back',
    tasks: 'Focus now',
    completed: 'Done tasks',
    files: 'Browse files',
    openclaw: 'Control panel'
  };

  const eyebrow = document.getElementById('eyebrow');

  document.querySelectorAll('.tab-button').forEach(button => {
    const isActive = button.dataset.tab === safeTab;
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  Object.entries(panels).forEach(([key, panel]) => {
    if (!panel) return;
    panel.hidden = key !== safeTab;
  });

  const tasksControls = document.getElementById('tasks-controls');
  if (tasksControls) {
    tasksControls.hidden = safeTab !== 'tasks';
  }

  document.title = titles[safeTab] || 'Argos';
  
  if (eyebrow) {
    eyebrow.textContent = eyebrows[safeTab] || '';
    eyebrow.style.display = 'block';
  }

  localStorage.setItem(TAB_STORAGE_KEY, safeTab);
  if (location.hash !== `#${safeTab}`) {
    history.replaceState(null, '', `#${safeTab}`);
  }

  // Load tab-specific data
  if (safeTab === 'home') {
    loadHome(loadToken);
  } else if (safeTab === 'tasks') {
    loadTasks(loadToken);
  } else if (safeTab === 'completed') {
    loadCompleted(loadToken);
  } else if (safeTab === 'files') {
    loadFiles(currentFilesPath, loadToken);
  }
}

function normalizeFilesPath(path) {
  if (!path.startsWith(FILES_ROOT)) return FILES_ROOT;
  if (!path.endsWith('/')) return `${path}/`;
  return path;
}

function buildBreadcrumbs(path) {
  const container = document.getElementById('files-breadcrumbs');
  if (!container) return;
  const cleanPath = normalizeFilesPath(path);
  const parts = cleanPath.replace(FILES_ROOT, '').split('/').filter(Boolean);
  const crumbs = [];
  let current = FILES_ROOT;

  crumbs.push({ label: 'Workspace', path: FILES_ROOT });
  for (const part of parts) {
    current += `${part}/`;
    crumbs.push({ label: part, path: current });
  }

  container.innerHTML = crumbs.map(crumb => `
    <button class="crumb" type="button" data-path="${crumb.path}">
      ${crumb.label}
    </button>
  `).join('');
}

function parseDirectoryListing(html, basePath) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const links = Array.from(doc.querySelectorAll('a'));
  const entries = [];

  for (const link of links) {
    const href = link.getAttribute('href');
    if (!href || href.startsWith('?') || href.startsWith('#')) continue;
    if (href === '..' || href.startsWith('../')) continue;

    const resolved = new URL(href, window.location.origin + basePath).pathname;
    if (!resolved.startsWith(FILES_ROOT)) continue;

    const isDir = href.endsWith('/');
    const name = link.textContent.trim() || resolved.split('/').filter(Boolean).pop();

    if (!name) continue;

    entries.push({ name, path: resolved, isDir });
  }

  const unique = new Map();
  for (const entry of entries) {
    if (!unique.has(entry.path)) unique.set(entry.path, entry);
  }

  return Array.from(unique.values()).sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function isMarkdownFile(path) {
  return /\.md$/i.test(path);
}

function getLanguageFromPath(path) {
  const match = path.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (!match) return null;
  return HIGHLIGHT_LANGUAGE_MAP[match[1]] || null;
}

function setMarkdownMode(mode) {
  const preview = document.getElementById('markdown-preview');
  const raw = document.getElementById('markdown-raw');
  if (!preview || !raw) return;

  const previewToggle = document.querySelector('.viewer-toggle[data-mode="preview"]');
  if (mode === 'preview' && previewToggle && previewToggle.disabled) {
    mode = 'raw';
  }

  const showRaw = mode === 'raw';
  preview.hidden = showRaw;
  raw.hidden = !showRaw;

  document.querySelectorAll('.viewer-toggle').forEach(button => {
    button.dataset.active = button.dataset.mode === mode ? 'true' : 'false';
  });
}

function renderMarkdownPreview(text) {
  const preview = document.getElementById('markdown-preview');
  if (!preview) return;

  if (!currentViewerIsMarkdown) {
    preview.innerHTML = '<p class="subtle">Preview available for Markdown files.</p>';
    return;
  }

  if (typeof marked !== 'undefined') {
    preview.innerHTML = marked.parse(text);
  } else {
    preview.textContent = text;
  }

  if (window.hljs) {
    preview.querySelectorAll('pre code').forEach(block => {
      delete block.dataset.highlighted;
      window.hljs.highlightElement(block);
    });
  }
}

function renderMarkdownRaw(text) {
  const code = document.querySelector('#markdown-raw code');
  if (!code) return;
  code.textContent = text;
  const language = currentViewerPath ? getLanguageFromPath(currentViewerPath) : null;
  code.className = language ? `language-${language}` : '';
  if (window.hljs && language) {
    delete code.dataset.highlighted;
    window.hljs.highlightElement(code);
  }
}

function setPreviewToggleEnabled(enabled) {
  const previewToggle = document.querySelector('.viewer-toggle[data-mode="preview"]');
  if (!previewToggle) return;
  previewToggle.disabled = !enabled;
  previewToggle.classList.toggle('is-disabled', !enabled);
  previewToggle.title = enabled ? 'Preview' : 'Preview (Markdown only)';
}

function resetMarkdownViewer() {
  const viewer = document.getElementById('markdown-viewer');
  const pathLabel = document.getElementById('markdown-path');
  const preview = document.getElementById('markdown-preview');
  const raw = document.getElementById('markdown-raw');
  if (!viewer || !preview || !raw) return;

  viewer.hidden = true;
  if (pathLabel) pathLabel.textContent = 'No file selected.';
  preview.innerHTML = '';
  raw.querySelector('code').textContent = '';
  currentViewerPath = null;
  currentViewerContent = '';
  currentViewerIsMarkdown = false;
  setPreviewToggleEnabled(true);
}

async function showFileViewer(path) {
  const viewer = document.getElementById('markdown-viewer');
  const pathLabel = document.getElementById('markdown-path');
  const rawLink = document.getElementById('markdown-raw-link');
  const preview = document.getElementById('markdown-preview');
  if (!viewer || !preview) return;

  viewer.hidden = false;
  if (pathLabel) pathLabel.textContent = path;
  if (rawLink) rawLink.href = path;

  currentViewerIsMarkdown = isMarkdownFile(path);
  setPreviewToggleEnabled(currentViewerIsMarkdown);

  if (currentViewerPath !== path) {
    currentViewerPath = path;
    currentViewerContent = '';
    preview.innerHTML = '<p class="subtle">Loading markdown...</p>';

    try {
      const resp = await fetch(path);
      if (!resp.ok) throw new Error(`Failed to load ${path}`);
      const text = await resp.text();
      currentViewerContent = text;
      renderMarkdownPreview(text);
      renderMarkdownRaw(text);
    } catch (err) {
      preview.innerHTML = '<p class="subtle">Could not load file.</p>';
      renderMarkdownRaw('Unable to load file.');
    }
  } else if (currentViewerContent) {
    renderMarkdownPreview(currentViewerContent);
    renderMarkdownRaw(currentViewerContent);
  }

  setMarkdownMode(currentViewerIsMarkdown ? 'preview' : 'raw');
  viewer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function loadFiles(path, token) {
  const status = document.getElementById('files-status');
  const list = document.getElementById('files-list');
  const count = document.getElementById('files-count');
  const folderUp = document.getElementById('folder-up');
  if (!status || !list || !count) return;
  if (!isTabActive('files', token)) return;

  resetMarkdownViewer();
  const normalizedPath = normalizeFilesPath(path);
  currentFilesPath = normalizedPath;
  localStorage.setItem(FILES_STORAGE_KEY, normalizedPath);
  if (folderUp) {
    folderUp.hidden = normalizedPath === FILES_ROOT;
  }
  status.textContent = `Loading ${normalizedPath}...`;
  list.innerHTML = '';
  count.textContent = '0';
  buildBreadcrumbs(normalizedPath);

  try {
    const resp = await fetch(normalizedPath);
    if (!resp.ok) throw new Error(`Failed to load ${normalizedPath}`);
    const html = await resp.text();
    const entries = parseDirectoryListing(html, normalizedPath);

    if (!isTabActive('files', token)) return;

    count.textContent = entries.length;
    if (entries.length === 0) {
      list.innerHTML = '<li class="subtle">Empty folder</li>';
    } else {
      list.innerHTML = entries.map(entry => `
        <li>
          <button class="file-name" type="button" data-path="${entry.path}" data-type="${entry.isDir ? 'dir' : 'file'}">
            ${entry.name}
          </button>
          <span class="file-meta">${entry.isDir ? 'Folder' : 'File'}</span>
          <button class="crumb" type="button" data-path="${entry.path}" data-type="${entry.isDir ? 'dir' : 'file'}">
            ${entry.isDir ? 'Open' : 'View'}
          </button>
        </li>
      `).join('');
    }

    status.textContent = `Viewing ${normalizedPath}`;
  } catch (err) {
    console.error('Error loading files:', err);
    status.textContent = 'Could not load files';
    list.innerHTML = '<li class="subtle">Unable to load directory listing.</li>';
  }
}

// Init
document.addEventListener('DOMContentLoaded', async () => {
  const versionStamp = document.getElementById('version-stamp');
  if (versionStamp) {
    versionStamp.textContent = `v${DASHBOARD_VERSION}`;
  }

  collapseSomeday();

  await loadDashboardConfig();

  const storedTab = localStorage.getItem(TAB_STORAGE_KEY);
  const storedFilesPath = localStorage.getItem(FILES_STORAGE_KEY);
  if (storedFilesPath) {
    currentFilesPath = normalizeFilesPath(storedFilesPath);
  }
  const hashTab = location.hash.replace('#', '');
  const initialTab = TAB_KEYS.includes(hashTab) ? hashTab : storedTab || 'home';
  setActiveTab(initialTab);
  loadStatusWidget();

  document.getElementById('refresh').addEventListener('click', () => {
    const currentTab = localStorage.getItem(TAB_STORAGE_KEY) || 'home';
    const loadToken = nextTabLoadToken(currentTab);
    if (currentTab === 'home') loadHome(loadToken);
    else if (currentTab === 'tasks') loadTasks(loadToken);
    else if (currentTab === 'completed') loadCompleted(loadToken);
    else if (currentTab === 'files') loadFiles(currentFilesPath, loadToken);
    loadStatusWidget();
  });

  const projectFilter = document.getElementById('project-filter');
  if (projectFilter) {
    projectFilter.addEventListener('change', event => {
      const value = event.target.value || 'All';
      setProjectFilterValue(value);
      applyProjectFilter();
    });
  }

  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => setActiveTab(button.dataset.tab));
  });

  ['active-list', 'backlog-list', 'someday-list', 'inbox-list', 'home-active-list'].forEach(listId => {
    const list = document.getElementById(listId);
    if (!list) return;
    list.addEventListener('click', handleTaskListClick);
    list.addEventListener('keydown', handleTaskListKeydown);
  });

  const completedContent = document.getElementById('completed-content');
  if (completedContent) {
    completedContent.addEventListener('click', handleTaskListClick);
    completedContent.addEventListener('keydown', handleTaskListKeydown);
  }

  const modal = document.getElementById('task-modal');
  if (modal) {
    modal.addEventListener('click', event => {
      const target = event.target;
      if (target.dataset.modalClose === 'true') closeTaskModal();
    });
  }

  document.getElementById('files-breadcrumbs').addEventListener('click', event => {
    const target = event.target.closest('[data-path]');
    if (!target) return;
    const loadToken = nextTabLoadToken('files');
    loadFiles(target.dataset.path, loadToken);
  });

  document.getElementById('files-list').addEventListener('click', event => {
    const target = event.target.closest('[data-path]');
    if (!target) return;
    const type = target.dataset.type;
    const path = target.dataset.path;
    if (type === 'dir') {
      const loadToken = nextTabLoadToken('files');
      loadFiles(path, loadToken);
    } else if (type === 'file') {
      showFileViewer(path);
    }
  });

  document.getElementById('openclaw-button').addEventListener('click', () => {
    if (!openclawToken) return;
    const host = window.location.hostname;
    const tokenParam = encodeURIComponent(openclawToken);
    window.open(`http://${host}:18789/?token=${tokenParam}`, '_blank');
  });

  document.getElementById('folder-up').addEventListener('click', event => {
    event.preventDefault();
    if (currentFilesPath === FILES_ROOT) return;
    const parts = currentFilesPath.replace(/\/$/, '').split('/');
    parts.pop();
    const parentPath = parts.join('/') + '/';
    const loadToken = nextTabLoadToken('files');
    loadFiles(parentPath.startsWith(FILES_ROOT) ? parentPath : FILES_ROOT, loadToken);
  });

  document.getElementById('open-data').addEventListener('click', () => {
    window.open('/data/', '_blank');
  });

  document.querySelectorAll('.viewer-toggle').forEach(button => {
    button.addEventListener('click', () => {
      setMarkdownMode(button.dataset.mode);
    });
  });

  window.addEventListener('hashchange', () => {
    const tab = location.hash.replace('#', '');
    if (TAB_KEYS.includes(tab)) setActiveTab(tab);
  });

  // Handle "View full log" clicks from context widget
  document.addEventListener('click', event => {
    const link = event.target.closest('.view-memory-log') || event.target.closest('.view-brief-log');
    if (!link) return;
    event.preventDefault();
    const path = link.dataset.path;
    if (path) {
      openFileModal(path);
    }
  });

  // Handle file modal close and toggle
  const fileModal = document.getElementById('file-modal');
  if (fileModal) {
    fileModal.addEventListener('click', event => {
      if (event.target.dataset.fileModalClose === 'true') {
        closeFileModal();
        return;
      }
      const toggle = event.target.closest('.file-modal-toggle');
      if (toggle) {
        setFileModalMode(toggle.dataset.mode);
      }
    });
  }
});
