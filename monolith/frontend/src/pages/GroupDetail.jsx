import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card } from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";
import { getGroupMessages, getMyGroups } from "@/shared/api/client";

export default function GroupDetail() {
  const { id } = useParams();
  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [groups, groupMessages] = await Promise.all([
          getMyGroups(),
          getGroupMessages(id),
        ]);

        setGroup((groups || []).find((item) => String(item.id) === String(id)) || null);
        setMessages(Array.isArray(groupMessages) ? groupMessages : []);
      } catch (e) {
        setErr(e.message || "Could not load group details.");
      }
    }

    load();
  }, [id]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[rgb(var(--text))]">
            {group ? `${group.name} (#${group.id})` : `Group #${id}`}
          </h1>
          <p className="mt-1 text-sm text-[rgb(var(--muted))]">
            Built from <code className="rounded bg-[rgb(var(--panel2))] px-1">GET /groups/my-groups</code> and message history.
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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="text-sm font-semibold text-[rgb(var(--text))]">About</div>
          <p className="mt-2 text-sm text-[rgb(var(--muted))]">
            {group?.description || "No description available."}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Card className="p-4">
              <div className="text-xs text-[rgb(var(--muted))]">Owner ID</div>
              <div className="mt-1 text-lg font-semibold text-[rgb(var(--text))]">
                {group?.owner_id ?? "—"}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-[rgb(var(--muted))]">Messages</div>
              <div className="mt-1 text-lg font-semibold text-[rgb(var(--text))]">
                {messages.length}
              </div>
            </Card>
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-semibold text-[rgb(var(--text))]">Actions</div>
          <p className="mt-2 text-sm text-[rgb(var(--muted))]">
            When messaging exists, you can pin, mute, or manage members here.
          </p>
          <div className="mt-4 grid gap-2">
            <Button variant="secondary" disabled>
              Add member
            </Button>
            <Button variant="secondary" disabled>
              Leave group
            </Button>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="text-sm font-semibold text-[rgb(var(--text))]">Messages</div>
        <div className="mt-3 space-y-2">
          {messages.length === 0 ? (
            <p className="text-sm text-[rgb(var(--muted))]">
              No messages yet.
            </p>
          ) : (
            messages.slice(-5).map((message) => (
              <div
                key={message.id}
                className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--panel2))] px-3 py-2"
              >
                <div className="text-xs text-[rgb(var(--muted))]">
                  User #{message.user_id}
                </div>
                <div className="mt-1 text-sm text-[rgb(var(--text))]">{message.content}</div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
