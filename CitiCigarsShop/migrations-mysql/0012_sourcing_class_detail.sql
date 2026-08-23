ALTER TABLE `customer_sourcing_interests`
  MODIFY COLUMN `sourcing_class`
  enum('A1-P','A1-R','A2-P','A2-R','B')
  NOT NULL;
