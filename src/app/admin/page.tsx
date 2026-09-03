"use client";

import {useCallback, useEffect, useState, type FormEvent} from "react";
import {useRouter} from "next/navigation";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {gamesLabel} from "@/lib/match-rules";
import type {MatchView, PlayerView, SettingsView} from "@/lib/types";
import {readApi} from "@/lib/types";

export default function AdminPage() {
    const router = useRouter();
    const [ready, setReady] = useState(false);
    const [settings, setSettings] = useState<SettingsView | null>(null);
    const [players, setPlayers] = useState<PlayerView[]>([]);
    const [matches, setMatches] = useState<MatchView[]>([]);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        const session = await readApi<{ admin: boolean }>("/api/admin/session");
        if (!session.admin) {
            router.replace("/admin/login");
            return;
        }
        const [settingsData, playerData, matchData] = await Promise.all([
            readApi<SettingsView>("/api/settings"),
            readApi<{ items: PlayerView[] }>("/api/admin/players"),
            readApi<{ items: MatchView[] }>("/api/admin/matches"),
        ]);
        setSettings({...settingsData, joinCodeRequired: false});
        setPlayers(playerData.items);
        setMatches(matchData.items);
        setReady(true);
    }, [router]);

    useEffect(() => {
        async function loadAdminData() {
            try {
                await load();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Request failed");
            }
        }

        void loadAdminData();
    }, [load]);

    if (!ready) {
        return <p className="p-8 text-sm text-ink/50">{error ?? "Loading…"}</p>;
    }

    return (
        <div className="min-h-full bg-paper p-6 text-ink">
            <div className="mx-auto max-w-5xl space-y-10">
                <header className="flex items-center justify-between">
                    <h1 className="font-display text-3xl">Tournament desk</h1>
                    <Button
                        variant="outline"
                        onClick={async () => {
                            await readApi("/api/admin/logout", {method: "POST"});
                            router.replace("/admin/login");
                        }}
                    >
                        Sign out
                    </Button>
                </header>

                {error ? <p className="text-sm text-red-700">{error}</p> : null}

                <SettingsForm settings={settings} onSave={load}/>
                <AddPlayerForm onSave={load}/>
                <FixtureDesk matches={matches} onSave={load}/>

                <section>
                    <h2 className="font-display text-2xl">Players</h2>
                    <div className="mt-3 overflow-hidden rounded-2xl border border-ink/10 bg-white">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-court text-white">
                            <tr>
                                <th className="px-3 py-2">Name</th>
                                <th className="px-3 py-2">Elo</th>
                                <th className="px-3 py-2">Status</th>
                                <th className="px-3 py-2"/>
                            </tr>
                            </thead>
                            <tbody>
                            {players.map((player) => (
                                <tr key={player.id} className="border-t border-ink/5">
                                    <td className="px-3 py-2">{player.name}</td>
                                    <td className="px-3 py-2">{player.elo}</td>
                                    <td className="px-3 py-2">{player.withdrawnAt ? "Withdrawn" : "Active"}</td>
                                    <td className="px-3 py-2 text-right">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={async () => {
                                                await readApi(`/api/players/${player.id}`, {
                                                    method: "PATCH",
                                                    body: JSON.stringify({withdrawn: !player.withdrawnAt}),
                                                });
                                                await load();
                                            }}
                                        >
                                            {player.withdrawnAt ? "Restore" : "Withdraw"}
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section>
                    <h2 className="font-display text-2xl">Match history</h2>
                    <ul className="mt-3 space-y-2">
                        {matches.filter((match) => match.status !== "PENDING").map((match) => (
                            <li
                                key={match.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm"
                            >
                <span>
                  {match.playerA.name} vs {match.playerB.name} · {gamesLabel(match.games)} ·{" "}
                    {match.status}
                </span>
                                <span className="flex gap-2">
                  {match.status === "PENDING" ? (
                      <Button
                          size="sm"
                          onClick={async () => {
                              await readApi(`/api/matches/${match.id}/confirm`, {method: "POST"});
                              await load();
                          }}
                      >
                          Confirm
                      </Button>
                  ) : null}
                                    {match.status !== "VOID" ? (
                                        <Button
                                            size="sm"
                                            variant="danger"
                                            onClick={async () => {
                                                await readApi(`/api/matches/${match.id}/void`, {method: "POST"});
                                                await load();
                                            }}
                                        >
                                            Void
                                        </Button>
                                    ) : null}
                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </div>
    );
}

function SettingsForm({
                          settings,
                          onSave,
                      }: {
    settings: SettingsView | null;
    onSave: () => Promise<void>;
}) {
    const [eventName, setEventName] = useState(settings?.eventName ?? "");
    const [registrationOpen, setRegistrationOpen] = useState(settings?.registrationOpen ?? true);
    const [startDate, setStartDate] = useState(toInputDate(settings?.startDate));
    const [endDate, setEndDate] = useState(toInputDate(settings?.endDate));

    async function submit(event: FormEvent) {
        event.preventDefault();
        await readApi("/api/settings", {
            method: "PATCH",
            body: JSON.stringify({
                eventName,
                registrationOpen,
                startDate: startDate || null,
                endDate: endDate || null,
            }),
        });
        await onSave();
    }

    return (
        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-ink/10 bg-white p-5">
            <h2 className="font-display text-2xl">Event</h2>
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <Label htmlFor="eventName">Name</Label>
                    <Input id="eventName" value={eventName} onChange={(e) => setEventName(e.target.value)}/>
                </div>
                <label className="flex items-center gap-2 pt-6 text-sm">
                    <input
                        type="checkbox"
                        checked={registrationOpen}
                        onChange={(e) => setRegistrationOpen(e.target.checked)}
                    />
                    Registration open
                </label>
                <div className="space-y-1.5">
                    <Label htmlFor="start">Start</Label>
                    <Input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}/>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="end">End</Label>
                    <Input id="end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}/>
                </div>
            </div>
            <Button type="submit" size="sm">
                Save event
            </Button>
        </form>
    );
}

function AddPlayerForm({onSave}: { onSave: () => Promise<void> }) {
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [department, setDepartment] = useState("");

    async function submit(event: FormEvent) {
        event.preventDefault();
        await readApi("/api/players", {
            method: "POST",
            body: JSON.stringify({firstName, lastName, department}),
        });
        setFirstName("");
        setLastName("");
        setDepartment("");
        await onSave();
    }

    return (
        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-ink/10 bg-white p-5">
            <h2 className="font-display text-2xl">Add player</h2>
            <div className="grid gap-3 sm:grid-cols-3">
                <Input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                       required/>
                <Input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required/>
                <Input placeholder="Department" value={department} onChange={(e) => setDepartment(e.target.value)}/>
            </div>
            <Button type="submit" size="sm">
                Add
            </Button>
        </form>
    );
}

function FixtureDesk({
                         matches,
                         onSave,
                     }: {
    matches: MatchView[];
    onSave: () => Promise<void>;
}) {
    const fixtures = matches.filter((match) => match.status === "PENDING");
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    async function drawFixtures() {
        setBusy(true);
        setMessage(null);
        try {
            const result = await readApi<{ created: number; byePlayerId: string | null }>("/api/admin/fixtures", {
                method: "POST",
            });
            setMessage(`${result.created} fixture${result.created === 1 ? "" : "s"} drawn.`);
            await onSave();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : "Could not draw fixtures.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="space-y-3 rounded-2xl border border-ink/10 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="font-display text-2xl">Fixture draw</h2>
                    <p className="text-sm text-ink/55">Randomly pair all active players.</p>
                </div>
                <Button type="button" size="sm" onClick={drawFixtures} disabled={busy || fixtures.length > 0}>
                    {busy ? "Drawing…" : "Draw fixtures"}
                </Button>
            </div>
            {message ? <p className="text-sm text-ink/70">{message}</p> : null}
            {fixtures.length > 0 ? (
                <div className="space-y-3">
                    {fixtures.map((match) => (
                        <FixtureResultForm key={match.id} match={match} onSave={onSave}/>
                    ))}
                </div>
            ) : (
                <p className="rounded-xl border border-dashed border-ink/15 px-3 py-6 text-center text-sm text-ink/50">
                    No active fixtures. Draw when registrations are ready.
                </p>
            )}
        </section>
    );
}

function FixtureResultForm({match, onSave}: { match: MatchView; onSave: () => Promise<void> }) {
    const [g1a, setG1a] = useState("11");
    const [g1b, setG1b] = useState("7");
    const [g2a, setG2a] = useState("11");
    const [g2b, setG2b] = useState("9");
    const [g3a, setG3a] = useState("");
    const [g3b, setG3b] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function submit(event: FormEvent) {
        event.preventDefault();
        setBusy(true);
        setError(null);
        const games = [
            {a: Number(g1a), b: Number(g1b)},
            {a: Number(g2a), b: Number(g2b)},
        ];
        if (g3a !== "" && g3b !== "") {
            games.push({a: Number(g3a), b: Number(g3b)});
        }
        try {
            await readApi(`/api/admin/fixtures/${match.id}/result`, {
                method: "POST",
                body: JSON.stringify({games}),
            });
            await onSave();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save result.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <form onSubmit={submit} className="space-y-3 rounded-xl bg-paper p-4">
            <p className="font-semibold">{match.playerA.name} vs {match.playerB.name}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                <Input aria-label="Game 1 player A" value={g1a} onChange={(e) => setG1a(e.target.value)}/>
                <Input aria-label="Game 1 player B" value={g1b} onChange={(e) => setG1b(e.target.value)}/>
                <Input aria-label="Game 2 player A" value={g2a} onChange={(e) => setG2a(e.target.value)}/>
                <Input aria-label="Game 2 player B" value={g2b} onChange={(e) => setG2b(e.target.value)}/>
                <Input placeholder="G3 A" value={g3a} onChange={(e) => setG3a(e.target.value)}/>
                <Input placeholder="G3 B" value={g3b} onChange={(e) => setG3b(e.target.value)}/>
            </div>
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <Button type="submit" size="sm" disabled={busy}>
                {busy ? "Saving…" : "Save result"}
            </Button>
        </form>
    );
}

function toInputDate(value: string | Date | null | undefined) {
    if (!value) return "";
    const date = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
}
