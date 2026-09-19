CREATE TABLE `organizer_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`legal_name` text NOT NULL,
	`registration_number` text NOT NULL,
	`jurisdiction` text NOT NULL,
	`document_hash` text NOT NULL,
	`document_name` text NOT NULL,
	`kyb_status` text DEFAULT 'pending' NOT NULL,
	`rejection_reason` text,
	`reviewed_by` text,
	`reviewed_at` text,
	`chain_sync` text DEFAULT 'none' NOT NULL,
	`chain_tx_hash` text,
	`chain_error` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizer_profiles_user_id_unique` ON `organizer_profiles` (`user_id`);