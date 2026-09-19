CREATE TABLE `chain_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_name` text NOT NULL,
	`contract_address` text NOT NULL,
	`vault_address` text NOT NULL,
	`block_number` integer NOT NULL,
	`block_timestamp` text NOT NULL,
	`tx_hash` text NOT NULL,
	`log_index` integer NOT NULL,
	`args` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `indexer_cursors` (
	`stream` text PRIMARY KEY NOT NULL,
	`last_block` integer NOT NULL,
	`updated_at` text NOT NULL
);
