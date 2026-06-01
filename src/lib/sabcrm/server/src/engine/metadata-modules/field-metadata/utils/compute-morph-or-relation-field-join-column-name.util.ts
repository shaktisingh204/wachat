// PORT-NOTE: No NestJS/TypeORM dependencies. Ported verbatim. Logic kept for
// Mongo field-key naming compatibility.

type ComputeMorphOrRelationFieldJoinColumnNameArgs = {
  name: string;
};

export const computeMorphOrRelationFieldJoinColumnName = ({
  name,
}: ComputeMorphOrRelationFieldJoinColumnNameArgs): string => {
  return `${name}Id`;
};
