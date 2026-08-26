-- Phase 2 / Milestone 7: persist the explicit CRM line -> Stock contract.
-- Existing historical rows remain NULL and are never backfilled or inferred.

ALTER TABLE `order_items`
  ADD COLUMN `stock_disposition` enum('CONSUME','NON_STOCK') NULL AFTER `source_record_id`,
  ADD COLUMN `stock_type` enum('Box','Pack','Loose','Accessory') NULL AFTER `stock_disposition`,
  ADD COLUMN `stock_pack_size` int NULL AFTER `stock_type`,
  ADD COLUMN `stock_source_location_id` varchar(36) NULL AFTER `stock_pack_size`,
  ADD COLUMN `stock_movement_group_id` varchar(36) NULL AFTER `stock_source_location_id`,
  ADD COLUMN `stock_non_consumption_reason` varchar(255) NULL AFTER `stock_movement_group_id`,
  ADD CONSTRAINT `fk_order_items_stock_source_location`
    FOREIGN KEY (`stock_source_location_id`) REFERENCES `stock_locations` (`location_id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_order_items_stock_movement_group`
    FOREIGN KEY (`stock_movement_group_id`) REFERENCES `stock_movement_groups` (`group_id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD KEY `idx_order_items_stock_source` (`stock_source_location_id`),
  ADD CONSTRAINT `uq_order_items_stock_movement_group` UNIQUE (`stock_movement_group_id`);
