export type HrFormSection = {
  title: string;
  fieldNames: string[];
};

export function getSectionedFieldNames(sections?: HrFormSection[]): Set<string> {
  return new Set((sections || []).flatMap((section) => section.fieldNames));
}

export function getRemainingFields<T extends { name: string }>(
  fields: T[],
  sections?: HrFormSection[],
): T[] {
  const sectioned = getSectionedFieldNames(sections);
  return fields.filter((field) => !sectioned.has(field.name));
}
