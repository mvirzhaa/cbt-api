/**
 * Direct API test untuk Gemini - bypass SDK
 * Test berbagai API versions
 */

require('dotenv').config();
const https = require('https');

const API_KEY = process.env.GEMINI_API_KEY;

// Test berbagai kombinasi API version dan model
const TESTS = [
    // API v1
    { version: 'v1', model: 'gemini-1.5-flash' },
    { version: 'v1', model: 'gemini-1.5-pro' },
    { version: 'v1', model: 'gemini-pro' },
    { version: 'v1', model: 'gemini-1.5-flash-latest' },

    // API v1beta
    { version: 'v1beta', model: 'gemini-1.5-flash' },
    { version: 'v1beta', model: 'gemini-1.5-pro' },
    { version: 'v1beta', model: 'gemini-pro' },

    // Tanpa prefix models/
    { version: 'v1', model: 'models/gemini-1.5-flash' },
    { version: 'v1beta', model: 'models/gemini-1.5-flash' },
];

function testAPI(version, model) {
    return new Promise((resolve) => {
        const postData = JSON.stringify({
            contents: [{
                parts: [{
                    text: "Test: 1+1=? Reply with just the number."
                }]
            }]
        });

        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/${version}/${model}:generateContent?key=${API_KEY}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': postData.length
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const json = JSON.parse(data);
                        const text = json.candidates?.[0]?.content?.parts?.[0]?.text || 'no response';
                        resolve({
                            success: true,
                            version,
                            model,
                            response: text.trim(),
                            status: res.statusCode
                        });
                    } catch (e) {
                        resolve({
                            success: false,
                            version,
                            model,
                            error: 'Parse error',
                            status: res.statusCode
                        });
                    }
                } else {
                    let error = '';
                    try {
                        const json = JSON.parse(data);
                        error = json.error?.message || json.error?.status || data.substring(0, 100);
                    } catch {
                        error = data.substring(0, 100);
                    }
                    resolve({
                        success: false,
                        version,
                        model,
                        error,
                        status: res.statusCode
                    });
                }
            });
        });

        req.on('error', (e) => {
            resolve({
                success: false,
                version,
                model,
                error: e.message,
                status: 'ERROR'
            });
        });

        req.write(postData);
        req.end();
    });
}

async function runTests() {
    console.log("=".repeat(70));
    console.log("🧪 GEMINI API DIRECT TEST (Bypass SDK)");
    console.log("=".repeat(70));
    console.log(`API Key: ${API_KEY ? '✅ Found' : '❌ Not found'}`);
    console.log(`API Key (first 20 chars): ${API_KEY?.substring(0, 20)}...`);
    console.log("=".repeat(70));
    console.log("");

    const results = [];

    for (const test of TESTS) {
        const fullPath = `${test.version}/${test.model}`;
        process.stdout.write(`🔍 Testing: ${fullPath}... `);

        const result = await testAPI(test.version, test.model);
        results.push(result);

        if (result.success) {
            console.log(`✅ SUCCESS (${result.status})`);
            console.log(`   Response: ${result.response}`);
        } else {
            console.log(`❌ FAILED (${result.status})`);
            console.log(`   Error: ${result.error.substring(0, 80)}...`);
        }

        // Delay 1 detik antar request
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log("");
    console.log("=".repeat(70));
    console.log("📊 SUMMARY");
    console.log("=".repeat(70));

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`\n✅ WORKING (${successful.length}):`);
    if (successful.length > 0) {
        successful.forEach(r => {
            console.log(`   - ${r.version}/${r.model}`);
        });
    } else {
        console.log("   None");
    }

    console.log(`\n❌ FAILED (${failed.length}):`);
    if (failed.length > 0) {
        // Group by error type
        const errorTypes = {};
        failed.forEach(r => {
            const key = `${r.status}`;
            if (!errorTypes[key]) errorTypes[key] = [];
            errorTypes[key].push(`${r.version}/${r.model}`);
        });

        Object.entries(errorTypes).forEach(([status, models]) => {
            console.log(`   Status ${status}: ${models.length} models`);
            models.forEach(m => console.log(`      - ${m}`));
        });
    }

    if (successful.length > 0) {
        console.log("\n" + "=".repeat(70));
        console.log("💡 RECOMMENDATION - Update aiService.js");
        console.log("=".repeat(70));

        const bestMatch = successful[0];
        console.log(`\nChange line 7 in services/aiService.js to:`);
        console.log(`\nconst model = genAI.getGenerativeModel({ model: "${bestMatch.model}" });`);
        console.log(`\nAnd update MODEL_PRIORITY array to:`);
        console.log(`const MODEL_PRIORITY = [`);
        successful.forEach((r, i) => {
            console.log(`    "${r.model}"${i < successful.length - 1 ? ',' : ''}`);
        });
        console.log(`];`);
    } else {
        console.log("\n" + "=".repeat(70));
        console.log("❌ CRITICAL: NO WORKING MODELS FOUND");
        console.log("=".repeat(70));
        console.log("\nPossible solutions:");
        console.log("1. Generate NEW API key: https://aistudio.google.com/apikey");
        console.log("2. Check quota: https://aistudio.google.com/");
        console.log("3. Try different Google account");
        console.log("4. Wait 24 hours (quota reset)");
        console.log("5. Upgrade to paid tier");

        console.log("\nTest API key manually:");
        console.log(`curl -H "Content-Type: application/json" \\`);
        console.log(`  -d '{"contents":[{"parts":[{"text":"Test"}]}]}' \\`);
        console.log(`  "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY?.substring(0, 20)}..."`);
    }

    console.log("\n" + "=".repeat(70));
}

runTests()
    .then(() => {
        console.log("\n✅ Test completed!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Test failed:", error);
        process.exit(1);
    });
