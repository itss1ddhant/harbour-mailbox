CREATE INDEX `messages_thread_idx` ON `messages` (`thread_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `messages_addressed_idx` ON `messages` (`addressed_to`);--> statement-breakpoint
CREATE INDEX `events_request_idx` ON `request_events` (`request_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `requests_thread_idx` ON `requests` (`thread_id`);--> statement-breakpoint
CREATE INDEX `requests_status_idx` ON `requests` (`status`,`closed_at`);--> statement-breakpoint
CREATE INDEX `sessions_expires_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `participants_user_idx` ON `thread_participants` (`user_id`);