"use client";

import {CircleDot, Pencil, Trophy, X} from "lucide-react";
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type FormEvent,
    type ReactNode,
} from "react";
import {Button} from "@/components/ui/button";
import {Dialog, DialogContent} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {gamesLabel} from "@/lib/match-rules";
import type {MatchView, PlayerView, SettingsView} from "@/lib/types";
import {readApi} from "@/lib/types";
import {formatDate} from "@/lib/utils";

type PageResponse<T> = {
    items: T[];
    nextOffset: number | null;
    total?: number;
};

export function TournamentPage() {
    const [settings, setSettings] = useState<SettingsView | null>(null);
    const [me, setMe] = useState<PlayerView | null>(null);
    const [rankings, setRankings] = useState<PlayerView[]>([]);
    const [rankOffset, setRankOffset] = useState<number | null>(0);
    const [matches, setMatches] = useState<MatchView[]>([]);
    const [fixtures, setFixtures] = useState<MatchView[]>([]);
    const [matchOffset, setMatchOffset] = useState<number | null>(0);
    const [error, setError] = useState<string | null>(null);
    const [registerOpen, setRegisterOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [selected, setSelected] = useState<PlayerView | null>(null);

    const loadMe = useCallback(async () => {
        const data = await readApi<{ settings: SettingsView; me: PlayerView | null }>("/api/me");
        setSettings(data.settings);
        setMe(data.me);
    }, []);

    const loadRankings = useCallback(async (offset: number, append: boolean) => {
        const data = await readApi<PageResponse<PlayerView>>(`/api/players?offset=${offset}&limit=20`);
        setRankings((current) => (append ? [...current, ...data.items] : data.items));
        setRankOffset(data.nextOffset);
    }, []);

    const loadMatches = useCallback(async (offset: number, append: boolean) => {
        const data = await readApi<PageResponse<MatchView>>(`/api/matches?offset=${offset}&limit=20`);
        setMatches((current) => (append ? [...current, ...data.items] : data.items));
        setMatchOffset(data.nextOffset);
    }, []);

    const loadFixtures = useCallback(async () => {
        const data = await readApi<{ items: MatchView[] }>("/api/matches?fixtures=1");
        setFixtures(data.items);
    }, []);

    const refreshAll = useCallback(async () => {
        await loadMe();
        await Promise.all([loadRankings(0, false), loadMatches(0, false), loadFixtures()]);
    }, [loadMe, loadRankings, loadMatches, loadFixtures]);

    useEffect(() => {
        async function loadInitialData() {
            try {
                await refreshAll();
            } catch (err) {
                setError(publicErrorMessage(err));
            }
        }

        void loadInitialData();
    }, [refreshAll]);

    const rankSentinel = useInfinite(rankOffset, (offset) => loadRankings(offset, true));
    const matchSentinel = useInfinite(matchOffset, (offset) => loadMatches(offset, true));

    return (
        <div className="min-h-full bg-paper text-ink">
            <header className="sticky top-0 z-40 border-b border-ink/10 bg-paper/90 backdrop-blur">
                <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
                    <a href="#top" className="flex items-center gap-2 font-display text-lg">
                        <CircleDot className="h-5 w-5 text-ball"/>
                        {publicEventName(settings)}
                    </a>
                    <nav className="hidden items-center gap-5 text-sm font-medium sm:flex">
                        <a href="#rankings" className="hover:text-ball">Sıralama</a>
                        <a href="#matches" className="hover:text-ball">Fikstür</a>
                        <a href="#rules" className="hover:text-ball">Kurallar</a>
                    </nav>
                    {me && !me.withdrawnAt ? (
                        <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                            <Pencil className="h-3.5 w-3.5"/>
                            Bilgilerim
                        </Button>
                    ) : (
                        <Button size="sm" onClick={() => setRegisterOpen(true)}
                                disabled={settings?.registrationOpen === false}>
                            Ben de varım!
                        </Button>
                    )}
                </div>
            </header>

            <main id="top">
                <Hero settings={settings} onJoin={() => setRegisterOpen(true)} listed={Boolean(me && !me.withdrawnAt)}/>

                {error ? (
                    <p className="mx-auto max-w-5xl px-4 pt-4 text-sm text-red-700">{error}</p>
                ) : null}

                {me ? (
                    <section className="mx-auto max-w-5xl px-4 pt-8">
                        <div className="rounded-2xl border border-court/20 bg-white p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-court">
                                {me.withdrawnAt ? "Sahadan çekildin" : "Hikâyedeki yerin hazır"}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                                <h2 className="font-display text-2xl">{me.name}</h2>
                                <div className="flex gap-2">
                                    {me.withdrawnAt ? (
                                        <Button
                                            size="sm"
                                            variant="court"
                                            onClick={async () => {
                                                await readApi(`/api/players/${me.id}`, {
                                                    method: "PATCH",
                                                    body: JSON.stringify({withdrawn: false}),
                                                });
                                                await refreshAll();
                                            }}
                                        >
                                            Yeniden sahadayım
                                        </Button>
                                    ) : (
                                        <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)}>
                                            Düzenle / ayrıl
                                        </Button>
                                    )}
                                </div>
                            </div>
                            {!me.withdrawnAt ? (
                                <p className="mt-2 text-sm text-ink/60">
                                    Elo {me.elo} · {me.wins}G–{me.losses}M
                                    {me.rank ? ` · ${me.rank}. sıra` : ""}
                                </p>
                            ) : null}
                        </div>
                    </section>
                ) : null}

                <section id="rankings" className="mx-auto max-w-5xl px-4 py-16">
                    <SectionTitle
                        icon={<Trophy className="h-5 w-5 text-ball"/>}
                        title="Sıralama"
                        subtitle="Kurada rakibini bul, maçını oyna, zirveye tırman."
                    />
                    <div className="mt-6 overflow-hidden rounded-2xl border border-ink/10 bg-white">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-court text-white">
                            <tr>
                                <th className="px-4 py-3 font-medium">#</th>
                                <th className="px-4 py-3 font-medium">Oyuncu</th>
                                <th className="px-4 py-3 font-medium">Elo</th>
                                <th className="hidden px-4 py-3 font-medium sm:table-cell">G–M</th>
                                <th className="hidden px-4 py-3 font-medium sm:table-cell">Seri</th>
                            </tr>
                            </thead>
                            <tbody>
                            {rankings.map((player) => (
                                <tr
                                    key={player.id}
                                    className="cursor-pointer border-t border-ink/5 hover:bg-paper"
                                    onClick={() => setSelected(player)}
                                >
                                    <td className="px-4 py-3 font-display text-lg">{player.rank}</td>
                                    <td className="px-4 py-3">
                                        <div className="font-semibold">
                                            {player.name}
                                            {me?.id === player.id ? (
                                                <span className="ml-2 text-xs font-medium text-ball">sen</span>
                                            ) : null}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 font-semibold">{player.elo}</td>
                                    <td className="hidden px-4 py-3 sm:table-cell">
                                        {player.wins}–{player.losses}
                                    </td>
                                    <td className="hidden px-4 py-3 sm:table-cell">{streakLabel(player.streak)}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                        {rankings.length === 0 ? (
                            <p className="px-4 py-10 text-center text-ink/50">
                                Masa hazır, ilk raketini bekliyor. Sen de hikâyeye katıl!
                            </p>
                        ) : null}
                        <div ref={rankSentinel} className="h-8"/>
                    </div>
                </section>

                <section id="matches" className="mx-auto max-w-5xl px-4 pb-16">
                    <SectionTitle title="Fikstür" subtitle="Kura sonucu belirlenen sıradaki karşılaşmalar."/>
                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                        {fixtures.map((match) => (
                            <article key={match.id} className="rounded-2xl border border-court/20 bg-white px-4 py-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-court">Sıradaki maç</p>
                                <p className="mt-1 font-semibold">
                                    {match.playerA.name} <span
                                    className="mx-2 text-ink/30">-</span> {match.playerB.name}
                                </p>
                            </article>
                        ))}
                        {fixtures.length === 0 ? (
                            <p className="rounded-2xl border border-dashed border-ink/15 px-4 py-8 text-center text-ink/50 sm:col-span-2">
                                Yeni eşleşmeler için kura bekleniyor.
                            </p>
                        ) : null}
                    </div>
                </section>

                <section className="mx-auto max-w-5xl px-4 pb-16">
                    <SectionTitle title="Maç Günlüğü" subtitle="Onaylanan mücadeleler, en yeniden en eskiye."/>
                    <div className="mt-6 space-y-3">
                        {matches.map((match) => (
                            <article key={match.id} className="rounded-2xl border border-ink/10 bg-white px-4 py-4">
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <p className="font-semibold">
                                        <button className="hover:text-ball" onClick={() => setSelected(match.playerA)}>
                                            {match.playerA.name}
                                        </button>
                                        <span className="mx-2 text-ink/30">-</span>
                                        <button className="hover:text-ball" onClick={() => setSelected(match.playerB)}>
                                            {match.playerB.name}
                                        </button>
                                    </p>
                                    <p className="text-xs text-ink/50">{formatDate(match.confirmedAt)}</p>
                                </div>
                                <p className="mt-1 text-sm text-ink/70">
                                    {gamesLabel(match.games)}
                                    {match.winnerId ? (
                                        <span className="ml-2 text-court">
                      Kazanan: {match.winnerId === match.playerA.id ? match.playerA.name : match.playerB.name}
                    </span>
                                    ) : null}
                                </p>
                            </article>
                        ))}
                        {matches.length === 0 ? (
                            <p className="rounded-2xl border border-dashed border-ink/15 px-4 py-10 text-center text-ink/50">
                                Henüz anlatılacak bir maç yok. İlk sayıyı kim alacak?
                            </p>
                        ) : null}
                        <div ref={matchSentinel} className="h-8"/>
                    </div>
                </section>

                <Rules/>
            </main>

            <footer className="border-t border-ink/10 py-8 text-center text-xs text-ink/40">
                Furkan Atak
            </footer>

            <RegisterDialog
                open={registerOpen}
                onOpenChange={setRegisterOpen}
                onDone={refreshAll}
            />
            <EditDialog
                key={`${me?.id ?? "none"}-${editOpen}`}
                player={me}
                open={editOpen}
                onOpenChange={setEditOpen}
                onDone={refreshAll}
            />
            <PlayerDialog
                key={selected?.id ?? "closed"}
                player={selected}
                me={me}
                onClose={() => setSelected(null)}
                onEdit={() => {
                    setSelected(null);
                    setEditOpen(true);
                }}
            />
        </div>
    );
}

function Hero({
                  settings,
                  onJoin,
                  listed,
              }: {
    settings: SettingsView | null;
    onJoin: () => void;
    listed: boolean;
}) {
    const dates = [formatDate(settings?.startDate), formatDate(settings?.endDate)]
        .filter(Boolean)
        .join(" – ");
    return (
        <section className="relative overflow-hidden bg-court text-white">
            <div className="pointer-events-none absolute inset-0 opacity-30">
                <div className="absolute inset-y-0 left-1/2 w-px bg-white"/>
                <div
                    className="absolute top-1/2 left-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"/>
                <div className="absolute top-0 left-0 h-full w-24 border-r-2 border-white/40"/>
                <div className="absolute top-0 right-0 h-full w-24 border-l-2 border-white/40"/>
            </div>
            <div className="relative mx-auto max-w-5xl px-4 py-20 sm:py-28">
                <p className="text-sm font-semibold tracking-[0.2em] text-ball uppercase">Ofis ligi</p>
                <h1 className="mt-3 max-w-xl font-display text-5xl leading-none sm:text-6xl">
                    {publicEventName(settings)}
                </h1>
                <p className="mt-4 max-w-lg text-white/80">
                    Ofisin raketleri sahneye çıkıyor. Adını listeye yazdır; rakibini kura belirlesin.
                    Maçlar oynandıkça sıralamadaki hikâyen şekillensin.
                </p>
                {dates ? <p className="mt-2 text-sm text-white/60">{dates}</p> : null}
                {!listed && settings?.registrationOpen !== false ? (
                    <Button className="mt-8" size="lg" onClick={onJoin}>
                        Ben de varım!
                    </Button>
                ) : null}
            </div>
        </section>
    );
}

function Rules() {
    return (
        <section id="rules" className="border-t border-ink/10 bg-white">
            <div className="mx-auto max-w-5xl px-4 py-16">
                <SectionTitle title="Masanın Kuralları" subtitle="Keyifli, hızlı ve adil bir mücadele."/>
                <ol className="mt-8 grid gap-4 sm:grid-cols-2">
                    {[
                        ["Set sayısı", "11 sayıya ilk ulaşan oyuncu seti kazanır."],
                        ["Uzatma", "10–10'dan sonra 2 sayı fark oluşana kadar devam edilir. 12'de sınır yok."],
                        ["Servis", "Servis her 2 sayıda bir değişir. 10–10'dan sonra her sayıda el değiştirir."],
                        ["Maç formatı", "2 set kazanan maçı alır. Skor 2–0 ise üçüncü set oynanmaz."],
                    ].map(([title, body]) => (
                        <li key={title} className="rounded-2xl border border-ink/10 bg-paper p-5">
                            <p className="font-display text-xl">{title}</p>
                            <p className="mt-2 text-sm text-ink/70">{body}</p>
                        </li>
                    ))}
                </ol>
                <p className="mt-6 text-sm text-ink/50">
                    Eşleşmeler kura ile belirlenir, maç sonuçları turnuva yöneticisi tarafından kaydedilir.
                </p>
            </div>
        </section>
    );
}

function SectionTitle({
                          title,
                          subtitle,
                          icon,
                      }: {
    title: string;
    subtitle: string;
    icon?: ReactNode;
}) {
    return (
        <div>
            <div className="flex items-center gap-2">
                {icon}
                <h2 className="font-display text-3xl">{title}</h2>
            </div>
            <p className="mt-1 text-sm text-ink/55">{subtitle}</p>
        </div>
    );
}

function streakLabel(streak: number) {
    if (streak > 0) return `G${streak}`;
    if (streak < 0) return `M${Math.abs(streak)}`;
    return "—";
}

function useInfinite(nextOffset: number | null, load: (offset: number) => Promise<void>) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (nextOffset === null) return;
        const node = ref.current;
        if (!node) return;
        const observer = new IntersectionObserver((entries) => {
            if (entries[0]?.isIntersecting) {
                load(nextOffset).catch(() => undefined);
            }
        });
        observer.observe(node);
        return () => observer.disconnect();
    }, [nextOffset, load]);
    return ref;
}

