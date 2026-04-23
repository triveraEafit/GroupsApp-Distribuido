import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Card } from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";
import {
  approveGroupMember,
  demoteGroupMember,
  getGroupFileDownloadUrl,
  getGroupMembers,
  getGroupMessages,
  getMyGroups,
  getUserIdFromToken,
  leaveGroup,
  promoteGroupMember,
  rejectGroupMember,
  removeGroupMember,
} from "@/shared/api/client";

function badgeClass(statusOrRole) {
  const value = String(statusOrRole || "").toLowerCase();
  if (value === "admin") return "bg-amber-500/15 text-amber-200 border-amber-400/20";
  if (value === "moderator") return "bg-sky-500/15 text-sky-200 border-sky-400/20";
  if (value === "active") return "bg-emerald-500/15 text-emerald-200 border-emerald-400/20";
  if (value === "pending") return "bg-yellow-500/15 text-yellow-200 border-yellow-400/20";
  if (value === "rejected") return "bg-rose-500/15 text-rose-200 border-rose-400/20";
  return "bg-white/5 text-white/70 border-white/10";
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function formatPreview(message) {
  if (!message) return "No messages yet.";
  if (message.file_name) return `📎 ${message.file_name}`;
  return message.content || "No messages yet.";
}

export default function GroupDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUserId = getUserIdFromToken();

  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");

  const currentMembership = useMemo(
    () => members.find((member) => Number(member.user_id) === Number(currentUserId)) || null,
    [members, currentUserId]
  );
  const isAdmin = currentMembership?.role === "admin";
  const canModerate = isAdmin || currentMembership?.role === "moderator";
  const pendingMembers = members.filter((member) => member.status === "pending");
  const activeMembers = members.filter((member) => member.status === "active");
  const recentMessages = messages.slice(-6).reverse();

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const [groups, groupMessages, groupMembers] = await Promise.all([
        getMyGroups(),
        getGroupMessages(id),
        getGroupMembers(id),
      ]);

      setGroup((groups || []).find((item) => String(item.id) === String(id)) || null);
      setMessages(Array.isArray(groupMessages) ? groupMessages : []);
      setMembers(Array.isArray(groupMembers) ? groupMembers : []);
    } catch (e) {
      setErr(e.message || "Could not load group details.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function runAction(key, action, successMessage) {
    setBusyKey(key);
    setErr("");
    setNotice("");
    try {
      await action();
      await load();
      setNotice(successMessage);
    } catch (e) {
      setErr(e.message || "Action failed.");
    } finally {
      setBusyKey("");
    }
  }

  async function onLeaveGroup() {
    setBusyKey("leave");
    setErr("");
    setNotice("");
    try {
      await leaveGroup(id);
      navigate("/groups");
    } catch (e) {
      setErr(e.message || "Could not leave the group.");
      setBusyKey("");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[rgb(var(--text))]">
            {group ? `${group.name} (#${group.id})` : `Group #${id}`}
          </h1>
          <p className="mt-1 text-sm text-[rgb(var(--muted))]">
            Administra miembros, solicitudes y el historial reciente del grupo.
          </p>
        </div>

        <div className="flex gap-2">
          <Link to="/groups">
            <Button variant="secondary">Back</Button>
          </Link>
          <Link to={`/chat?group=${id}`}>
            <Button>Open chat</Button>
          </Link>
        </div>
      </div>

      {err ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {notice}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="text-sm font-semibold text-[rgb(var(--text))]">Resumen</div>
          <p className="mt-2 text-sm text-[rgb(var(--muted))]">
            {group?.description || "No description available."}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="p-4">
              <div className="text-xs text-[rgb(var(--muted))]">Subscription</div>
              <div className="mt-1 text-lg font-semibold text-[rgb(var(--text))]">
                {group?.subscription_mode || "open"}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-[rgb(var(--muted))]">Members</div>
              <div className="mt-1 text-lg font-semibold text-[rgb(var(--text))]">
                {activeMembers.length}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-[rgb(var(--muted))]">Pending</div>
              <div className="mt-1 text-lg font-semibold text-[rgb(var(--text))]">
                {pendingMembers.length}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-[rgb(var(--muted))]">Max members</div>
              <div className="mt-1 text-lg font-semibold text-[rgb(var(--text))]">
                {group?.max_members ?? "∞"}
              </div>
            </Card>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass(currentMembership?.role)}`}>
              Tu rol: {currentMembership?.role || "member"}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass(currentMembership?.status)}`}>
              Estado: {currentMembership?.status || "unknown"}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/70">
              Invites: {group?.allow_member_invites ? "enabled" : "disabled"}
            </span>
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-semibold text-[rgb(var(--text))]">Actions</div>
          <p className="mt-2 text-sm text-[rgb(var(--muted))]">
            {canModerate
              ? "Este usuario puede aprobar solicitudes y moderar miembros."
              : "Puedes ver el estado del grupo y salir cuando quieras."}
          </p>
          <div className="mt-4 grid gap-2">
            <Button
              variant="secondary"
              onClick={load}
              disabled={loading || Boolean(busyKey)}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
            <Button
              variant="secondary"
              onClick={onLeaveGroup}
              disabled={busyKey === "leave"}
            >
              {busyKey === "leave" ? "Leaving..." : "Leave group"}
            </Button>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[rgb(var(--text))]">Members</div>
              <div className="mt-1 text-xs text-[rgb(var(--muted))]">
                Solicitudes pendientes y miembros activos del grupo.
              </div>
            </div>
            <div className="text-xs text-[rgb(var(--muted))]">
              {members.length} registros
            </div>
          </div>

          {loading ? (
            <div className="mt-4 text-sm text-[rgb(var(--muted))]">Loading members...</div>
          ) : null}

          {!loading && pendingMembers.length > 0 ? (
            <div className="mt-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-yellow-200/80">
                Pending requests
              </div>
              {pendingMembers.map((member) => (
                <div
                  key={`pending-${member.user_id}`}
                  className="rounded-2xl border border-yellow-500/15 bg-yellow-500/5 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[rgb(var(--text))]">@{member.username}</div>
                      <div className="mt-1 text-xs text-[rgb(var(--muted))]">
                        Requested: {formatDate(member.joined_at)}
                      </div>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass(member.status)}`}>
                      {member.status}
                    </span>
                  </div>
                  {canModerate ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        className="h-9"
                        disabled={busyKey === `approve-${member.user_id}`}
                        onClick={() =>
                          runAction(
                            `approve-${member.user_id}`,
                            () => approveGroupMember(id, member.user_id),
                            `Solicitud de @${member.username} aprobada.`
                          )
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        variant="secondary"
                        className="h-9"
                        disabled={busyKey === `reject-${member.user_id}`}
                        onClick={() =>
                          runAction(
                            `reject-${member.user_id}`,
                            () => rejectGroupMember(id, member.user_id),
                            `Solicitud de @${member.username} rechazada.`
                          )
                        }
                      >
                        Reject
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {!loading ? (
            <div className="mt-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-white/45">
                Active members
              </div>
              {activeMembers.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-[rgb(var(--muted))]">
                  No active members found.
                </div>
              ) : (
                activeMembers.map((member) => {
                  const isSelf = Number(member.user_id) === Number(currentUserId);
                  return (
                    <div
                      key={`member-${member.user_id}`}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[rgb(var(--text))]">
                            @{member.username} {isSelf ? "(tú)" : ""}
                          </div>
                          <div className="mt-1 text-xs text-[rgb(var(--muted))]">
                            Joined: {formatDate(member.joined_at)}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass(member.role)}`}>
                            {member.role}
                          </span>
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass(member.status)}`}>
                            {member.status}
                          </span>
                        </div>
                      </div>

                      {canModerate && !isSelf ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {isAdmin ? (
                            <>
                              {member.role !== "moderator" ? (
                                <Button
                                  variant="secondary"
                                  className="h-9"
                                  disabled={busyKey === `moderator-${member.user_id}`}
                                  onClick={() =>
                                    runAction(
                                      `moderator-${member.user_id}`,
                                      () => promoteGroupMember(id, member.user_id, "moderator"),
                                      `@${member.username} ahora es moderator.`
                                    )
                                  }
                                >
                                  Make moderator
                                </Button>
                              ) : null}
                              {member.role !== "admin" ? (
                                <Button
                                  variant="secondary"
                                  className="h-9"
                                  disabled={busyKey === `admin-${member.user_id}`}
                                  onClick={() =>
                                    runAction(
                                      `admin-${member.user_id}`,
                                      () => promoteGroupMember(id, member.user_id, "admin"),
                                      `@${member.username} ahora es admin.`
                                    )
                                  }
                                >
                                  Make admin
                                </Button>
                              ) : null}
                              {member.role !== "member" ? (
                                <Button
                                  variant="secondary"
                                  className="h-9"
                                  disabled={busyKey === `member-${member.user_id}`}
                                  onClick={() =>
                                    runAction(
                                      `member-${member.user_id}`,
                                      () => demoteGroupMember(id, member.user_id),
                                      `@${member.username} volvió a member.`
                                    )
                                  }
                                >
                                  Set member
                                </Button>
                              ) : null}
                            </>
                          ) : null}
                          <Button
                            variant="secondary"
                            className="h-9"
                            disabled={busyKey === `remove-${member.user_id}`}
                            onClick={() =>
                              runAction(
                                `remove-${member.user_id}`,
                                () => removeGroupMember(id, member.user_id),
                                `@${member.username} fue removido del grupo.`
                              )
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          ) : null}
        </Card>

        <Card className="p-5">
          <div className="text-sm font-semibold text-[rgb(var(--text))]">Recent messages</div>
          <div className="mt-1 text-xs text-[rgb(var(--muted))]">
            Vista rápida del historial más reciente del grupo.
          </div>
          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="text-sm text-[rgb(var(--muted))]">Loading messages...</div>
            ) : recentMessages.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-[rgb(var(--muted))]">
                No messages yet.
              </div>
            ) : (
              recentMessages.map((message) => (
                <div
                  key={message.id}
                  className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--panel2))] px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-xs text-[rgb(var(--muted))]">
                      User #{message.user_id}
                    </div>
                    <div className="text-[11px] text-[rgb(var(--muted))]">
                      {formatDate(message.created_at)}
                    </div>
                  </div>
                  <div className="mt-1 text-sm text-[rgb(var(--text))]">
                    {formatPreview(message)}
                  </div>
                  {message.file_name ? (
                    <a
                      href={getGroupFileDownloadUrl(message.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex rounded-lg bg-[rgb(var(--primary))] px-2.5 py-1 text-xs font-semibold text-white"
                    >
                      Abrir archivo
                    </a>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
