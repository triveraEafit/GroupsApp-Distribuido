import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/shared/ui/Card";
import { Input } from "@/shared/ui/Input";
import { Button } from "@/shared/ui/Button";
import {
  getCurrentUsername,
  getDirectHistory,
  getGroupMessages,
  getMyGroups,
  getUnreadDirectMessages,
  getUserIdFromToken,
  markDirectMessagesAsRead,
  uploadFileToUser,
  getFileDownloadUrl,
} from "@/shared/api/client";
import { tokenStorage } from "@/shared/auth/tokenStorage";
import { TextWebSocketClient } from "@/shared/wsClient";

const RECENT_DM_KEY = "groupsapp_recent_dm_usernames";

function migrateRecentDms() {
  const current = sessionStorage.getItem(RECENT_DM_KEY);
  if (current) return current;

  const legacy = localStorage.getItem(RECENT_DM_KEY);
  if (!legacy) return "[]";

  sessionStorage.setItem(RECENT_DM_KEY, legacy);
  localStorage.removeItem(RECENT_DM_KEY);
  return legacy;
}

function loadRecentDmUsernames() {
  try {
    const saved = JSON.parse(migrateRecentDms());
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveRecentDmUsernames(usernames) {
  sessionStorage.setItem(RECENT_DM_KEY, JSON.stringify(usernames.slice(0, 8)));
  localStorage.removeItem(RECENT_DM_KEY);
}

function formatTimestamp(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function parseMessageDate(value) {
  const timestamp = new Date(value || "").getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function humanFileSize(size) {
  if (!size && size !== 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function makeQueueId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function Chat() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialGroup = Number(searchParams.get("group") || "");
  const initialDm = searchParams.get("dm") || "";

  const currentUserId = getUserIdFromToken();
  const currentUsername =
    getCurrentUsername() || (currentUserId ? `User #${currentUserId}` : "Session");

  const [mode, setMode] = useState(initialDm ? "dm" : "group");
  const [groups, setGroups] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState(
    Number.isFinite(initialGroup) ? initialGroup : 0
  );
  const [groupMessages, setGroupMessages] = useState([]);

  const [recentDmUsernames, setRecentDmUsernames] = useState(loadRecentDmUsernames);
  const [dmInput, setDmInput] = useState(initialDm);
  const [activeDmUsername, setActiveDmUsername] = useState(initialDm);
  const [dmMessages, setDmMessages] = useState([]);
  const [unreadDmCount, setUnreadDmCount] = useState(0);

  const [composer, setComposer] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [socketStatus, setSocketStatus] = useState("offline");
  const [socketNote, setSocketNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [queuedByThread, setQueuedByThread] = useState({});
  const [localFilesByThread, setLocalFilesByThread] = useState({});

  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const queuedByThreadRef = useRef({});
  const fileInputRef = useRef(null);

  const activeGroup = groups.find((group) => Number(group.id) === Number(activeGroupId));
  const activeMessages = mode === "group" ? groupMessages : dmMessages;
  const activeThreadKey =
    mode === "group" ? `group:${activeGroupId || "none"}` : `dm:${activeDmUsername || "none"}`;
  const queuedMessages = queuedByThread[activeThreadKey] || [];
  const localFiles = localFilesByThread[activeThreadKey] || [];
  const canTargetConversation =
    mode === "group" ? Boolean(activeGroupId) : Boolean(activeDmUsername);

  useEffect(() => {
    queuedByThreadRef.current = queuedByThread;
  }, [queuedByThread]);

  function rememberKnownUser(userId, username) {
    tokenStorage.rememberKnownUser(userId, username);
  }

  function resolveKnownUsername(userId) {
    if (Number(userId) === Number(currentUserId)) return currentUsername;
    return tokenStorage.getKnownUsername(Number(userId));
  }

  function getStatusMeta() {
    if (socketStatus === "online") {
      return {
        label: queuedMessages.length > 0 ? `Online · ${queuedMessages.length} queued` : "Online",
        helper: "Ready to send now",
        chipClass: "bg-emerald-500/15 text-emerald-200 border-emerald-400/20",
      };
    }

    if (socketStatus === "connecting") {
      return {
        label: queuedMessages.length > 0 ? `Reconnecting · ${queuedMessages.length} on hold` : "Reconnecting",
        helper: "Trying to restore the chat connection",
        chipClass: "bg-amber-500/15 text-amber-200 border-amber-400/20",
      };
    }

    if (socketStatus === "blocked") {
      return {
        label: "Unavailable",
        helper: "Backend rejected this chat session",
        chipClass: "bg-red-500/15 text-red-200 border-red-400/20",
      };
    }

    return {
      label: queuedMessages.length > 0 ? `Offline · ${queuedMessages.length} on hold` : "Offline",
      helper: "New text messages stay queued locally",
      chipClass: "bg-slate-500/15 text-slate-200 border-white/10",
    };
  }

  async function loadGroups() {
    const data = await getMyGroups();
    const nextGroups = Array.isArray(data) ? data : [];
    setGroups(nextGroups);

    if (!activeGroupId && nextGroups[0]) {
      setActiveGroupId(nextGroups[0].id);
    }
  }

  async function loadUnreadCount() {
    try {
      const unread = await getUnreadDirectMessages();
      setUnreadDmCount(Array.isArray(unread) ? unread.length : 0);
    } catch {
      setUnreadDmCount(0);
    }
  }

  async function loadGroupHistory(groupId) {
    if (!groupId) {
      setGroupMessages([]);
      return;
    }

    setLoading(true);
    try {
      const data = await getGroupMessages(groupId);
      const items = Array.isArray(data) ? data : [];
      rememberKnownUser(currentUserId, currentUsername);
      setGroupMessages(items);
    } catch (e) {
      setError(e.message || "Could not load group history.");
      setGroupMessages([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadDmHistory(username) {
    if (!username) {
      setDmMessages([]);
      return;
    }

    setLoading(true);
    try {
      const data = await getDirectHistory(username);
      const items = Array.isArray(data) ? data : [];
      rememberKnownUser(currentUserId, currentUsername);

      const otherUserId = items.reduce((foundId, message) => {
        if (foundId) return foundId;
        if (Number(message.sender_id) !== Number(currentUserId)) return Number(message.sender_id);
        if (Number(message.receiver_id) !== Number(currentUserId)) return Number(message.receiver_id);
        return foundId;
      }, null);

      if (otherUserId) {
        rememberKnownUser(otherUserId, username);
      }

      setDmMessages(items);
      await markDirectMessagesAsRead(username).catch(() => null);
      await loadUnreadCount();
    } catch (e) {
      setError(e.message || "Could not load direct messages.");
      setDmMessages([]);
    } finally {
      setLoading(false);
    }
  }

  function rememberDm(username) {
    const cleaned = username.trim();
    if (!cleaned) return;

    const next = [cleaned, ...recentDmUsernames.filter((item) => item !== cleaned)];
    setRecentDmUsernames(next);
    saveRecentDmUsernames(next);
  }

  function forgetDm(username) {
    const next = recentDmUsernames.filter((item) => item !== username);
    setRecentDmUsernames(next);
    saveRecentDmUsernames(next);

    if (activeDmUsername === username) {
      setActiveDmUsername("");
      setDmInput("");
      setDmMessages([]);
    }
  }

  function openDm(username) {
    const cleaned = username.trim();
    if (!cleaned) return;

    rememberDm(cleaned);
    setMode("dm");
    setActiveDmUsername(cleaned);
    setDmInput(cleaned);
    setError("");
    setSocketNote("");
  }

  function queueMessage(text) {
    const item = {
      id: makeQueueId(),
      text,
      createdAt: new Date().toISOString(),
    };

    setQueuedByThread((prev) => ({
      ...prev,
      [activeThreadKey]: [...(prev[activeThreadKey] || []), item],
    }));
  }

  function clearQueuedMessages(threadKey) {
    setQueuedByThread((prev) => {
      const next = { ...prev };
      delete next[threadKey];
      return next;
    });
  }

  function addLocalFileMessage(file, note, status) {
    const item = {
      id: makeQueueId(),
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || "application/octet-stream",
      note: note.trim(),
      createdAt: new Date().toISOString(),
      status,
    };

    setLocalFilesByThread((prev) => ({
      ...prev,
      [activeThreadKey]: [...(prev[activeThreadKey] || []), item],
    }));
  }

  function updateLocalFileStatus(threadKey, fromStatus, toStatus) {
    setLocalFilesByThread((prev) => ({
      ...prev,
      [threadKey]: (prev[threadKey] || []).map((item) =>
        item.status === fromStatus ? { ...item, status: toStatus } : item
      ),
    }));
  }

  function clearLocalFiles(threadKey) {
    setLocalFilesByThread((prev) => {
      const next = { ...prev };
      delete next[threadKey];
      return next;
    });
  }

  function flushQueuedMessages(client, threadKey) {
    const queued = queuedByThreadRef.current[threadKey] || [];
    if (!queued.length) return;

    for (const item of queued) {
      client.send(item.text);
    }

    clearQueuedMessages(threadKey);
    setSocketNote(`Delivered ${queued.length} queued message${queued.length === 1 ? "" : "s"}.`);
  }

  useEffect(() => {
    loadGroups().catch((e) => setError(e.message || "Could not load groups."));
    loadUnreadCount();
    rememberKnownUser(currentUserId, currentUsername);
  }, []);

  useEffect(() => {
    if (mode === "group") {
      loadGroupHistory(activeGroupId);
      return;
    }

    loadDmHistory(activeDmUsername);
  }, [mode, activeGroupId, activeDmUsername]);

  useEffect(() => {
    if (!canTargetConversation) {
      setSocketStatus("offline");
      return;
    }

    wsRef.current?.close();
    setSocketStatus("connecting");

    const threadKey =
      mode === "group" ? `group:${activeGroupId}` : `dm:${activeDmUsername}`;
    const path =
      mode === "group"
        ? `/groups/ws/${activeGroupId}`
        : `/groups/dm/ws/${encodeURIComponent(activeDmUsername)}`;

    const client = new TextWebSocketClient(path, {
      onOpen: () => {
        setSocketStatus("online");
        setError("");
        flushQueuedMessages(client, threadKey);
        updateLocalFileStatus(threadKey, "on_hold", "pending_backend");
      },
      onClose: (event) => {
        if (event?.code === 1008) {
          setSocketStatus("blocked");
          return;
        }

        setSocketStatus("offline");
      },
      onError: (socketError) => {
        const message = socketError.message || "WebSocket connection failed";
        setSocketStatus(
          message.includes("rejected by backend") ? "blocked" : "offline"
        );
        setError(message);
      },
      onMessage: (text) => {
        if (mode === "dm" && text.startsWith("[Sistema]")) {
          setSocketNote(text);
        } else if (socketNote) {
          setSocketNote("");
        }

        if (mode === "group") {
          loadGroupHistory(activeGroupId);
        } else {
          loadDmHistory(activeDmUsername);
        }
      },
    });

    client.connect();
    wsRef.current = client;

    return () => {
      client.close();
    };
  }, [mode, activeGroupId, activeDmUsername, canTargetConversation]);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (mode === "group" && activeGroupId) {
      nextParams.set("group", String(activeGroupId));
    }
    if (mode === "dm" && activeDmUsername) {
      nextParams.set("dm", activeDmUsername);
    }
    setSearchParams(nextParams, { replace: true });
  }, [mode, activeGroupId, activeDmUsername, setSearchParams]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [groupMessages, dmMessages, queuedMessages, localFiles, mode]);

  useEffect(() => {
    const conversationLabel =
      mode === "group"
        ? activeGroup?.name || "Group chat"
        : activeDmUsername
          ? `@${activeDmUsername}`
          : "Direct chat";

    const statusText = socketStatus === "online" ? "online" : "offline";
    document.title = `${currentUsername} · ${conversationLabel} · ${statusText}`;
  }, [currentUsername, mode, activeGroup?.name, activeDmUsername, socketStatus]);

  async function onSend(e) {
    e.preventDefault();
    const text = composer.trim();
    const file = selectedFile;

    if (!text && !file) return;
    if (!canTargetConversation) return;

    setError("");

    // Manejar archivo en DM
    if (file && mode === "dm" && activeDmUsername) {
      try {
        const result = await uploadFileToUser(activeDmUsername, file);
        setSocketNote(`File "${file.name}" uploaded successfully!`);
        
        // Recargar mensajes para mostrar el archivo
        await loadDmHistory(activeDmUsername);
        
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } catch (uploadError) {
        setError(`Failed to upload file: ${uploadError.message}`);
        // Si falla, guardarlo localmente como fallback
        addLocalFileMessage(
          file,
          text,
          "upload_failed"
        );
      }
    } else if (file && mode === "group") {
      // Los grupos aún no soportan archivos
      setSocketNote("File uploads are only available in direct messages for now.");
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }

    // Manejar texto
    if (text) {
      if (socketStatus === "online") {
        try {
          wsRef.current?.send(text);
        } catch (sendError) {
          queueMessage(text);
          setError(sendError.message || "Message could not be sent right now.");
        }
      } else {
        queueMessage(text);
      }
    }

    setComposer("");
  }

  function renderServerMessage(message) {
    const isMine =
      mode === "group"
        ? Number(message.user_id) === Number(currentUserId)
        : Number(message.sender_id) === Number(currentUserId);
    const authorLabel =
      mode === "group"
        ? isMine
          ? "You"
          : resolveKnownUsername(message.user_id) || `Member #${message.user_id}`
        : isMine
          ? "You"
          : `@${activeDmUsername}`;

    const hasFile = message.file_name && message.file_path;

    return (
      <div
        key={`${mode}-server-${message.id}`}
        className={[
          "max-w-[78%] rounded-2xl px-4 py-3 shadow-sm",
          isMine
            ? "ml-auto text-white bg-gradient-to-b from-[rgb(var(--primary))] to-[rgb(var(--primary2))]"
            : "border border-[rgb(var(--border))] bg-[rgb(var(--panel2))] text-[rgb(var(--text))]",
        ].join(" ")}
      >
        <div
          className={[
            "text-xs font-semibold",
            isMine ? "text-white/85" : "text-[rgb(var(--muted))]",
          ].join(" ")}
        >
          {authorLabel}
        </div>
        
        {hasFile && (
          <div className={[
            "mt-2 rounded-xl px-3 py-2 border",
            isMine 
              ? "bg-white/10 border-white/20" 
              : "bg-[rgb(var(--panel))] border-[rgb(var(--border))]"
          ].join(" ")}>
            <div className="flex items-center gap-2">
              <span className="text-lg">📎</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">
                  {message.file_name}
                </div>
                <div className={[
                  "text-xs",
                  isMine ? "text-white/70" : "text-[rgb(var(--muted))]"
                ].join(" ")}>
                  {humanFileSize(message.file_size)}
                </div>
              </div>
              <a
                href={getFileDownloadUrl(message.id)}
                download={message.file_name}
                target="_blank"
                rel="noopener noreferrer"
                className={[
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                  isMine
                    ? "bg-white/20 hover:bg-white/30 text-white"
                    : "bg-[rgb(var(--primary))] hover:bg-[rgb(var(--primary2))] text-white"
                ].join(" ")}
              >
                Download
              </a>
            </div>
          </div>
        )}
        
        {message.content && (
          <div className="mt-2 text-sm whitespace-pre-wrap break-words">
            {message.content}
          </div>
        )}
        
        <div
          className={[
            "mt-2 text-[11px]",
            isMine ? "text-white/85" : "text-[rgb(var(--muted))]",
          ].join(" ")}
        >
          {formatTimestamp(message.created_at)}
          {mode === "dm" && isMine ? ` · ${message.is_read ? "Read" : "Sent"}` : ""}
        </div>
      </div>
    );
  }

  function renderLocalFileMessage(message) {
    const statusLabel =
      message.status === "on_hold"
        ? "On hold"
        : "UI ready · backend pending";

    return (
      <div
        key={`local-file-${message.id}`}
        className="ml-auto max-w-[78%] rounded-2xl border border-dashed border-sky-400/30 bg-sky-400/10 px-4 py-3 text-sky-50"
      >
        <div className="text-xs font-semibold text-sky-100">
          You · File attachment
        </div>
        <div className="mt-2 text-sm font-semibold break-words">
          {message.fileName}
        </div>
        <div className="mt-1 text-xs text-sky-100/90">
          {humanFileSize(message.fileSize)} · {message.fileType}
        </div>
        {message.note ? (
          <div className="mt-2 rounded-xl bg-black/10 px-3 py-2 text-sm text-sky-50/95">
            Local note: {message.note}
          </div>
        ) : null}
        <div className="mt-2 text-[11px] text-sky-100/90">
          {formatTimestamp(message.createdAt)} · {statusLabel}
        </div>
      </div>
    );
  }

  const timelineItems = [
    ...activeMessages.map((message) => ({
      kind: "server",
      timestamp:
        parseMessageDate(message.created_at) || Number(message.id) || 0,
      payload: message,
    })),
    ...localFiles.map((message) => ({
      kind: "local-file",
      timestamp: parseMessageDate(message.createdAt) || 0,
      payload: message,
    })),
  ].sort((a, b) => a.timestamp - b.timestamp);

  const statusMeta = getStatusMeta();
  const activeConversationLabel =
    mode === "group"
      ? activeGroup
        ? `${activeGroup.name} (#${activeGroup.id})`
        : "Select a group"
      : activeDmUsername
        ? `@${activeDmUsername}`
        : "Open a direct chat";

  return (
    <div className="flex h-[calc(100dvh-10.5rem)] min-h-[640px] flex-col gap-4 overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-semibold text-[rgb(var(--text))]">Chat</h1>
          <p className="mt-1 text-sm text-[rgb(var(--muted))]">
            Active as <span className="font-semibold text-[rgb(var(--text))]">@{currentUsername}</span>. This tab keeps its own session, queued text messages and local file drafts.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowInfoModal(true)}
          className="flex items-center gap-3 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--panel))] px-3 py-2 text-left transition hover:bg-[rgb(var(--panel2))]"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-b from-[rgb(var(--primary))] to-[rgb(var(--primary2))] text-sm font-semibold text-white">
            {currentUsername.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[rgb(var(--text))]">
              @{currentUsername}
            </div>
            <div className="text-xs text-[rgb(var(--muted))]">
              Profile & current chat
            </div>
          </div>
        </button>
      </div>

      {error ? (
        <div className="flex-shrink-0 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {socketNote ? (
        <div className="flex-shrink-0 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--panel2))] px-3 py-2 text-sm text-[rgb(var(--muted))]">
          {socketNote}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="flex min-h-0 flex-col overflow-hidden p-4">
          <div className="flex items-center gap-2">
            <Button
              variant={mode === "group" ? "primary" : "secondary"}
              onClick={() => setMode("group")}
            >
              Groups
            </Button>
            <Button
              variant={mode === "dm" ? "primary" : "secondary"}
              onClick={() => setMode("dm")}
            >
              Direct
            </Button>
          </div>

          {mode === "group" ? (
            <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {groups.length === 0 ? (
                <div className="text-sm text-[rgb(var(--muted))]">
                  No joined groups yet. Create or join one first.
                </div>
              ) : null}

              {groups.map((group) => {
                const isActive = Number(group.id) === Number(activeGroupId);
                return (
                  <button
                    key={group.id}
                    onClick={() => {
                      setMode("group");
                      setActiveGroupId(group.id);
                      setError("");
                    }}
                    className={[
                      "w-full text-left rounded-2xl border px-4 py-3 transition",
                      "border-[rgb(var(--border))]",
                      isActive ? "bg-[rgb(var(--panel2))]" : "hover:bg-[rgb(var(--panel2))]",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[rgb(var(--text))]">
                          #{group.id} {group.name}
                        </div>
                        <div className="truncate text-xs text-[rgb(var(--muted))]">
                          {group.description || "No description"}
                        </div>
                      </div>
                      {isActive ? (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                          Open
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  openDm(dmInput);
                }}
                className="space-y-2"
              >
                <Input
                  label="Username"
                  placeholder="Open a direct chat by username"
                  value={dmInput}
                  onChange={(e) => setDmInput(e.target.value)}
                />
                <Button className="w-full" disabled={!dmInput.trim()}>
                  Open direct chat
                </Button>
              </form>

              <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--panel2))] px-3 py-2 text-xs text-[rgb(var(--muted))]">
                Unread direct messages: {unreadDmCount}
              </div>

              {recentDmUsernames.length === 0 ? (
                <div className="text-sm text-[rgb(var(--muted))]">
                  No recent direct chats yet.
                </div>
              ) : null}

              {recentDmUsernames.map((username) => {
                const isActive = username === activeDmUsername;
                return (
                  <div
                    key={username}
                    className={[
                      "rounded-2xl border px-3 py-3 transition",
                      "border-[rgb(var(--border))]",
                      isActive ? "bg-[rgb(var(--panel2))]" : "hover:bg-[rgb(var(--panel2))]",
                    ].join(" ")}
                  >
                    <button
                      className="w-full text-left"
                      onClick={() => openDm(username)}
                    >
                      <div className="text-sm font-semibold text-[rgb(var(--text))]">
                        @{username}
                      </div>
                      <div className="text-xs text-[rgb(var(--muted))]">
                        Direct conversation
                      </div>
                    </button>

                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="secondary"
                        className="flex-1"
                        onClick={() => openDm(username)}
                      >
                        Open
                      </Button>
                      <Button
                        variant="ghost"
                        className="px-3"
                        onClick={() => forgetDm(username)}
                      >
                        Forget
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="flex h-full min-h-0 flex-col overflow-hidden p-0">
          <div className="flex flex-shrink-0 items-center gap-3 border-b border-[rgb(var(--border))] bg-[rgb(var(--panel))] px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-b from-[rgb(var(--primary))] to-[rgb(var(--primary2))] text-sm font-semibold text-white">
              {mode === "group"
                ? (activeGroup?.name || "G").slice(0, 2).toUpperCase()
                : (activeDmUsername || "DM").slice(0, 2).toUpperCase()}
            </div>

            <div className="min-w-0">
              <div className="text-sm font-semibold text-[rgb(var(--text))] truncate">
                {activeConversationLabel}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={[
                    "rounded-full border px-2 py-0.5 font-semibold",
                    statusMeta.chipClass,
                  ].join(" ")}
                >
                  {statusMeta.label}
                </span>
                <span className="text-[rgb(var(--muted))]">
                  {statusMeta.helper}
                </span>
              </div>
            </div>

            <div className="flex-1" />

            <Button
              variant="secondary"
              onClick={() =>
                mode === "group"
                  ? loadGroupHistory(activeGroupId)
                  : loadDmHistory(activeDmUsername)
              }
            >
              Refresh
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowInfoModal(true)}
            >
              Info
            </Button>
          </div>

          {queuedMessages.length > 0 ? (
            <div className="flex-shrink-0 border-b border-[rgb(var(--border))] bg-amber-500/10 px-4 py-2 text-xs text-amber-100">
              {queuedMessages.length} text message{queuedMessages.length === 1 ? "" : "s"} on hold for this chat. They will send automatically when the connection returns.
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {loading ? (
              <div className="text-sm text-[rgb(var(--muted))]">Loading conversation...</div>
            ) : null}

            {!loading && timelineItems.length === 0 && queuedMessages.length === 0 ? (
              <div className="max-w-[78%] rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--panel2))] px-4 py-3 text-sm text-[rgb(var(--muted))]">
                No messages yet for this conversation.
              </div>
            ) : null}

            {!loading &&
              timelineItems.map((item) =>
                item.kind === "server"
                  ? renderServerMessage(item.payload)
                  : renderLocalFileMessage(item.payload)
              )}

            {queuedMessages.map((message) => (
              <div
                key={`hold-${message.id}`}
                className="ml-auto max-w-[78%] rounded-2xl border border-dashed border-amber-400/30 bg-amber-400/10 px-4 py-3 text-amber-50"
              >
                <div className="text-xs font-semibold text-amber-100">
                  You · On hold
                </div>
                <div className="mt-2 text-sm whitespace-pre-wrap break-words">
                  {message.text}
                </div>
                <div className="mt-2 text-[11px] text-amber-100/90">
                  {formatTimestamp(message.createdAt)} · Waiting for the chat to come back online
                </div>
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={onSend}
            className="flex-shrink-0 border-t border-[rgb(var(--border))] bg-[rgb(var(--panel))] p-3"
          >
            {selectedFile ? (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-sky-400/20 bg-sky-400/10 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-sky-100">
                    {selectedFile.name}
                  </div>
                  <div className="text-xs text-sky-100/80">
                    {humanFileSize(selectedFile.size)} · UI-only until backend upload support exists
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                >
                  Remove
                </Button>
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />

              <Button
                type="button"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={!canTargetConversation || socketStatus === "blocked"}
              >
                Attach
              </Button>

              <div className="flex-1">
                <Input
                  placeholder={
                    mode === "group"
                      ? activeGroupId
                        ? socketStatus === "online"
                          ? "Send a group message..."
                          : "Write now, it will stay on hold if offline"
                        : "Select a group first"
                      : activeDmUsername
                        ? socketStatus === "online"
                          ? `Message @${activeDmUsername}`
                          : `Write to @${activeDmUsername}; it will stay on hold if offline`
                        : "Open a direct chat first"
                  }
                  value={composer}
                  onChange={(e) => setComposer(e.target.value)}
                  disabled={!canTargetConversation || socketStatus === "blocked"}
                />
              </div>
              <Button
                disabled={
                  (!composer.trim() && !selectedFile) ||
                  !canTargetConversation ||
                  socketStatus === "blocked"
                }
              >
                {socketStatus === "online" ? "Send" : "Hold"}
              </Button>
            </div>

            <div className="mt-2 text-xs text-[rgb(var(--muted))]">
              Text messages are sent live when online and queued when offline. File attachments are already testable in the UI, but they stay local until backend upload support exists.
            </div>
          </form>
        </Card>
      </div>

      {showInfoModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
          onClick={() => setShowInfoModal(false)}
        >
          <Card
            className="w-full max-w-[560px] p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-b from-[rgb(var(--primary))] to-[rgb(var(--primary2))] text-lg font-semibold text-white">
                {currentUsername.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-semibold text-[rgb(var(--text))]">
                  @{currentUsername}
                </div>
                <div className="text-sm text-[rgb(var(--muted))]">
                  User ID {currentUserId ?? "?"}
                </div>
              </div>
              <Button variant="ghost" onClick={() => setShowInfoModal(false)}>
                Close
              </Button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Card className="p-4 bg-[rgb(var(--panel2))]">
                <div className="text-sm font-semibold text-[rgb(var(--text))]">
                  Current chat
                </div>
                <div className="mt-2 text-sm text-[rgb(var(--muted))]">
                  {mode === "group"
                    ? activeGroup
                      ? `${activeGroup.name} · Group #${activeGroup.id}`
                      : "No group selected"
                    : activeDmUsername
                      ? `Direct with @${activeDmUsername}`
                      : "No direct chat selected"}
                </div>
                {mode === "group" && activeGroup?.description ? (
                  <div className="mt-2 text-xs text-[rgb(var(--muted))]">
                    {activeGroup.description}
                  </div>
                ) : null}
              </Card>

              <Card className="p-4 bg-[rgb(var(--panel2))]">
                <div className="text-sm font-semibold text-[rgb(var(--text))]">
                  Delivery state
                </div>
                <div className="mt-2 text-sm text-[rgb(var(--muted))]">
                  {statusMeta.label}
                </div>
                <div className="mt-1 text-xs text-[rgb(var(--muted))]">
                  Queued text: {queuedMessages.length}
                </div>
                <div className="mt-1 text-xs text-[rgb(var(--muted))]">
                  Local files: {localFiles.length}
                </div>
              </Card>
            </div>

            <Card className="mt-4 p-4 bg-[rgb(var(--panel2))]">
              <div className="text-sm font-semibold text-[rgb(var(--text))]">
                Actions
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Button
                  variant="secondary"
                  onClick={() =>
                    mode === "group"
                      ? loadGroupHistory(activeGroupId)
                      : loadDmHistory(activeDmUsername)
                  }
                  disabled={!canTargetConversation}
                >
                  Refresh current chat
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => clearQueuedMessages(activeThreadKey)}
                  disabled={queuedMessages.length === 0}
                >
                  Clear on-hold text
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => clearLocalFiles(activeThreadKey)}
                  disabled={localFiles.length === 0}
                >
                  Clear local files
                </Button>

                {mode === "dm" ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      forgetDm(activeDmUsername);
                      setShowInfoModal(false);
                    }}
                    disabled={!activeDmUsername}
                  >
                    Forget this direct chat
                  </Button>
                ) : null}

                <Button variant="ghost" onClick={() => navigate("/groups")}>
                  Back to groups
                </Button>
              </div>
            </Card>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
