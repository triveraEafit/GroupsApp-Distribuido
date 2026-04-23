import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createGroup, getMyGroups, joinGroup } from "@/shared/api/client";
import { Card } from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";

function avatarInitials(label) {
  const clean = String(label || "?").trim();
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

export default function Groups() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subscriptionMode, setSubscriptionMode] = useState("open");
  const [allowMemberInvites, setAllowMemberInvites] = useState(false);
  const [maxMembers, setMaxMembers] = useState("");
  const [joinId, setJoinId] = useState("");
  const [search, setSearch] = useState("");

  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [groups, setGroups] = useState([]);
  const [copiedGroupId, setCopiedGroupId] = useState(null);
  const [loadingGroups, setLoadingGroups] = useState(true);

  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingJoin, setLoadingJoin] = useState(false);

  const canCreate = name.trim().length > 0;
  const canJoin = /^\d+$/.test(joinId);
  const filteredGroups = groups.filter((group) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      String(group.id).includes(q) ||
      String(group.name || "").toLowerCase().includes(q) ||
      String(group.description || "").toLowerCase().includes(q)
    );
  });

  async function loadGroups() {
    setLoadingGroups(true);
    try {
      const data = await getMyGroups();
      setGroups(Array.isArray(data) ? data : []);
    } catch {
      setGroups([]);
    } finally {
      setLoadingGroups(false);
    }
  }

  useEffect(() => {
    loadGroups();
  }, []);

  async function onCreate(e) {
    e.preventDefault();
    if (!canCreate) return;

    setErr("");
    setOk("");
    setLoadingCreate(true);

    try {
      const payload = {
        name,
        description,
        subscription_mode: subscriptionMode,
        allow_member_invites: allowMemberInvites,
        max_members: maxMembers.trim() ? Number(maxMembers) : null,
      };
      const g = await createGroup(payload);
      await joinGroup(g.id).catch(() => null);
      await loadGroups();

      setOk(`Group created: #${g.id} ${g.name}`);

      setName("");
      setDescription("");
      setSubscriptionMode("open");
      setAllowMemberInvites(false);
      setMaxMembers("");

      setTimeout(() => {
        navigate(`/groups/${g.id}`);
      }, 450);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoadingCreate(false);
    }
  }

  async function onJoin(e) {
    e.preventDefault();
    if (!canJoin) {
      setErr("Group ID must be a number.");
      return;
    }

    setErr("");
    setOk("");
    setLoadingJoin(true);

    try {
      await joinGroup(Number(joinId));
      await loadGroups();

      setOk(`Joined group #${joinId}`);

      const id = joinId;
      setJoinId("");

      setTimeout(() => {
        navigate(`/groups/${id}`);
      }, 450);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoadingJoin(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-[rgb(var(--chat-main))] px-5 py-4">
        <h1 className="text-3xl font-bold tracking-[-0.02em] text-[rgb(var(--text))]">Groups</h1>
        <p className="mt-1 text-sm text-[rgb(var(--muted))]">
          Create a new group or join an existing one.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl border-white/10 bg-[#1a1d2e] p-7">
          <div className="mb-2 text-2xl text-[#6366f1]">👥</div>
          <h2 className="text-lg font-semibold text-white">Crear grupo</h2>
          <p className="mt-1 text-sm text-white/55">
            Start a new group for your team.
          </p>

          <form onSubmit={onCreate} className="mt-4 space-y-3">
            <input
              placeholder="e.g. Study Group"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 w-full rounded-xl border border-white/10 bg-[#0f1117] px-4 text-sm outline-none transition focus:border-[#6366f1] focus:ring-4 focus:ring-indigo-500/20"
            />

            <textarea
              placeholder="Short description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-xl border border-white/10 bg-[#0f1117] px-4 py-3 text-sm outline-none transition focus:border-[#6366f1] focus:ring-4 focus:ring-indigo-500/20"
            />

            <select
              value={subscriptionMode}
              onChange={(e) => setSubscriptionMode(e.target.value)}
              className="h-11 w-full rounded-xl border border-white/10 bg-[#0f1117] px-4 text-sm outline-none transition focus:border-[#6366f1] focus:ring-4 focus:ring-indigo-500/20"
            >
              <option value="open">Open</option>
              <option value="approval">Approval required</option>
              <option value="invite_only">Invite only</option>
            </select>

            <input
              placeholder="Máximo de miembros (opcional)"
              value={maxMembers}
              onChange={(e) => setMaxMembers(e.target.value)}
              inputMode="numeric"
              className="h-11 w-full rounded-xl border border-white/10 bg-[#0f1117] px-4 text-sm outline-none transition focus:border-[#6366f1] focus:ring-4 focus:ring-indigo-500/20"
            />

            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0f1117] px-4 py-3 text-sm text-white/75">
              <input
                type="checkbox"
                checked={allowMemberInvites}
                onChange={(e) => setAllowMemberInvites(e.target.checked)}
              />
              Permitir que miembros inviten a otros
            </label>

            <Button
              className="h-11 w-full rounded-xl bg-[linear-gradient(135deg,#6366f1,#7c3aed)] font-semibold"
              disabled={!canCreate || loadingCreate}
            >
              {loadingCreate ? "Creating..." : "Create"}
            </Button>
          </form>
        </Card>

        <Card className="rounded-2xl border-white/10 bg-[#1a1d2e] p-7">
          <div className="mb-2 text-2xl text-[#6366f1]">🔗</div>
          <h2 className="text-lg font-semibold text-white">Unirse a grupo</h2>
          <p className="mt-1 text-sm text-white/55">
            Enter a group ID to join.
          </p>

          <form onSubmit={onJoin} className="mt-4 space-y-3">
            <input
              placeholder="ID del grupo (ej: 12)"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              inputMode="numeric"
              className="h-11 w-full rounded-xl border border-white/10 bg-[#0f1117] px-4 text-sm outline-none transition focus:border-[#6366f1] focus:ring-4 focus:ring-indigo-500/20"
            />

            <Button
              className="h-11 w-full rounded-xl bg-[linear-gradient(135deg,#6366f1,#7c3aed)] font-semibold"
              disabled={!canJoin || loadingJoin}
            >
              {loadingJoin ? "Joining..." : "Join"}
            </Button>
            <p className="text-xs text-white/40">Pide el ID al administrador del grupo</p>
          </form>
        </Card>
      </div>

      {err && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {err}
        </div>
      )}

      {ok && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {ok}
        </div>
      )}

      <Card className="rounded-2xl border-white/10 bg-[#1a1d2e] p-5">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <h3 className="font-semibold text-white">Mis grupos</h3>
            <div className="mt-1 inline-flex rounded-full bg-indigo-500/20 px-2.5 py-1 text-xs font-semibold text-indigo-200">
              {groups.length} grupos
            </div>
          </div>
          <button
            type="button"
            onClick={loadGroups}
            disabled={loadingGroups}
            className="h-9 w-9 rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10 disabled:opacity-50"
            title="Refresh"
          >
            ↻
          </button>
        </div>

        <div className="mt-3">
          <div className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-[#0f1117] px-3 focus-within:border-[#6366f1] focus-within:ring-4 focus-within:ring-indigo-500/20">
            <span className="text-white/50">🔍</span>
            <input
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/40"
              placeholder="Search by ID, name or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 space-y-1">
          {loadingGroups ? (
            <div className="text-sm text-white/55">Loading your groups...</div>
          ) : null}

          {!loadingGroups && groups.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-center">
              <div className="text-3xl">👥</div>
              <div className="mt-2 text-sm font-semibold text-white">No tienes grupos aún</div>
              <Button className="mt-3" onClick={() => setName("Nuevo grupo")}>
                Crear mi primer grupo
              </Button>
            </div>
          ) : null}

          {!loadingGroups && groups.length > 0 && filteredGroups.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-white/55">
              No hay grupos para esa búsqueda.
            </div>
          ) : null}

          {!loadingGroups &&
            filteredGroups.map((group) => (
              <div
                key={group.id}
                className="flex items-center gap-3 border-b border-white/5 px-2 py-3 transition hover:bg-white/5"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundImage: avatarGradient(group.name) }}
                >
                  {avatarInitials(group.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">
                    #{group.id} {group.name}
                  </div>
                  <div className="truncate text-xs text-white/50">
                    {group.description || "No description"}
                  </div>
                </div>
                <div className="hidden items-center gap-2 md:flex">
                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard
                        .writeText(String(group.id))
                        .then(() => {
                          setCopiedGroupId(group.id);
                          setTimeout(() => setCopiedGroupId(null), 1200);
                          setOk(`Group ID #${group.id} copied`);
                        })
                        .catch(() => null)
                    }
                    className="relative h-8 w-8 rounded-lg border border-white/10 bg-white/5 text-sm text-white"
                    title={copiedGroupId === group.id ? "ID copiado ✓" : "Copiar ID"}
                  >
                    📋
                  </button>
                  <Button
                    variant="secondary"
                    className="h-8 rounded-lg border border-white/10 bg-transparent px-3 text-xs"
                    onClick={() => navigate(`/groups/${group.id}`)}
                  >
                    Detail
                  </Button>
                  <Button
                    className="h-8 rounded-lg bg-[linear-gradient(135deg,#6366f1,#7c3aed)] px-3 text-xs"
                    onClick={() => navigate(`/chat?group=${group.id}`)}
                  >
                    Chat →
                  </Button>
                </div>
                <div className="flex items-center gap-2 md:hidden">
                  <Button
                    className="h-8 rounded-lg bg-[linear-gradient(135deg,#6366f1,#7c3aed)] px-3 text-xs"
                    onClick={() => navigate(`/chat?group=${group.id}`)}
                  >
                    Chat
                  </Button>
                  <details className="relative">
                    <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white">
                      ⋯
                    </summary>
                    <div className="absolute right-0 z-10 mt-1 w-28 rounded-lg border border-white/10 bg-[#1a1d2e] p-1">
                      <button
                        type="button"
                        className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-white/10"
                        onClick={() =>
                          navigator.clipboard
                            .writeText(String(group.id))
                            .then(() => setOk(`Group ID #${group.id} copied`))
                            .catch(() => null)
                        }
                      >
                        Copy ID
                      </button>
                      <button
                        type="button"
                        className="mt-1 block w-full rounded px-2 py-1 text-left text-xs hover:bg-white/10"
                        onClick={() => navigate(`/groups/${group.id}`)}
                      >
                        Detail
                      </button>
                    </div>
                  </details>
                </div>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}
