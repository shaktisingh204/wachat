// PORT-NOTE: server-logic — TypeORM QueryRunner is kept as a type reference.
// In the Next.js/Mongo port, QueryRunner is not used; commands operate on
// MongoDB collections directly. This interface is preserved for structural
// compatibility with the command registry.

export interface FastInstanceCommand {
  up(): Promise<void>;
  down(): Promise<void>;
}
