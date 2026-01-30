const path = require('path');
const fs = require('fs/promises');
const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron');
const { fileURLToPath } = require('url');
const nodemailer = require('nodemailer');
const htmlToDocx = require('html-to-docx');
const fsSync = require('fs');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun } = require('docx');
const { DatabaseService } = require('./database.cjs');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');

protocol.registerSchemesAsPrivileged([
  { scheme: 'vanguard', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

const isDevelopment = process.env.NODE_ENV !== 'production' && !app.isPackaged;

const createWindow = () => {
  const iconPath = path.join(app.isPackaged ? app.getAppPath() : process.cwd(), 'assets', 'app-logo.png');
  const win = new BrowserWindow({
    width: 1360,
    height: 900,
    show: false,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  if (isDevelopment) {
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    const appPath = app.getAppPath();
    const indexPath = path.join(appPath, 'renderer', 'index.html');
    console.log('[app]', { appPath, indexPath });
    win.loadFile(indexPath);
  }

  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[app] did-fail-load', code, desc, url);
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[app] render-process-gone', details);
  });
  win.webContents.on('console-message', (_e, level, message) => {
    console.log('[renderer]', level, message);
  });

  if (process.env.DEBUG_OPEN_DEVTOOLS === '1') {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  win.once('ready-to-show', () => win.show());
};

const registerIpcHandlers = () => {
  ipcMain.handle('get-projects', () => DatabaseService.getProjects());
  ipcMain.handle('create-project', (_, payload) => DatabaseService.createProject(payload));
  ipcMain.handle('create-subproject', (_, payload) => DatabaseService.createSubProject(payload));
  ipcMain.handle('delete-project', (_, id) => DatabaseService.deleteProject(id));
  ipcMain.handle('get-issues', (_, projectId) => DatabaseService.getIssuesByProject(projectId));
  ipcMain.handle('save-issue', (_, projectId, issue) => DatabaseService.saveIssue(projectId, issue));
  ipcMain.handle('delete-issue', (_, projectId, issueId) => DatabaseService.deleteIssue(projectId, issueId));
  ipcMain.handle('get-methodologies', () => DatabaseService.getMethodologies());
  ipcMain.handle('create-methodology', (_, payload) => DatabaseService.createMethodology(payload));
  ipcMain.handle('create-methodology-task', (_, payload) => DatabaseService.createTask(payload));
  ipcMain.handle('update-methodology-task', (_, payload) => DatabaseService.updateTaskStatus(payload));
  ipcMain.handle('update-methodology', (_, payload) => DatabaseService.updateMethodology(payload));
  ipcMain.handle('delete-methodology', (_, id) => DatabaseService.deleteMethodology(id));
  ipcMain.handle('delete-methodology-task', (_, id) => DatabaseService.deleteTask(id));
  ipcMain.handle('get-user-profile', () => DatabaseService.getUserProfile());
  ipcMain.handle('create-user-profile', (_, payload) => DatabaseService.createUserProfile(payload));
  ipcMain.handle('update-user-profile', (_, payload) => DatabaseService.updateUserProfile(payload));
  ipcMain.handle('get-notes', (_, projectId) => DatabaseService.getNotesByProject(projectId));
  ipcMain.handle('save-note', (_, projectId, note) => DatabaseService.saveNote(projectId, note));
  ipcMain.handle('delete-note', (_, projectId, noteId) => DatabaseService.deleteNote(projectId, noteId));
  ipcMain.handle('generate-report', async (_, payload) => {
    try {
      const project = DatabaseService.getProjectById(payload.projectId);
      if (!project) {
        return { error: 'Project not found.' };
      }
      const projectIds = DatabaseService.getProjectDescendants(project.id);
      const issues = DatabaseService.getIssuesByProjectIds(projectIds);
      const html = buildReportHtml({ project, issues });

      if (payload.format === 'html') {
        const saveResult = await dialog.showSaveDialog({
          title: 'Save Report',
          defaultPath: `${project.name.replace(/\\s+/g, '_')}_report.html`,
          filters: [{ name: 'HTML', extensions: ['html'] }],
        });
        if (saveResult.canceled || !saveResult.filePath) return null;
        await fs.writeFile(saveResult.filePath, html, 'utf-8');
        return { path: saveResult.filePath };
      }
      if (payload.format === 'docx') {
        const saveResult = await dialog.showSaveDialog({
          title: 'Save Report',
          defaultPath: `${project.name.replace(/\\s+/g, '_')}_report.docx`,
          filters: [{ name: 'DOCX', extensions: ['docx'] }],
        });
        if (saveResult.canceled || !saveResult.filePath) return null;
        const docxBuffer = await renderDocxBuffer(html);
        await fs.writeFile(saveResult.filePath, docxBuffer);
        return { path: saveResult.filePath };
      }

      const saveResult = await dialog.showSaveDialog({
        title: 'Save Report',
        defaultPath: `${project.name.replace(/\\s+/g, '_')}_report.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      if (saveResult.canceled || !saveResult.filePath) return null;

      const pdfWindow = new BrowserWindow({
        show: false,
        webPreferences: { sandbox: false },
      });
      const encoded = Buffer.from(html, 'utf-8').toString('base64');
      await pdfWindow.loadURL(`data:text/html;base64,${encoded}`);
      await pdfWindow.webContents.executeJavaScript('document.fonts && document.fonts.ready');
      const pdf = await pdfWindow.webContents.printToPDF({
        printBackground: true,
        marginsType: 1,
        pageSize: 'A4',
      });
      await fs.writeFile(saveResult.filePath, pdf);
      pdfWindow.close();
      return { path: saveResult.filePath };
    } catch (error) {
      console.error('Report generation failed', error);
      return { error: error?.stack || error?.message || 'Report generation failed' };
    }
  });
  ipcMain.handle('get-smtp-settings', () => DatabaseService.getSmtpSettings());
  ipcMain.handle('save-smtp-settings', (_, payload) => DatabaseService.saveSmtpSettings(payload));
  ipcMain.handle('get-email-history', (_, payload) => DatabaseService.getEmailHistory(payload || {}));
  ipcMain.handle('send-issue-report-email', async (_, payload) => {
    try {
      const { projectId, issueId, to, subject, message, format } = payload || {};
      const settings = DatabaseService.getSmtpSettings();
      if (!settings?.host || !settings?.port || !settings?.user || !settings?.pass || !settings?.from) {
        return { error: 'SMTP settings are incomplete. Please update email configuration.' };
      }
      const fromAddress = settings.user;
      const replyTo = settings.from && settings.from !== settings.user ? settings.from : undefined;
      const project = DatabaseService.getProjectById(projectId);
      const issue = DatabaseService.getIssueById(issueId);
      if (!project || !issue) {
        return { error: 'Unable to locate project or issue.' };
      }
      const reportHtmlNoVideo = buildIssueHtml({ project, issue, includeVideos: false });
      const reportHtmlWithMedia = buildIssueHtml({ project, issue, includeVideos: true });
      const rawHtml = injectEmailNote(
        format === 'html' ? reportHtmlWithMedia : buildIssueEmailSummaryHtml({ project, issue }),
        message
      );
      const { attachments: inlineAttachments } = await prepareEmailHtmlWithAttachments(reportHtmlWithMedia);
      const transport = createSmtpTransport(settings);
      const mail = {
        from: fromAddress,
        replyTo,
        to,
        subject: subject || `Finding Report: ${issue.title || project.name}`,
        text: message || 'Finding report attached.',
        html: rawHtml,
      };
      if (format === 'docx') {
        const docxBuffer = await buildIssueDocxBuffer({ project, issue });
        mail.attachments = [
          {
            filename: `${(issue.title || project.name).replace(/\s+/g, '_')}_finding.docx`,
            content: docxBuffer,
          },
        ];
        const videoAttachments = inlineAttachments.filter((item) => isVideoExt(path.extname(item.filename || '')));
        if (videoAttachments.length) {
          mail.attachments.push(...videoAttachments);
        }
      } else if (format === 'html') {
        if (inlineAttachments.length) mail.attachments = inlineAttachments;
      } else {
        const pdfBuffer = await renderPdfBuffer(reportHtmlNoVideo);
        mail.attachments = [
          {
            filename: `${(issue.title || project.name).replace(/\s+/g, '_')}_finding.pdf`,
            content: pdfBuffer,
          },
          ...inlineAttachments,
        ];
      }
      await sendMailWithRetry(transport, mail);
      DatabaseService.addEmailHistory({
        id: `eh-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        project_id: project.id,
        project_name: project.name,
        issue_id: issue.id,
        issue_title: issue.title,
        recipient: to,
        subject: subject || `Finding Report: ${issue.title || project.name}`,
        format: format || 'pdf',
        status: 'sent',
        sent_at: new Date().toISOString(),
      });
      return { ok: true };
    } catch (error) {
      console.error('Failed to send issue report email', error);
      if (error?.code === 'EAI_AGAIN' || error?.code === 'EDNS') {
        return { error: 'DNS lookup failed. Please check your internet or SMTP host.' };
      }
      return { error: error?.message || 'Failed to send email.' };
    }
  });
  ipcMain.handle('send-project-report-email', async (_, payload) => {
    try {
      const { projectId, to, subject, message, format } = payload || {};
      const settings = DatabaseService.getSmtpSettings();
      if (!settings?.host || !settings?.port || !settings?.user || !settings?.pass || !settings?.from) {
        return { error: 'SMTP settings are incomplete. Please update email configuration.' };
      }
      const fromAddress = settings.user;
      const replyTo = settings.from && settings.from !== settings.user ? settings.from : undefined;
      const project = DatabaseService.getProjectById(projectId);
      if (!project) {
        return { error: 'Unable to locate project.' };
      }
      const issues = DatabaseService.getIssuesByProject(projectId);
      const rawHtml = injectEmailNote(buildReportHtml({ project, issues }), message);
      const { html, attachments: inlineAttachments } = await prepareEmailHtmlWithAttachments(rawHtml);
      const transport = createSmtpTransport(settings);
      const mail = {
        from: fromAddress,
        replyTo,
        to,
        subject: subject || `Project Report: ${project.name}`,
        text: message || 'Project report attached.',
        html,
      };
      if (format === 'pdf') {
        const pdfBuffer = await renderPdfBuffer(html);
        mail.attachments = [
          {
            filename: `${project.name.replace(/\s+/g, '_')}_report.pdf`,
            content: pdfBuffer,
          },
          ...inlineAttachments,
        ];
      } else if (format === 'docx') {
        const docxBuffer = await renderDocxBuffer(html);
        mail.attachments = [
          {
            filename: `${project.name.replace(/\s+/g, '_')}_report.docx`,
            content: docxBuffer,
          },
          ...inlineAttachments,
        ];
      } else if (inlineAttachments.length) {
        mail.attachments = inlineAttachments;
      }
      await sendMailWithRetry(transport, mail);
      DatabaseService.addEmailHistory({
        id: `eh-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        project_id: project.id,
        project_name: project.name,
        issue_id: null,
        issue_title: null,
        recipient: to,
        subject: subject || `Project Report: ${project.name}`,
        format: format || 'pdf',
        status: 'sent',
        sent_at: new Date().toISOString(),
      });
      return { ok: true };
    } catch (error) {
      console.error('Failed to send project report email', error);
      if (error?.code === 'EAI_AGAIN' || error?.code === 'EDNS') {
        return { error: 'DNS lookup failed. Please check your internet or SMTP host.' };
      }
      return { error: error?.message || 'Failed to send email.' };
    }
  });
  ipcMain.handle('get-report-preview', async (_, payload) => {
    try {
      const project = DatabaseService.getProjectById(payload.projectId);
      if (!project) {
        return { error: 'Project not found.' };
      }
      const projectIds = DatabaseService.getProjectDescendants(project.id);
      const issues = DatabaseService.getIssuesByProjectIds(projectIds);
      const html = buildReportHtml({ project, issues });
      return { html };
    } catch (error) {
      console.error('Report preview failed', error);
      return { error: error?.message || 'Report preview failed' };
    }
  });
  ipcMain.handle('select-media', async (_, mediaType) => {
    const filters = mediaType === 'video'
      ? [{ name: 'Videos', extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi'] }]
      : [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] }];

    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters,
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const sourcePath = result.filePaths[0];
    const storageRoot = app.isPackaged
      ? path.join(app.getPath('userData'), 'ducky-pwn-docs', 'assets')
      : path.join(process.cwd(), 'assets');
    await fs.mkdir(storageRoot, { recursive: true });
    const ext = path.extname(sourcePath);
    const safeName = path.basename(sourcePath, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
    const targetName = `${safeName}_${Date.now()}${ext}`;
    const targetPath = path.join(storageRoot, targetName);
    await fs.copyFile(sourcePath, targetPath);

    return {
      url: `vanguard://assets/${encodeURIComponent(targetPath)}`,
      name: path.basename(sourcePath),
    };
  });
};

const renderMarkdownText = (value) => {
  const lines = (value || '').split('\n');
  let html = '';
  let inList = false;

  const closeList = () => {
    if (inList) {
      html += '</ul>';
      inList = false;
    }
  };

  lines.forEach((raw) => {
    const line = raw.trim();
    if (!line) {
      closeList();
      return;
    }
    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      html += `<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`;
      return;
    }
    if (line.startsWith('- ')) {
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      html += `<li>${renderInlineMarkdown(line.slice(2))}</li>`;
      return;
    }
    closeList();
    html += `<p>${renderInlineMarkdown(line)}</p>`;
  });

  closeList();
  return html;
};

const renderInlineMarkdown = (value) => {
  let output = escapeHtml(value || '');
  output = output.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  output = output.replace(/`(.*?)`/g, '<code>$1</code>');
  output = output.replace(/\*(.*?)\*/g, '<em>$1</em>');
  return output;
};

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderRichText = (value, includeVideos = true) => {
  const parts = String(value || '').split(/(\[image\|.*?\|.*?\]|\[video\|.*?\|.*?\])/g);
  return parts
    .map((part) => {
      const imageMatch = part.match(/\[image\|(.+?)\|(.+?)\]/);
      const videoMatch = part.match(/\[video\|(.+?)\|(.+?)\]/);
      if (imageMatch) {
        const src = getRenderableImageSrc(imageMatch[1]);
        return `<figure class="media"><img src="${src}" alt="${escapeHtml(imageMatch[2])}"/><figcaption>${escapeHtml(imageMatch[2])}</figcaption></figure>`;
      }
      if (videoMatch) {
        if (!includeVideos) {
          return '';
        }
        const src = getRenderableVideoSrc(videoMatch[1]);
        const mime = mimeByExt(path.extname(resolveLocalAssetPath(videoMatch[1]) || ''));
        return `<figure class="media"><video src="${src}" controls>${mime ? `<source src="${src}" type="${mime}">` : ''}</video><figcaption>${escapeHtml(videoMatch[2])}</figcaption></figure>`;
      }
      return renderMarkdownText(part);
    })
    .join('');
};

const extractEvidenceTags = (value) => {
  const items = [];
  const text = String(value || '');
  const regex = /\[(image|video)\|(.+?)\|(.+?)\]/g;
  let match;
  while ((match = regex.exec(text))) {
    items.push({ type: match[1], url: match[2], caption: match[3] });
  }
  return items;
};

const collectIssueEvidence = (issue) => {
  const items = [];
  items.push(...extractEvidenceTags(issue.description));
  (issue.customFields || []).forEach((field) => {
    items.push(...extractEvidenceTags(field.value));
  });
  return items;
};

const buildIssueDocxBuffer = async ({ project, issue }) => {
  const severityColor = {
    Critical: 'EF4444',
    High: 'F97316',
    Medium: 'EAB308',
    Low: '3B82F6',
    Info: '94A3B8',
  }[issue.severity] || '94A3B8';

  const children = [
    new Paragraph({
      text: 'Security Finding Intelligence',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: issue.title || 'Untitled Finding', bold: true, size: 32 })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Project: ', bold: true }),
        new TextRun({ text: project.name || 'N/A' }),
        new TextRun({ text: ' · Client: ', bold: true }),
        new TextRun({ text: project.client || 'N/A' }),
      ],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Severity: ', bold: true }),
        new TextRun({ text: issue.severity || 'Info', color: severityColor, bold: true }),
      ],
    }),
    new Paragraph({
      children: [new TextRun({ text: `Asset: ${issue.affected || 'General Scope'}` })],
    }),
    new Paragraph({
      children: [new TextRun({ text: `CVSS: ${issue.cvssScore || '0.0'} ${issue.cvssVector || ''}` })],
      spacing: { after: 160 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Description', bold: true })],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: stripHtml(renderRichText(issue.description || '')) || 'Not provided' })],
      spacing: { after: 160 },
    }),
  ];

  const evidenceItems = collectIssueEvidence(issue);
  const imageItems = evidenceItems.filter((item) => item.type === 'image');
  const videoItems = evidenceItems.filter((item) => item.type === 'video');

  if (imageItems.length) {
    children.push(
      new Paragraph({ children: [new TextRun({ text: 'Evidence Images', bold: true })], spacing: { after: 80 } })
    );
    for (const item of imageItems) {
      const localPath = resolveLocalAssetPath(item.url);
      if (!localPath) continue;
      try {
        const buffer = fsSync.readFileSync(localPath);
        children.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: buffer,
                transformation: { width: 520, height: 320 },
              }),
            ],
          })
        );
        if (item.caption) {
          children.push(new Paragraph({ text: item.caption, spacing: { after: 80 } }));
        }
      } catch {
        children.push(new Paragraph({ text: `Image missing: ${item.caption || localPath}` }));
      }
    }
  }

  if (videoItems.length) {
    children.push(
      new Paragraph({ children: [new TextRun({ text: 'Video Evidence (attached)', bold: true })], spacing: { after: 80 } })
    );
    for (const item of videoItems) {
      const localPath = resolveLocalAssetPath(item.url);
      const name = localPath ? path.basename(localPath) : item.url;
      children.push(new Paragraph({ text: `${item.caption || 'Video'} — ${name}` }));
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
};

const createSmtpTransport = (settings) => {
  const port = Number(settings.port) || 0;
  return nodemailer.createTransport({
    host: settings.host,
    port,
    secure: port === 465,
    auth: {
      user: settings.user,
      pass: settings.pass,
    },
    connectionTimeout: 7000,
    greetingTimeout: 7000,
    socketTimeout: 12000,
  });
};

const sendMailWithRetry = async (transport, mail, attempts = 3) => {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await transport.sendMail(mail);
    } catch (err) {
      lastError = err;
      const code = err?.code || err?.responseCode;
      const retryable =
        code === 'EDNS' ||
        code === 'EAI_AGAIN' ||
        code === 'ETIMEDOUT' ||
        code === 'ECONNRESET';
      if (!retryable || i === attempts - 1) break;
      const delay = 500 * (i + 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
};

const injectEmailNote = (html, message) => {
  if (!message) return html;
  const note = `<p><strong>Note:</strong> ${escapeHtml(message)}</p>`;
  return html.replace('<div class="cover">', `<div class="cover">${note}`);
};

const renderPdfBuffer = async (html) => {
  const pdfWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  });
  try {
    const encoded = Buffer.from(html, 'utf-8').toString('base64');
    await pdfWindow.loadURL(`data:text/html;base64,${encoded}`);
    const pdf = await pdfWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
    });
    return pdf;
  } finally {
    if (!pdfWindow.isDestroyed()) pdfWindow.close();
  }
};

