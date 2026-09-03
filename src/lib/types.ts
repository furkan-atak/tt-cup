export type PlayerView = {
    id: string;
    firstName: string;
    lastName: string;
    name: string;
    department: string | null;
    wins: number;
    losses: number;
    matchesPlayed: number;
    withdrawnAt: string | Date | null;
    eliminatedAt: string | Date | null;
};

export type RegistrationRequestView = {
    id: string;
    firstName: string;
    lastName: string;
    name: string;
    department: string | null;
    createdAt: string | Date;
};

export type MatchView = {
    id: string;
    status: string;
    round: number | null;
    games: { a: number; b: number }[];
    winnerId: string | null;
    confirmedAt: string | Date | null;
    playedAt: string | Date;
    reportedByPlayerId: string | null;
    playerA: PlayerView;
    playerB: PlayerView;
};

export type SettingsView = {
    eventName: string;
    registrationOpen: boolean;
    startDate: string | Date | null;
    endDate: string | Date | null;
    joinCodeRequired: boolean;
};

export async function readApi<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(path, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers ?? {}),
        },
    });
    const data = (await response.json().catch(() => ({}))) as T & { error?: string };
    if (!response.ok) {
        throw new Error(data.error || "Request failed");
    }
    return data;
}
