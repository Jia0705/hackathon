#!/bin/bash

# GPS Stability & Corridor Intelligence - Setup Script
# This script automates the complete setup process

echo "====================================="
echo "GPS Stability & Corridor Intelligence"
echo "Automated Setup Script"
echo "====================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Installing dependencies...${NC}"
echo ""

# Install dev dependencies
echo -e "${CYAN}Installing Prisma (dev)...${NC}"
npm install --save-dev prisma
if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Failed to install Prisma${NC}"
    exit 1
fi

# Install main dependencies
echo -e "${CYAN}Installing main dependencies...${NC}"
npm install @prisma/client maplibre-gl h3-js @turf/turf @turf/distance @turf/bearing csv-parse dayjs
if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Failed to install dependencies${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

echo -e "${YELLOW}Step 2: Setting up database...${NC}"
echo ""

# Generate Prisma Client
echo -e "${CYAN}Generating Prisma Client...${NC}"
npx prisma generate
if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Failed to generate Prisma Client${NC}"
    exit 1
fi

# Create database migration
echo -e "${CYAN}Creating database migration...${NC}"
npx prisma migrate dev --name init
if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Failed to create migration${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ Database initialized${NC}"
echo ""

echo "====================================="
echo -e "${GREEN}Setup Complete!${NC}"
echo "====================================="
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Run: npm run dev"
echo "2. Open: http://localhost:3000"
echo "3. Click 'Start Replay' in the Simulator panel"
echo ""
echo -e "${YELLOW}Documentation:${NC}"
echo "- QUICKSTART.md - Quick start guide"
echo "- IMPLEMENTATION.md - Full system overview"
echo "- CHECKLIST.md - Verification checklist"
echo ""
echo -e "${CYAN}Happy hacking! 🚀${NC}"
