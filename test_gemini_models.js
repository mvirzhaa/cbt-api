/**
 * Script untuk test model Gemini mana yang available dengan API key Anda
 *
 * Usage:
 * node test_gemini_models.js
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Daftar model yang akan dicoba
const MODELS_TO_TEST = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.5-pro",
    "gemini-2.0-flash-exp",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-1.5-pro",
    "gemini-1.5-flash-latest",
    "gemini-pro",
    "gemini-flash-1.5",
];

const testModel = async (modelName) => {
    try {
        console.log(`\n🔍 Testing: ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });

        const prompt = "Test: 1+1=? Reply with just the number.";
        const result = await model.generateContent(prompt);
        const response = result.response.text();

        console.log(`✅ SUCCESS: ${modelName}`);
        console.log(`   Response: ${response.trim()}`);
        return { model: modelName, status: 'success', response: response.trim() };
    } catch (error) {
        const errorMsg = error.message.substring(0, 150);
        console.log(`❌ FAILED: ${modelName}`);
        console.log(`   Error: ${errorMsg}...`);
        return { model: modelName, status: 'failed', error: errorMsg };
    }
};

const testAllModels = async () => {
    console.log("=".repeat(60));
    console.log("🧪 GEMINI API MODEL TESTER");
    console.log("=".repeat(60));
    console.log(`API Key: ${process.env.GEMINI_API_KEY ? '✅ Found' : '❌ Not found'}`);
    console.log(`API Key (first 20 chars): ${process.env.GEMINI_API_KEY?.substring(0, 20)}...`);
    console.log("=".repeat(60));

    const results = [];

    for (const modelName of MODELS_TO_TEST) {
        const result = await testModel(modelName);
        results.push(result);

        // Delay 2 detik antar test untuk avoid rate limit
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 SUMMARY RESULTS");
    console.log("=".repeat(60));

    const successful = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'failed');

    console.log(`\n✅ WORKING MODELS (${successful.length}):`);
    successful.forEach(r => {
        console.log(`   - ${r.model}`);
    });

    console.log(`\n❌ FAILED MODELS (${failed.length}):`);
    failed.forEach(r => {
        console.log(`   - ${r.model}`);
        console.log(`     Reason: ${r.error.substring(0, 80)}...`);
    });

    console.log("\n" + "=".repeat(60));
    console.log("💡 RECOMMENDATION");
    console.log("=".repeat(60));

    if (successful.length > 0) {
        console.log(`\n✅ Use this model in aiService.js:`);
        console.log(`\nconst MODEL_PRIORITY = [`);
        successful.forEach((r, idx) => {
            console.log(`    "${r.model}"${idx < successful.length - 1 ? ',' : ''}`);
        });
        console.log(`];`);
    } else {
        console.log(`\n❌ NO WORKING MODELS FOUND!`);
        console.log(`\nPossible issues:`);
        console.log(`1. Invalid API key`);
        console.log(`2. API key has no quota`);
        console.log(`3. All models are temporarily down`);
        console.log(`\nGet new API key: https://aistudio.google.com/apikey`);
    }

    console.log("\n" + "=".repeat(60));
};

// Run test
testAllModels()
    .then(() => {
        console.log("\n✅ Test completed!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Test failed:", error);
        process.exit(1);
    });
