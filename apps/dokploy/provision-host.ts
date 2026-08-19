import { exit } from "node:process";
import { setupDirectories } from "@dokploy/server/setup/config-paths";
import {
	initializeNetwork,
	initializeSwarm,
} from "@dokploy/server/setup/setup";
import {
	createDefaultMiddlewares,
	createDefaultServerTraefikConfig,
	createDefaultTraefikConfig,
	initializeStandaloneTraefik,
} from "@dokploy/server/setup/traefik-setup";

/**
 * Prepares a host for the panel: directory layout, default Traefik configuration, the swarm,
 * the overlay network and Traefik itself.
 *
 * Postgres is deliberately absent. `setup.ts` starts it with a password compiled into the
 * source, which is fine for upstream's own installer but not for one that provisions other
 * people's servers, so install.sh creates it with a generated password held in a Docker secret.
 * Running the upstream setup here would overwrite that with the shared default.
 */
(async () => {
	try {
		setupDirectories();
		createDefaultMiddlewares();
		await initializeSwarm();
		await initializeNetwork();
		createDefaultTraefikConfig();
		createDefaultServerTraefikConfig();
		await initializeStandaloneTraefik();
		console.log("Host provisioned ✅");
		exit(0);
	} catch (error) {
		console.error("Failed to provision the host", error);
		exit(1);
	}
})();