const renderDocxBuffer = async (html) => {
  return htmlToDocx(html, null, {
    table: { row: { cantSplit: true } },
    footer: true,
    pageNumber: true,
  });
};

const resolveLocalAssetPath = (src) => {
  if (!src) return null;
  try {
    if (src.startsWith('vanguard://')) {
      const url = new URL(src);
      if (url.hostname === 'assets') {
        const raw = url.pathname.replace(/^\/+/, '');
        return decodeURIComponent(raw);
      }
      return decodeURIComponent(url.pathname);
    }
    if (src.startsWith('file://')) {
      return fileURLToPath(src);
    }
    if (/^[A-Za-z]:[\\/]/.test(src) || src.startsWith('/')) {
      return src;
    }
  } catch {
    return null;
  }
  return null;
};

const toFileUrl = (filePath) => `file://${filePath.replace(/\\/g, '/')}`;

const mimeByExt = (ext) => {
  const map = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
  };
  return map[ext.toLowerCase()] || 'application/octet-stream';
};

const isVideoExt = (ext) => ['.mp4', '.webm', '.mov'].includes(ext.toLowerCase());

const stripHtml = (value) => String(value || '').replace(/<[^>]+>/g, '');

const getRenderableImageSrc = (src) => {
  const localPath = resolveLocalAssetPath(src);
  if (!localPath) return src;
  try {
    const stat = fsSync.statSync(localPath);
    if (stat.size <= 2 * 1024 * 1024) {
      const buffer = fsSync.readFileSync(localPath);
      const mime = mimeByExt(path.extname(localPath));
      return `data:${mime};base64,${buffer.toString('base64')}`;
    }
    return toFileUrl(localPath);
  } catch {
    return src;
  }
};

