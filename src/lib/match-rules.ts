export type GameScore = { a: number; b: number };

export function isValidGame(a: number, b: number): boolean {
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
        return false;
    }
    if (a === b) {
        return false;
    }
    const high = Math.max(a, b);
    const low = Math.min(a, b);
    if (high === 11) {
        return low <= 9;
    }
    return high > 11 && low >= 10 && high - low === 2;
}

export function gameWinner(game: GameScore): "a" | "b" | null {
    if (!isValidGame(game.a, game.b)) {
        return null;
    }
    return game.a > game.b ? "a" : "b";
}

export function validateBestOfThree(games: GameScore[]): string | null {
    if (games.length < 2 || games.length > 3) {
        return "A match is best of 3 (first to 2 games).";
    }

    let winsA = 0;
    let winsB = 0;

    for (let i = 0; i < games.length; i += 1) {
        const winner = gameWinner(games[i]);
        if (!winner) {
            return `Game ${i + 1} is not a valid table tennis score (11 points, win by 2 from deuce).`;
        }
        if (winsA === 2 || winsB === 2) {
            return "Stop once a player has won 2 games — no extra games.";
        }
        if (winner === "a") {
            winsA += 1;
        } else {
            winsB += 1;
        }
    }

    if (winsA !== 2 && winsB !== 2) {
        return "Someone must win 2 games.";
    }
    if (games.length === 2 && (winsA !== 2 || winsB !== 0) && (winsB !== 2 || winsA !== 0)) {
        return "A 2-game match must be 2–0.";
    }
    if (games.length === 3 && (winsA === 2 ? winsB !== 1 : winsA !== 1)) {
        return "A 3-game match must be 2–1.";
    }

    return null;
}

export function matchWinnerFromGames(games: GameScore[]): "a" | "b" {
    const error = validateBestOfThree(games);
    if (error) {
        throw new Error(error);
    }
    const winsA = games.filter((game) => gameWinner(game) === "a").length;
    return winsA === 2 ? "a" : "b";
}

export function parseGames(json: string): GameScore[] {
    const parsed = JSON.parse(json) as GameScore[];
    if (!Array.isArray(parsed)) {
        return [];
    }
    return parsed;
}

export function gamesLabel(games: GameScore[]) {
    return games.map((game) => `${game.a}–${game.b}`).join(", ");
}
