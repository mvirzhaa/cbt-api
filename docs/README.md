# CBT API Documentation

Complete documentation for the CBT (Computer Based Test) API system.

## 📋 Table of Contents

### Quick Start
- **[Fix AI Errors Now](./FIX_AI_ERROR_NOW.md)** ⚡ - 5-minute quick fix for common AI errors
- **[Deployment Guide](./DEPLOY_TO_SERVER.md)** - Step-by-step deployment to production server

### Feature Guides
- **[Multiple Choice Guide](./MULTIPLE_CHOICE_GUIDE.md)** - Complete guide for TIPE_1 & TIPE_2 implementation
- **[Test Cases](./TEST_MULTIPLE_CHOICE.md)** - Comprehensive test cases and scoring examples

### Troubleshooting
- **[AI Troubleshooting](./AI_TROUBLESHOOTING.md)** - Complete guide for fixing AI service errors
- **[Emergency Fix](./EMERGENCY_FIX_GEMINI.md)** - Emergency procedures for Gemini API issues

### Development
- **[Testing Checklist](./TESTING_CHECKLIST.md)** - Pre-deployment testing guide
- **[Architecture](./arsitektur_cbt_api.md)** - System architecture (Indonesian)
- **[Agent Guide](./AGENT_CBT_API.md)** - AI agent implementation guide

### Historical
- **[Revisi Sistem](./revisi_sistem.md)** - System revision notes (Indonesian)

---

## 🚀 Quick Links

### For Developers
1. Start with [Architecture](./arsitektur_cbt_api.md) to understand the system
2. Follow [Testing Checklist](./TESTING_CHECKLIST.md) before deploying
3. Use [Multiple Choice Guide](./MULTIPLE_CHOICE_GUIDE.md) for frontend integration

### For DevOps
1. Read [Deployment Guide](./DEPLOY_TO_SERVER.md) for deployment steps
2. Keep [AI Troubleshooting](./AI_TROUBLESHOOTING.md) handy for production issues
3. Use [Fix AI Errors Now](./FIX_AI_ERROR_NOW.md) for quick emergency fixes

### For QA/Testing
1. Follow [Test Cases](./TEST_MULTIPLE_CHOICE.md) for validation
2. Use [Testing Checklist](./TESTING_CHECKLIST.md) for comprehensive testing

---

## 🆘 Common Issues

### Question Creation Returns 400
**Solution:** Check [Testing Checklist](./TESTING_CHECKLIST.md#-validation-rules-summary) for correct payload format

### AI Grading Not Working
**Solution:** Follow [Fix AI Errors Now](./FIX_AI_ERROR_NOW.md) (5-minute fix)

### 404 Model Not Found
**Solution:** See [AI Troubleshooting](./AI_TROUBLESHOOTING.md#1-error-404-model-not-found)

### 503 Service Unavailable
**Solution:** See [Emergency Fix](./EMERGENCY_FIX_GEMINI.md#solution-3-generate-new-api-key)

---

## 📝 Document Status

| Document | Last Updated | Status |
|----------|--------------|--------|
| FIX_AI_ERROR_NOW.md | 2026-05-23 | ✅ Current |
| AI_TROUBLESHOOTING.md | 2026-05-22 | ✅ Current |
| TESTING_CHECKLIST.md | 2026-05-23 | ✅ Current |
| MULTIPLE_CHOICE_GUIDE.md | 2026-05-22 | ✅ Current |
| DEPLOY_TO_SERVER.md | 2026-05-22 | ✅ Current |
| TEST_MULTIPLE_CHOICE.md | 2026-05-22 | ✅ Current |
| EMERGENCY_FIX_GEMINI.md | 2026-05-22 | ⚠️ Reference |
| AGENT_CBT_API.md | 2026-05-04 | 📚 Historical |
| arsitektur_cbt_api.md | 2026-04-30 | 📚 Historical |
| revisi_sistem.md | 2026-05-18 | 📚 Historical |

---

## 🔗 External Resources

- **Gemini API Docs:** https://ai.google.dev/gemini-api/docs
- **Prisma Docs:** https://www.prisma.io/docs
- **Express.js Docs:** https://expressjs.com/

---

## 📞 Support

For issues not covered in these documents:
1. Check server logs: `pm2 logs cbt-skripsi-api`
2. Review error details in [AI Troubleshooting](./AI_TROUBLESHOOTING.md)
3. Contact system administrator
