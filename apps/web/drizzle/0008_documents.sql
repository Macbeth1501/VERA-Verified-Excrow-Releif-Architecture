CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`purpose` text NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256_hash` text NOT NULL,
	`data` blob NOT NULL,
	`uploaded_by_user_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `milestone_actions` ADD `evidence_document_id` text REFERENCES documents(id);--> statement-breakpoint
ALTER TABLE `organizer_profiles` ADD `document_id` text REFERENCES documents(id);