function RegisterDialog({
                            open,
                            onOpenChange,
                            onDone,
                        }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onDone: () => Promise<void>;
}) {
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function submit(event: FormEvent) {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
            await readApi("/api/players", {
                method: "POST",
                body: JSON.stringify({firstName, lastName}),
            });
            onOpenChange(false);
            setFirstName("");
            setLastName("");
            await onDone();
        } catch (err) {
            setError(publicErrorMessage(err, "Turnuvaya katılım tamamlanamadı."));
        } finally {
            setBusy(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent title="Ben de varım!" description="Adını yazdır, raketini kap ve hikâyeye katıl.">
                <form className="space-y-4" onSubmit={submit}>
                    <Field label="Ad" value={firstName} onChange={setFirstName} required/>
                    <Field label="Soyad" value={lastName} onChange={setLastName} required/>
                    {error ? <p className="text-sm text-red-700">{error}</p> : null}
                    <Button type="submit" className="w-full" disabled={busy}>
                        {busy ? "Adın yazılıyor..." : "Hikâyeye katıl"}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function EditDialog({
                        player,
                        open,
                        onOpenChange,
                        onDone,
                    }: {
    player: PlayerView | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onDone: () => Promise<void>;
}) {
    const [firstName, setFirstName] = useState(player?.firstName ?? "");
    const [lastName, setLastName] = useState(player?.lastName ?? "");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!player) return null;
    const playerId = player.id;

    async function save(event: FormEvent) {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
            await readApi(`/api/players/${playerId}`, {
                method: "PATCH",
                body: JSON.stringify({firstName, lastName}),
            });
            onOpenChange(false);
            await onDone();
        } catch (err) {
            setError(publicErrorMessage(err, "Bilgilerin kaydedilemedi."));
        } finally {
            setBusy(false);
        }
    }

    async function removeSelf() {
        if (!confirm("Sıralamadan ayrılmak istiyor musun? Geçmiş maçların günlükte kalacak.")) return;
        setBusy(true);
        try {
            await readApi(`/api/players/${playerId}`, {method: "DELETE"});
            onOpenChange(false);
            await onDone();
        } catch (err) {
            setError(publicErrorMessage(err, "Sıralamadan ayrılamadın."));
        } finally {
            setBusy(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                title="Sahadaki kimliğin"
                description="Bu tarayıcıdan yalnızca kendi bilgilerini değiştirebilirsin."
            >
                <form className="space-y-4" onSubmit={save}>
                    <Field label="Ad" value={firstName} onChange={setFirstName} required/>
                    <Field label="Soyad" value={lastName} onChange={setLastName} required/>
                    {error ? <p className="text-sm text-red-700">{error}</p> : null}
                    <div className="flex gap-2">
                        <Button type="submit" className="flex-1" disabled={busy}>
                            Kaydet
                        </Button>
                        <Button type="button" variant="danger" onClick={removeSelf} disabled={busy}>
                            <X className="h-4 w-4"/>
                            Turnuvadan ayrıl
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function PlayerDialog({
                          player,
                          me,
                          onClose,
                          onEdit,
                      }: {
    player: PlayerView | null;
    me: PlayerView | null;
    onClose: () => void;
    onEdit: () => void;
}) {
    const [detail, setDetail] = useState<{
        ratingHistory: { eloAfter: number }[];
        recentMatches: MatchView[];
    } | null>(null);

    useEffect(() => {
        if (!player) return;
        readApi<{
            ratingHistory: { eloAfter: number }[];
            recentMatches: MatchView[];
        }>(`/api/players/${player.id}`)
            .then(setDetail)
            .catch(() => setDetail(null));
    }, [player]);

    return (
        <Dialog open={Boolean(player)} onOpenChange={(open) => !open && onClose()}>
            {player ? (
                <DialogContent title={player.name} description="Oyuncu profili">
                    <p className="text-sm text-ink/70">
                        Elo {player.elo} · {player.wins}G–{player.losses}M · {streakLabel(player.streak)}
                    </p>
                    {detail?.ratingHistory.length ? (
                        <p className="mt-3 text-xs text-ink/50">
                            Elo yolculuğu: {detail.ratingHistory.map((event) => event.eloAfter).join(" → ")}
                        </p>
                    ) : (
                        <p className="mt-3 text-xs text-ink/50">Henüz onaylanmış bir maçı yok.</p>
                    )}
                    {me?.id === player.id ? (
                        <Button className="mt-4 w-full" variant="outline" onClick={onEdit}>
                            Bilgilerimi düzenle
                        </Button>
                    ) : null}
                </DialogContent>
            ) : null}
        </Dialog>
    );
}

function Field({
                   label,
                   value,
                   onChange,
                   required,
                   type = "text",
               }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    required?: boolean;
    type?: string;
}) {
    const id = label
        .toLocaleLowerCase("tr-TR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-");
    return (
        <div className="space-y-1.5">
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                type={type}
                required={required}
                value={value}
                onChange={(event) => onChange(event.target.value)}
            />
        </div>
    );
}

const publicErrorMessages: Record<string, string> = {
    "Request failed": "İstek tamamlanamadı.",
    "Registration is closed.": "Katılım şu anda kapalı.",
    "Invalid JSON.": "Gönderilen veri geçersiz.",
    "First name and last name are required.": "Ad ve soyad zorunludur.",
    "Enter a first and last name (2–40 characters each).":
        "Ad ve soyad alanlarının her biri 2–40 karakter olmalıdır.",
    "This browser is already listed. Edit your name instead.":
        "Bu tarayıcıdan zaten katıldın. Bilgilerini düzenleyebilirsin.",
    "That name is already on the list.": "Bu isim zaten listede.",
    "Player not found.": "Oyuncu bulunamadı.",
    "You can only edit your own listing.": "Yalnızca kendi bilgilerini düzenleyebilirsin.",
    "Invalid update.": "Güncelleme bilgileri geçersiz.",
    "You can only remove your own listing.": "Yalnızca kendini sıralamadan çıkarabilirsin.",
    "Add your name first, then you can report a match.":
        "Maç bildirmek için önce turnuvaya katılmalısın.",
    "Opponent and game scores are required.": "Rakip ve set skorları zorunludur.",
    "Game scores are invalid.": "Set skorları geçersiz.",
    "A match is best of 3 (first to 2 games).":
        "Bir maçta 2 set kazanan taraf galip olur; 2 veya 3 set girilmelidir.",
    "Stop once a player has won 2 games — no extra games.":
        "Bir oyuncu 2 set kazandığında maç biter; fazladan set girilemez.",
    "Someone must win 2 games.": "Oyunculardan biri 2 set kazanmalı.",
    "A 2-game match must be 2–0.": "İki setlik bir maç 2–0 bitmelidir.",
    "A 3-game match must be 2–1.": "Üç setlik bir maç 2–1 bitmelidir.",
    "Both players are required.": "İki oyuncu da seçilmelidir.",
    "You cannot play yourself.": "Kendine karşı oynayamazsın.",
    "Both players must be on the active list.": "İki oyuncu da aktif listede olmalıdır.",
    "Match not found.": "Maç bulunamadı.",
    "This match is not waiting for confirmation.": "Bu maç onay beklemiyor.",
    "Only the opponent can confirm this result.": "Bu sonucu yalnızca rakip onaylayabilir.",
};

function publicErrorMessage(error: unknown, fallback = "İstek tamamlanamadı.") {
    if (!(error instanceof Error)) return fallback;
    const gameError = error.message.match(
        /^Game (\d+) is not a valid table tennis score \(11 points, win by 2 from deuce\)\.$/,
    );
    if (gameError) {
        return `${gameError[1]}. set skoru geçerli değil. Set 11 sayıda ve uzatmada 2 sayı farkla biter.`;
    }
    return publicErrorMessages[error.message] ?? fallback;
}

function publicEventName(settings: SettingsView | null) {
    if (!settings || settings.eventName === "Office Table Tennis Cup") {
        return "Masa Tenisi Turnuvası";
    }
    return settings.eventName;
}
