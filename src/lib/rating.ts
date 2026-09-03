import { nextElo, STARTING_ELO } from "@/lib/elo";
import { prisma } from "@/lib/prisma";

type RatingState = {
  elo: number;
  wins: number;
  losses: number;
  streak: number;
};

export async function recomputeRatings() {
  const players = await prisma.player.findMany({ select: { id: true } });
  const matches = await prisma.match.findMany({
    where: { status: "CONFIRMED" },
    orderBy: [{ confirmedAt: "asc" }, { createdAt: "asc" }],
  });

  await prisma.ratingEvent.deleteMany();

  const state = new Map<string, RatingState>(
    players.map((player) => [
      player.id,
      { elo: STARTING_ELO, wins: 0, losses: 0, streak: 0 },
    ]),
  );

  const events: {
    matchId: string;
    playerId: string;
    eloBefore: number;
    eloAfter: number;
  }[] = [];

  for (const match of matches) {
    if (!match.winnerId) {
      continue;
    }
    const a = state.get(match.playerAId);
    const b = state.get(match.playerBId);
    if (!a || !b) {
      continue;
    }

    const aWon = match.winnerId === match.playerAId;
    const nextA = nextElo(a.elo, b.elo, aWon);
    const nextB = nextElo(b.elo, a.elo, !aWon);

    events.push(
      {
        matchId: match.id,
        playerId: match.playerAId,
        eloBefore: a.elo,
        eloAfter: nextA,
      },
      {
        matchId: match.id,
        playerId: match.playerBId,
        eloBefore: b.elo,
        eloAfter: nextB,
      },
    );

    applyResult(a, aWon, nextA);
    applyResult(b, !aWon, nextB);
  }

  if (events.length > 0) {
    await prisma.ratingEvent.createMany({ data: events });
  }

  await Promise.all(
    [...state.entries()].map(([id, stats]) =>
      prisma.player.update({
        where: { id },
        data: stats,
      }),
    ),
  );
}

function applyResult(player: RatingState, won: boolean, nextRating: number) {
  player.elo = nextRating;
  if (won) {
    player.wins += 1;
    player.streak = player.streak > 0 ? player.streak + 1 : 1;
  } else {
    player.losses += 1;
    player.streak = player.streak < 0 ? player.streak - 1 : -1;
  }
}
