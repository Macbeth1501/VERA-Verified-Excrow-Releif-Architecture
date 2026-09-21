CREATE TABLE `disbursements` (
	`id` text PRIMARY KEY NOT NULL,
	`milestone_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`beneficiary_id` text NOT NULL,
	`identity_hash` text NOT NULL,
	`amount_minor_units` text NOT NULL,
	`payout_reference` text NOT NULL,
	`payout_ref_hash` text NOT NULL,
	`requested_by_user_id` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`approve_tx_hash` text,
	`tx_hash` text,
	`error` text,
	`locked_until` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`confirmed_at` text,
	FOREIGN KEY (`milestone_id`) REFERENCES `milestones`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`beneficiary_id`) REFERENCES `beneficiaries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requested_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `disbursements_milestone_id_unique` ON `disbursements` (`milestone_id`);