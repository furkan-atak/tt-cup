import type { Player } from "@prisma/client";
import { displayName } from "@/lib/utils";

export function serializePlayer(player: Player, rank?: number) {
  return {
    id: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    name: displayName(player.firstName, player.lastName),
    department: player.department,
    elo: player.elo,
    wins: player.wins,
    losses: player.losses,
    streak: player.streak,
    matchesPlayed: player.wins + player.losses,
    withdrawnAt: player.withdrawnAt,
    rank: rank ?? null,
  };
}

export const rankingOrder = [
  { elo: "desc" as const },
  { wins: "desc" as const },
  { id: "asc" as const },
];
