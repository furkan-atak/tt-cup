import type { Player } from "@prisma/client";
import { displayName } from "@/lib/utils";

export function serializePlayer(player: Player) {
  return {
    id: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    name: displayName(player.firstName, player.lastName),
    department: player.department,
    wins: player.wins,
    losses: player.losses,
    matchesPlayed: player.wins + player.losses,
    withdrawnAt: player.withdrawnAt,
    eliminatedAt: player.eliminatedAt,
  };
}