const getRenderableVideoSrc = (src) => {
  const localPath = resolveLocalAssetPath(src);
  if (!localPath) return src;
  return toFileUrl(localPath);
};

const prepareEmailHtmlWithAttachments = async (html) => {
  let nextHtml = html;
  const attachments = [];
  const seen = new Map();

  const addAttachment = async (src) => {
    const localPath = resolveLocalAssetPath(src);
    if (!localPath) return null;
    if (seen.has(localPath)) return seen.get(localPath);
    try {
      await fs.access(localPath);
      const cid = `asset-${attachments.length + 1}@vanguard`;
      attachments.push({
        filename: path.basename(localPath),
        path: localPath,
        cid,
      });
      seen.set(localPath, cid);
      return cid;
    } catch {
      return null;
    }
  };

  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
  const imgMatches = [...nextHtml.matchAll(imgRegex)];
  for (const match of imgMatches) {
    const src = match[1];
    const cid = await addAttachment(src);
    if (cid) {
      nextHtml = nextHtml.replace(src, `cid:${cid}`);
    }
  }

  const videoRegex = /<video[^>]+src="([^"]+)"[^>]*>.*?<\/video>/g;
  const videoMatches = [...nextHtml.matchAll(videoRegex)];
  for (const match of videoMatches) {
    const src = match[1];
    const cid = await addAttachment(src);
    if (cid) {
      nextHtml = nextHtml.replace(
        match[0],
        `<p><strong>Video Evidence:</strong> ${path.basename(resolveLocalAssetPath(src) || src)} (attached)</p>`
      );
    }
  }

  return { html: nextHtml, attachments };
};


