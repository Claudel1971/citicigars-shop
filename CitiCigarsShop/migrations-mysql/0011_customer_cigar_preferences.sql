CREATE TABLE `customer_cigar_preferences` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customer_id` varchar(36) NOT NULL,
  `source_request_id` varchar(100) NOT NULL,
  `position` int NOT NULL,
  `reference_id` varchar(64),
  `brand` varchar(255) NOT NULL,
  `line` varchar(255) NOT NULL,
  `dimensions_raw` varchar(100),
  `dimensions_normalized` varchar(100) NOT NULL,
  `format` varchar(100),
  `vitola` varchar(100),
  `source` varchar(30) NOT NULL DEFAULT 'DNA',
  `created_at` timestamp DEFAULT (now()),
  CONSTRAINT `customer_cigar_preferences_id`
    PRIMARY KEY (`id`),
  CONSTRAINT `uq_cigar_preferences_request_position`
    UNIQUE (`source_request_id`,`position`)
);
--> statement-breakpoint

ALTER TABLE `customer_cigar_preferences`
  ADD CONSTRAINT `fk_cigar_preferences_customer`
  FOREIGN KEY (`customer_id`)
  REFERENCES `customers`(`customer_id`)
  ON DELETE cascade
  ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX `idx_cigar_preferences_customer`
  ON `customer_cigar_preferences` (`customer_id`);
--> statement-breakpoint

CREATE INDEX `idx_cigar_preferences_reference`
  ON `customer_cigar_preferences` (`reference_id`);
