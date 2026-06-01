// PORT-NOTE: pg-migration->mongo-index/seed — this util is pure TypeScript (no Postgres DDL),
// so it ports directly as a plain function. No Mongo index changes are needed.

import { isDefined } from "@/lib/sabcrm/shared/utils/is-defined.util";

import type { AllFlatEntityMaps } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/all-flat-entity-maps.type";

export const findPageLayoutTabIdInCreatePageLayoutContext = ({
  universalIdentifier,
  tabIdByUniversalIdentifier,
  flatPageLayoutTabMaps,
}: {
  universalIdentifier: string;
  tabIdByUniversalIdentifier: Record<string, string> | undefined;
  flatPageLayoutTabMaps: AllFlatEntityMaps["flatPageLayoutTabMaps"];
}): string | null => {
  const providedId = tabIdByUniversalIdentifier?.[universalIdentifier];

  if (isDefined(providedId)) {
    return providedId;
  }

  const existingTab =
    flatPageLayoutTabMaps.byUniversalIdentifier[universalIdentifier];

  return existingTab?.id ?? null;
};
