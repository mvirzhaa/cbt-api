#!/bin/bash

# Quick API Test Script
# Usage: bash test_question_api.sh <base_url> <token>

BASE_URL="${1:-http://localhost:3000}"
TOKEN="${2:-your_token_here}"

echo "======================================"
echo "🧪 Testing Question API"
echo "Base URL: $BASE_URL"
echo "======================================"
echo ""

# Test 1: Create TIPE_1
echo "Test 1: Create TIPE_1 (Single Choice)"
echo "--------------------------------------"
curl -X POST "$BASE_URL/api/questions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "exam_id": 1,
    "tipe_soal": "TIPE_1",
    "cpmk": "CPMK-01",
    "isi_soal": "Test Single Choice?",
    "kunci_jawaban": "C",
    "bobot_nilai": 10,
    "opsi_jawaban": ["Option A", "Option B", "Option C", "Option D", "Option E"]
  }'
echo -e "\n"

# Test 2: Create TIPE_2
echo "Test 2: Create TIPE_2 (Multiple Choice)"
echo "----------------------------------------"
curl -X POST "$BASE_URL/api/questions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "exam_id": 1,
    "tipe_soal": "TIPE_2",
    "cpmk": "CPMK-02",
    "isi_soal": "Test Multiple Choice?",
    "kunci_jawaban": "A,C,E",
    "bobot_nilai": 15,
    "opsi_jawaban": ["Option A", "Option B", "Option C", "Option D", "Option E"]
  }'
echo -e "\n"

# Test 3: Create TIPE_3
echo "Test 3: Create TIPE_3 (Essay)"
echo "------------------------------"
curl -X POST "$BASE_URL/api/questions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "exam_id": 1,
    "tipe_soal": "TIPE_3",
    "cpmk": "CPMK-03",
    "isi_soal": "Test Essay Question?",
    "kunci_jawaban": "Sample rubric",
    "bobot_nilai": 20
  }'
echo -e "\n"

# Test 4: Create TIPE_4
echo "Test 4: Create TIPE_4 (File Upload)"
echo "------------------------------------"
curl -X POST "$BASE_URL/api/questions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "exam_id": 1,
    "tipe_soal": "TIPE_4",
    "cpmk": "CPMK-04",
    "isi_soal": "Test File Upload Question?",
    "bobot_nilai": 25
  }'
echo -e "\n"

# Test 5: Check AI Queue Status
echo "Test 5: AI Queue Status"
echo "-----------------------"
curl -X GET "$BASE_URL/api/grading/ai-queue/status" \
  -H "Authorization: Bearer $TOKEN"
echo -e "\n"

echo ""
echo "======================================"
echo "✅ Tests completed!"
echo "======================================"
