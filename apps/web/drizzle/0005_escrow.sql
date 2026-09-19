CREATE TABLE `milestone_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`milestone_id` text NOT NULL,
	`kind` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`actor_address` text NOT NULL,
	`proof_hash` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`tx_hash` text,
	`error` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`milestone_id`) REFERENCES `milestones`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `milestone_actions_once` ON `milestone_actions` (`milestone_id`,`kind`,`actor_address`);--> statement-breakpoint
CREATE TABLE `role_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`chain_sync` text DEFAULT 'none' NOT NULL,
	`chain_tx_hash` text,
	`chain_error` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `role_grants_user_role` ON `role_grants` (`user_id`,`role`);--> statement-breakpoint
ALTER TABLE `milestones` ADD `chain_status` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `milestones` ADD `chain_tx_hash` text;--> statement-breakpoint
ALTER TABLE `milestones` ADD `chain_error` text;