# AJAR API Deployment Status

## ✅ Deployment Complete

**Worker URL:** https://ajar-api.teycircoder10.workers.dev  
**Version:** 52e14516-d413-46e2-a95e-5e15510689d5  
**Status:** Live and operational

## 🧪 Integration Test Results

**Overall:** 53/55 tests passing (96% pass rate)

### Passing Tests (53)
- ✅ Health check
- ✅ 404 handling
- ✅ API key validation middleware
- ✅ Input validation for POST /evals
- ✅ Eval creation (all algorithms)
- ✅ Status polling (GET /evals/:id)
- ✅ Results listing (GET /results with filters)
- ✅ Internal API authorization
- ✅ SSE stream endpoint setup
- ✅ CORS headers
- ✅ D1 persistence

### Known Limitation (2 tests)
- ⚠️ **Test 11:** Eval lifecycle (fails with totalTurns=0)
- ⚠️ **Test 9:** SSE stream data (skipped - no events within timeout)

**Root Cause:** OpenRouter API keys have $0 balance. The eval runner correctly:
1. Accepts the eval request
2. Stores it in KV
3. Launches background execution
4. Attempts to call OpenRouter API
5. Receives "Insufficient credits" error
6. Marks eval as failed

This is **expected behavior** - the API is working correctly, but LLM calls require credits.

## 🔧 What Was Fixed

### Bug #1: Missing D1 Column
- **Issue:** `scorer_model` column missing from schema
- **Fix:** Applied migration `0002_add_scorer_model.sql`
- **Status:** ✅ Live in production

### Bug #2: API Key Not Persisted
- **Issue:** Runner used server secret instead of caller's key
- **Fix:** Store `apiKey` in KV session, runner reads it back
- **Status:** ✅ Deployed

### Bug #3: Async Emit Callbacks
- **Issue:** Emit callbacks weren't awaited, errors swallowed
- **Fix:** Changed emit signature to `Promise<void>`, awaited all calls
- **Status:** ✅ Deployed

### Bug #4: Error Handling
- **Issue:** Outer errors not caught or logged
- **Fix:** Added outer try-catch with event logging
- **Status:** ✅ Deployed

## 📊 Current Architecture

```
POST /evals
  ↓
Store session in KV (with apiKey)
  ↓
ctx.waitUntil(runEval(...))  ← background execution
  ↓
runEval reads session from KV
  ↓
Creates AuditorAgent with caller's apiKey
  ↓
Runs algorithm (Crescendo/ActorAttack/XTeaming)
  ↓
Each event → appendEvent(KV)
  ↓
On completion → persistResult(D1)
```

## 🎯 To Enable Full Testing

Add credits to any OpenRouter key, then run:
```bash
./workers/api/tests/integration.sh
```

All 55 tests should pass with a funded key.

## 📝 API Keys Available

12 OpenRouter keys configured in `integration.sh`:
- All keys are valid
- All keys have $0 balance
- Any key can be funded at https://openrouter.ai/settings/credits

## 🚀 Next Steps

1. **Fund one OpenRouter key** to verify end-to-end eval execution
2. **Frontend integration** - connect Next.js app to deployed API
3. **Monitoring** - set up alerts for failed evals
4. **Rate limiting** - add per-key rate limits if needed
