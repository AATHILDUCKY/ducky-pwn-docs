const fs = require('fs');
const path = require('path');
const { app } = require('electron');
let Database;
let sqliteLoadError;
try {
  Database = require('better-sqlite3');
} catch (error) {
  sqliteLoadError = error;
}

let db;

const ensureTables = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      client TEXT NOT NULL,
      last_update TEXT NOT NULL,
      status TEXT NOT NULL,
      parent_id TEXT
    );
    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT,
      severity TEXT,
      affected TEXT,
      state TEXT,
      is_fixed INTEGER DEFAULT 0,
      tags TEXT,
      cvss_score TEXT,
      cvss_vector TEXT,
      type TEXT,
      description TEXT,
      solution TEXT,
      evidence TEXT,
      custom_fields TEXT,
      comments TEXT,
      updated_at TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS methodologies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS methodology_tasks (
      id TEXT PRIMARY KEY,
      methodology_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      FOREIGN KEY (methodology_id) REFERENCES methodologies(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS user_profile (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      full_name TEXT,
      role TEXT,
      email TEXT,
      avatar_color TEXT,
      avatar_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS smtp_settings (
      id INTEGER PRIMARY KEY,
      host TEXT,
      port INTEGER,
      user TEXT,
      pass TEXT,
      sender TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS email_history (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      project_name TEXT,
      issue_id TEXT,
      issue_title TEXT,
      recipient TEXT NOT NULL,
      subject TEXT,
      format TEXT,
      status TEXT,
      sent_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS project_notes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_issues_project ON issues(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_methodology ON methodology_tasks(methodology_id);
    CREATE INDEX IF NOT EXISTS idx_notes_project ON project_notes(project_id);
    CREATE INDEX IF NOT EXISTS idx_notes_updated ON project_notes(updated_at);
  `);
  const projectColumns = db.prepare(`PRAGMA table_info(projects)`).all();
  const hasParent = projectColumns.some((col) => col.name === 'parent_id');
  if (!hasParent) {
    db.exec('ALTER TABLE projects ADD COLUMN parent_id TEXT');
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_projects_parent ON projects(parent_id)');
  const profileColumns = db.prepare(`PRAGMA table_info(user_profile)`).all();
  const hasAvatarUrl = profileColumns.some((col) => col.name === 'avatar_url');
  if (!hasAvatarUrl) {
    db.exec('ALTER TABLE user_profile ADD COLUMN avatar_url TEXT');
  }
};

const parseJson = (value) => {
  if (!value) return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
};

const toUserProfile = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name || '',
    role: row.role || 'Owner',
    email: row.email || '',
    avatarColor: row.avatar_color || '#4f46e5',
    avatarUrl: row.avatar_url || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const toIssue = (row) => ({
  id: row.id,
  title: row.title || 'Untitled Finding',
  severity: row.severity || 'Info',
  affected: row.affected || '',
  state: row.state || 'Draft',
  isFixed: Boolean(row.is_fixed),
  tags: parseJson(row.tags),
  cvssScore: row.cvss_score || '0.0',
  cvssVector: row.cvss_vector || '',
  type: row.type || 'Internal',
  description: row.description || '',
  solution: row.solution || '',
  evidence: parseJson(row.evidence),
  customFields: parseJson(row.custom_fields),
  comments: parseJson(row.comments),
  updatedAt: row.updated_at || new Date().toISOString(),
});

const DatabaseService = {
  async initialize() {
    await app.whenReady();
    if (sqliteLoadError) {
      const message = [
        'SQLite native module failed to load.',
        'Run: npm run electron:rebuild',
      ].join(' ');
      const err = new Error(message);
      err.original = sqliteLoadError;
      throw err;
    }
    const storagePath = path.join(app.getPath('userData'), 'ducky-pwn-docs');
    fs.mkdirSync(storagePath, { recursive: true });
    const dbFile = path.join(storagePath, 'vault.db');
    const versionFile = path.join(storagePath, '.app-version');
    const installFile = path.join(storagePath, '.install-id');
    const currentVersion = app.getVersion();
    let installId = currentVersion;
    try {
      const stat = fs.statSync(process.execPath);
      installId = String(stat.mtimeMs);
    } catch (error) {
      // Fallback to version when file stats are unavailable.
    }
    const prevInstallId = fs.existsSync(installFile) ? fs.readFileSync(installFile, 'utf8').trim() : '';
    if (prevInstallId !== installId) {
      if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
      fs.writeFileSync(installFile, installId);
      fs.writeFileSync(versionFile, currentVersion);
    }
    db = new Database(dbFile);
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    ensureTables();
  },

  getProjects() {
    const rawProjects = db.prepare('SELECT * FROM projects ORDER BY last_update DESC').all();
    const counts = db
      .prepare(`
        SELECT
          project_id,
          SUM(CASE WHEN severity = 'Critical' THEN 1 ELSE 0 END) AS critical,
          SUM(CASE WHEN severity = 'High' THEN 1 ELSE 0 END) AS high,
          SUM(CASE WHEN severity = 'Medium' THEN 1 ELSE 0 END) AS medium,
          SUM(CASE WHEN severity = 'Low' THEN 1 ELSE 0 END) AS low
        FROM issues
        GROUP BY project_id
      `)
      .all();
    const countsMap = new Map(counts.map((row) => [row.project_id, row]));

    return rawProjects.map((project) => {
      const countRow = countsMap.get(project.id);
      return {
        id: project.id,
        name: project.name,
        client: project.client,
        lastUpdate: project.last_update,
        status: project.status,
        parentId: project.parent_id || null,
        issueCount: countRow
          ? {
              critical: countRow.critical ?? 0,
              high: countRow.high ?? 0,
              medium: countRow.medium ?? 0,
              low: countRow.low ?? 0,
            }
          : { critical: 0, high: 0, medium: 0, low: 0 },
      };
    });
  },

  createProject({ id, name, client }) {
    const now = new Date().toISOString().split('T')[0];
    const stmt = db.prepare('INSERT INTO projects (id, name, client, last_update, status, parent_id) VALUES (?, ?, ?, ?, ?, ?)');
    stmt.run(id, name, client, now, 'active', null);
    return {
      id,
      name,
      client,
      lastUpdate: now,
      status: 'active',
      parentId: null,
      issueCount: { critical: 0, high: 0, medium: 0, low: 0 },
    };
  },

  createSubProject({ id, name, client, parentId }) {
    if (!parentId) return null;
    const now = new Date().toISOString().split('T')[0];
    const stmt = db.prepare('INSERT INTO projects (id, name, client, last_update, status, parent_id) VALUES (?, ?, ?, ?, ?, ?)');
    stmt.run(id, name, client, now, 'active', parentId);
    return {
      id,
      name,
      client,
      lastUpdate: now,
      status: 'active',
      parentId,
      issueCount: { critical: 0, high: 0, medium: 0, low: 0 },
    };
  },

  deleteProject(projectId) {
    if (!projectId) return;
    const ids = this.getProjectDescendants(projectId);
    if (!ids.length) return;
    const placeholders = ids.map(() => '?').join(', ');
    db.prepare(`DELETE FROM projects WHERE id IN (${placeholders})`).run(...ids);
  },

  getIssuesByProject(projectId) {
    if (!projectId) return [];
    const stmt = db.prepare('SELECT * FROM issues WHERE project_id = ? ORDER BY updated_at DESC');
    return stmt.all(projectId).map(toIssue);
  },

  getIssueById(issueId) {
    if (!issueId) return null;
    const row = db.prepare('SELECT * FROM issues WHERE id = ?').get(issueId);
    return row ? toIssue(row) : null;
  },

  getProjectById(projectId) {
    if (!projectId) return null;
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      client: row.client,
      lastUpdate: row.last_update,
      status: row.status,
      parentId: row.parent_id || null,
    };
  },

  getProjectDescendants(projectId) {
    const visited = new Set();
    const ids = [];
    const queue = [projectId];
    while (queue.length) {
      const id = queue.shift();
      if (!id || visited.has(id)) continue;
      visited.add(id);
      ids.push(id);
      const children = db.prepare('SELECT id FROM projects WHERE parent_id = ?').all(id);
      children.forEach((child) => queue.push(child.id));
    }
    return ids;
  },

  getIssuesByProjectIds(projectIds) {
    if (!projectIds?.length) return [];
    const placeholders = projectIds.map(() => '?').join(', ');
    const stmt = db.prepare(`SELECT * FROM issues WHERE project_id IN (${placeholders}) ORDER BY updated_at DESC`);
    return stmt.all(...projectIds).map(toIssue);
  },

  saveIssue(projectId, issue) {
    const now = new Date().toISOString();
    const prepared = db.prepare(`
      INSERT INTO issues (
        id, project_id, title, severity, affected, state, is_fixed, tags, cvss_score,
        cvss_vector, type, description, solution, evidence, custom_fields, comments, updated_at
      ) VALUES (
        @id, @projectId, @title, @severity, @affected, @state, @isFixed, @tags, @cvssScore,
        @cvssVector, @type, @description, @solution, @evidence, @customFields, @comments, @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        severity = excluded.severity,
        affected = excluded.affected,
        state = excluded.state,
        is_fixed = excluded.is_fixed,
        tags = excluded.tags,
        cvss_score = excluded.cvss_score,
        cvss_vector = excluded.cvss_vector,
        type = excluded.type,
        description = excluded.description,
        solution = excluded.solution,
        evidence = excluded.evidence,
        custom_fields = excluded.custom_fields,
        comments = excluded.comments,
        updated_at = excluded.updated_at
    `);

    prepared.run({
      id: issue.id,
      projectId,
      title: issue.title,
      severity: issue.severity,
      affected: issue.affected,
      state: issue.state,
      isFixed: issue.isFixed ? 1 : 0,
      tags: JSON.stringify(issue.tags || []),
      cvssScore: issue.cvssScore,
      cvssVector: issue.cvssVector,
      type: issue.type,
      description: issue.description,
      solution: issue.solution,
      evidence: JSON.stringify(issue.evidence || []),
      customFields: JSON.stringify(issue.customFields || []),
      comments: JSON.stringify(issue.comments || []),
      updatedAt: issue.updatedAt || now,
    });

    db.prepare('UPDATE projects SET last_update = ? WHERE id = ?').run(now.split('T')[0], projectId);
  },

  deleteIssue(projectId, issueId) {
    if (!projectId || !issueId) return;
    db.prepare('DELETE FROM issues WHERE project_id = ? AND id = ?').run(projectId, issueId);
  },

  getMethodologies() {
    const methods = db.prepare('SELECT * FROM methodologies ORDER BY name ASC').all();
    const tasks = db.prepare('SELECT * FROM methodology_tasks ORDER BY title ASC').all();
    const tasksByMethod = new Map();
    tasks.forEach((task) => {
      const list = tasksByMethod.get(task.methodology_id) || [];
      list.push({
        id: task.id,
        title: task.title,
        status: task.status,
      });
      tasksByMethod.set(task.methodology_id, list);
    });
    return methods.map((method) => ({
      id: method.id,
      name: method.name,
      tasks: tasksByMethod.get(method.id) || [],
    }));
  },

  createMethodology({ id, name }) {
    if (!id || !name) return null;
    db.prepare('INSERT INTO methodologies (id, name) VALUES (?, ?)').run(id, name);
    return { id, name, tasks: [] };
  },

  updateMethodology({ id, name }) {
    if (!id || !name) return null;
    db.prepare('UPDATE methodologies SET name = ? WHERE id = ?').run(name, id);
    return { id, name };
  },

  createTask({ id, methodologyId, title, status }) {
    if (!id || !methodologyId || !title) return null;
    const safeStatus = status || 'todo';
    db.prepare(
      'INSERT INTO methodology_tasks (id, methodology_id, title, status) VALUES (?, ?, ?, ?)'
    ).run(id, methodologyId, title, safeStatus);
    return { id, title, status: safeStatus };
  },

  updateTaskStatus({ id, status, title }) {
    if (!id) return null;
    if (status && title) {
      db.prepare('UPDATE methodology_tasks SET status = ?, title = ? WHERE id = ?').run(status, title, id);
      return { id, status, title };
    }
    if (status) {
      db.prepare('UPDATE methodology_tasks SET status = ? WHERE id = ?').run(status, id);
      return { id, status };
    }
    if (title) {
      db.prepare('UPDATE methodology_tasks SET title = ? WHERE id = ?').run(title, id);
      return { id, title };
    }
    return null;
  },

  deleteMethodology(id) {
    if (!id) return;
    db.prepare('DELETE FROM methodologies WHERE id = ?').run(id);
  },

  deleteTask(id) {
    if (!id) return;
    db.prepare('DELETE FROM methodology_tasks WHERE id = ?').run(id);
  },

  getUserProfile() {
    const row = db.prepare('SELECT * FROM user_profile LIMIT 1').get();
    return toUserProfile(row);
  },

  addEmailHistory(entry) {
    const recent = db.prepare('SELECT * FROM email_history ORDER BY sent_at DESC LIMIT 1').get();
    if (recent && recent.recipient === entry.recipient && recent.subject === entry.subject && recent.project_id === entry.project_id && recent.issue_id === entry.issue_id) {
      const prev = Date.parse(recent.sent_at || '');
      const now = Date.parse(entry.sent_at || '');
      if (prev && now && Math.abs(now - prev) < 5000) return null;
    }
    if (!entry?.id || !entry?.recipient || !entry?.sent_at) return null;
    db.prepare(`
      INSERT INTO email_history (
        id, project_id, project_name, issue_id, issue_title, recipient, subject, format, status, sent_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.id,
      entry.project_id || null,
      entry.project_name || null,
      entry.issue_id || null,
      entry.issue_title || null,
      entry.recipient,
      entry.subject || null,
      entry.format || null,
      entry.status || 'sent',
      entry.sent_at
    );
    return entry;
  },

  getEmailHistory({ limit = 10, offset = 0 } = {}) {
    return db
      .prepare('SELECT * FROM email_history ORDER BY sent_at DESC LIMIT ? OFFSET ?')
      .all(limit, offset);
  },

  createUserProfile(profile) {
    const existing = db.prepare('SELECT * FROM user_profile LIMIT 1').get();
    if (existing) return toUserProfile(existing);
    if (!profile?.username) return null;
    const now = new Date().toISOString();
    const payload = {
      id: profile.id || `u-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      username: profile.username,
      full_name: profile.fullName || '',
      role: profile.role || 'Owner',
      email: profile.email || '',
      avatar_color: profile.avatarColor || '#4f46e5',
      avatar_url: profile.avatarUrl || '',
      created_at: now,
      updated_at: now,
    };
    db.prepare(`
      INSERT INTO user_profile (id, username, full_name, role, email, avatar_color, avatar_url, created_at, updated_at)
      VALUES (@id, @username, @full_name, @role, @email, @avatar_color, @avatar_url, @created_at, @updated_at)
    `).run(payload);
    return toUserProfile(payload);
  },

  updateUserProfile(profile) {
    if (!profile?.id) return null;
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE user_profile
      SET username = ?, full_name = ?, role = ?, email = ?, avatar_color = ?, avatar_url = ?, updated_at = ?
      WHERE id = ?
    `).run(
      profile.username,
      profile.fullName || '',
      profile.role || 'Owner',
      profile.email || '',
      profile.avatarColor || '#4f46e5',
      profile.avatarUrl || '',
      now,
      profile.id
    );
    return toUserProfile({
      id: profile.id,
      username: profile.username,
      full_name: profile.fullName,
      role: profile.role,
      email: profile.email,
      avatar_color: profile.avatarColor,
      avatar_url: profile.avatarUrl,
      created_at: profile.createdAt,
      updated_at: now,
    });
  },

  getSmtpSettings() {
    const row = db.prepare('SELECT * FROM smtp_settings WHERE id = 1').get();
    if (!row) return null;
    return {
      host: row.host || '',
      port: row.port || 0,
      user: row.user || '',
      pass: row.pass || '',
      from: row.sender || '',
    };
  },

  saveSmtpSettings(settings) {
    if (!settings) return null;
    const now = new Date().toISOString();
    const payload = {
      id: 1,
      host: settings.host || '',
      port: settings.port || 0,
      user: settings.user || '',
      pass: settings.pass || '',
      sender: settings.from || '',
      updated_at: now,
    };
    db.prepare(`
      INSERT INTO smtp_settings (id, host, port, user, pass, sender, updated_at)
      VALUES (@id, @host, @port, @user, @pass, @sender, @updated_at)
      ON CONFLICT(id) DO UPDATE SET
        host = excluded.host,
        port = excluded.port,
        user = excluded.user,
        pass = excluded.pass,
        sender = excluded.sender,
        updated_at = excluded.updated_at
    `).run(payload);
    return this.getSmtpSettings();
  },

  getNotesByProject(projectId) {
    if (!projectId) return [];
    const rows = db
      .prepare('SELECT * FROM project_notes WHERE project_id = ? ORDER BY updated_at DESC')
      .all(projectId);
    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      content: row.content || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  },

  saveNote(projectId, note) {
    if (!projectId || !note?.id) return null;
    const now = new Date().toISOString();
    const existing = db.prepare('SELECT created_at FROM project_notes WHERE id = ?').get(note.id);
    const createdAt = existing?.created_at || note.createdAt || now;
    db.prepare(`
      INSERT INTO project_notes (id, project_id, title, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        content = excluded.content,
        updated_at = excluded.updated_at
    `).run(note.id, projectId, note.title, note.content || '', createdAt, note.updatedAt || now);
    return {
      id: note.id,
      projectId,
      title: note.title,
      content: note.content || '',
      createdAt,
      updatedAt: note.updatedAt || now,
    };
  },

  deleteNote(projectId, noteId) {
    if (!projectId || !noteId) return;
    db.prepare('DELETE FROM project_notes WHERE project_id = ? AND id = ?').run(projectId, noteId);
  },
};

module.exports = { DatabaseService };
