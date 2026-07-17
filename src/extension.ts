import * as crypto from 'node:crypto';
import * as nodeFs from 'node:fs';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as readline from 'node:readline';
import * as vscode from 'vscode';

interface ChatEntry {
  id: string;
  title: string;
  updatedAt?: string;
  sessionPath?: string;
}

interface TranscriptMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp?: string;
}

const VIEW_ID = 'codexBumper.chats';
const CONFIG_SECTION = 'codexBumper';
const SESSION_TITLE_SCAN_LINE_LIMIT = 200;
const CHAT_TITLE_MAX_LENGTH = 72;

export function activate(context: vscode.ExtensionContext): void {
  const store = new CodexHistoryStore();
  const provider = new ChatTreeProvider(store);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(VIEW_ID, provider),
    vscode.commands.registerCommand('codexBumper.refresh', () => provider.refresh()),
    vscode.commands.registerCommand('codexBumper.openChat', async (item?: ChatItem | string) => {
      const chat = await resolveChat(store, item);
      if (chat) {
        await openChatWebview(context, store, chat);
      }
    }),
    vscode.commands.registerCommand('codexBumper.bumpChat', async (item?: ChatItem | string) => {
      const chat = await resolveChat(store, item);
      if (!chat) {
        return;
      }

      const bumped = await store.bumpChat(chat);
      provider.refresh();
      vscode.window.showInformationMessage(`Bumped "${bumped.title}" with hi.`);
    })
  );
}

export function deactivate(): void {
  // No cleanup is required.
}

class ChatTreeProvider implements vscode.TreeDataProvider<ChatItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<ChatItem | undefined | null | void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private readonly store: CodexHistoryStore) {}

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: ChatItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<ChatItem[]> {
    const chats = await this.store.listChats();
    return chats.map((chat) => new ChatItem(chat));
  }
}

class ChatItem extends vscode.TreeItem {
  constructor(readonly chat: ChatEntry) {
    super(chat.title, vscode.TreeItemCollapsibleState.None);
    this.id = chat.id;
    this.description = `${shortId(chat.id)}${chat.updatedAt ? ` - ${formatDate(chat.updatedAt)}` : ''}`;
    this.tooltip = [
      chat.title,
      `ID: ${chat.id}`,
      chat.updatedAt ? `Updated: ${chat.updatedAt}` : undefined,
      chat.sessionPath ? `Session: ${chat.sessionPath}` : undefined
    ]
      .filter(Boolean)
      .join('\n');
    this.contextValue = 'codexChat';
    this.iconPath = new vscode.ThemeIcon('comment-discussion');
    this.command = {
      command: 'codexBumper.openChat',
      title: 'Open Chat',
      arguments: [this]
    };
  }
}

class CodexHistoryStore {
  async listChats(): Promise<ChatEntry[]> {
    const codexHome = this.codexHome();
    const indexEntries = await this.readIndex(path.join(codexHome, 'session_index.jsonl'));
    const sessionFiles = await this.findSessionFiles(path.join(codexHome, 'sessions'));
    const chats = new Map<string, ChatEntry>();

    for (const entry of indexEntries) {
      const existing = chats.get(entry.id);
      if (!existing || compareUpdatedAt(entry.updatedAt, existing.updatedAt) >= 0) {
        const merged = { ...existing, ...entry };
        if (existing && isGenericTitle(entry.title, entry.id) && !isGenericTitle(existing.title, existing.id)) {
          merged.title = existing.title;
        }
        chats.set(entry.id, merged);
      }
    }

    for (const sessionPath of sessionFiles) {
      const id = extractSessionId(sessionPath);
      if (!id) {
        continue;
      }

      const existing = chats.get(id);
      const updatedAt = existing?.updatedAt ?? (await fileMtimeIso(sessionPath));
      const inferredTitle =
        !existing || isGenericTitle(existing.title, id) ? await this.inferSessionTitle(sessionPath) : undefined;
      chats.set(id, {
        id,
        title: inferredTitle ?? existing?.title ?? genericTitle(id),
        updatedAt,
        sessionPath
      });
    }

    return [...chats.values()].sort((a, b) => compareUpdatedAt(b.updatedAt, a.updatedAt));
  }

