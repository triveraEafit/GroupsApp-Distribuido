import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { Input } from "@/shared/ui/Input";
import {
  addGroupContact,
  createGroupChannel,
  createGroup,
  deleteGroupContact,
  getCurrentUsername,
  getGroupChannels,
  getGroupDistribution,
  getDirectHistory,
  getDirectFileDownloadUrl,
  getGroupContacts,
  getGroupFileDownloadUrl,
  getGroupMembers,
  getGroupMessages,
  getMyGroups,
  getUnreadDirectMessages,
  getUserIdFromToken,
  joinGroup,
  markGroupMessagesRead,
  markDirectMessagesAsRead,
  uploadFileToGroup,
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

function groupReceiptLabel(summary) {
  if (!summary || !summary.total_recipients) return null;
  if (summary.read_count >= summary.total_recipients) return { icon: "✓✓", className: "text-sky-200", label: `Leido por ${summary.read_count}/${summary.total_recipients}` };
  if (summary.delivered_count > 0) return { icon: "✓✓", className: "text-white/75", label: `Entregado a ${summary.delivered_count}/${summary.total_recipients}` };
  return { icon: "✓", className: "text-white/75", label: `Entregado a 0/${summary.total_recipients}` };
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

function IconSearch({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function IconGroups({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconChats({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 10h10" />
      <path d="M7 14h7" />
      <path d="M21 12c0 4.97-4.03 9-9 9a9.9 9.9 0 0 1-4.6-1.1L3 21l1.28-4.05A8.95 8.95 0 0 1 3 12c0-4.97 4.03-9 9-9s9 4.03 9 9Z" />
    </svg>
  );
}

function IconCompose({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  );
}

function IconPlus({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function IconSettings({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15.1a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .74 1.7 1.7 0 0 0-.2 1.2V21.5a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-.99-1.57A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 3 15a1.7 1.7 0 0 0-.74-1 1.7 1.7 0 0 0-1.2-.2H1.5a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.57-.99A1.7 1.7 0 0 0 3 7a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 7 3a1.7 1.7 0 0 0 1-.74 1.7 1.7 0 0 0 .2-1.2V1.5a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 .99 1.57A1.7 1.7 0 0 0 17 3a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 21 7a1.7 1.7 0 0 0 .74 1 1.7 1.7 0 0 0 1.2.2h.09a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.57.99A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>
  );
}

export default function Chat() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialGroupId = Number(searchParams.get("group") || "");
  const initialDm = searchParams.get("dm") || "";

  const currentUserId = getUserIdFromToken();
  const currentUsername = getCurrentUsername() || (currentUserId ? `User #${currentUserId}` : "Session");

  const [groups, setGroups] = useState([]);
  const [recentDmUsernames, setRecentDmUsernames] = useState(loadRecentDmUsernames);
  const [groupMessages, setGroupMessages] = useState([]);
  const [dmMessages, setDmMessages] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [groupContacts, setGroupContacts] = useState([]);
  const [groupChannels, setGroupChannels] = useState([]);
  const [activeChannelByGroup, setActiveChannelByGroup] = useState({});
  const [groupDistribution, setGroupDistribution] = useState(null);
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
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDescription, setNewChannelDescription] = useState("");
  const [sidebarMode, setSidebarMode] = useState(initialDm ? "dms" : "groups");
  const [socketStatus, setSocketStatus] = useState("offline");
  const [socketNote, setSocketNote] = useState("");
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [typingPreview, setTypingPreview] = useState(false);
  const [bubbleActionId, setBubbleActionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [contactBusyKey, setContactBusyKey] = useState("");
  const [error, setError] = useState("");

  const wsRef = useRef(null);
  const bottomRef = useRef(null);
  const timelineRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastChatKeyRef = useRef("");

  const activeGroup = groups.find((group) => Number(group.id) === Number(activeChat.id));
  const activeGroupContacts = useMemo(() => new Set(groupContacts.map((contact) => Number(contact.user_id))), [groupContacts]);
  const activeChannelId = activeChat.type === "group" ? activeChannelByGroup[activeChat.id] || null : null;
  const activeChannel = useMemo(
    () => groupChannels.find((channel) => Number(channel.id) === Number(activeChannelId)) || groupChannels.find((channel) => channel.is_default) || null,
    [groupChannels, activeChannelId]
  );
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

  const searchedMessages = useMemo(() => {
    const query = chatSearch.trim().toLowerCase();
    if (!query) return activeMessages;
    return activeMessages.filter((item) => {
      const sender = activeChat.type === "group" ? item.username || resolveUsername(item.user_id) : item.sender_id === currentUserId ? currentUsername : activeChat.id;
      return [
        item.content,
        item.file_name,
        sender,
      ].some((value) => String(value || "").toLowerCase().includes(query));
    });
  }, [activeMessages, chatSearch, activeChat.type, activeChat.id, currentUserId, currentUsername]);

  const timelineItems = useMemo(() => {
    const sorted = [...searchedMessages].sort((a, b) => {
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
  }, [searchedMessages]);

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
              preview: last?.file_name ? `📎 ${last.file_name}` : last?.content || "Sin mensajes",
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
              preview: last?.file_name ? `📎 ${last.file_name}` : last?.content || "Sin mensajes",
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

  async function loadGroupContext(groupId) {
    if (!groupId) {
      setGroupMembers([]);
      setGroupContacts([]);
      setGroupChannels([]);
      setGroupDistribution(null);
      return;
    }
    try {
      const [members, contacts, channels, distribution] = await Promise.all([
        getGroupMembers(groupId),
        getGroupContacts(groupId),
        getGroupChannels(groupId),
        getGroupDistribution(groupId),
      ]);
      const memberList = Array.isArray(members) ? members : [];
      const contactList = Array.isArray(contacts) ? contacts : [];
      const channelList = Array.isArray(channels) ? channels : [];
      setGroupMembers(memberList);
      setGroupContacts(contactList);
      setGroupChannels(channelList);
      setGroupDistribution(distribution || null);
      setActiveChannelByGroup((prev) => {
        const existing = prev[groupId];
        const fallback = channelList.find((channel) => channel.is_default)?.id || channelList[0]?.id || null;
        return existing && channelList.some((channel) => Number(channel.id) === Number(existing))
          ? prev
          : { ...prev, [groupId]: fallback };
      });
      for (const member of memberList) {
        tokenStorage.rememberKnownUser(member.user_id, member.username);
      }
      for (const contact of contactList) {
        tokenStorage.rememberKnownUser(contact.user_id, contact.username);
      }
    } catch {
      setGroupMembers([]);
      setGroupContacts([]);
      setGroupChannels([]);
      setGroupDistribution(null);
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

  async function loadGroupHistory(groupId, options = {}) {
    const { silent = false, channelId = activeChannelByGroup[groupId] || null } = options;
    if (!groupId) {
      setGroupMessages([]);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const data = await getGroupMessages(groupId, channelId);
      const items = Array.isArray(data) ? data : [];
      setGroupMessages(items);
      for (const item of items) {
        if (item.username) tokenStorage.rememberKnownUser(item.user_id, item.username);
      }
      await markGroupMessagesRead(groupId, null, channelId).catch(() => null);
    } catch (e) {
      setError(e.message || "No se pudo cargar el grupo");
      if (!silent) setGroupMessages([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function loadDmHistory(username, options = {}) {
    const { silent = false } = options;
    if (!username) {
      setDmMessages([]);
      return;
    }
    if (!silent) setLoading(true);
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
      if (!silent) setDmMessages([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  function refreshActiveChat() {
    if (!canSend) return Promise.resolve();
    return activeChat.type === "group"
      ? loadGroupHistory(activeChat.id, { silent: true, channelId: activeChannelByGroup[activeChat.id] || null })
      : loadDmHistory(activeChat.id, { silent: true });
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
      loadGroupHistory(activeChat.id, { channelId: activeChannelByGroup[activeChat.id] || null });
      loadGroupContext(activeChat.id);
    } else {
      loadDmHistory(activeChat.id);
      setGroupMembers([]);
      setGroupContacts([]);
      setShowInfoPanel(false);
    }
  }, [activeChat.type, activeChat.id]);

  useEffect(() => {
    if (activeChat.type !== "group" || !activeChat.id) return;
    loadGroupHistory(activeChat.id, { channelId: activeChannelByGroup[activeChat.id] || null });
  }, [activeChat.type, activeChat.id, activeChannelByGroup[activeChat.id]]);

  useEffect(() => {
    if (!canSend) return;
    const refresh = () => {
      if (document.hidden) return;
      refreshActiveChat();
    };
    const intervalId = window.setInterval(refresh, 2200);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [activeChat.type, activeChat.id, canSend]);

  useEffect(() => {
    if (!canSend) {
      setSocketStatus("offline");
      return;
    }

    wsRef.current?.close();
    setSocketStatus("connecting");

    const path =
      activeChat.type === "group"
        ? `/groups/ws/${activeChat.id}${activeChannelByGroup[activeChat.id] ? `?channel_id=${encodeURIComponent(activeChannelByGroup[activeChat.id])}` : ""}`
        : `/groups/dm/ws/${encodeURIComponent(activeChat.id)}`;

    const client = new TextWebSocketClient(path, {
      onOpen: () => {
        setSocketStatus("online");
        setError("");
        refreshActiveChat();
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
        if (payload?.type === "group_receipt" && payload?.message_id) {
          setGroupMessages((prev) =>
            prev.map((message) =>
              message.id === payload.message_id
                ? { ...message, receipt_summary: payload.receipt_summary || message.receipt_summary }
                : message
            )
          );
          return;
        }
        if (payload?.type === "dm_message" && payload?.message_id) {
          setDmMessages((prev) => {
            const nextMessage = {
              id: payload.message_id,
              content: payload.content,
              sender_id: payload.sender_id,
              receiver_id: payload.receiver_id,
              created_at: payload.created_at,
              is_read: payload.is_read,
              file_name: payload.file_name,
              file_path: payload.file_path,
              file_size: payload.file_size,
              file_type: payload.file_type,
              file_checksum: payload.file_checksum,
              storage_provider: payload.storage_provider,
            };
            const exists = prev.some((message) => Number(message.id) === Number(payload.message_id));
            if (exists) {
              return prev.map((message) =>
                Number(message.id) === Number(payload.message_id) ? { ...message, ...nextMessage } : message
              );
            }
            return [...prev, nextMessage];
          });
          if (payload.sender_username) {
            tokenStorage.rememberKnownUser(payload.sender_id, payload.sender_username);
            rememberDm(payload.sender_username);
          }
          if (Number(payload.sender_id) !== Number(currentUserId)) {
            markDirectMessagesAsRead(activeChat.id).catch(() => null);
          }
          loadUnreadDms();
          computeDmMeta([activeChat.id]);
          return;
        }
        if (activeChat.type === "group") {
          if ((payload?.type === "group_message" || payload?.type === "group_file") && payload?.message_id) {
            const selectedChannelId = activeChannelByGroup[activeChat.id] || null;
            if (selectedChannelId && Number(payload.channel_id || 0) !== Number(selectedChannelId)) {
              computeGroupMeta(groups);
              return;
            }
            if (payload.username) {
              tokenStorage.rememberKnownUser(payload.user_id, payload.username);
            }
            setGroupMessages((prev) => {
              const exists = prev.some((message) => message.id === payload.id || message.id === payload.message_id);
              if (exists) {
                return prev.map((message) =>
                  message.id === payload.id || message.id === payload.message_id ? { ...message, ...payload, id: payload.id || payload.message_id } : message
                );
              }
              return [...prev, { ...payload, id: payload.id || payload.message_id }];
            });
            if (Number(payload.user_id) !== Number(currentUserId)) {
              markGroupMessagesRead(activeChat.id, payload.message_id, activeChannelByGroup[activeChat.id] || null).catch(() => null);
            }
          } else {
            loadGroupHistory(activeChat.id, { silent: true, channelId: activeChannelByGroup[activeChat.id] || null });
          }
        } else {
          if (text.startsWith("[Sistema]")) setSocketNote(text);
          loadDmHistory(activeChat.id);
        }
      },
    });

    client.connect();
    wsRef.current = client;

    return () => client.close();
  }, [activeChat.type, activeChat.id, canSend, activeChannelByGroup[activeChat.id], groups]);

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
    if (selectedFile) {
      try {
        if (activeChat.type === "dm") {
          await uploadFileToUser(activeChat.id, selectedFile);
          await loadDmHistory(activeChat.id, { silent: true });
        } else {
          await uploadFileToGroup(activeChat.id, selectedFile, activeChannelByGroup[activeChat.id] || null);
          await loadGroupHistory(activeChat.id, { silent: true, channelId: activeChannelByGroup[activeChat.id] || null });
        }
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (e) {
        setError(e.message || "Error subiendo archivo");
      }
    }

    if (text) {
      try {
        wsRef.current?.send(text);
        window.setTimeout(() => {
          refreshActiveChat();
        }, 180);
        window.setTimeout(() => {
          refreshActiveChat();
        }, 900);
      } catch (e) {
        setError(e.message || "No se pudo enviar el mensaje");
      }
    }
    setComposer("");
  }

  async function onCreateChannel(event) {
    event.preventDefault();
    if (!activeChat.id || !newChannelName.trim()) return;
    try {
      const created = await createGroupChannel(activeChat.id, {
        name: newChannelName.trim(),
        description: newChannelDescription.trim(),
      });
      await loadGroupContext(activeChat.id);
      setActiveChannelByGroup((prev) => ({ ...prev, [activeChat.id]: created.id }));
      setNewChannelName("");
      setNewChannelDescription("");
      setSocketNote(`Canal #${created.name} creado`);
    } catch (e) {
      setError(e.message || "No se pudo crear el canal");
    }
  }

  function startDirectChat() {
    const username = newDmInput.trim();
    if (!username) return;
    rememberDm(username);
    setSidebarMode("dms");
    setShowGroupPanel(false);
    setShowJoinPanel(false);
    setShowInfoPanel(false);
    setActiveChat({ type: "dm", id: username });
    setMobilePane("chat");
    setNewDmInput("");
  }

  function openGroup(groupId) {
    setSidebarMode("groups");
    setShowInfoPanel(false);
    setChatSearch("");
    setGroupDistribution(null);
    setActiveChat({ type: "group", id: groupId });
    setMobilePane("chat");
  }

  function openDm(username) {
    rememberDm(username);
    setSidebarMode("dms");
    setShowInfoPanel(false);
    setChatSearch("");
    setGroupChannels([]);
    setGroupDistribution(null);
    setActiveChat({ type: "dm", id: username });
    setMobilePane("chat");
  }

  async function addContact(member) {
    if (!activeChat.id || !member?.username) return;
    const key = `add-${member.user_id}`;
    setContactBusyKey(key);
    try {
      await addGroupContact(activeChat.id, member.username);
      await loadGroupContext(activeChat.id);
      setSocketNote(`@${member.username} agregado a tus contactos del grupo`);
    } catch (e) {
      setError(e.message || "No se pudo agregar el contacto");
    } finally {
      setContactBusyKey("");
    }
  }

  async function removeContact(contact) {
    if (!activeChat.id || !contact?.user_id) return;
    const key = `remove-${contact.user_id}`;
    setContactBusyKey(key);
    try {
      await deleteGroupContact(activeChat.id, contact.user_id);
      await loadGroupContext(activeChat.id);
      setSocketNote(`@${contact.username} removido de tus contactos del grupo`);
    } catch (e) {
      setError(e.message || "No se pudo quitar el contacto");
    } finally {
      setContactBusyKey("");
    }
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
        ? message.username || resolveUsername(message.user_id)
        : isMine
          ? "Tú"
          : `@${activeChat.id}`;
    const hasFile = Boolean(message.file_name && message.file_path);
    const showsOnlyAttachmentLabel =
      hasFile && message.content === `📎 File attachment: ${message.file_name}`;
    const receipt = receiptsByMessageId[message.id];
    const readState =
      !isMine
        ? null
        : activeChat.type === "dm"
          ? receipt?.read_at || message.is_read
            ? { icon: "✓✓", className: "text-sky-200", label: "Leido" }
            : receipt?.delivered_at
              ? { icon: "✓✓", className: "text-white/75", label: "Entregado" }
              : { icon: "✓", className: "text-white/75", label: "Enviado" }
          : groupReceiptLabel(message.receipt_summary);

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
                href={activeChat.type === "group" ? getGroupFileDownloadUrl(message.id) : getDirectFileDownloadUrl(message.id)}
                target="_blank"
                rel="noopener noreferrer"
                className={["text-[11px] rounded-lg px-2 py-1 font-semibold", isMine ? "bg-white/20" : "bg-[rgb(var(--primary))] text-white"].join(" ")}
              >
                Abrir
              </a>
            </div>
          </div>
        ) : null}
        {message.content && !showsOnlyAttachmentLabel ? (
          <div className="mt-1.5 whitespace-pre-wrap break-words text-[14px] leading-[1.5]">{message.content}</div>
        ) : null}
        <div className={["mt-1.5 flex items-center justify-end gap-1 text-[11px] opacity-70", isMine ? "text-white/85" : "text-[rgb(var(--muted))]"].join(" ")}>
          <span>{formatTime(message.created_at)}</span>
          {readState ? <span className={readState.className} title={readState.label}>{readState.icon}</span> : null}
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

  const visibleSidebarItems = sidebarMode === "groups" ? filteredGroups : filteredDms;
  const activeGroupCount = groupMembers.filter((member) => member.status === "active").length;

  return (
    <div className="h-[calc(100dvh-7.5rem)] min-h-[620px] overflow-hidden">
      {error ? (
        <div className="mb-3 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid h-full gap-3 overflow-hidden lg:grid-cols-[420px_minmax(0,1fr)] 2xl:grid-cols-[460px_minmax(0,1fr)]">
        <Card
          className={[
            "min-h-0 overflow-hidden p-0",
            mobilePane === "list" ? "flex" : "hidden",
            "lg:flex",
          ].join(" ")}
          style={{ background: "rgb(var(--chat-sidebar))", borderColor: "rgba(255,255,255,0.05)", boxShadow: "0 28px 70px rgba(0,0,0,0.16)" }}
        >
          <div className="grid min-h-0 flex-1 grid-cols-[78px_minmax(0,1fr)]">
            <div className="flex flex-col items-center gap-3 border-r border-white/6 bg-[linear-gradient(180deg,rgba(0,122,255,0.12),transparent_22%,transparent)] px-3 py-4">
              <button
                type="button"
                className={[
                  "flex h-12 w-12 items-center justify-center rounded-2xl border transition",
                  sidebarMode === "groups"
                    ? "border-transparent bg-[linear-gradient(135deg,rgba(var(--primary),0.9),rgba(var(--primary2),0.9))] text-white shadow-[0_14px_30px_rgba(0,122,255,0.28)]"
                    : "border-white/10 bg-white/5 text-[rgb(var(--muted))] hover:bg-white/10 hover:text-[rgb(var(--text))]",
                ].join(" ")}
                onClick={() => setSidebarMode("groups")}
                title="Grupos"
              >
                <IconGroups className="h-5 w-5" />
              </button>
              <button
                type="button"
                className={[
                  "flex h-12 w-12 items-center justify-center rounded-2xl border transition",
                  sidebarMode === "dms"
                    ? "border-transparent bg-[linear-gradient(135deg,rgba(var(--primary),0.9),rgba(var(--primary2),0.9))] text-white shadow-[0_14px_30px_rgba(0,122,255,0.28)]"
                    : "border-white/10 bg-white/5 text-[rgb(var(--muted))] hover:bg-white/10 hover:text-[rgb(var(--text))]",
                ].join(" ")}
                onClick={() => setSidebarMode("dms")}
                title="Chats directos"
              >
                <IconChats className="h-5 w-5" />
              </button>
              <div className="mt-2 h-px w-9 bg-white/10" />
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[rgb(var(--text))] transition hover:bg-white/10"
                onClick={() => sidebarMode === "groups" ? setShowGroupPanel((prev) => !prev) : setNewDmInput("")}
                title={sidebarMode === "groups" ? "Nuevo grupo" : "Nuevo chat"}
              >
                {sidebarMode === "groups" ? <IconPlus className="h-4 w-4" /> : <IconCompose className="h-4 w-4" />}
              </button>
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[rgb(var(--text))] transition hover:bg-white/10"
                onClick={() => navigate("/settings")}
                title="Settings"
              >
                <IconSettings className="h-4 w-4" />
              </button>
            </div>

            <div className="flex min-h-0 flex-col p-3">
              <div className="px-1 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h1 className="text-[26px] font-extrabold tracking-[-0.03em]">
                      {sidebarMode === "groups" ? "Grupos" : "Chats"}
                    </h1>
                    <p className="text-xs text-[rgb(var(--muted))] opacity-80">Conectado como @{currentUsername}</p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[rgb(var(--text))] transition hover:bg-white/10"
                    onClick={() => navigate("/settings")}
                    title="Settings"
                  >
                    <IconSettings className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="px-1">
                <div className="relative">
                  <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--muted))]" />
                  <Input
                    placeholder={sidebarMode === "groups" ? "Buscar grupos..." : "Buscar chats..."}
                    value={sidebarSearch}
                    onChange={(e) => setSidebarSearch(e.target.value)}
                    className="rounded-2xl border-white/10 bg-[#0f1117]/90 py-3 pl-11"
                  />
                </div>
              </div>

              <div className="mt-3 px-1">
                {sidebarMode === "dms" ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      startDirectChat();
                    }}
                    className="flex items-center gap-2 rounded-[22px] border border-white/10 bg-white/5 p-2"
                  >
                    <Input
                      placeholder="Nuevo chat por username"
                      value={newDmInput}
                      onChange={(e) => setNewDmInput(e.target.value)}
                      className="border-none bg-transparent shadow-none"
                    />
                    <Button className="h-11 rounded-2xl px-4" disabled={!newDmInput.trim()}>
                      Abrir
                    </Button>
                  </form>
                ) : (
                  <div className="grid gap-2">
                    <button
                      type="button"
                      className="flex items-center gap-3 rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-semibold transition hover:bg-white/10"
                      onClick={() => {
                        setShowGroupPanel((prev) => !prev);
                        setShowJoinPanel(false);
                      }}
                    >
                      <IconPlus className="h-4 w-4" />
                      Nuevo grupo
                    </button>
                    <button
                      type="button"
                      className="flex items-center gap-3 rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-semibold transition hover:bg-white/10"
                      onClick={() => {
                        setShowJoinPanel((prev) => !prev);
                        setShowGroupPanel(false);
                      }}
                    >
                      <IconCompose className="h-4 w-4" />
                      Unirse por ID
                    </button>
                  </div>
                )}
              </div>

              {showGroupPanel ? (
                <form
                  onSubmit={onCreateGroup}
                  className="mx-1 mt-3 space-y-2 rounded-[22px] border border-white/10 bg-[#111726] p-3 shadow-2xl"
                >
                  <Input
                    placeholder="Nombre del grupo"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="border-none bg-[#0b111d]"
                  />
                  <Input
                    placeholder="Descripción (opcional)"
                    value={newGroupDescription}
                    onChange={(e) => setNewGroupDescription(e.target.value)}
                    className="border-none bg-[#0b111d]"
                  />
                  <Button className="w-full rounded-2xl" disabled={!newGroupName.trim()}>
                    Crear grupo
                  </Button>
                </form>
              ) : null}

              {showJoinPanel ? (
                <form
                  onSubmit={onJoinGroup}
                  className="mx-1 mt-3 flex items-center gap-2 rounded-[22px] border border-white/10 bg-[#111726] p-3 shadow-2xl"
                >
                  <Input
                    placeholder="ID del grupo"
                    value={joinGroupId}
                    onChange={(e) => setJoinGroupId(e.target.value)}
                    inputMode="numeric"
                    className="border-none bg-[#0b111d]"
                  />
                  <Button className="shrink-0 rounded-2xl" disabled={!joinGroupId.trim()}>
                    Unir
                  </Button>
                </form>
              ) : null}

              <div className="mt-4 px-1">
                <div className="rounded-full border border-white/10 bg-white/5 p-1">
                  <div className="grid grid-cols-2 gap-1 text-xs font-semibold">
                    <button
                      type="button"
                      className={["rounded-full px-3 py-2 transition", sidebarMode === "groups" ? "bg-white text-slate-900" : "text-[rgb(var(--muted))]"].join(" ")}
                      onClick={() => setSidebarMode("groups")}
                    >
                      Grupos
                    </button>
                    <button
                      type="button"
                      className={["rounded-full px-3 py-2 transition", sidebarMode === "dms" ? "bg-white text-slate-900" : "text-[rgb(var(--muted))]"].join(" ")}
                      onClick={() => setSidebarMode("dms")}
                    >
                      DM
                    </button>
                  </div>
                </div>
              </div>

              <div className="chat-scrollbar mt-4 min-h-0 flex-1 overflow-y-auto px-1">
                <div className="mb-2 flex items-center justify-between px-2 text-[10px] uppercase tracking-[0.14em] text-white/35">
                  <span>{sidebarMode === "groups" ? "Group spaces" : "Direct messages"}</span>
                  <span>{visibleSidebarItems.length}</span>
                </div>
                <div className="space-y-2 pb-3">
                  {sidebarMode === "groups" ? (
                    filteredGroups.map((group) => {
                      const active = activeChat.type === "group" && Number(activeChat.id) === Number(group.id);
                      const meta = groupMetaById[group.id] || { preview: "Sin mensajes", time: null };
                      return (
                        <button
                          key={`group-${group.id}`}
                          onClick={() => openGroup(group.id)}
                          className={[
                            "w-full rounded-[22px] border px-3 py-3 text-left transition-all duration-150",
                            active
                              ? "border-[rgba(var(--primary),0.55)] bg-[linear-gradient(135deg,rgba(var(--primary),0.16),rgba(var(--primary2),0.12))] shadow-[0_18px_36px_rgba(0,122,255,0.16)]"
                              : "border-white/6 bg-white/5 hover:bg-white/10",
                          ].join(" ")}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[12px] font-semibold text-white shadow-[0_12px_24px_rgba(0,0,0,0.18)]"
                              style={{ backgroundImage: avatarGradient(group.name) }}
                            >
                              {avatarInitials(group.name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="truncate text-sm font-semibold">{group.name}</div>
                                <div className="text-[11px] text-[rgb(var(--muted))]">{formatTime(meta.time)}</div>
                              </div>
                              <div className="mt-0.5 truncate text-[12px] text-[rgb(var(--muted))]">{meta.preview}</div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    filteredDms.map((username) => {
                      const active = activeChat.type === "dm" && activeChat.id === username;
                      const unreadCount = unreadByDm[username] || 0;
                      const meta = dmMetaByUsername[username] || { preview: "Sin mensajes", time: null };
                      return (
                        <button
                          key={`dm-${username}`}
                          onClick={() => openDm(username)}
                          className={[
                            "w-full rounded-[22px] border px-3 py-3 text-left transition-all duration-150",
                            active
                              ? "border-[rgba(var(--primary),0.55)] bg-[linear-gradient(135deg,rgba(var(--primary),0.16),rgba(var(--primary2),0.12))] shadow-[0_18px_36px_rgba(0,122,255,0.16)]"
                              : "border-white/6 bg-white/5 hover:bg-white/10",
                          ].join(" ")}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[12px] font-semibold text-white shadow-[0_12px_24px_rgba(0,0,0,0.18)]"
                              style={{ backgroundImage: avatarGradient(username) }}
                            >
                              {avatarInitials(username)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="truncate text-sm font-semibold">@{username}</div>
                                <div className="text-[11px] text-[rgb(var(--muted))]">{formatTime(meta.time)}</div>
                              </div>
                              <div className="mt-0.5 truncate text-[12px] text-[rgb(var(--muted))]">{meta.preview}</div>
                            </div>
                            {unreadCount > 0 ? (
                              <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-[rgb(var(--primary))] px-2 py-1 text-[10px] font-bold text-white">
                                {unreadCount}
                              </span>
                            ) : (
                              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 online-pulse" />
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                  {visibleSidebarItems.length === 0 ? (
                    <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-[rgb(var(--muted))]">
                      No hay resultados para esa busqueda.
                    </div>
                  ) : null}
                </div>
              </div>
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
          <div className="flex items-center gap-3 border-b px-5 py-4" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(var(--chat-main),0.88)" }}>
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
                {socketStatus === "online" ? "Online" : socketStatus === "connecting" ? "Conectando..." : "Offline"} · {activeChat.type === "group" ? `${activeGroupCount} miembros activos${activeChannel ? ` · #${activeChannel.name}` : ""}` : "Direct chat"}
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                className={["flex h-10 w-10 items-center justify-center rounded-2xl border text-sm transition", showChatSearch ? "border-[rgba(var(--primary),0.55)] bg-[rgba(var(--primary),0.16)] text-white" : "border-white/10 bg-white/5 hover:bg-white/10"].join(" ")}
                title="Buscar"
                onClick={() => setShowChatSearch((prev) => !prev)}
              >
                <IconSearch className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm transition hover:bg-white/10"
                title="Info"
                onClick={() => setShowInfoPanel((prev) => !prev)}
              >
                <IconGroups className="h-4 w-4" />
              </button>
              <Button
                variant="secondary"
                className="h-10 w-10 rounded-2xl p-0"
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

          {activeChat.type === "group" && groupChannels.length > 0 ? (
            <div className="border-b border-white/6 px-5 py-3">
              <div className="chat-scrollbar flex gap-2 overflow-x-auto pb-1">
                {groupChannels.map((channel) => (
                  <button
                    key={`channel-pill-${channel.id}`}
                    type="button"
                    className={[
                      "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                      Number((activeChannelByGroup[activeChat.id] || activeChannel?.id)) === Number(channel.id)
                        ? "border-[rgba(var(--primary),0.5)] bg-[rgba(var(--primary),0.18)] text-white"
                        : "border-white/10 bg-white/5 text-[rgb(var(--muted))] hover:bg-white/10 hover:text-[rgb(var(--text))]",
                    ].join(" ")}
                    onClick={() => setActiveChannelByGroup((prev) => ({ ...prev, [activeChat.id]: channel.id }))}
                  >
                    #{channel.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {showChatSearch ? (
            <div className="border-b border-white/6 px-5 py-3">
              <div className="relative">
                <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--muted))]" />
                <Input
                  placeholder="Buscar dentro del chat por texto, archivo o remitente..."
                  value={chatSearch}
                  onChange={(e) => setChatSearch(e.target.value)}
                  className="rounded-2xl border-white/10 bg-[#0f1117]/70 py-3 pl-11"
                />
              </div>
            </div>
          ) : null}

          {socketNote ? (
            <div className="border-b border-[rgb(var(--border))] bg-[rgb(var(--panel2))] px-4 py-2 text-xs text-[rgb(var(--muted))]">
              {socketNote}
            </div>
          ) : null}

          {showInfoPanel && activeChat.type === "group" ? (
            <div className="absolute inset-y-0 right-0 z-20 w-full max-w-[360px] border-l border-white/10 bg-[#151827] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold">Grupo y contactos</div>
                  <div className="text-xs text-[rgb(var(--muted))]">
                    Contactos visibles estilo libreta del grupo
                  </div>
                </div>
                <Button variant="ghost" className="h-8 w-8 p-0" onClick={() => setShowInfoPanel(false)}>
                  ×
                </Button>
              </div>

              <div className="chat-scrollbar h-[calc(100%-61px)] overflow-y-auto px-4 py-4">
                <div className="mb-3 text-[10px] uppercase tracking-[0.1em] text-white/40">Canales</div>
                <div className="space-y-2">
                  {groupChannels.map((channel) => (
                    <button
                      key={`channel-panel-${channel.id}`}
                      type="button"
                      className={[
                        "w-full rounded-xl border px-3 py-3 text-left transition",
                        Number((activeChannelByGroup[activeChat.id] || activeChannel?.id)) === Number(channel.id)
                          ? "border-[rgba(var(--primary),0.55)] bg-[rgba(var(--primary),0.16)]"
                          : "border-white/10 bg-white/5 hover:bg-white/10",
                      ].join(" ")}
                      onClick={() => {
                        setActiveChannelByGroup((prev) => ({ ...prev, [activeChat.id]: channel.id }));
                        setShowInfoPanel(false);
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">#{channel.name}</div>
                          <div className="text-[11px] text-[rgb(var(--muted))]">
                            shard {channel.partition_slot} · {channel.replica_group}
                          </div>
                        </div>
                        {channel.is_default ? <span className="text-[10px] text-cyan-300">default</span> : null}
                      </div>
                    </button>
                  ))}
                </div>

                <form onSubmit={onCreateChannel} className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="mb-2 text-[10px] uppercase tracking-[0.1em] text-white/40">Nuevo canal</div>
                  <Input
                    placeholder="Nombre del canal"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    className="border-white/10 bg-[#0f1117]/80"
                  />
                  <Input
                    placeholder="Descripcion corta"
                    value={newChannelDescription}
                    onChange={(e) => setNewChannelDescription(e.target.value)}
                    className="mt-2 border-white/10 bg-[#0f1117]/80"
                  />
                  <Button className="mt-2 w-full rounded-xl" disabled={!newChannelName.trim()}>
                    Crear canal
                  </Button>
                </form>

                {groupDistribution ? (
                  <div className="mt-4 rounded-xl border border-cyan-400/15 bg-cyan-500/5 px-3 py-3">
                    <div className="text-[10px] uppercase tracking-[0.1em] text-cyan-300">Distribucion</div>
                    <div className="mt-2 text-xs text-[rgb(var(--muted))]">
                      Etcd: {groupDistribution.coordination_healthy ? "online" : "offline"} · shards: {groupDistribution.shard_count} · replicas: {groupDistribution.replication_factor}
                    </div>
                    <div className="mt-1 text-xs text-[rgb(var(--muted))]">
                      Grupo en shard {groupDistribution.group_partition_slot} · {groupDistribution.group_replica_group}
                    </div>
                  </div>
                ) : null}

                <div className="mb-3 text-[10px] uppercase tracking-[0.1em] text-white/40">Mis contactos</div>
                <div className="space-y-2">
                  {groupContacts.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-[rgb(var(--muted))]">
                      Aun no tienes contactos guardados en este grupo.
                    </div>
                  ) : (
                    groupContacts.map((contact) => (
                      <div key={`contact-${contact.user_id}`} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold">@{contact.username}</div>
                            <div className="text-[11px] text-[rgb(var(--muted))]">Contacto del grupo</div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => openDm(contact.username)}>
                              Chat
                            </Button>
                            <Button
                              variant="ghost"
                              className="h-8 px-2 text-xs"
                              onClick={() => removeContact(contact)}
                              disabled={contactBusyKey === `remove-${contact.user_id}`}
                            >
                              Quitar
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mb-3 mt-5 text-[10px] uppercase tracking-[0.1em] text-white/40">Miembros del grupo</div>
                <div className="space-y-2">
                  {groupMembers
                    .filter((member) => member.status === "active")
                    .map((member) => {
                      const isSelf = Number(member.user_id) === Number(currentUserId);
                      const isContact = activeGroupContacts.has(Number(member.user_id));
                      return (
                        <div key={`member-panel-${member.user_id}`} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold">
                                @{member.username} {isSelf ? "(tú)" : ""}
                              </div>
                              <div className="mt-1 flex gap-2 text-[11px] text-[rgb(var(--muted))]">
                                <span>{member.role}</span>
                                <span>•</span>
                                <span>{member.status}</span>
                              </div>
                            </div>
                            {!isSelf ? (
                              <div className="flex flex-wrap justify-end gap-2">
                                <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => openDm(member.username)}>
                                  Chat
                                </Button>
                                {isContact ? (
                                  <Button
                                    variant="ghost"
                                    className="h-8 px-2 text-xs"
                                    onClick={() => removeContact(member)}
                                    disabled={contactBusyKey === `remove-${member.user_id}`}
                                  >
                                    Quitar
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    className="h-8 px-2 text-xs"
                                    onClick={() => addContact(member)}
                                    disabled={contactBusyKey === `add-${member.user_id}`}
                                  >
                                    Contacto
                                  </Button>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          ) : null}

          <div ref={timelineRef} onScroll={onTimelineScroll} className="chat-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
            {loading ? <div className="text-sm text-[rgb(var(--muted))]">Cargando mensajes...</div> : null}
            {!loading && timelineItems.length === 0 ? (
              <div className="mx-auto mt-12 max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                <div className="mb-2 text-2xl">💬</div>
                <div className="text-sm font-semibold">{chatSearch.trim() ? "No hubo coincidencias" : "No hay mensajes aún"}</div>
                <div className="text-xs text-[rgb(var(--muted))]">{chatSearch.trim() ? "Prueba otra palabra clave." : "Envía el primer mensaje para iniciar esta conversación."}</div>
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
                disabled={!canSend}
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
