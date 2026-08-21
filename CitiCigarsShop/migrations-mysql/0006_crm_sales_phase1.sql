CREATE TABLE `crm_followups` (
	`followup_id` varchar(36) NOT NULL,
	`customer_id` varchar(36) NOT NULL,
	`source_interaction_id` varchar(36),
	`action` text NOT NULL,
	`due_at` date NOT NULL,
	`status` enum('OPEN','DONE','CANCELLED') NOT NULL DEFAULT 'OPEN',
	`completed_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `crm_followups_followup_id` PRIMARY KEY(`followup_id`)
);
--> statement-breakpoint
CREATE TABLE `customer_dna` (
	`dna_id` varchar(36) NOT NULL,
	`customer_id` varchar(36) NOT NULL,
	`profile_code` varchar(50),
	`profile_name` varchar(255),
	`profile_tagline` varchar(500),
	`family` varchar(100),
	`engine_version` varchar(50),
	`full_payload` json,
	`tested_at` timestamp NOT NULL,
	`source_request_id` varchar(100),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `customer_dna_dna_id` PRIMARY KEY(`dna_id`),
	CONSTRAINT `uq_dna_source_request` UNIQUE(`source_request_id`)
);
--> statement-breakpoint
CREATE TABLE `customer_interactions` (
	`interaction_id` varchar(36) NOT NULL,
	`customer_id` varchar(36) NOT NULL,
	`channel` varchar(30) NOT NULL,
	`interaction_date` timestamp NOT NULL,
	`direction` enum('INBOUND','OUTBOUND') NOT NULL,
	`raw_text` text,
	`summary` text NOT NULL,
	`products_mentioned` json,
	`interest` varchar(255),
	`next_action` text,
	`next_action_at` date,
	`source_type` enum('manual','whatsapp_paste','dna','api','system') NOT NULL DEFAULT 'manual',
	`created_by` enum('human','ai','system') NOT NULL DEFAULT 'human',
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `customer_interactions_interaction_id` PRIMARY KEY(`interaction_id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`customer_id` varchar(36) NOT NULL,
	`first_name` varchar(255),
	`last_name` varchar(255),
	`phone_whatsapp` varchar(30),
	`phone_raw` varchar(50),
	`email` varchar(255),
	`city` varchar(100),
	`country` varchar(100) DEFAULT 'Cameroun',
	`customer_type` enum('B2C','CORPORATE','PARTNER','OTHER') DEFAULT 'B2C',
	`company_name` varchar(255),
	`job_title` varchar(255),
	`source` varchar(100),
	`status` enum('PROSPECT','QUALIFIED','CUSTOMER','DORMANT','LOST') DEFAULT 'PROSPECT',
	`is_internal` boolean NOT NULL DEFAULT false,
	`notes` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_customer_id` PRIMARY KEY(`customer_id`)
);
--> statement-breakpoint
CREATE TABLE `crm_saved_views` (
	`saved_view_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`filters` json NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `crm_saved_views_saved_view_id` PRIMARY KEY(`saved_view_id`)
);
--> statement-breakpoint
CREATE TABLE `order_item_components` (
	`order_item_component_id` varchar(60) NOT NULL,
	`order_item_id` varchar(36) NOT NULL,
	`component_sku` varchar(50) NOT NULL,
	`component_type` enum('CIGAR_BOX','BUNDLE','ACCESSORY','SERVICE','OTHER') NOT NULL,
	`component_label` varchar(500) NOT NULL,
	`quantity_per_item` int NOT NULL,
	`total_quantity` int NOT NULL,
	`unit_cost_at_sale_xaf` int,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `order_item_components_order_item_component_id` PRIMARY KEY(`order_item_component_id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`order_item_id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`item_type` enum('PRODUCT','BUNDLE','ACCESSORY','SERVICE','CUSTOM') NOT NULL,
	`item_sku` varchar(50) NOT NULL,
	`brand` varchar(255),
	`series` varchar(255),
	`vitole` varchar(255),
	`custom_label` varchar(500),
	`quantity` int NOT NULL,
	`regular_unit_price_xaf` int NOT NULL,
	`promo_unit_price_xaf` int,
	`effective_unit_price_xaf` int NOT NULL,
	`line_subtotal_xaf` int NOT NULL,
	`allocated_order_discount_xaf` int NOT NULL DEFAULT 0,
	`actual_line_revenue_xaf` int NOT NULL,
	`actual_unit_price_xaf` int NOT NULL,
	`standard_unit_cost_xaf` decimal(12,4),
	`standard_line_cost_xaf` decimal(12,4),
	`actual_line_cost_xaf` decimal(12,4),
	`cost_variance_vs_standard_xaf` decimal(12,4),
	`unit_cost_at_sale_xaf` int,
	`total_cost_xaf` int,
	`line_margin_xaf` int,
	`margin_rate` decimal(6,4),
	`source_system` varchar(100),
	`source_record_id` varchar(255),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `order_items_order_item_id` PRIMARY KEY(`order_item_id`),
	CONSTRAINT `uq_order_items_source_record` UNIQUE(`source_system`,`source_record_id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`order_id` varchar(36) NOT NULL,
	`customer_id` varchar(36) NOT NULL,
	`order_date` timestamp NOT NULL,
	`status` enum('DRAFT','CONFIRMED','PAID','CANCELLED') NOT NULL DEFAULT 'CONFIRMED',
	`currency` varchar(3) NOT NULL DEFAULT 'XAF',
	`subtotal_regular_total_xaf` int NOT NULL,
	`product_discounts_total_xaf` int NOT NULL DEFAULT 0,
	`subtotal_after_discounts_xaf` int NOT NULL,
	`extra_customer_discount_xaf` int NOT NULL DEFAULT 0,
	`final_sale_total_xaf` int NOT NULL,
	`total_cost_xaf` int,
	`gross_margin_xaf` int,
	`gross_margin_rate` decimal(6,4),
	`amount_paid` int NOT NULL DEFAULT 0,
	`balance_due` int NOT NULL DEFAULT 0,
	`payment_date` timestamp,
	`source` enum('historical_import','manual','online') NOT NULL DEFAULT 'manual',
	`source_system` varchar(100),
	`source_record_id` varchar(255),
	`source_row_hash` varchar(64),
	`import_batch_id` varchar(36),
	`notes` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_order_id` PRIMARY KEY(`order_id`),
	CONSTRAINT `uq_orders_source_record` UNIQUE(`source_system`,`source_record_id`)
);
--> statement-breakpoint
ALTER TABLE `crm_followups` ADD CONSTRAINT `crm_followups_customer_id_customers_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`customer_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `crm_followups` ADD CONSTRAINT `fk_followups_source_interaction` FOREIGN KEY (`source_interaction_id`) REFERENCES `customer_interactions`(`interaction_id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_dna` ADD CONSTRAINT `customer_dna_customer_id_customers_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`customer_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_interactions` ADD CONSTRAINT `customer_interactions_customer_id_customers_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`customer_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_item_components` ADD CONSTRAINT `order_item_components_order_item_id_order_items_order_item_id_fk` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`order_item_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_orders_order_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`order_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_customer_id_customers_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`customer_id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_followups_customer` ON `crm_followups` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_followups_due_at` ON `crm_followups` (`due_at`);--> statement-breakpoint
CREATE INDEX `idx_followups_status` ON `crm_followups` (`status`);--> statement-breakpoint
CREATE INDEX `idx_dna_customer` ON `customer_dna` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_dna_tested_at` ON `customer_dna` (`tested_at`);--> statement-breakpoint
CREATE INDEX `idx_interactions_customer` ON `customer_interactions` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_interactions_next_action` ON `customer_interactions` (`next_action_at`);--> statement-breakpoint
CREATE INDEX `idx_customers_phone` ON `customers` (`phone_whatsapp`);--> statement-breakpoint
CREATE INDEX `idx_customers_status` ON `customers` (`status`);--> statement-breakpoint
CREATE INDEX `idx_saved_views_name` ON `crm_saved_views` (`name`);--> statement-breakpoint
CREATE INDEX `idx_order_item_components_item` ON `order_item_components` (`order_item_id`);--> statement-breakpoint
CREATE INDEX `idx_order_item_components_sku` ON `order_item_components` (`component_sku`);--> statement-breakpoint
CREATE INDEX `idx_order_items_order` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_order_items_item_sku` ON `order_items` (`item_sku`);--> statement-breakpoint
CREATE INDEX `idx_orders_customer` ON `orders` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_orders_date` ON `orders` (`order_date`);