CREATE TABLE `beneficiary_attestations` (
	`id` text PRIMARY KEY NOT NULL,
	`beneficiary_id` text NOT NULL,
	`attestor_user_id` text NOT NULL,
	`evidence_hash` text,
	`evidence_document_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`beneficiary_id`) REFERENCES `beneficiaries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`attestor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`evidence_document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `beneficiary_attestations_once` ON `beneficiary_attestations` (`beneficiary_id`,`attestor_user_id`);