  async readTranscript(chat: ChatEntry): Promise<TranscriptMessage[]> {
    const sessionPath = chat.sessionPath ?? (await this.findSessionPath(chat.id));
    if (!sessionPath) {
      throw new Error(`Could not find session file for ${chat.id}`);
    }

    const raw = await fs.readFile(sessionPath, 'utf8');
    const messages: TranscriptMessage[] = [];

    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) {
        continue;
      }

      const record = safeJsonParse(line);
      if (!record || record.type !== 'response_item') {
        continue;
      }

      const payload = record.payload;
      if (!payload || payload.type !== 'message') {
        continue;
      }

      if (payload.role !== 'user' && payload.role !== 'assistant') {
        continue;
      }

      const text = extractMessageText(payload.content);
      if (!text.trim()) {
        continue;
      }

      messages.push({
        role: payload.role,
        text,
        timestamp: typeof record.timestamp === 'string' ? record.timestamp : undefined
      });
    }

    return messages;
  }

  async bumpChat(chat: ChatEntry): Promise<ChatEntry> {
    const sessionPath = chat.sessionPath ?? (await this.findSessionPath(chat.id));
    if (!sessionPath) {
      throw new Error(`Could not find session file for ${chat.id}`);
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const turnId = crypto.randomUUID();
    const reply = vscode.workspace
      .getConfiguration(CONFIG_SECTION)
      .get<string>('bumpAssistantReply', "Hi. I'm here.");
    const records = [
      {
        timestamp: nowIso,
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'hi' }],
          internal_chat_message_metadata_passthrough: { turn_id: turnId }
        }
      },
      {
        timestamp: nowIso,
        type: 'event_msg',
        payload: {
          type: 'user_message',
          message: 'hi',
          images: [],
          local_images: [],
          text_elements: []
        }
      },
      {
        timestamp: nowIso,
        type: 'event_msg',
        payload: {
          type: 'agent_message',
          message: reply,
          phase: 'final_answer',
          memory_citation: null
        }
      },
      {
        timestamp: nowIso,
        type: 'response_item',
        payload: {
          type: 'message',
          id: `msg_${crypto.randomUUID().replaceAll('-', '')}`,
          role: 'assistant',
          content: [{ type: 'output_text', text: reply }],
          phase: 'final_answer',
          internal_chat_message_metadata_passthrough: { turn_id: turnId }
        }
      },
      {
        timestamp: nowIso,
        type: 'event_msg',
        payload: {
          type: 'task_complete',
          turn_id: turnId,
          last_agent_message: reply,
          completed_at: Math.floor(now.getTime() / 1000),
          duration_ms: 0,
          time_to_first_token_ms: 0
        }
      }
    ];

    await fs.appendFile(sessionPath, `${records.map((record) => JSON.stringify(record)).join('\n')}\n`, 'utf8');

    const fresh: ChatEntry = {
      ...chat,
      sessionPath,
      updatedAt: nowIso
    };
    await this.appendIndexEntry(fresh);
    return fresh;
  }

  private codexHome(): string {
    const configured = vscode.workspace.getConfiguration(CONFIG_SECTION).get<string>('codexHome', '').trim();
    if (configured) {
      return expandHome(configured);
    }

    return process.env.CODEX_HOME ? expandHome(process.env.CODEX_HOME) : path.join(os.homedir(), '.codex');
  }

  private async appendIndexEntry(chat: ChatEntry): Promise<void> {
    const indexPath = path.join(this.codexHome(), 'session_index.jsonl');
    const entry = {
      id: chat.id,
      thread_name: chat.title,
      updated_at: chat.updatedAt ?? new Date().toISOString()
    };
    await fs.mkdir(path.dirname(indexPath), { recursive: true });
    await fs.appendFile(indexPath, `${JSON.stringify(entry)}\n`, 'utf8');
  }

  private async findSessionPath(id: string): Promise<string | undefined> {
    const files = await this.findSessionFiles(path.join(this.codexHome(), 'sessions'));
    return files.find((file) => extractSessionId(file) === id);
  }

  private async inferSessionTitle(sessionPath: string): Promise<string | undefined> {
    const input = nodeFs.createReadStream(sessionPath, { encoding: 'utf8' });
    const lines = readline.createInterface({ input, crlfDelay: Infinity });
    let firstUserMessage: string | undefined;
    let scannedLines = 0;

    try {
      for await (const line of lines) {
        scannedLines += 1;
        const record = safeJsonParse(line);
        const storedTitle = extractStoredThreadName(record);
        if (storedTitle) {
          return formatInferredTitle(storedTitle);
        }

        if (!firstUserMessage) {
          const candidate = extractUserTitleSource(record);
          if (candidate && !isTitleNoise(candidate)) {
            firstUserMessage = candidate;
          }
        }

        if (scannedLines >= SESSION_TITLE_SCAN_LINE_LIMIT) {
          break;
        }
      }
    } catch (error) {
      if (isNotFound(error)) {
        return undefined;
      }
      throw error;
    } finally {
      lines.close();
      input.destroy();
    }

    return firstUserMessage ? formatInferredTitle(firstUserMessage) : undefined;
  }

  private async readIndex(indexPath: string): Promise<ChatEntry[]> {
    try {
      const raw = await fs.readFile(indexPath, 'utf8');
      const entries: ChatEntry[] = [];

      for (const line of raw.split(/\r?\n/)) {
        if (!line.trim()) {
          continue;
        }

        const record = safeJsonParse(line);
        if (!record || typeof record.id !== 'string') {
          continue;
        }

        entries.push({
          id: record.id,
          title:
            typeof record.thread_name === 'string' && record.thread_name.trim()
              ? record.thread_name
              : genericTitle(record.id),
          updatedAt: typeof record.updated_at === 'string' ? record.updated_at : undefined
        });
      }

      return entries;
    } catch (error) {
      if (isNotFound(error)) {
        return [];
      }
      throw error;
    }
  }

  private async findSessionFiles(root: string): Promise<string[]> {
    const found: string[] = [];

    async function walk(dir: string): Promise<void> {
      let entries: Array<import('node:fs').Dirent>;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch (error) {
        if (isNotFound(error)) {
          return;
        }
        throw error;
      }

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
          found.push(fullPath);
        }
      }
    }

    await walk(root);
    return found;
  }
}

