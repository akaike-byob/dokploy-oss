#!/bin/bash
set -euo pipefail

# One-command installer for a self-hosted panel.
#
#   curl -sSL https://raw.githubusercontent.com/akaike-byob/dokploy-oss/main/install.sh | bash
#
# Overrides:
#   IMAGE=ghcr.io/akaike-byob/dokploy-oss:latest   image to deploy
#   ADVERTISE_ADDR=1.2.3.4                         swarm advertise address
#   PANEL_PORT=3000                                port the panel listens on

IMAGE="${IMAGE:-ghcr.io/akaike-byob/dokploy-oss:latest}"
PANEL_PORT="${PANEL_PORT:-3000}"
BASE_PATH="${BASE_PATH:-/etc/dokploy}"
DB_SECRET="dokploy-postgres-password"

log()  { echo "  $*"; }
ok()   { echo "✅ $*"; }
die()  { echo "❌ $*" >&2; exit 1; }

require_root() {
	[ "$(id -u)" -eq 0 ] || die "Run as root, or with sudo."
}

require_linux() {
	[ "$(uname -s)" = "Linux" ] || die "This installer targets Linux servers."
	case "$(uname -m)" in
		x86_64|amd64|aarch64|arm64) ;;
		*) die "Unsupported architecture: $(uname -m). Images are built for amd64 and arm64." ;;
	esac
}

require_free_ports() {
	for port in 80 443 "$PANEL_PORT"; do
		if command -v ss >/dev/null 2>&1 && ss -tuln 2>/dev/null | grep -q ":${port} "; then
			die "Port ${port} is already in use. Free it, then re-run."
		fi
	done
	ok "Ports 80, 443 and ${PANEL_PORT} are free"
}

install_docker() {
	if command -v docker >/dev/null 2>&1; then
		ok "Docker already installed"
		return
	fi
	log "Installing Docker..."
	curl -sSL https://get.docker.com | sh
	ok "Docker installed"
}

detect_ip() {
	local ip=""
	for url in https://ifconfig.io https://icanhazip.com https://ipecho.net/plain; do
		ip=$(curl -4s --connect-timeout 5 "$url" 2>/dev/null || true)
		[ -n "$ip" ] && { echo "$ip"; return; }
	done
	for url in https://ifconfig.io https://icanhazip.com; do
		ip=$(curl -6s --connect-timeout 5 "$url" 2>/dev/null || true)
		[ -n "$ip" ] && { echo "$ip"; return; }
	done
	die "Could not determine this server's IP. Re-run with ADVERTISE_ADDR=<ip>."
}

init_swarm() {
	if docker info 2>/dev/null | grep -q "Swarm: active"; then
		ok "Docker Swarm already active"
		return
	fi
	local addr="${ADVERTISE_ADDR:-$(detect_ip)}"
	log "Initializing swarm on ${addr}..."
	docker swarm init --advertise-addr "$addr" >/dev/null
	ok "Swarm initialized on ${addr}"
}

init_network() {
	if docker network ls --format '{{.Name}}' | grep -qx "dokploy-network"; then
		ok "Network dokploy-network already exists"
		return
	fi
	docker network create --driver overlay --attachable dokploy-network >/dev/null
	ok "Network dokploy-network created"
}

run_bootstrap() {
	log "Pulling ${IMAGE}..."
	docker pull "$IMAGE" >/dev/null
	ok "Image pulled"

	mkdir -p "$BASE_PATH"

	# Directory layout, default Traefik configuration and Traefik itself. Postgres is handled
	# separately so this installer owns its password.
	log "Provisioning the host (Traefik, config)..."
	docker run --rm \
		-v /var/run/docker.sock:/var/run/docker.sock \
		-v "${BASE_PATH}:${BASE_PATH}" \
		-e NODE_ENV=production \
		"$IMAGE" node -r dotenv/config dist/provision-host.mjs
	ok "Host provisioned"
}

# Postgres reads its password from a Docker secret. The password is generated here, so no two
# installations share one.
init_postgres() {
	if docker service inspect dokploy-postgres >/dev/null 2>&1; then
		ok "Postgres already running, left as it is"
		return
	fi

	if ! docker secret inspect "$DB_SECRET" >/dev/null 2>&1; then
		openssl rand -hex 32 | tr -d "\n" | docker secret create "$DB_SECRET" - >/dev/null
		ok "Generated the database password"
	fi

	log "Starting Postgres..."
	docker service create \
		--name dokploy-postgres \
		--replicas 1 \
		--network dokploy-network \
		--constraint 'node.role==manager' \
		--secret "$DB_SECRET" \
		--env POSTGRES_USER=dokploy \
		--env POSTGRES_DB=dokploy \
		--env POSTGRES_PASSWORD_FILE="/run/secrets/${DB_SECRET}" \
		--mount type=volume,source=dokploy-postgres,target=/var/lib/postgresql/data \
		postgres:16 >/dev/null
	ok "Postgres started"
}

deploy_panel() {
	if docker service inspect dokploy >/dev/null 2>&1; then
		log "Updating existing panel service..."
		docker service update --image "$IMAGE" --force dokploy >/dev/null
		ok "Panel updated"
		return
	fi

	local db_args=()
	if docker secret inspect "$DB_SECRET" >/dev/null 2>&1; then
		db_args=(
			--secret "$DB_SECRET"
			--env POSTGRES_PASSWORD_FILE="/run/secrets/${DB_SECRET}"
		)
	fi

	log "Deploying the panel..."
	docker service create \
		--name dokploy \
		--replicas 1 \
		${db_args[@]+"${db_args[@]}"} \
		--network dokploy-network \
		--mount type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock \
		--mount type=bind,source="${BASE_PATH}",target="${BASE_PATH}" \
		--mount type=volume,source=dokploy-docker-config,target=/root/.docker \
		--publish published="${PANEL_PORT}",target=3000,mode=host \
		--update-parallelism 1 \
		--update-order stop-first \
		--constraint 'node.role==manager' \
		"$IMAGE" >/dev/null
	ok "Panel deployed"
}

main() {
	require_root
	require_linux
	require_free_ports
	install_docker
	init_swarm
	init_network
	run_bootstrap
	init_postgres
	deploy_panel

	local addr="${ADVERTISE_ADDR:-$(detect_ip)}"
	echo
	ok "Done. Open http://${addr}:${PANEL_PORT} and create the first account."
	echo
	echo "   The first account created becomes the owner. Create it now: until an owner"
	echo "   exists the registration page is open to anyone who can reach the panel."
	echo
	echo "   To enable Google sign-in, set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the"
	echo "   service and add https://<your-domain>/api/auth/callback/google as the redirect URI:"
	echo
	echo "     docker service update \\"
	echo "       --env-add GOOGLE_CLIENT_ID=... --env-add GOOGLE_CLIENT_SECRET=... dokploy"
	echo
}

main "$@"
