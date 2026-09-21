CREATE TABLE `beneficiaries` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`identity_hash` text NOT NULL,
	`photo_hash` text,
	`payout_method` text NOT NULL,
	`registered_by_user_id` text NOT NULL,
	`chain_status` text DEFAULT 'PENDING' NOT NULL,
	`chain_tx_hash` text,
	`chain_error` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`registered_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `beneficiaries_once` ON `beneficiaries` (`campaign_id`,`identity_hash`);--> statement-breakpoint
CREATE TABLE `campaign_salts` (
	`campaign_id` text PRIMARY KEY NOT NULL,
	`salt` text NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