async function resolveChat(store: CodexHistoryStore, item?: ChatItem | string): Promise<ChatEntry | undefined> {
  if (item instanceof ChatItem) {
    return item.chat;
  }

  const chats = await store.listChats();
  if (typeof item === 'string') {
    return chats.find((chat) => chat.id === item);
  }

  const picked = await vscode.window.showQuickPick(
    chats.map((chat) => ({
      label: chat.title,
      description: shortId(chat.id),
      detail: chat.updatedAt,
      chat
    })),
    { placeHolder: 'Select a Codex chat' }
  );

  return picked?.chat;
}

async function openChatWebview(
  context: vscode.ExtensionContext,
  store: CodexHistoryStore,
  chat: ChatEntry
): Promise<void> {
  const panel = vscode.window.createWebviewPanel(
    'codexBumper.chat',
    `Codex: ${chat.title}`,
    vscode.ViewColumn.One,
    { enableCommandUris: true }
  );
  const messages = await store.readTranscript(chat);
  panel.webview.html = renderTranscriptHtml(context, panel.webview, chat, messages);
}

function renderTranscriptHtml(
  context: vscode.ExtensionContext,
  webview: vscode.Webview,
  chat: ChatEntry,
  messages: TranscriptMessage[]
): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  const bumpUri = `command:codexBumper.bumpChat?${encodeURIComponent(JSON.stringify([chat.id]))}`;
  const stylesheet = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'resources', 'webview.css'));

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link nonce="${nonce}" rel="stylesheet" href="${stylesheet}">
  <title>${escapeHtml(chat.title)}</title>
