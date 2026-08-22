ALTER TABLE customer_interactions
  ADD COLUMN source_request_id VARCHAR(100) NULL;
--> statement-breakpoint
ALTER TABLE customer_interactions
  ADD CONSTRAINT uq_interactions_source_request UNIQUE (source_request_id);
