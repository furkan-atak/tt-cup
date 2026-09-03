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
                        <a href="#rankings" className="hover:text-ball">Turnuva</a>
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
                <Hero
                    settings={settings}
                    onJoin={() => setRegisterOpen(true)}
                    onManage={() => setEditOpen(true)}
                    listed={Boolean(me && !me.withdrawnAt)}
                />

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
                                    {playerStatusLabel(me)} · {me.wins} galibiyet · {me.losses} mağlubiyet
                                </p>
                            ) : null}
                        </div>
                    </section>
                ) : null}

                <section id="rankings" className="mx-auto max-w-5xl px-4 py-16">
                    <SectionTitle
                        icon={<Trophy className="h-5 w-5 text-ball"/>}
                        title="Turnuva Tablosu"
                        subtitle="Kazananlar yoluna devam eder, kaybedenler turnuvaya veda eder."
                    />
                    <div className="mt-6 overflow-hidden rounded-2xl border border-ink/10 bg-white">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-court text-white">
                            <tr>
                                <th className="px-4 py-3 font-medium">Oyuncu</th>
                                <th className="px-4 py-3 font-medium">Durum</th>
                                <th className="hidden px-4 py-3 font-medium sm:table-cell">G–M</th>
                            </tr>
                            </thead>
                            <tbody>
                            {rankings.map((player) => (
                                <tr
                                    key={player.id}
                                    className="cursor-pointer border-t border-ink/5 hover:bg-paper"
                                    onClick={() => setSelected(player)}
                                >
                                    <td className="px-4 py-3">
                                        <div className="font-semibold">
                                            {player.name}
                                            {me?.id === player.id ? (
                                                <span className="ml-2 text-xs font-medium text-ball">sen</span>
                                            ) : null}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-court">
                                        {playerStatusLabel(player)}
                                    </td>
                                    <td className="hidden px-4 py-3 sm:table-cell">
                                        {player.wins}–{player.losses}
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                        {rankings.length === 0 ? (
                            <p className="px-4 py-10 text-center text-ink/50">
                                Turnuva listesi ilk oyuncularını bekliyor. Sen de mücadeleye katıl!
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
                                {match.round ? <p className="mt-1 text-xs text-ink/45">{match.round}. tur</p> : null}
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
                                    {match.round ?
                                        <span className="ml-2 text-ink/45">· {match.round}. tur</span> : null}
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
                Designed By Furkan Atak
            </footer>

            <RegisterDialog
                open={registerOpen}
                onOpenChange={setRegisterOpen}
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
                  onManage,
                  listed,
              }: {
    settings: SettingsView | null;
    onJoin: () => void;
    onManage: () => void;
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
            <div
                className="relative mx-auto grid max-w-5xl items-center gap-10 px-4 py-16 sm:py-24 md:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="relative z-10">
                    <p className="text-sm font-semibold tracking-[0.2em] text-ball uppercase">Ofis ligi</p>
                    <h1 className="mt-3 max-w-xl font-display text-5xl leading-none sm:text-6xl">
                        {publicEventName(settings)}
                    </h1>
                    <TournamentCountdown/>
                    <p className="mt-4 max-w-lg text-white/80">
                        Ofisin raketleri sahneye çıkıyor. Adını listeye yazdır; rakibini kura belirlesin.
                        Maçlar oynandıkça sıralamadaki hikâyen şekillensin.
                    </p>
                    {dates ? <p className="mt-2 text-sm text-white/60">{dates}</p> : null}
                    {listed ? (
                        <Button className="mt-8" size="lg" variant="outline" onClick={onManage}>
                            <Pencil className="h-4 w-4"/>
                            Bilgilerim
                        </Button>
                    ) : (
                        <Button
                            className="mt-8"
                            size="lg"
                            onClick={onJoin}
                            disabled={settings?.registrationOpen === false}
                        >
                            {settings?.registrationOpen === false ? "Katılım kapalı" : "Ben de varım!"}
                        </Button>
                    )}
                </div>
                <TableTennisAnimation/>
            </div>
        </section>
    );
}

const tournamentStart = new Date("2026-09-14T00:00:00+03:00");

function TournamentCountdown() {
    const [remaining, setRemaining] = useState<ReturnType<typeof countdownParts> | null>(null);

    useEffect(() => {
        function updateCountdown() {
            setRemaining(countdownParts(tournamentStart.getTime() - Date.now()));
        }

        updateCountdown();
        const timer = window.setInterval(updateCountdown, 1000);
        return () => window.clearInterval(timer);
    }, []);

    return (
        <div className="mt-6 min-h-20" aria-live="off">
            <p className="text-xs font-semibold tracking-[0.16em] text-white/55 uppercase">
                Turnuva&apos;nın başlamasına kalan süre
            </p>
            {remaining?.started ? (
                <p className="mt-2 font-display text-2xl text-ball">Turnuva başladı!</p>
            ) : (
                <div className="mt-2 flex gap-2"
                     aria-label={remaining ? countdownLabel(remaining) : "Geri sayım yükleniyor"}>
                    {[
                        [remaining?.days, "Gün"],
                        [remaining?.hours, "Saat"],
                        [remaining?.minutes, "Dakika"],
                        [remaining?.seconds, "Saniye"],
                    ].map(([value, label]) => (
                        <div key={label}
                             className="min-w-14 rounded-lg border border-white/15 bg-black/10 px-2 py-2 text-center backdrop-blur-sm">
                            <span className="block font-display text-2xl leading-none tabular-nums text-white">
                                {value === undefined ? "--" : String(value).padStart(2, "0")}
                            </span>
                            <span
                                className="mt-1 block text-[9px] font-semibold tracking-wider text-white/50 uppercase">
                                {label}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function countdownParts(milliseconds: number) {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    return {
        started: milliseconds <= 0,
        days: Math.floor(totalSeconds / 86_400),
        hours: Math.floor((totalSeconds % 86_400) / 3_600),
        minutes: Math.floor((totalSeconds % 3_600) / 60),
        seconds: totalSeconds % 60,
    };
}

function countdownLabel(remaining: ReturnType<typeof countdownParts>) {
    return `${remaining.days} gün, ${remaining.hours} saat, ${remaining.minutes} dakika, ${remaining.seconds} saniye kaldı`;
}

function TableTennisAnimation() {
    return (
        <div
            className="table-tennis-scene pointer-events-none relative mx-auto w-full max-w-sm select-none"
            aria-hidden="true"
        >
            <div className="absolute inset-8 rounded-full bg-ball/15 blur-3xl"/>
            <svg viewBox="0 0 360 260" className="relative h-auto w-full overflow-visible">
                <defs>
                    <linearGradient id="table-top" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#247e68"/>
                        <stop offset="1" stopColor="#11503f"/>
                    </linearGradient>
                    <linearGradient id="table-edge" x1="0" y1="0" x2="0" y2="1">
                        <stop stopColor="#0d382e"/>
                        <stop offset="1" stopColor="#071f1a"/>
                    </linearGradient>
                    <linearGradient id="handle" x1="0" y1="0" x2="1" y2="1">
                        <stop stopColor="#edc083"/>
                        <stop offset="1" stopColor="#9d6236"/>
                    </linearGradient>
                    <radialGradient id="ball-fill" cx="35%" cy="30%">
                        <stop stopColor="#fff4c6"/>
                        <stop offset="0.35" stopColor="#ff9b46"/>
                        <stop offset="1" stopColor="#ff5a0a"/>
                    </radialGradient>
                    <filter id="scene-shadow" x="-40%" y="-40%" width="180%" height="200%">
                        <feGaussianBlur stdDeviation="7"/>
                    </filter>
                    <filter id="ball-glow" x="-200%" y="-200%" width="500%" height="500%">
                        <feGaussianBlur stdDeviation="4" result="blur"/>
                        <feMerge>
                            <feMergeNode in="blur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                    <clipPath id="net-clip">
                        <path d="M168 125 L192 176 L192 202 L168 143 Z"/>
                    </clipPath>
                </defs>

                <ellipse cx="180" cy="231" rx="139" ry="17" fill="#00150f" opacity=".42" filter="url(#scene-shadow)"/>

                <g className="table-tennis-table">
                    <path d="M18 204 L342 204 L326 220 L34 220 Z" fill="url(#table-edge)"/>
                    <path d="M55 216 L70 216 L62 255 L50 255 Z" fill="#08261f"/>
                    <path d="M290 216 L305 216 L310 255 L298 255 Z" fill="#08261f"/>
                    <path d="M18 202 L49 143 L311 143 L342 202 Z" fill="url(#table-top)" stroke="white"
                          strokeOpacity=".85" strokeWidth="2"/>
                    <path d="M49 172 L326 172" stroke="white" strokeOpacity=".5" strokeWidth="1.3"/>
                    <path d="M180 143 L180 202" stroke="white" strokeOpacity=".2"/>
                    <path d="M49 143 L18 202 M311 143 L342 202" stroke="white" strokeOpacity=".2"/>
                </g>

                <g className="table-tennis-net">
                    <path d="M168 125 L192 176 L192 202 L168 143 Z" fill="#061d18" fillOpacity=".56"/>
                    <g clipPath="url(#net-clip)" fill="none" stroke="#f8f1df" strokeOpacity=".56" strokeWidth=".55">
                        <path
                            d="M171 121 L171 207 M175 121 L175 207 M179 121 L179 207 M183 121 L183 207 M187 121 L187 207 M191 121 L191 207"/>
                        <path
                            d="M162 130 L198 130 M162 136 L198 136 M162 142 L198 142 M162 148 L198 148 M162 154 L198 154 M162 160 L198 160 M162 166 L198 166 M162 172 L198 172 M162 178 L198 178 M162 184 L198 184 M162 190 L198 190 M162 196 L198 196"/>
                    </g>
                    <path d="M168 143 L192 202" fill="none" stroke="#d8cbb4" strokeOpacity=".65" strokeWidth=".8"/>
                    <path d="M168 125 L168 143 M192 176 L192 202" fill="none" stroke="#d8cbb4" strokeOpacity=".8"
                          strokeWidth=".8"/>

                    <path d="M168 126 Q180 143 192 176" fill="none" stroke="#09251e" strokeOpacity=".65" strokeWidth="3"
                          strokeLinecap="round"/>
                    <path d="M168 125 Q180 142 192 175" fill="none" stroke="#fff8e8" strokeWidth="1.6"
                          strokeLinecap="round"/>
                    <circle cx="168" cy="125" r="2.2" fill="#fff8e8" stroke="#8f7657" strokeWidth=".7"/>
                    <circle cx="192" cy="176" r="2.2" fill="#fff8e8" stroke="#8f7657" strokeWidth=".7"/>

                    <path d="M168 120 L168 147 M192 171 L192 207" stroke="#f7ead3" strokeWidth="2.5"
                          strokeLinecap="round"/>
                    <circle cx="168" cy="120" r="2.25" fill="#fff8e8"/>
                    <circle cx="192" cy="171" r="2.25" fill="#fff8e8"/>
                    <path d="M163 146 L173 146 L172 152 L164 152 Z M187 205 L197 205 L196 212 L188 212 Z" fill="#d8cbb4"
                          stroke="#fff8e8" strokeWidth=".7"/>
                    <path d="M165 152 L171 152 M189 212 L195 212" stroke="#8f7657" strokeWidth="1.5"
                          strokeLinecap="round"/>
                </g>

                <ellipse className="table-tennis-ball-shadow" cx="0" cy="0" rx="10" ry="3.5" fill="#00150f"
                         opacity=".42"/>

                <g className="table-tennis-paddle-left">
                    <path d="M23 130 L35 151" stroke="url(#handle)" strokeWidth="12" strokeLinecap="round"/>
                    <ellipse cx="14" cy="108" rx="25" ry="31" transform="rotate(-28 14 108)" fill="#e65123"
                             stroke="#f8e5cb" strokeWidth="5"/>
                    <ellipse cx="8" cy="100" rx="11" ry="16" transform="rotate(-28 8 100)" fill="white" opacity=".1"/>
                </g>
                <g className="table-tennis-paddle-right">
                    <path d="M337 130 L325 151" stroke="url(#handle)" strokeWidth="12" strokeLinecap="round"/>
                    <ellipse cx="346" cy="108" rx="25" ry="31" transform="rotate(28 346 108)" fill="#14243d"
                             stroke="#f8e5cb" strokeWidth="5"/>
                    <ellipse cx="352" cy="100" rx="11" ry="16" transform="rotate(28 352 100)" fill="white"
                             opacity=".09"/>
                </g>

                <g className="table-tennis-impact table-tennis-impact-left">
                    <path d="M2 75 L-5 62 M12 70 L11 54 M-4 87 L-17 81" stroke="#ffb067" strokeWidth="3"
                          strokeLinecap="round"/>
                </g>
                <g className="table-tennis-impact table-tennis-impact-right">
                    <path d="M358 75 L365 62 M348 70 L349 54 M364 87 L377 81" stroke="#ffb067" strokeWidth="3"
                          strokeLinecap="round"/>
                </g>

                <circle className="table-tennis-ball" r="8" fill="url(#ball-fill)" filter="url(#ball-glow)"/>
            </svg>
        </div>
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

function playerStatusLabel(player: PlayerView) {
    if (player.withdrawnAt) return "Turnuvadan ayrıldı";
    if (player.eliminatedAt) return "Elendi";
    return "Eşleşme Bekliyor";
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
                        }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);

    async function submit(event: FormEvent) {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
            await readApi("/api/players", {
                method: "POST",
                body: JSON.stringify({firstName, lastName}),
            });
            setSubmitted(true);
        } catch (err) {
            setError(publicErrorMessage(err, "Turnuvaya katılım tamamlanamadı."));
        } finally {
            setBusy(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => {
            onOpenChange(nextOpen);
            if (!nextOpen) {
                setSubmitted(false);
                setFirstName("");
                setLastName("");
                setError(null);
            }
        }}>
            <DialogContent
                title={submitted ? "Başvurun alındı" : "Ben de varım!"}
                description={submitted
                    ? "Başvurun turnuva yöneticisine iletildi. Onaylandıktan sonra adını katılımcılar listesinde görebilirsin."
                    : "Adını gönder; turnuva yöneticisi başvurunu inceleyecek."}
            >
                {submitted ? (
                    <Button
                        type="button"
                        className="w-full"
                        onClick={() => {
                            setSubmitted(false);
                            setFirstName("");
                            setLastName("");
                            onOpenChange(false);
                        }}
                    >
                        Tamam
                    </Button>
                ) : (
                    <form className="space-y-4" onSubmit={submit}>
                        <Field label="Ad" value={firstName} onChange={setFirstName} required/>
                        <Field label="Soyad" value={lastName} onChange={setLastName} required/>
                        {error ? <p className="text-sm text-red-700">{error}</p> : null}
                        <Button type="submit" className="w-full" disabled={busy}>
                            {busy ? "Başvuru gönderiliyor..." : "Başvuruyu gönder"}
                        </Button>
                    </form>
                )}
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
        recentMatches: MatchView[];
    } | null>(null);

    useEffect(() => {
        if (!player) return;
        readApi<{
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
                        {playerStatusLabel(player)} · {player.wins} galibiyet · {player.losses} mağlubiyet
                    </p>
                    {detail?.recentMatches.length ? (
                        <p className="mt-3 text-xs text-ink/50">{detail.recentMatches.length} maç oynadı.</p>
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
    "This browser already has a registration awaiting review.":
        "Bu tarayıcıdan gönderilmiş, inceleme bekleyen bir başvuru var.",
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
