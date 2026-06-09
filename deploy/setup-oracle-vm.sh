#!/bin/bash
# Run on a fresh Ubuntu VM (Oracle Cloud Always Free)
# Usage: bash deploy/setup-oracle-vm.sh

set -e

echo "=== Installing Docker ==="
sudo apt update
sudo apt install -y git docker.io docker-compose-v2
sudo usermod -aG docker "$USER" || true
sudo systemctl enable docker
sudo systemctl start docker

echo "=== Opening firewall port 80 ==="
sudo ufw allow 80/tcp 2>/dev/null || true

echo ""
echo "Done! Log out and back in (or run: newgrp docker)"
echo ""
echo "Next steps:"
echo "  git clone https://github.com/JAKKABHANUMANOJKUMAR/video-lecture-transcript-qa-bot.git"
echo "  cd video-lecture-transcript-qa-bot"
echo "  cp .env.docker.example .env.docker"
echo "  nano .env.docker   # set GROQ_API_KEY, passwords, PUBLIC_ORIGIN"
echo "  docker compose --env-file .env.docker up -d --build"
