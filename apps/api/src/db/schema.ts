import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Week 1 holds only what the healthcheck and the first migration need. The
 * real domain model (documents, cases, extractions, review tasks, audit
 * events) lands in week 2 alongside the state machine.
 */
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** Content hash — the idempotency key for re-uploads of the same file. */
    checksum: text('checksum').notNull().unique(),
    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    /** Verbatim ingest payload. Interpreted later, never overwritten. */
    rawPayload: jsonb('raw_payload').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('documents_created_at_idx').on(table.createdAt)],
);

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
