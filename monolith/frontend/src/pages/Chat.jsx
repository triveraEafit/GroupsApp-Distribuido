import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { Input } from "@/shared/ui/Input";
import {
  createGroup,
  getCurrentUsername,
  getDirectHistory,
  getFileDownloadUrl,
  getGroupMessages,
  getMyGroups,
  getUnreadDirectMessages,
  getUserIdFromToken,
  joinGroup,
  markDirectMessagesAsRead,
  uploadFileToUser,
} from "@/shared/api/client";
import { tokenStorage } from "@/shared/auth/tokenStorage";
import { TextWebSocketClient } from "@/shared/wsClient";

const RECENT_DM_KEY = "groupsapp_recent_dm_usernames";

function loadRecentDmUsernames() {
  try {
    const raw = sessionStorage.getItem(RECENT_DM_KEY) || localStorage.getItem(RECENT_DM_KEY) || "[]";
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecentDmUsernames(items) {
  sessionStorage.setItem(RECENT_DM_KEY, JSON.stringify(items.slice(0, 16)));
  localStorage.removeItem(RECENT_DM_KEY);
}

function toTimestamp(value) {
  const ms = new Date(value || "").getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin >= 0 && diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateDivider(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diff = Math.round((startOfToday - startOfDate) / (24 * 60 * 60 * 1000));
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  return date.toLocaleDateString();
}

function humanFileSize(size) {
  if (!size && size !== 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function avatarInitials(label) {
  const clean = String(label || "?").replace(/^@|^#/, "").trim();
  if (!clean) return "?";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

function avatarGradient(seed) {
  const clean = String(seed || "x");
  const total = clean.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const from = 200 + (total % 120);
  const to = 250 + (total % 80);
  return `linear-gradient(135deg, hsl(${from}, 78%, 58%), hsl(${to}, 72%, 54%))`;
}

export default function Chat() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialGroupId = Number(searchParams.get("group") || "");
  const initialDm = searchParams.get("dm") || "";

  const currentUserId = getUserIdFromToken();
  const currentUsername = getCurrentUsername() || (currentUserId ? `User #${currentUserId}` : "Session");

  const [groups, setGroups] = useState([]);
  const [recentDmUsernames, setRecentDmUsernames] = useState(loadRecentDmUsernames);
  const [groupMessages, setGroupMessages] = useState([]);
  const [dmMessages, setDmMessages] = useState([]);
  const [unreadByDm, setUnreadByDm] = useState({});
  const [receiptsByMessageId, setReceiptsByMessageId] = useState({});
  const [groupMetaById, setGroupMetaById] = useState({});
  const [dmMetaByUsername, setDmMetaByUsername] = useState({});

  const [activeChat, setActiveChat] = useState(
    initialDm ? { type: "dm", id: initialDm } : { type: "group", id: Number.isFinite(initialGroupId) ? initialGroupId : 0 }
  );
  const [composer, setComposer] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [newDmInput, setNewDmInput] = useState(initialDm);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [joinGroupId, setJoinGroupId] = useState("");
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [mobilePane, setMobilePane] = useState(initialDm || initialGroupId ? "chat" : "list");
  const [showGroupPanel, setShowGroupPanel] = useState(false);
  const [showJoinPanel, setShowJoinPanel] = useState(false);
  const [socketStatus, setSocketStatus] = useState("offline");
  const [socketNote, setSocketNote] = useState("");
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [typingPreview, setTypingPreview] = useState(false);
  const [bubbleActionId, setBubbleActionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const wsRef = useRef(null);
  const bottomRef = useRef(null);
  const timelineRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastChatKeyRef = useRef("");

  const activeGroup = groups.find((group) => Number(group.id) === Number(activeChat.id));
  const activeMessages = activeChat.type === "group" ? groupMessages : dmMessages;
  const canSend = activeChat.type === "group" ? Boolean(activeChat.id) : Boolean(activeChat.id?.trim());

  const filteredGroups = useMemo(() => {
    const q = sidebarSearch.trim().toLowerCase();
    return groups.filter((group) => {
      if (!q) return true;
      return (
        String(group.id).includes(q) ||
        String(group.name || "").toLowerCase().includes(q) ||
        String(group.description || "").toLowerCase().includes(q)
      );
    });
  }, [groups, sidebarSearch]);

  const filteredDms = useMemo(() => {
    const q = sidebarSearch.trim().toLowerCase();
    return recentDmUsernames.filter((username) => !q || username.toLowerCase().includes(q));
  }, [recentDmUsernames, sidebarSearch]);

  const timelineItems = useMemo(() => {
    const sorted = [...activeMessages].sort((a, b) => {
      const ta = toTimestamp(a.created_at) || Number(a.id) || 0;
      const tb = toTimestamp(b.created_at) || Number(b.id) || 0;
      return ta - tb;
    });
    const result = [];
    let lastDivider = "";
    for (const item of sorted) {
      const divider = formatDateDivider(item.created_at);
      if (divider && divider !== lastDivider) {
        result.push({ kind: "divider", id: `divider-${divider}-${item.id}`, label: divider });
        lastDivider = divider;
      }
      result.push({ kind: "message", id: `message-${item.id}`, payload: item });
    }
    return result;
  }, [activeMessages]);

  const orderedMessages = useMemo(
    () => timelineItems.filter((item) => item.kind === "message").map((item) => item.payload),
    [timelineItems]
  );

  function rememberDm(username) {
    const clean = username.trim();
    if (!clean) return;
    const next = [clean, ...recentDmUsernames.filter((item) => item !== clean)];
    setRecentDmUsernames(next);
    saveRecentDmUsernames(next);
  }

  function resolveUsername(userId) {
    if (Number(userId) === Number(currentUserId)) return currentUsername;
    return tokenStorage.getKnownUsername(Number(userId)) || `User #${userId}`;
  }

  async function computeGroupMeta(list) {
    const entries = await Promise.all(
      list.map(async (group) => {
        try {
          const messages = await getGroupMessages(group.id);
          const arr = Array.isArray(messages) ? messages : [];
          const last = arr[arr.length - 1];
          return [
            group.id,
            {
              preview: last?.content || "Sin mensajes",
              time: last?.created_at || null,
            },
          ];
        } catch {
          return [group.id, { preview: "Sin mensajes", time: null }];
        }
      })
    );
    setGroupMetaById(Object.fromEntries(entries));
  }

  async function computeDmMeta(usernames) {
    const entries = await Promise.all(
      usernames.map(async (username) => {
        try {
          const messages = await getDirectHistory(username);
          const arr = Array.isArray(messages) ? messages : [];
          const last = arr[arr.length - 1];
          return [
            username,
            {
              preview: last?.content || (last?.file_name ? `📎 ${last.file_name}` : "Sin mensajes"),
              time: last?.created_at || null,
            },
          ];
        } catch {
          return [username, { preview: "Sin mensajes", time: null }];
        }
      })
    );
    setDmMetaByUsername((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
  }

  async function loadGroups() {
    const data = await getMyGroups();
    const list = Array.isArray(data) ? data : [];
    setGroups(list);
    computeGroupMeta(list);
    if (activeChat.type === "group" && !activeChat.id && list[0]) {
      setActiveChat({ type: "group", id: list[0].id });
    }
  }

  async function onCreateGroup(event) {
    event.preventDefault();
    const name = newGroupName.trim();
    if (!name) return;
    try {
      const created = await createGroup({
        name,
        description: newGroupDescription.trim(),
      });
      await loadGroups();
      setActiveChat({ type: "group", id: created.id });
      setMobilePane("chat");
      setNewGroupName("");
      setNewGroupDescription("");
      setSocketNote(`Grupo #${created.id} creado`);
    } catch (e) {
      setError(e.message || "No se pudo crear el grupo");
    }
  }

  async function onJoinGroup(event) {
    event.preventDefault();
    const id = Number(joinGroupId);
    if (!Number.isFinite(id) || id <= 0) return;
    try {
      await joinGroup(id);
      await loadGroups();
      setActiveChat({ type: "group", id });
      setMobilePane("chat");
      setJoinGroupId("");
      setSocketNote(`Te uniste al grupo #${id}`);
    } catch (e) {
      setError(e.message || "No se pudo unir al grupo");
    }
  }

  async function loadUnreadDms() {
    try {
      const unread = await getUnreadDirectMessages();
      const map = {};
      for (const item of Array.isArray(unread) ? unread : []) {
        const username = resolveUsername(item.sender_id);
        map[username] = (map[username] || 0) + 1;
        rememberDm(username);
      }
      setUnreadByDm(map);
    } catch {
      setUnreadByDm({});
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
      setGroupMessages(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "No se pudo cargar el grupo");
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
      for (const item of items) {
        if (Number(item.sender_id) !== Number(currentUserId)) {
          tokenStorage.rememberKnownUser(item.sender_id, username);
        }
        if (item.is_read) {
          setReceiptsByMessageId((prev) => ({
            ...prev,
            [item.id]: { ...(prev[item.id] || {}), read_at: item.created_at || new Date().toISOString() },
          }));
        }
      }
      setDmMessages(items);
      await markDirectMessagesAsRead(username).catch(() => null);
      await loadUnreadDms();
      await computeDmMeta([username]);
    } catch (e) {
      setError(e.message || "No se pudo cargar el chat directo");
      setDmMessages([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGroups().catch((e) => setError(e.message || "No se pudieron cargar grupos"));
    loadUnreadDms();
  }, []);

  useEffect(() => {
    computeDmMeta(recentDmUsernames);
  }, [recentDmUsernames.join("|")]);

  useEffect(() => {
    const onToggleSidebar = () => setMobilePane((prev) => (prev === "list" ? "chat" : "list"));
    window.addEventListener("groupsapp:toggle-sidebar", onToggleSidebar);
    return () => window.removeEventListener("groupsapp:toggle-sidebar", onToggleSidebar);
  }, []);

  useEffect(() => {
    if (activeChat.type === "group") {
      loadGroupHistory(activeChat.id);
    } else {
      loadDmHistory(activeChat.id);
    }
  }, [activeChat.type, activeChat.id]);

  useEffect(() => {
    if (!canSend) {
      setSocketStatus("offline");
      return;
    }

    wsRef.current?.close();
    setSocketStatus("connecting");

    const path =
      activeChat.type === "group"
        ? `/groups/ws/${activeChat.id}`
        : `/groups/dm/ws/${encodeURIComponent(activeChat.id)}`;

    const client = new TextWebSocketClient(path, {
      onOpen: () => {
        setSocketStatus("online");
        setError("");
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
        setSocketStatus(message.includes("rejected by backend") ? "blocked" : "offline");
        setError(message);
      },
      onMessage: (text) => {
        let payload = null;
        try {
          payload = JSON.parse(text);
        } catch {
          payload = null;
        }
        if (payload?.type === "dm_receipt" && payload?.message_id) {
          setReceiptsByMessageId((prev) => ({
            ...prev,
            [payload.message_id]: {
              ...(prev[payload.message_id] || {}),
              delivered_at: payload.delivered_at || prev[payload.message_id]?.delivered_at || null,
              read_at: payload.read_at || prev[payload.message_id]?.read_at || null,
            },
          }));
          setDmMessages((prev) =>
            prev.map((message) =>
              message.id === payload.message_id && payload.read_at
                ? { ...message, is_read: true }
                : message
            )
          );
          return;
        }
        if (activeChat.type === "group") {
          loadGroupHistory(activeChat.id);
        } else {
          if (text.startsWith("[Sistema]")) setSocketNote(text);
          loadDmHistory(activeChat.id);
        }
      },
    });

    client.connect();
    wsRef.current = client;

    return () => client.close();
  }, [activeChat.type, activeChat.id, canSend]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (activeChat.type === "group" && activeChat.id) params.set("group", String(activeChat.id));
    if (activeChat.type === "dm" && activeChat.id) params.set("dm", activeChat.id);
    setSearchParams(params, { replace: true });
  }, [activeChat, setSearchParams]);

  useEffect(() => {
    const currentChatKey = `${activeChat.type}:${activeChat.id || ""}`;
    const chatChanged = lastChatKeyRef.current !== currentChatKey;
    lastChatKeyRef.current = currentChatKey;

    const scrollBehavior = chatChanged ? "auto" : "smooth";
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: scrollBehavior, block: "end" });
    });
  }, [timelineItems, socketNote, activeChat.type, activeChat.id]);

  useEffect(() => {
    setTypingPreview(Boolean(composer.trim()));
  }, [composer]);

  function onTimelineScroll(event) {
    const el = event.currentTarget;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollButton(distance > 120);
  }

  function scrollToBottom(smooth = true) {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" });
  }

  async function onSend(event) {
    event.preventDefault();
    const text = composer.trim();
    if (!text && !selectedFile) return;
    if (!canSend) return;

    setError("");
    if (selectedFile && activeChat.type === "dm") {
      try {
        await uploadFileToUser(activeChat.id, selectedFile);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        await loadDmHistory(activeChat.id);
      } catch (e) {
        setError(e.message || "Error subiendo archivo");
      }
    }

    if (text) {
      try {
        wsRef.current?.send(text);
      } catch (e) {
        setError(e.message || "No se pudo enviar el mensaje");
      }
    }
    setComposer("");
  }

  function startDirectChat() {
    const username = newDmInput.trim();
    if (!username) return;
    rememberDm(username);
    setActiveChat({ type: "dm", id: username });
    setMobilePane("chat");
    setNewDmInput("");
  }

  function openGroup(groupId) {
    setActiveChat({ type: "group", id: groupId });
    setMobilePane("chat");
  }

  function openDm(username) {
    setActiveChat({ type: "dm", id: username });
    setMobilePane("chat");
  }

  function renderMessageBubble(message, index) {
    const isMine =
      activeChat.type === "group"
        ? Number(message.user_id) === Number(currentUserId)
        : Number(message.sender_id) === Number(currentUserId);
    const prev = orderedMessages[index - 1];
    const next = orderedMessages[index + 1];
    const samePrev =
      prev &&
      ((activeChat.type === "group" && Number(prev.user_id) === Number(message.user_id)) ||
        (activeChat.type === "dm" && Number(prev.sender_id) === Number(message.sender_id)));
    const sameNext =
      next &&
      ((activeChat.type === "group" && Number(next.user_id) === Number(message.user_id)) ||
        (activeChat.type === "dm" && Number(next.sender_id) === Number(message.sender_id)));
    const senderLabel =
      activeChat.type === "group"
        ? resolveUsername(message.user_id)
        : isMine
          ? "Tú"
          : `@${activeChat.id}`;
    const hasFile = Boolean(message.file_name && message.file_path);
    const receipt = receiptsByMessageId[message.id];
    const readState =
      !isMine || activeChat.type !== "dm"
        ? null
        : receipt?.read_at || message.is_read
          ? { icon: "✓✓", className: "text-sky-200" }
          : receipt?.delivered_at
            ? { icon: "✓✓", className: "text-white/75" }
            : { icon: "✓", className: "text-white/75" };

    return (
      <div
        key={`message-${message.id}`}
        className={["group relative max-w-[85vw] md:max-w-[82%] px-[14px] py-[10px] msg-enter", isMine ? "ml-auto" : ""].join(" ")}
        onMouseEnter={() => setBubbleActionId(message.id)}
        onMouseLeave={() => setBubbleActionId((prevId) => (prevId === message.id ? null : prevId))}
        onTouchStart={() => setBubbleActionId(message.id)}
        style={{
          borderTopLeftRadius: samePrev ? 8 : 18,
          borderTopRightRadius: samePrev ? 8 : 18,
          borderBottomRightRadius: isMine ? (sameNext ? 8 : 4) : 18,
          borderBottomLeftRadius: isMine ? 18 : sameNext ? 8 : 4,
          background: isMine
            ? "linear-gradient(135deg, rgb(var(--chat-bubble-mine-from)), rgb(var(--chat-bubble-mine-to)))"
            : "rgb(var(--chat-bubble-other))",
          border: isMine ? "none" : "1px solid rgba(255,255,255,0.06)",
          boxShadow: isMine ? "0 2px 12px rgba(99,102,241,0.25)" : "none",
        }}
      >
        <div className={["text-[11px] font-semibold uppercase tracking-[0.05em]", isMine ? "text-white/85" : "text-[#a5b4fc]"].join(" ")}>
          {senderLabel}
        </div>
        {hasFile ? (
          <div className={["mt-1.5 rounded-xl px-2.5 py-2 border", isMine ? "border-white/20 bg-white/10" : "border-[rgb(var(--border))] bg-[rgb(var(--panel))]"].join(" ")}>
            <div className="flex items-center gap-2">
              <span>📎</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{message.file_name}</div>
                <div className="text-[11px] opacity-80">{humanFileSize(message.file_size)}</div>
              </div>
              <a
                href={getFileDownloadUrl(message.id)}
                target="_blank"
                rel="noopener noreferrer"
                className={["text-[11px] rounded-lg px-2 py-1 font-semibold", isMine ? "bg-white/20" : "bg-[rgb(var(--primary))] text-white"].join(" ")}
              >
                Abrir
              </a>
            </div>
          </div>
        ) : null}
        {message.content ? <div className="mt-1.5 whitespace-pre-wrap break-words text-[14px] leading-[1.5]">{message.content}</div> : null}
        <div className={["mt-1.5 flex items-center justify-end gap-1 text-[11px] opacity-70", isMine ? "text-white/85" : "text-[rgb(var(--muted))]"].join(" ")}>
          <span>{formatTime(message.created_at)}</span>
          {readState ? <span className={readState.className}>{readState.icon}</span> : null}
        </div>
        <div
          className={[
            "pointer-events-none absolute -top-3 flex gap-1 rounded-full border border-white/10 bg-[#0f1117]/90 px-2 py-1 text-[11px] text-white transition-opacity duration-150",
            isMine ? "right-2" : "left-2",
            bubbleActionId === message.id ? "opacity-100" : "opacity-0",
          ].join(" ")}
        >
          <span>👍</span>
          <span>❤️</span>
          <span>🔥</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100dvh-7.5rem)] min-h-[620px] overflow-hidden">
      {error ? (
        <div className="mb-3 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid h-full gap-2 overflow-hidden lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card
          className={[
            "min-h-0 flex-col overflow-hidden p-3",
            mobilePane === "list" ? "flex" : "hidden",
            "lg:flex",
          ].join(" ")}
          style={{ background: "rgb(var(--chat-sidebar))", borderColor: "rgba(255,255,255,0.05)" }}
        >
          <div className="px-2 pb-3">
            <h1 className="text-xl font-extrabold tracking-[-0.02em]">Mensajes</h1>
            <p className="text-xs text-[rgb(var(--muted))] opacity-80">Conectado como @{currentUsername}</p>
          </div>

          <div className="px-2">
            <Input
              placeholder="Buscar grupos o chats..."
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              className="rounded-2xl border-none bg-[#0f1117] text-[14px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
            />
          </div>

          <div className="mt-3 px-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                startDirectChat();
              }}
              className="flex items-center gap-2"
            >
              <Input
                placeholder="Nuevo directo por username"
                value={newDmInput}
                onChange={(e) => setNewDmInput(e.target.value)}
              />
              <Button className="shrink-0" disabled={!newDmInput.trim()}>
                Abrir
              </Button>
            </form>
          </div>

          <div className="mt-3 px-2 space-y-2">
            <button
              type="button"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm font-semibold"
              onClick={() => {
                setShowGroupPanel((prev) => !prev);
                setShowJoinPanel(false);
              }}
            >
              + Crear grupo
            </button>
            {showGroupPanel ? (
              <form
                onSubmit={onCreateGroup}
                className="fixed inset-x-3 bottom-3 z-30 space-y-2 rounded-2xl border border-white/10 bg-[#1a1d2e] p-3 shadow-2xl md:static md:inset-auto md:bottom-auto md:z-auto md:rounded-xl md:p-2"
              >
                <Input
                  placeholder="Nombre del grupo"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="border-none bg-[#0f1117]"
                />
                <Input
                  placeholder="Descripción (opcional)"
                  value={newGroupDescription}
                  onChange={(e) => setNewGroupDescription(e.target.value)}
                  className="border-none bg-[#0f1117]"
                />
                <Button className="w-full" disabled={!newGroupName.trim()}>
                  Crear
                </Button>
              </form>
            ) : null}
            <button
              type="button"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm font-semibold"
              onClick={() => {
                setShowJoinPanel((prev) => !prev);
                setShowGroupPanel(false);
              }}
            >
              # Unirse por ID
            </button>
            {showJoinPanel ? (
              <form
                onSubmit={onJoinGroup}
                className="fixed inset-x-3 bottom-3 z-30 flex items-center gap-2 rounded-2xl border border-white/10 bg-[#1a1d2e] p-3 shadow-2xl md:static md:inset-auto md:bottom-auto md:z-auto md:rounded-xl md:p-2"
              >
                <Input
                  placeholder="ID de grupo"
                  value={joinGroupId}
                  onChange={(e) => setJoinGroupId(e.target.value)}
                  inputMode="numeric"
                  className="border-none bg-[#0f1117]"
                />
                <Button className="shrink-0" disabled={!joinGroupId.trim()}>
                  Unir
                </Button>
              </form>
            ) : null}
          </div>

          <div className="chat-scrollbar mt-4 min-h-0 flex-1 overflow-y-auto px-2">
            <div className="mb-2 text-[10px] uppercase tracking-[0.1em] opacity-35">GROUPS</div>
            <div className="space-y-1.5">
              {filteredGroups.map((group) => {
                const active = activeChat.type === "group" && Number(activeChat.id) === Number(group.id);
                const meta = groupMetaById[group.id] || { preview: "Sin mensajes", time: null };
                return (
                  <button
                    key={`group-${group.id}`}
                    onClick={() => openGroup(group.id)}
                    className={[
                      "w-full rounded-[10px] px-3 py-2 text-left transition-[background] duration-100",
                      active
                        ? "border-l-2 border-l-[#6366f1] bg-[rgba(99,102,241,0.15)]"
                        : "hover:bg-[rgba(255,255,255,0.04)]",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                        style={{ backgroundImage: avatarGradient(group.name) }}
                      >
                        {avatarInitials(group.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate text-sm font-semibold">{group.name}</div>
                          <div className="text-[11px] text-[rgb(var(--muted))]">{formatTime(meta.time)}</div>
                        </div>
                        <div className="truncate text-[12px] text-[rgb(var(--muted))]">{meta.preview}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mb-2 mt-4 text-[10px] uppercase tracking-[0.1em] opacity-35">DIRECT</div>
            <div className="space-y-1.5 pb-3">
              {filteredDms.map((username) => {
                const active = activeChat.type === "dm" && activeChat.id === username;
                const unreadCount = unreadByDm[username] || 0;
                const meta = dmMetaByUsername[username] || { preview: "Sin mensajes", time: null };
                return (
                  <button
                    key={`dm-${username}`}
                    onClick={() => openDm(username)}
                    className={[
                      "w-full rounded-[10px] px-3 py-2 text-left transition-[background] duration-100",
                      active
                        ? "border-l-2 border-l-[#6366f1] bg-[rgba(99,102,241,0.15)]"
                        : "hover:bg-[rgba(255,255,255,0.04)]",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                        style={{ backgroundImage: avatarGradient(username) }}
                      >
                        {avatarInitials(username)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate text-sm font-semibold">@{username}</div>
                          <div className="text-[11px] text-[rgb(var(--muted))]">{formatTime(meta.time)}</div>
                        </div>
                        <div className="truncate text-[12px] text-[rgb(var(--muted))]">{meta.preview}</div>
                      </div>
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 online-pulse" />
                      {unreadCount > 0 ? (
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[rgb(var(--primary))] px-1.5 text-[10px] font-bold text-white">
                          {unreadCount}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        <Card
          className={[
            "relative min-h-0 flex-col overflow-hidden p-0",
            mobilePane === "chat" ? "flex" : "hidden",
            "lg:flex",
          ].join(" ")}
          style={{ background: "rgb(var(--chat-main))", borderColor: "rgba(255,255,255,0.05)" }}
        >
          <div className="flex items-center gap-3 border-b px-4 py-2.5" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgb(var(--chat-main))" }}>
            <Button
              type="button"
              variant="ghost"
              className="lg:hidden"
              onClick={() => setMobilePane("list")}
            >
              ←
            </Button>
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ backgroundImage: avatarGradient(activeChat.type === "group" ? activeGroup?.name : activeChat.id) }}
            >
              {avatarInitials(activeChat.type === "group" ? activeGroup?.name || "?" : activeChat.id || "?")}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">
                {activeChat.type === "group"
                  ? activeGroup
                    ? `${activeGroup.name} · #${activeGroup.id}`
                    : "Selecciona un grupo"
                  : activeChat.id
                    ? `@${activeChat.id}`
                    : "Abre un chat directo"}
              </div>
              <div className="text-xs text-[rgb(var(--muted))]">
                {socketStatus === "online" ? "Online" : socketStatus === "connecting" ? "Conectando..." : "Offline"} · {activeChat.type === "group" ? "Miembros activos" : "Direct chat"}
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button type="button" className="h-8 w-8 rounded-full border border-white/10 bg-white/5 text-sm hover:bg-white/10" title="Buscar">
                🔍
              </button>
              <button type="button" className="h-8 w-8 rounded-full border border-white/10 bg-white/5 text-sm hover:bg-white/10" title="Info">
                ℹ
              </button>
              <Button
                variant="secondary"
                className="h-8 w-8 rounded-full p-0"
                onClick={() =>
                  activeChat.type === "group" ? loadGroupHistory(activeChat.id) : loadDmHistory(activeChat.id)
                }
                disabled={!canSend}
                title="Refresh"
              >
                ↻
              </Button>
            </div>
          </div>

          {socketNote ? (
            <div className="border-b border-[rgb(var(--border))] bg-[rgb(var(--panel2))] px-4 py-2 text-xs text-[rgb(var(--muted))]">
              {socketNote}
            </div>
          ) : null}

          <div ref={timelineRef} onScroll={onTimelineScroll} className="chat-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
            {loading ? <div className="text-sm text-[rgb(var(--muted))]">Cargando mensajes...</div> : null}
            {!loading && timelineItems.length === 0 ? (
              <div className="mx-auto mt-12 max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                <div className="mb-2 text-2xl">💬</div>
                <div className="text-sm font-semibold">No hay mensajes aún</div>
                <div className="text-xs text-[rgb(var(--muted))]">Envía el primer mensaje para iniciar esta conversación.</div>
              </div>
            ) : null}
            {!loading &&
              timelineItems.map((item) =>
                item.kind === "divider" ? (
                  <div key={item.id} className="flex justify-center py-1">
                    <span className="rounded-full border border-white/10 bg-[rgba(255,255,255,0.06)] px-3 py-[3px] text-[11px] text-[rgb(var(--muted))]">
                      {item.label}
                    </span>
                  </div>
                ) : (
                  renderMessageBubble(item.payload, orderedMessages.findIndex((msg) => msg.id === item.payload.id))
                )
              )}
            {typingPreview ? (
              <div className="text-xs text-[rgb(var(--muted))]">
                escribiendo<span className="animate-pulse">...</span>
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>
          {showScrollButton ? (
            <button
              type="button"
              onClick={() => scrollToBottom(true)}
              className="absolute bottom-24 right-6 z-10 h-10 w-10 rounded-full bg-[rgb(var(--primary))] text-white shadow-lg"
              title="Ir abajo"
            >
              ↓
            </button>
          ) : null}

          <form onSubmit={onSend} className="border-t p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]" style={{ borderColor: "rgba(255,255,255,0.06)", background: "#1a1d2e" }}>
            {selectedFile ? (
              <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-[rgb(var(--panel2))] px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{selectedFile.name}</div>
                  <div className="text-[11px] text-[rgb(var(--muted))]">{humanFileSize(selectedFile.size)}</div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  Quitar
                </Button>
              </div>
            ) : null}

            <div className="flex min-h-[56px] items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
              <Button
                type="button"
                variant="ghost"
                className="h-11 w-11 rounded-full p-0 opacity-40 hover:opacity-100"
                onClick={() => fileInputRef.current?.click()}
                disabled={!canSend || activeChat.type !== "dm"}
              >
                +
              </Button>
              <div className="flex-1 rounded-[24px] bg-[#0f1117] px-3 py-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] focus-within:shadow-[0_0_0_2px_rgba(99,102,241,0.45)]">
                <textarea
                  placeholder={
                    activeChat.type === "group"
                      ? "Escribe un mensaje..."
                      : activeChat.id
                        ? `Mensaje para @${activeChat.id}`
                        : "Abre un chat directo"
                  }
                  value={composer}
                  onChange={(e) => setComposer(e.target.value)}
                  disabled={!canSend || socketStatus === "blocked"}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onSend(e);
                    }
                  }}
                  rows={1}
                  className="chat-scrollbar max-h-28 w-full resize-none bg-transparent text-[14px] leading-[1.5] outline-none placeholder:text-[rgb(var(--muted))]"
                />
              </div>
              <Button
                className="h-11 w-11 rounded-full p-0"
                disabled={(!composer.trim() && !selectedFile) || !canSend || socketStatus === "blocked"}
              >
                →
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
