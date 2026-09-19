CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`email_hash` text NOT NULL,
	`password_hash` text NOT NULL,
	`wallet_address` text NOT NULL,
	`wallet_type` text NOT NULL,
	`wallet_key_enc` text,
	`role` text DEFAULT 'donor' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_hash_unique` ON `users` (`email_hash`);