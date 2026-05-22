#!/bin/bash

# Quick Fix Script untuk AI Service Error
# Usage: bash quick_fix_ai.sh

echo "======================================"
echo "🔧 CBT API - AI Service Quick Fix"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if in correct directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found!${NC}"
    echo "Please run this script from the project root directory."
    exit 1
fi

echo -e "${YELLOW}Step 1: Testing Gemini API models...${NC}"
echo ""
node test_gemini_models.js > /tmp/gemini_test.log 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Model test completed${NC}"
    echo ""
    echo "Working models:"
    grep "SUCCESS:" /tmp/gemini_test.log | cut -d':' -f2
    echo ""
else
    echo -e "${RED}❌ Model test failed${NC}"
    echo "Check /tmp/gemini_test.log for details"
    exit 1
fi

echo -e "${YELLOW}Step 2: Checking current aiService.js...${NC}"
if [ -f "services/aiService.js" ]; then
    echo -e "${GREEN}✅ aiService.js found${NC}"
else
    echo -e "${RED}❌ aiService.js not found!${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 3: Restarting PM2 process...${NC}"

# Find PM2 process name
PM2_NAME=$(pm2 jlist | grep -o '"name":"[^"]*"' | head -1 | cut -d':' -f2 | tr -d '"')

if [ -z "$PM2_NAME" ]; then
    echo -e "${RED}❌ No PM2 process found${NC}"
    echo "Starting with default name..."
    pm2 start index.js --name cbt-api
    PM2_NAME="cbt-api"
else
    echo "Found PM2 process: $PM2_NAME"
    pm2 restart $PM2_NAME
fi

echo -e "${GREEN}✅ PM2 restarted${NC}"
echo ""

echo -e "${YELLOW}Step 4: Monitoring logs (30 seconds)...${NC}"
echo "Press Ctrl+C to stop monitoring"
echo ""

# Monitor logs for 30 seconds
timeout 30 pm2 logs $PM2_NAME 2>&1 | grep --line-buffered "AI Worker" &
MONITOR_PID=$!

sleep 30
kill $MONITOR_PID 2>/dev/null

echo ""
echo "======================================"
echo -e "${GREEN}✅ Quick fix completed!${NC}"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Test submit exam dengan TIPE_3 (esai)"
echo "2. Monitor logs: pm2 logs $PM2_NAME"
echo "3. Check full test result: cat /tmp/gemini_test.log"
echo ""
echo "If still failing, check: AI_TROUBLESHOOTING.md"
