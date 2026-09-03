"use client";

import {useCallback, useEffect, useState, type FormEvent} from "react";
import {useRouter} from "next/navigation";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {gamesLabel} from "@/lib/match-rules";
import type {MatchView, PlayerView, RegistrationRequestView, SettingsView} from "@/lib/types";
import {readApi} from "@/lib/types";

export default function AdminPage() {
    const router = useRouter();
    const [ready, setReady] = useState(false);
    const [settings, setSettings] = useState<SettingsView | null>(null);
    const [players, setPlayers] = useState<PlayerView[]>([]);
    const [registrations, setRegistrations] = useState<RegistrationRequestView[]>([]);
    const [matches, setMatches] = useState<MatchView[]>([]);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        const session = await readApi<{ admin: boolean }>("/api/admin/session");
        if (!session.admin) {
            router.replace("/admin/login");
            return;
        }
        const [settingsData, playerData, registrationData, matchData] = await Promise.all([
            readApi<SettingsView>("/api/settings"),
            readApi<{ items: PlayerView[] }>("/api/admin/players"),
            readApi<{ items: RegistrationRequestView[] }>("/api/admin/registrations"),
            readApi<{ items: MatchView[] }>("/api/admin/matches"),
        ]);
        setSettings({...settingsData, joinCodeRequired: false});
        setPlayers(playerData.items);
        setRegistrations(registrationData.items);
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
                <RegistrationReview requests={registrations} onSave={load}/>
                <AddPlayerForm onSave={load}/>
                <FixtureDesk matches={matches} onSave={load}/>

                <section>
                    <h2 className="font-display text-2xl">Players</h2>
                    <div className="mt-3 overflow-hidden rounded-2xl border border-ink/10 bg-white">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-court text-white">
                            <tr>
                                <th className="px-3 py-2">Name</th>
                                <th className="px-3 py-2">Record</th>
                                <th className="px-3 py-2">Status</th>
                                <th className="px-3 py-2"/>
                            </tr>
                            </thead>
                            <tbody>
                            {players.map((player) => (
                                <tr key={player.id} className="border-t border-ink/5">
                                    <td className="px-3 py-2">{player.name}</td>
                                    <td className="px-3 py-2">{player.wins}–{player.losses}</td>
                                    <td className="px-3 py-2">{player.withdrawnAt ? "Withdrawn" : player.eliminatedAt ? "Eliminated" : "Active"}</td>
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
                                        <Button
                                            size="sm"
                                            variant="danger"
                                            onClick={async () => {
                                                if (!confirm(`Permanently delete ${player.name} and all of their matches? This cannot be undone.`)) {
                                                    return;
                                                }
                                                try {
                                                    setError(null);
                                                    await readApi(`/api/admin/players/${player.id}`, {method: "DELETE"});
                                                    await load();
                                                } catch (err) {
                                                    setError(err instanceof Error ? err.message : "Could not delete player.");
                                                }
                                            }}
                                        >
                                            Delete permanently
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
                  {match.round ? `Round ${match.round} · ` : ""}{match.playerA.name} vs {match.playerB.name} · {gamesLabel(match.games)} ·{" "}
                    {match.status}
                </span>
                                <span className="flex gap-2">
                                    {match.status === "VOID" ? (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={async () => {
                                                await readApi(`/api/matches/${match.id}/void`, {method: "DELETE"});
                                                await load();
                                            }}
                                        >
                                            Restore
                                        </Button>
                                    ) : (
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
                                    )}
                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </div>
    );
}

function RegistrationReview({
                                requests,
                                onSave,
                            }: {
    requests: RegistrationRequestView[];
    onSave: () => Promise<void>;
}) {
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function review(id: string, decision: "APPROVED" | "REJECTED") {
        setBusyId(id);
        setError(null);
        try {
            await readApi(`/api/admin/registrations/${id}`, {
                method: "PATCH",
                body: JSON.stringify({decision}),
            });
            await onSave();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not review registration.");
        } finally {
            setBusyId(null);
        }
    }

    return (
        <section className="space-y-3 rounded-2xl border border-ball/20 bg-white p-5">
            <div>
                <h2 className="font-display text-2xl">Registration requests</h2>
                <p className="text-sm text-ink/55">Approve coworkers before they appear in the tournament.</p>
            </div>
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            {requests.length ? (
                <ul className="divide-y divide-ink/10 overflow-hidden rounded-xl border border-ink/10">
                    {requests.map((request) => (
                        <li key={request.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                            <div>
                                <p className="font-semibold">{request.name}</p>
                                <p className="text-xs text-ink/50">
                                    {new Date(request.createdAt).toLocaleString()}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={busyId === request.id}
                                    onClick={() => review(request.id, "REJECTED")}
                                >
                                    Reject
                                </Button>
                                <Button
                                    size="sm"
                                    variant="court"
                                    disabled={busyId === request.id}
                                    onClick={() => review(request.id, "APPROVED")}
                                >
                                    Approve
                                </Button>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="rounded-xl border border-dashed border-ink/15 px-3 py-6 text-center text-sm text-ink/50">
                    No registrations are waiting for review.
                </p>
            )}
        </section>
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

    async function submit(event: FormEvent) {
        event.preventDefault();
        await readApi("/api/players", {
            method: "POST",
            body: JSON.stringify({firstName, lastName, approveImmediately: true}),
        });
        setFirstName("");
        setLastName("");
        await onSave();
    }

    return (
        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-ink/10 bg-white p-5">
            <h2 className="font-display text-2xl">Add player</h2>
            <div className="grid gap-3 sm:grid-cols-2">
                <Input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                       required/>
                <Input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required/>
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
            const result = await readApi<{
                created: number;
                round: number;
                byePlayerId: string | null
            }>("/api/admin/fixtures", {
                method: "POST",
            });
            setMessage(`Round ${result.round}: ${result.created} fixture${result.created === 1 ? "" : "s"} drawn.`);
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
                    <p className="text-sm text-ink/55">Pair the players still in the tournament.</p>
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
    const [g1a, setG1a] = useState("");
    const [g1b, setG1b] = useState("");
    const [g2a, setG2a] = useState("");
    const [g2b, setG2b] = useState("");
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
        <form onSubmit={submit} className="space-y-4 rounded-xl bg-paper p-4">
            <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-court">
                    {match.round ? `Round ${match.round}` : "Pending fixture"}
                </p>
                <p className="mt-1 font-semibold">{match.playerA.name} vs {match.playerB.name}</p>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full min-w-md text-sm">
                    <thead>
                    <tr className="text-left text-xs text-ink/55">
                        <th className="pb-2 font-medium">Player</th>
                        <th className="px-1 pb-2 text-center font-medium">Game 1</th>
                        <th className="px-1 pb-2 text-center font-medium">Game 2</th>
                        <th className="px-1 pb-2 text-center font-medium">Game 3 (if needed)</th>
                    </tr>
                    </thead>
                    <tbody>
                    <ScoreRow
                        name={match.playerA.name}
                        values={[g1a, g2a, g3a]}
                        onChange={[setG1a, setG2a, setG3a]}
                    />
                    <ScoreRow
                        name={match.playerB.name}
                        values={[g1b, g2b, g3b]}
                        onChange={[setG1b, setG2b, setG3b]}
                    />
                    </tbody>
                </table>
            </div>
            <p className="text-xs text-ink/50">Enter the final points for each game after the match is played.</p>
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <Button type="submit" size="sm" disabled={busy}>
                {busy ? "Saving…" : "Save result"}
            </Button>
        </form>
    );
}

function ScoreRow({
                      name,
                      values,
                      onChange,
                  }: {
    name: string;
    values: string[];
    onChange: ((value: string) => void)[];
}) {
    return (
        <tr>
            <th className="pr-3 py-1 text-left font-medium">{name}</th>
            {values.map((value, index) => (
                <td key={index} className="px-1 py-1">
                    <Input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        required={index < 2}
                        aria-label={`${name}, game ${index + 1}`}
                        placeholder="Points"
                        value={value}
                        onChange={(event) => onChange[index](event.target.value)}
                    />
                </td>
            ))}
        </tr>
    );
}

function toInputDate(value: string | Date | null | undefined) {
    if (!value) return "";
    const date = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
}
