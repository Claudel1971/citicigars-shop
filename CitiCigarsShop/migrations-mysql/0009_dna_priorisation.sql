CREATE TABLE `priorisation` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sku` varchar(50) NOT NULL,
	`priority_level` int NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`reason` varchar(500),
	`valid_from` date NOT NULL,
	`valid_to` date,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `priorisation_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `priorisation` ADD CONSTRAINT `priorisation_sku_skus_sku_fk` FOREIGN KEY (`sku`) REFERENCES `skus`(`sku`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `idx_priorisation_sku` ON `priorisation` (`sku`);
--> statement-breakpoint
CREATE INDEX `idx_priorisation_active` ON `priorisation` (`active`);
