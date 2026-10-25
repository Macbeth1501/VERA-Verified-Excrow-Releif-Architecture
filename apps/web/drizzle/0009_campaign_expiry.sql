ALTER TABLE `campaigns` ADD `duration_days` integer DEFAULT 90 NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `inactivity_days` integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `deadline_at` text;