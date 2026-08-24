CREATE TABLE `cigar_dna_reviews` (
  `cigar_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('DRAFT','RESEARCHED','REVIEW','APPROVED','REJECTED') NOT NULL DEFAULT 'DRAFT',

  `proposed_profile` json DEFAULT NULL,
  `final_profile` json DEFAULT NULL,

  `memo_research` text,
  `memo_validation` text,

  `approved_by` varchar(100) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,

  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`cigar_id`),
  KEY `idx_cigar_dna_reviews_status` (`status`),

  CONSTRAINT `fk_cigar_dna_reviews_cigar`
    FOREIGN KEY (`cigar_id`)
    REFERENCES `cigar_catalog` (`cigar_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);