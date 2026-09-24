CREATE TABLE `deploymentAllocations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`officerId` int NOT NULL,
	`selectedArea` varchar(180) NOT NULL,
	`road` varchar(180) NOT NULL,
	`latitude` double NOT NULL,
	`longitude` double NOT NULL,
	`horizonMinutes` int NOT NULL,
	`predictedOccupancy` int NOT NULL,
	`arrivalAt` timestamp NOT NULL,
	`status` enum('proposed','scheduled','enroute','deployed','complete','cancelled') NOT NULL DEFAULT 'proposed',
	`notes` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deploymentAllocations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integrationEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`selectedArea` varchar(180) NOT NULL,
	`source` varchar(64) NOT NULL,
	`externalId` varchar(180),
	`title` varchar(240) NOT NULL,
	`startsAt` timestamp,
	`endsAt` timestamp,
	`impactLevel` enum('low','medium','high') NOT NULL DEFAULT 'low',
	`latitude` double NOT NULL,
	`longitude` double NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `integrationEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `officers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`name` varchar(160) NOT NULL,
	`badgeNumber` varchar(64) NOT NULL,
	`callSign` varchar(64) NOT NULL,
	`status` enum('available','assigned','enroute','deployed','offDuty') NOT NULL DEFAULT 'available',
	`currentLat` double,
	`currentLng` double,
	`lastSeenAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `officers_id` PRIMARY KEY(`id`),
	CONSTRAINT `officers_badgeNumber_unique` UNIQUE(`badgeNumber`)
);
--> statement-breakpoint
CREATE TABLE `routeAdvisories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`allocationId` int,
	`origin` text NOT NULL,
	`destination` text NOT NULL,
	`encodedPolyline` text,
	`distanceMeters` int,
	`durationSeconds` int,
	`status` enum('active','stale','failed') NOT NULL DEFAULT 'active',
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `routeAdvisories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `signalActions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`selectedArea` varchar(180) NOT NULL,
	`controllerId` varchar(120) NOT NULL,
	`action` varchar(180) NOT NULL,
	`status` enum('queued','sent','acknowledged','failed','notConfigured') NOT NULL DEFAULT 'queued',
	`requestedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `signalActions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
