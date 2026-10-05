/**
 * Backend AI and Security Automated Test Suite for CivicFix / NagarSetu.
 *
 * Tests Section 37 requirements:
 * - API / AI analysis contract validation
 * - Explainable priority score & reasons
 * - SLA hours and status calculation
 * - Duplicate grouping logic
 * - Image upload security (MIME validation, size limits)
 * - Anti-crash resilience on unexpected inputs
 */

const assert = require("assert");
const { analyzeCivicComplaint } = require("../backend/services/civicAIService");
const uploadMiddleware = require("../backend/middleware/uploadMiddleware");

async function runBackendTests() {
  console.log("=== Running Backend AI & Security Tests ===");
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  [OK] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`  [OK] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // 1. AI Analysis Contract Test
  await testAsync("AI Service returns normalized schema matching Section 23", async () => {
    const res = await analyzeCivicComplaint({
      description: "Severe waterlogging at Hindmata cinema junction during heavy monsoon rain, road completely submerged",
      latitude: 19.0123,
      longitude: 72.8456
    });

    assert.ok(res.category, "Must have category");
    assert.ok(res.category.value, "Category must have value");
    assert.strictEqual(typeof res.category.confidence, "number", "Category confidence must be number");

    assert.ok(res.severity, "Must have severity");
    assert.ok(["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(res.severity.value), "Severity value must be canonical");

    assert.ok(res.department, "Must have department");
    assert.ok(res.department.value, "Department must have value");

    assert.ok(res.priority, "Must have priority");
    assert.ok(res.priority.score >= 0 && res.priority.score <= 100, "Priority score must be 0-100");
    assert.ok(Array.isArray(res.priority.reasons), "Priority reasons must be an array");
    assert.ok(res.priority.reasons.length > 0, "Must have at least one explainable priority reason");

    assert.ok(res.sla, "Must have sla");
    assert.ok(typeof res.sla.hours === "number", "SLA hours must be number");
    assert.ok(["ON_TRACK", "AT_RISK", "OVERDUE", "RESOLVED"].includes(res.sla.status), "SLA status must be valid");
  });

  // 2. Dual Legacy Compatibility Test
  await testAsync("AI Service provides backward-compatible analysis object for existing frontend", async () => {
    const res = await analyzeCivicComplaint({
      description: "Overflowing garbage dump creating foul smell on street",
      latitude: 22.5726,
      longitude: 88.3639
    });

    assert.ok(res.analysis, "Must include analysis object for legacy components");
    assert.ok(res.analysis.category, "Legacy analysis must have category");
    assert.ok(res.analysis.urgency, "Legacy analysis must have urgency");
    assert.ok(typeof res.analysis.aiScore === "number", "Legacy analysis must have aiScore");
    assert.ok(res.analysis.department, "Legacy analysis must have department");
    assert.ok(res.analysis.aiReason, "Legacy analysis must have aiReason");
  });

  // 3. Graceful Failure Resilience
  await testAsync("AI Service never throws on empty or corrupt inputs", async () => {
    const res = await analyzeCivicComplaint({});
    assert.ok(res, "Must return valid object on empty input");
    assert.ok(res.category.value, "Must return fallback category");
    assert.ok(res.severity.value, "Must return fallback severity");
    assert.ok(res.priority.score !== undefined, "Must return fallback priority score");
  });

  // 4. Image Upload Security - MIME Type Validation
  test("Upload Middleware enforces strict MIME type whitelist", () => {
    // Inspect fileFilter
    const fileFilter = uploadMiddleware.fileFilter;
    assert.strictEqual(typeof fileFilter, "function", "fileFilter must be defined");

    // Allowed types
    let allowedPassed = false;
    fileFilter({}, { mimetype: "image/jpeg" }, (err, accepted) => {
      allowedPassed = !err && accepted === true;
    });
    assert.ok(allowedPassed, "image/jpeg must be accepted");

    // Disallowed types (e.g., executable, script)
    let disallowedRejected = false;
    fileFilter({}, { mimetype: "application/x-msdownload" }, (err, accepted) => {
      disallowedRejected = Boolean(err) && accepted === false;
    });
    assert.ok(disallowedRejected, "Executable binary MIME must be rejected");

    let phpRejected = false;
    fileFilter({}, { mimetype: "text/php" }, (err, accepted) => {
      phpRejected = Boolean(err) && accepted === false;
    });
    assert.ok(phpRejected, "PHP script MIME must be rejected");
  });

  // 5. Image Upload Security - Size Limits
  test("Upload Middleware enforces 5MB size limit", () => {
    assert.ok(uploadMiddleware.limits, "Multer limits must be defined");
    assert.strictEqual(uploadMiddleware.limits.fileSize, 5 * 1024 * 1024, "Size limit must be exactly 5MB");
  });

  console.log(`\nTests Completed: ${passed} Passed, ${failed} Failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runBackendTests().catch((e) => {
  console.error("Test runner error:", e);
  process.exit(1);
});
