CREATE TABLE `donations` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`donor_user_id` text NOT NULL,
	`amount_minor_units` text NOT NULL,
	`fee_minor_units` text DEFAULT '0' NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`step` text DEFAULT 'gas' NOT NULL,
	`gas_tx_hash` text,
	`mint_tx_hash` text,
	`approve_tx_hash` text,
	`onchain_tx_hash` text,
	`fee_tx_hash` text,
	`error` text,
	`locked_until` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`confirmed_at` text,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`donor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `donations_onchain_tx_hash_unique` ON `donations` (`onchain_tx_hash`);