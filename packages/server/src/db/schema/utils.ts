import { decryptValue, encryptValue } from "@dokploy/server/lib/encryption";
import { generatePassword } from "@dokploy/server/templates";
import { faker } from "@faker-js/faker";
import { customType } from "drizzle-orm/pg-core";
import { customAlphabet } from "nanoid";

/**
 * Text column encrypted at rest (AES-256-GCM, key derived from
 * BETTER_AUTH_SECRET). Legacy plaintext values are passed through on read
 * and get encrypted the next time they are written.
 */
export const encryptedText = customType<{ data: string; driverData: string }>({
	dataType() {
		return "text";
	},
	toDriver(value) {
		return encryptValue(value);
	},
	fromDriver(value) {
		try {
			return decryptValue(value);
		} catch {
			// Fail open so a key mismatch (e.g. restoring a backup under a
			// different BETTER_AUTH_SECRET) degrades to showing ciphertext
			// instead of breaking every query that touches the row.
			console.error(
				"Failed to decrypt an encrypted column; returning the raw value. This usually means BETTER_AUTH_SECRET changed after the value was encrypted.",
			);
			return value;
		}
	},
});

const alphabet = "abcdefghijklmnopqrstuvwxyz123456789";

const customNanoid = customAlphabet(alphabet, 6);

/** App name: letters, numbers, dots, underscores, hyphens only (no spaces). Safe for shell/Docker. */
export const APP_NAME_REGEX = /^[a-zA-Z0-9._-]+$/;

export const APP_NAME_MESSAGE =
	"App name can only contain letters, numbers, dots, underscores and hyphens";

/** Docker volume name: must start alphanumeric, then letters/numbers/._- only. Safe for shell. */
export const VOLUME_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;

/**
 * A folder inside a bucket. It reaches rclone commands on the service's server, and `..` would
 * point retention at another service's folder.
 */
export const BUCKET_PATH_REGEX =
	/^(?!(?:.*\/)?\.\.(?:\/|$))[\p{L}\p{M}\p{N}_./ +@=,:-]*$/u;

export const BUCKET_PATH_MESSAGE =
	"A bucket path can only contain letters, numbers, spaces, slashes and the characters . _ - + @ = , :, and no .. segment";

/** The Compose specification's pattern for a service name. Empty means no compose service. */
export const COMPOSE_SERVICE_NAME_REGEX = /^[a-zA-Z0-9._-]*$/;

export const COMPOSE_SERVICE_NAME_MESSAGE =
	"A compose service name can only contain letters, numbers, dots, underscores and hyphens";

/**
 * The callback finds an account by provider id and subject before any link check runs, and the
 * identity provider picks the subject. A provider named after a built-in method would sign in to
 * that method's accounts: a password account's subject is the user id.
 */
export const RESERVED_SSO_PROVIDER_IDS = [
	"credential",
	"github",
	"google",
	"scim",
];

export const VOLUME_NAME_MESSAGE =
	"Volume name must start with a letter or number and contain only letters, numbers, dots, underscores and hyphens";

/** Database password: blocks shell-dangerous characters like $ ! ' " \ / and spaces. */
export const DATABASE_PASSWORD_REGEX =
	/^[a-zA-Z0-9@#%^&*()_+\-=[\]{}|;:,.<>?~`]*$/;

export const DATABASE_PASSWORD_MESSAGE =
	"Password contains invalid characters. Please avoid: $ ! ' \" \\ / and space characters for database compatibility";

export const generateAppName = (type: string) => {
	const verb = faker.hacker.verb().replace(/ /g, "-");
	const adjective = faker.hacker.adjective().replace(/ /g, "-");
	const noun = faker.hacker.noun().replace(/ /g, "-");
	const randomFakerElement = `${verb}-${adjective}-${noun}`;
	const nanoidPart = customNanoid();
	return `${type}-${randomFakerElement}-${nanoidPart}`;
};

export const cleanAppName = (appName?: string) => {
	if (!appName) {
		return appName?.toLowerCase();
	}
	return appName.trim().replace(/ /g, "-").toLowerCase();
};

export const buildAppName = (type: string, baseAppName?: string) => {
	if (baseAppName) {
		return `${cleanAppName(baseAppName)}-${generatePassword(6)}`;
	}
	return generateAppName(type);
};
