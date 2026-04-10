#!/usr/bin/env bash

# ============================================================
# setup.sh — NexusGate Lead Generator Environment Setup
# ============================================================
# This script helps you set up the project for local development.
# It validates your environment, installs dependencies, and 
# provides a checklist of required credentials.
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo ""
echo -e "${BOLD}========================================"
echo -e "  NexusGate Lead Generator — Setup"
echo -e "========================================${NC}"
echo ""

# ============================================================
# Check Node.js version
# ============================================================
echo -e "${CYAN}Checking Node.js version...${NC}"
if command -v node &> /dev/null; then
  NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VERSION" -ge 20 ]; then
    echo -e "  ${GREEN}✅ Node.js $(node -v)${NC}"
  else
    echo -e "  ${RED}❌ Node.js 20+ required (found $(node -v))${NC}"
    exit 1
  fi
else
  echo -e "  ${RED}❌ Node.js not found. Install Node.js 20+ from https://nodejs.org${NC}"
  exit 1
fi

# ============================================================
# Check npm
# ============================================================
echo -e "${CYAN}Checking npm...${NC}"
if command -v npm &> /dev/null; then
  echo -e "  ${GREEN}✅ npm $(npm -v)${NC}"
else
  echo -e "  ${RED}❌ npm not found${NC}"
  exit 1
fi

# ============================================================
# Install dependencies
# ============================================================
echo ""
echo -e "${CYAN}Installing dependencies...${NC}"
cd "$PROJECT_DIR"
npm install
echo -e "  ${GREEN}✅ Dependencies installed${NC}"

# ============================================================
# Install Playwright browsers
# ============================================================
echo ""
echo -e "${CYAN}Installing Playwright browsers...${NC}"
npx playwright install --with-deps 2>/dev/null || {
  echo -e "  ${YELLOW}⚠️ Playwright browser install had issues (may need sudo)${NC}"
  echo -e "  ${YELLOW}   Run: npx playwright install --with-deps${NC}"
}

# ============================================================
# Check .env file
# ============================================================
echo ""
echo -e "${CYAN}Checking environment configuration...${NC}"
if [ -f "$PROJECT_DIR/.env" ]; then
  echo -e "  ${GREEN}✅ .env file exists${NC}"
else
  echo -e "  ${YELLOW}⚠️ .env file not found${NC}"
  echo -e "  ${YELLOW}   Creating from .env.example...${NC}"
  cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
  echo -e "  ${GREEN}✅ Created .env — please fill in your credentials${NC}"
fi

# ============================================================
# Credential checklist
# ============================================================
echo ""
echo -e "${BOLD}========================================"
echo -e "  Required Credentials Checklist"
echo -e "========================================${NC}"
echo ""

check_env_var() {
  local var_name="$1"
  local description="$2"
  if [ -f "$PROJECT_DIR/.env" ]; then
    local value=$(grep "^${var_name}=" "$PROJECT_DIR/.env" 2>/dev/null | cut -d'=' -f2)
    if [ -n "$value" ] && [ "$value" != "your-$var_name" ] && [ "$value" != "your-${var_name,,}" ]; then
      echo -e "  ${GREEN}✅${NC} $description ($var_name)"
    else
      echo -e "  ${RED}❌${NC} $description ($var_name) — ${YELLOW}needs configuration${NC}"
    fi
  else
    echo -e "  ${RED}❌${NC} $description ($var_name) — ${YELLOW}.env not found${NC}"
  fi
}

check_env_var "WEBHOOK_URL" "n8n Webhook URL"
check_env_var "APIFY_API_TOKEN" "Apify API Token"
check_env_var "OPENCLAW_API_KEY" "OpenClaw API Key"
check_env_var "SLACK_WEBHOOK_URL" "Slack Webhook URL (or use Telegram)"
check_env_var "GOOGLE_SHEETS_SPREADSHEET_ID" "Google Sheets Spreadsheet ID"

echo ""
echo -e "${BOLD}========================================"
echo -e "  Next Steps"
echo -e "========================================${NC}"
echo ""
echo "  1. Edit .env and fill in your credentials"
echo "  2. Import workflows/nexusgate-lead-generator.json into n8n"
echo "  3. Configure credentials in n8n for each node"
echo "  4. Activate the workflow in n8n"
echo "  5. Embed forms/index.html on nexusgate.tech"
echo "  6. Run tests: npx playwright test"
echo ""
echo -e "${GREEN}Setup complete! 🚀${NC}"
echo ""