</head>
<body>
  <header>
    <div>
      <h1>${escapeHtml(chat.title)}</h1>
      <p>${escapeHtml(chat.id)}${chat.updatedAt ? ` · ${escapeHtml(chat.updatedAt)}` : ''}</p>
    </div>
    <a class="button" href="${bumpUri}">Bump: say hi</a>
  </header>
  <main>
    ${messages.map(renderMessage).join('\n')}
  </main>
</body>
</html>`;
}

function renderMessage(message: TranscriptMessage): string {
  return `<section class="message ${message.role}">
  <div class="meta">${message.role}${message.timestamp ? ` · ${escapeHtml(message.timestamp)}` : ''}</div>
  <pre>${escapeHtml(message.text)}</pre>
</section>`;
}

function extractMessageText(content: unknown): string {
  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map((part) => {
      if (!part || typeof part !== 'object') {
        return '';
      }
      const maybeText = (part as { text?: unknown }).text;
      return typeof maybeText === 'string' ? maybeText : '';
    })
    .filter(Boolean)
    .join('\n\n');
}

function extractStoredThreadName(record: any): string | undefined {
  const title =
    record?.type === 'event_msg' && record.payload?.type === 'thread_name_updated'
      ? record.payload.thread_name
      : undefined;
  return typeof title === 'string' && title.trim() ? title : undefined;
}

function extractUserTitleSource(record: any): string | undefined {
  if (record?.type === 'event_msg' && record.payload?.type === 'user_message') {
    const message = record.payload.message;
    return typeof message === 'string' && message.trim() ? message : undefined;
  }

  if (record?.type === 'response_item' && record.payload?.type === 'message' && record.payload.role === 'user') {
    const message = extractMessageText(record.payload.content);
    return message.trim() ? message : undefined;
  }

  return undefined;
}

function isTitleNoise(value: string): boolean {
  const normalized = value.trimStart().toLowerCase();
  return [
    '<environment_context',
    '<user_instructions',
    '<permissions instructions',
    '<collaboration_mode',
    '<skills_instructions',
    '<apps_instructions',
    '<plugins_instructions',
    '<recommended_plugins',
    '# agents.md instructions'
  ].some((prefix) => normalized.startsWith(prefix));
}

function formatInferredTitle(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= CHAT_TITLE_MAX_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, CHAT_TITLE_MAX_LENGTH - 3).trimEnd()}...`;
}

function extractSessionId(filePath: string): string | undefined {
  return /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i.exec(filePath)?.[1];
}

async function fileMtimeIso(filePath: string): Promise<string | undefined> {
  try {
    return (await fs.stat(filePath)).mtime.toISOString();
  } catch {
    return undefined;
  }
}

function compareUpdatedAt(left?: string, right?: string): number {
  const leftTime = left ? Date.parse(left) : 0;
  const rightTime = right ? Date.parse(right) : 0;
  return leftTime - rightTime;
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

function genericTitle(id: string): string {
  return `Codex chat ${shortId(id)}`;
}

function isGenericTitle(title: string, id: string): boolean {
  return !title.trim() || title === genericTitle(id);
}

function expandHome(value: string): string {
  if (value === '~') {
    return os.homedir();
  }
  if (/^~[\\/]/.test(value)) {
    return path.join(os.homedir(), value.slice(2));
  }
  return value;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeJsonParse(line: string): any | undefined {
  try {
    return JSON.parse(line);
  } catch {
    return undefined;
  }
}

function isNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as NodeJS.ErrnoException).code === 'ENOENT');
}
