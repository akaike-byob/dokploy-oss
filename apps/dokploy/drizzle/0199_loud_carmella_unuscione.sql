CREATE TYPE "public"."socialAuthProviderId" AS ENUM('google', 'github');--> statement-breakpoint
CREATE TABLE "socialAuthProvider" (
	"providerId" "socialAuthProviderId" PRIMARY KEY NOT NULL,
	"clientId" text NOT NULL,
	"clientSecret" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
