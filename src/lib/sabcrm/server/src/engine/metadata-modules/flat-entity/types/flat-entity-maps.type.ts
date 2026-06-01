// PORT-NOTE: FlatEntityMaps is a complex generic type in Twenty used to store flat entities
// indexed by multiple keys. Ported as a structural equivalent for SabNode.

export type FlatEntityMaps<T extends { id: string }> = {
  // Primary index by entity id
  byId: Partial<Record<string, T>>;
  // Index by universalIdentifier
  universalIdentifierById: Partial<Record<string, string>>;
  universalIdentifiersByApplicationId: Partial<Record<string, string[]>>;
};
