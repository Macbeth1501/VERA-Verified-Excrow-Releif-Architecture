ALTER TABLE `beneficiary_attestations` ADD `chain_status` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `beneficiary_attestations` ADD `chain_tx_hash` text;--> statement-breakpoint
ALTER TABLE `beneficiary_attestations` ADD `chain_error` text;