const buildReportHtml = ({ project, issues }) => {
  const severityOrder = { Critical: 4, High: 3, Medium: 2, Low: 1, Info: 0 };
  const sorted = [...issues].sort((a, b) => (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0));
  const summaryCounts = sorted.reduce(
    (acc, item) => {
      const key = item.severity?.toLowerCase?.() || 'info';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  );
  const totalFindings = sorted.length || 1;
  const severityBreakdown = [
    { label: 'Critical', key: 'critical', color: '#ef4444' },
    { label: 'High', key: 'high', color: '#f97316' },
    { label: 'Medium', key: 'medium', color: '#f59e0b' },
    { label: 'Low', key: 'low', color: '#3b82f6' },
    { label: 'Info', key: 'info', color: '#64748b' },
  ];

  const renderFinding = (finding) => `
    <section class="finding">
      <div class="finding-header">
        <h3>${escapeHtml(finding.title || 'Untitled Finding')}</h3>
        <span class="badge ${finding.severity?.toLowerCase() || 'info'}">${finding.severity || 'Info'}</span>
      </div>
      <p class="meta"><strong>Asset:</strong> ${escapeHtml(finding.affected || 'General Scope')}</p>
      <p class="meta"><strong>CVSS:</strong> ${escapeHtml(finding.cvssScore || '0.0')} (${escapeHtml(finding.cvssVector || '')})</p>
      <div class="section">
        <h4>Description</h4>
        <p>${renderRichText(finding.description || '')}</p>
      </div>
      ${finding.customFields?.length ? `
        <div class="section">
          ${finding.customFields
            .map((field) => `<h4>${escapeHtml(field.label || 'Detail')}</h4><p>${renderRichText(field.value || '')}</p>`)
            .join('')}
        </div>
      ` : ''}
    </section>
  `;

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(project.name)} Report</title>
        <style>
          :root { color-scheme: light; }
          body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; background: #f1f5f9; }
          .page { max-width: 900px; margin: 32px auto 48px; background: #ffffff; padding: 40px; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.12); border-radius: 24px; }
          h1, h2, h3 { margin: 0 0 8px; }
          h1 { font-size: 28px; }
          h2 { font-size: 20px; margin-top: 24px; }
          h3 { font-size: 16px; }
          h4 { font-size: 13px; }
          p { margin: 8px 0; line-height: 1.6; }
          ul { margin: 8px 0 8px 18px; padding: 0; }
          li { margin-bottom: 4px; }
          code { background: #e2e8f0; padding: 1px 4px; border-radius: 4px; font-size: 12px; }
          .cover { border-bottom: 2px solid #e2e8f0; padding-bottom: 24px; margin-bottom: 24px; }
          .summary { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
          .summary-card { padding: 12px; border-radius: 12px; text-align: center; font-weight: 600; min-height: 72px; display: flex; flex-direction: column; justify-content: center; gap: 4px; }
          .summary-card strong { font-size: 20px; line-height: 1; }
          .summary-card span { font-size: 12px; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .summary-card.critical { background: #fee2e2; border: 1px solid #fecaca; color: #991b1b; }
          .summary-card.high { background: #ffedd5; border: 1px solid #fed7aa; color: #9a3412; }
          .summary-card.medium { background: #fef9c3; border: 1px solid #fde68a; color: #92400e; }
          .summary-card.low { background: #dbeafe; border: 1px solid #bfdbfe; color: #1d4ed8; }
          .summary-card.info { background: #e2e8f0; border: 1px solid #cbd5f5; color: #334155; }
          .findings { margin-top: 24px; }
          .finding { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
          .finding-header { display: flex; justify-content: space-between; align-items: center; }
          .badge { padding: 4px 10px; border-radius: 999px; font-size: 11px; text-transform: uppercase; font-weight: bold; }
          .badge.critical { background: #fee2e2; color: #b91c1c; }
          .badge.high { background: #ffedd5; color: #c2410c; }
          .badge.medium { background: #fef9c3; color: #a16207; }
          .badge.low { background: #dbeafe; color: #1d4ed8; }
          .badge.info { background: #e2e8f0; color: #475569; }
          .meta { font-size: 12px; color: #475569; margin: 6px 0; }
          .section h4 { margin: 12px 0 6px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; }
          .media { margin: 16px 0; padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc; }
          .media img, .media video { width: 100%; max-height: 420px; object-fit: contain; border-radius: 8px; background: #fff; }
          .media figcaption { margin-top: 8px; font-size: 11px; color: #64748b; }
          .executive { display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; align-items: start; }
          .analytics { margin-top: 28px; }
          .analytics-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
          .chart-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; background: #ffffff; }
          .bars { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
          .bar-row { display: grid; grid-template-columns: 80px 1fr 40px; gap: 10px; align-items: center; font-size: 12px; }
          .bar-label { color: #475569; font-weight: 600; }
          .bar-track { height: 10px; background: #e2e8f0; border-radius: 999px; overflow: hidden; }
          .bar-fill { height: 100%; border-radius: 999px; }
          .bar-value { text-align: right; font-weight: 700; color: #0f172a; }
          .severity-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
          .severity-table th, .severity-table td { text-align: left; padding: 8px; border-bottom: 1px solid #e2e8f0; }
          .severity-table th { text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; color: #64748b; }
          @media print {
            body { margin: 0; background: #ffffff; }
            .page { max-width: none; margin: 0; padding: 24px; box-shadow: none; border-radius: 0; }
            .executive { grid-template-columns: 1fr; }
          }
          @page { size: A4; margin: 16mm; }
        </style>
      </head>
      <body>
        <div class="page">
        <div class="cover">
          <h1>${escapeHtml(project.name)}</h1>
          <p><strong>Client:</strong> ${escapeHtml(project.client)}</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        </div>

        <section class="executive">
          <div>
            <h2>Executive Summary</h2>
            <p>This report summarizes findings discovered during the engagement. Review all critical and high items first.</p>
          </div>
          <div class="summary">
            <div class="summary-card critical"><strong>${summaryCounts.critical}</strong><span>Critical</span></div>
            <div class="summary-card high"><strong>${summaryCounts.high}</strong><span>High</span></div>
            <div class="summary-card medium"><strong>${summaryCounts.medium}</strong><span>Medium</span></div>
            <div class="summary-card low"><strong>${summaryCounts.low}</strong><span>Low</span></div>
            <div class="summary-card info"><strong>${summaryCounts.info}</strong><span>Info</span></div>
          </div>
        </section>

        <section class="analytics">
          <h2>Analytics Overview</h2>
          <div class="analytics-grid">
            <div class="chart-card">
              <h3>Severity Distribution</h3>
              <div class="bars">
                ${severityBreakdown
                  .map((item) => {
                    const count = summaryCounts[item.key] || 0;
                    const width = Math.round((count / totalFindings) * 100);
                    return `
                      <div class="bar-row">
                        <span class="bar-label">${item.label}</span>
                        <div class="bar-track">
                          <div class="bar-fill" style="width: ${width}%; background: ${item.color};"></div>
                        </div>
                        <span class="bar-value">${count}</span>
                      </div>
                    `;
                  })
                  .join('')}
              </div>
            </div>
            <div class="chart-card">
              <h3>Key Findings Table</h3>
              <table class="severity-table">
                <thead>
                  <tr>
                    <th>Finding</th>
                    <th>Severity</th>
                    <th>CVSS</th>
                    <th>Asset</th>
                  </tr>
                </thead>
                <tbody>
                  ${sorted
                    .map((finding) => `
                      <tr>
                        <td>${escapeHtml(finding.title || 'Untitled Finding')}</td>
                        <td><span class="badge ${finding.severity?.toLowerCase() || 'info'}">${finding.severity || 'Info'}</span></td>
                        <td>${escapeHtml(finding.cvssScore || '0.0')}</td>
                        <td>${escapeHtml(finding.affected || 'General Scope')}</td>
                      </tr>
                    `)
                    .join('')}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <div class="findings">
          <h2>Technical Findings</h2>
          ${sorted.map(renderFinding).join('')}
        </div>
        </div>
      </body>
    </html>
  `;
};

const buildIssueHtml = ({ project, issue, includeVideos = true }) => {
  const finding = issue;
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(finding.title || project.name)} Report</title>
        <style>
          :root { color-scheme: light; }
          body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; background: #f1f5f9; }
          .page { max-width: 980px; margin: 32px auto 48px; background: #ffffff; padding: 48px; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.12); border-radius: 24px; }
          h1, h2, h3, h4 { margin: 0 0 8px; }
          h1 { font-size: 32px; }
          h2 { font-size: 18px; margin-top: 20px; }
          h3 { font-size: 14px; }
          h4 { font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; color: #6366f1; }
          p { margin: 8px 0; line-height: 1.7; }
          code { background: #e2e8f0; padding: 1px 4px; border-radius: 4px; font-size: 12px; }
          .meta { font-size: 12px; color: #475569; margin: 6px 0; }
          .badge { padding: 4px 10px; border-radius: 999px; font-size: 11px; text-transform: uppercase; font-weight: bold; }
          .badge.critical { background: #fee2e2; color: #b91c1c; }
          .badge.high { background: #ffedd5; color: #c2410c; }
          .badge.medium { background: #fef9c3; color: #a16207; }
          .badge.low { background: #dbeafe; color: #1d4ed8; }
          .badge.info { background: #e2e8f0; color: #475569; }
          .section { margin-top: 20px; }
          .section h4 { margin: 12px 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; }
          .section-body { margin-left: 16px; padding-left: 18px; border-left: 2px solid #e2e8f0; }
          .media { margin: 16px 0; padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc; }
          .media img, .media video { width: 100%; max-height: 420px; object-fit: contain; border-radius: 8px; background: #fff; }
          .media figcaption { margin-top: 8px; font-size: 11px; color: #64748b; }
          @media print {
            body { margin: 0; background: #ffffff; }
            .page { max-width: none; margin: 0; padding: 24px; box-shadow: none; border-radius: 0; }
          }
          @page { size: A4; margin: 16mm; }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="cover">
            <h4>Security Finding Intelligence</h4>
            <h1>${escapeHtml(finding.title || 'Untitled Finding')}</h1>
            <p class="meta"><strong>Project:</strong> ${escapeHtml(project.name)} · <strong>Client:</strong> ${escapeHtml(project.client)}</p>
            <p class="meta"><strong>Severity:</strong> <span class="badge ${finding.severity?.toLowerCase() || 'info'}">${finding.severity || 'Info'}</span></p>
            <p class="meta"><strong>Asset:</strong> ${escapeHtml(finding.affected || 'General Scope')}</p>
            <p class="meta"><strong>CVSS:</strong> ${escapeHtml(finding.cvssScore || '0.0')} ${escapeHtml(finding.cvssVector || '')}</p>
          </div>

          <section class="section">
            <h3>Description</h3>
            <div class="section-body">
              <p>${renderRichText(finding.description || '', includeVideos)}</p>
            </div>
          </section>
          ${finding.customFields?.length ? `
            <section class="section">
              ${finding.customFields
                .map((field) => `
                  <h3>${escapeHtml(field.label || 'Detail')}</h3>
                  <div class="section-body">
                    <p>${renderRichText(field.value || '', includeVideos)}</p>
                  </div>
                `)
                .join('')}
            </section>
          ` : ''}
        </div>
      </body>
    </html>
  `;
};

const buildIssueEmailSummaryHtml = ({ project, issue }) => {
  const finding = issue;
  const severityClass = (finding.severity || 'info').toLowerCase();
  const severityColor = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#3b82f6',
    info: '#94a3b8',
  }[severityClass] || '#94a3b8';
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; color: #e2e8f0; margin: 0; padding: 24px; background: #0b0b0e; }
          .card { background: #0f1115; border: 1px solid #1f2937; border-radius: 18px; padding: 22px 24px; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35); }
          h2 { margin: 0 0 6px; font-size: 22px; font-weight: 800; color: #f8fafc; }
          p { margin: 6px 0; font-size: 13px; line-height: 1.6; color: #cbd5f5; }
          .label { color: #8b5cf6; font-weight: 900; text-transform: uppercase; font-size: 10px; letter-spacing: 0.32em; }
          .meta { margin-top: 10px; display: grid; gap: 6px; }
          .pill { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.14em; padding: 4px 12px; border-radius: 999px; background: rgba(148, 163, 184, 0.14); color: ${severityColor}; border: 1px solid rgba(148, 163, 184, 0.2); }
          .block { margin-top: 14px; }
          .desc { background: #0b0d12; border: 1px solid #1f2937; border-radius: 12px; padding: 12px 14px; }
          code { background: #111827; padding: 1px 4px; border-radius: 4px; font-size: 12px; color: #e2e8f0; }
          strong { color: #e2e8f0; }
          .muted { color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="card">
          <p class="label">Security Finding Intelligence</p>
          <h2>${escapeHtml(finding.title || 'Untitled Finding')}</h2>
          <p class="muted"><strong>Project:</strong> ${escapeHtml(project.name)} · <strong>Client:</strong> ${escapeHtml(project.client)}</p>
          <div class="meta">
            <p><strong>Severity:</strong> <span class="pill ${severityClass}">${escapeHtml(finding.severity || 'Info')}</span></p>
            <p><strong>Asset:</strong> ${escapeHtml(finding.affected || 'General Scope')}</p>
            <p><strong>CVSS:</strong> ${escapeHtml(finding.cvssScore || '0.0')} ${escapeHtml(finding.cvssVector || '')}</p>
          </div>
          <div class="block">
            <p class="label">Description</p>
            <div class="desc">${renderRichText(finding.description || 'Not provided')}</div>
          </div>
        </div>
      </body>
    </html>
  `;
};

app.whenReady().then(async () => {
  protocol.registerFileProtocol('vanguard', (request, callback) => {
    try {
      const url = new URL(request.url);
      const encodedPath = url.hostname === 'assets'
        ? url.pathname.replace(/^\/+/, '')
        : url.pathname;
      const filePath = url.hostname === 'assets'
        ? decodeURIComponent(encodedPath)
        : decodeURI(encodedPath);
      callback({ path: path.normalize(filePath) });
    } catch (error) {
      console.error('Failed to resolve vanguard asset', error);
      callback({ error: -2 });
    }
  });

  try {
    await DatabaseService.initialize();
  } catch (error) {
    console.error('Database initialization failed', error);
    const detail = error?.message || 'Unable to initialize local SQLite storage.';
    dialog.showErrorBox('Ducky Pwn Docs', detail);
    app.quit();
    return;
  }
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
