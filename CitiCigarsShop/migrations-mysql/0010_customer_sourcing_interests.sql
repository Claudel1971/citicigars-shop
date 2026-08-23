CREATE TABLE `customer_sourcing_interests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customer_id` varchar(36) NOT NULL,
  `dna_id` varchar(36) NOT NULL,
  `source_request_id` varchar(100) NOT NULL,
  `cigar_id` varchar(20) NOT NULL,
  `sourcing_class` enum('A1','A2','B') NOT NULL,
  `dna_score` decimal(5,1) NOT NULL,
  `interested` boolean NOT NULL,
  `created_at` timestamp DEFAULT (now()),
  `updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `customer_sourcing_interests_id` PRIMARY KEY (`id`),
  CONSTRAINT `uq_sourcing_request_cigar`
    UNIQUE (`source_request_id`,`cigar_id`)
);
--> statement-breakpoint

ALTER TABLE `customer_sourcing_interests`
  ADD CONSTRAINT `fk_sourcing_customer`
  FOREIGN KEY (`customer_id`)
  REFERENCES `customers`(`customer_id`)
  ON DELETE cascade
  ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE `customer_sourcing_interests`
  ADD CONSTRAINT `fk_sourcing_dna`
  FOREIGN KEY (`dna_id`)
  REFERENCES `customer_dna`(`dna_id`)
  ON DELETE cascade
  ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE `customer_sourcing_interests`
  ADD CONSTRAINT `fk_sourcing_cigar`
  FOREIGN KEY (`cigar_id`)
  REFERENCES `cigar_catalog`(`cigar_id`)
  ON DELETE restrict
  ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX `idx_sourcing_customer`
  ON `customer_sourcing_interests` (`customer_id`);
--> statement-breakpoint

CREATE INDEX `idx_sourcing_dna`
  ON `customer_sourcing_interests` (`dna_id`);
--> statement-breakpoint

CREATE INDEX `idx_sourcing_cigar`
  ON `customer_sourcing_interests` (`cigar_id`);
--> statement-breakpoint

CREATE INDEX `idx_sourcing_interested`
  ON `customer_sourcing_interests` (`interested`);
