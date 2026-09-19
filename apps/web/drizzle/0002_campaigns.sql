CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`organizer_profile_id` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`category` text NOT NULL,
	`funding_goal` text NOT NULL,
	`admin_expense_cap_pct` integer NOT NULL,
	`vault_contract_address` text,
	`onchain_campaign_id` integer,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`chain_status` text DEFAULT 'pending' NOT NULL,
	`chain_tx_hash` text,
	`chain_error` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`organizer_profile_id`) REFERENCES `organizer_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`description` text NOT NULL,
	`target_pct` integer NOT NULL,
	`required_attestations` integer NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`sequence_order` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
