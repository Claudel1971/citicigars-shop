CREATE TABLE `cigar_research_pool` (
  `pool_id` varchar(40) NOT NULL,
  `source_cigar_id` varchar(20) DEFAULT NULL,
  `canonical_cigar_id` varchar(20) DEFAULT NULL,
  `brand` varchar(150) NOT NULL,
  `line` varchar(255) NOT NULL,
  `vitole` varchar(255) DEFAULT NULL,
  `format` varchar(150) DEFAULT NULL,
  `box_pressed` boolean DEFAULT NULL,
  `box_count` int DEFAULT NULL,
  `length` varchar(50) DEFAULT NULL,
  `ring` int DEFAULT NULL,
  `dimensions` varchar(100) DEFAULT NULL,
  `strength` varchar(50) DEFAULT NULL,
  `sourcing_rating` varchar(20) DEFAULT NULL,
  `origin_country` varchar(150) DEFAULT NULL,
  `owner` varchar(255) DEFAULT NULL,
  `factory` varchar(255) DEFAULT NULL,
  `made_by` varchar(255) DEFAULT NULL,
  `wrapper` text,
  `binder` text,
  `filler` text,
  `product_status` varchar(255) DEFAULT NULL,
  `technical_key` varchar(700) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `source_type` varchar(50) NOT NULL,
  `source_version` varchar(100) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`pool_id`),
  UNIQUE KEY `uq_research_pool_technical_key` (`technical_key`),
  KEY `idx_research_pool_search` (`brand`,`line`,`vitole`),
  KEY `idx_research_pool_factory` (`factory`),
  KEY `idx_research_pool_made_by` (`made_by`),
  KEY `idx_research_pool_canonical` (`canonical_cigar_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint

CREATE TABLE `cigar_research_pool_evidence` (
  `id` varchar(40) NOT NULL,
  `pool_id` varchar(40) NOT NULL,
  `ranking_source` enum('CA','CJ') NOT NULL,
  `ranking_year` int NOT NULL,
  `ranking_rank` int NOT NULL,
  `ranking_rating` int DEFAULT NULL,
  `official_source_url` text,
  `ranking_source_url` text,
  `secondary_source_url` text,
  `confidence` varchar(50) DEFAULT NULL,
  `raw_payload` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pool_evidence_appearance` (`pool_id`,`ranking_source`,`ranking_year`,`ranking_rank`),
  KEY `idx_pool_evidence_ranking` (`ranking_source`,`ranking_year`),
  CONSTRAINT `fk_pool_evidence_pool` FOREIGN KEY (`pool_id`)
    REFERENCES `cigar_research_pool` (`pool_id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint

ALTER TABLE `cigar_catalog`
  ADD COLUMN `pool_id` varchar(40) DEFAULT NULL,
  ADD UNIQUE KEY `uq_cigar_catalog_pool_id` (`pool_id`),
  ADD CONSTRAINT `fk_cigar_catalog_pool` FOREIGN KEY (`pool_id`)
    REFERENCES `cigar_research_pool` (`pool_id`) ON DELETE SET NULL ON UPDATE CASCADE;
--> statement-breakpoint

ALTER TABLE `cigar_research_pool`
  ADD CONSTRAINT `fk_research_pool_canonical` FOREIGN KEY (`canonical_cigar_id`)
    REFERENCES `cigar_catalog` (`cigar_id`) ON DELETE SET NULL ON UPDATE CASCADE;
--> statement-breakpoint

CREATE TABLE `dna_research_cases` (
  `case_id` varchar(40) NOT NULL,
  `pool_id` varchar(40) DEFAULT NULL,
  `cigar_id` varchar(20) DEFAULT NULL,
  `status` enum('DRAFT','RESEARCHED','REVIEW','APPROVED','REJECTED') NOT NULL DEFAULT 'DRAFT',
  `case_type` enum('CREATE','UPDATE') NOT NULL DEFAULT 'CREATE',
  `research_mode` enum('AGENT','DIRECT') DEFAULT NULL,
  `current_profile_snapshot` json DEFAULT NULL,
  `proposed_profile` json DEFAULT NULL,
  `final_profile` json DEFAULT NULL,
  `memo_research` text,
  `memo_validation` text,
  `approved_by` varchar(100) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`case_id`),
  KEY `idx_dna_cases_pool_status` (`pool_id`,`status`),
  KEY `idx_dna_cases_cigar` (`cigar_id`),
  KEY `idx_dna_cases_status` (`status`),
  CONSTRAINT `fk_dna_cases_pool` FOREIGN KEY (`pool_id`)
    REFERENCES `cigar_research_pool` (`pool_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_dna_cases_cigar` FOREIGN KEY (`cigar_id`)
    REFERENCES `cigar_catalog` (`cigar_id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint

INSERT IGNORE INTO `dna_research_cases` (
  `case_id`, `pool_id`, `cigar_id`, `status`, `case_type`, `research_mode`,
  `current_profile_snapshot`, `proposed_profile`, `final_profile`,
  `memo_research`, `memo_validation`, `approved_by`, `approved_at`, `created_at`, `updated_at`
)
SELECT
  CONCAT('LEGACY-', r.`cigar_id`), c.`pool_id`, r.`cigar_id`, r.`status`, 'CREATE', 'AGENT',
  CASE WHEN r.`status` = 'APPROVED' THEN r.`final_profile` ELSE NULL END,
  r.`proposed_profile`, r.`final_profile`, r.`memo_research`, r.`memo_validation`,
  r.`approved_by`, r.`approved_at`, r.`created_at`, r.`updated_at`
FROM `cigar_dna_reviews` r
LEFT JOIN `cigar_catalog` c ON c.`cigar_id` = r.`cigar_id`;
