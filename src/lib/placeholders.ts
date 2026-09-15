import type {Player} from "@prisma/client";

export const PLACEHOLDER_STATUS = "PLACEHOLDER";
export const PLACEHOLDER_ROUND_PREFIX = "fixture-round:";

export function isPlaceholderPlayer(player: Pick<Player, "registrationStatus">) {
    return player.registrationStatus === PLACEHOLDER_STATUS;
}

export function placeholderRoundMarker(round: number) {
    return `${PLACEHOLDER_ROUND_PREFIX}${round}`;
}
