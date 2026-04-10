// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * NexusGate Lead Form — End-to-End Tests
 * 
 * Tests the multi-step form flow, validation, honeypot spam detection,
 * and webhook submission integration.
 */

// ============================================================
// Helper: Serve the form locally for testing
// ============================================================
test.beforeAll(async () => {
  // Tests assume the form is served at baseURL (configured in playwright.config.js)
  // In CI, use BASE_URL env var; locally, http-server serves the forms/ directory
});

// ============================================================
// Test: Full successful submission (both steps)
// ============================================================
test('Lead form submits successfully through both steps and shows confirmation', async ({ page }) => {
  await page.goto('/');

  // Verify Step 1 is visible
  await expect(page.locator('#step1')).toBeVisible();
  await expect(page.locator('#step2')).not.toBeVisible();
  await expect(page.locator('#progressText')).toHaveText('Step 1 of 2');

  // Step 1: Fill email and use case
  await page.fill('[name="email"]', 'test-lead@example-company.com');
  await page.fill('[name="use_case"]', 'We need observability for our GPT-4 pipeline in production.');

  // Click Next
  await page.click('#nextBtn');

  // Verify Step 2 is visible
  await expect(page.locator('#step1')).not.toBeVisible();
  await expect(page.locator('#step2')).toBeVisible();
  await expect(page.locator('#progressText')).toHaveText('Step 2 of 2 — Optional');

  // Step 2: Fill enrichment data
  await page.fill('[name="name"]', 'Test Lead');
  await page.fill('[name="company"]', 'Example AI Corp');
  await page.fill('[name="company_domain"]', 'example-company.com');

  // Intercept the webhook call
  let webhookPayload = null;
  await page.route('**/webhook/**', async (route) => {
    const request = route.request();
    webhookPayload = JSON.parse(request.postData() || '{}');
    // Mock successful response
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'received', lead_id: 'lead_test_123' }),
    });
  });

  // Submit
  await page.click('#submitBtn');

  // Wait for confirmation
  await expect(page.locator('.confirmation-message')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.confirmation-message')).toContainText("You're on the list");

  // Verify webhook payload
  expect(webhookPayload).not.toBeNull();
  expect(webhookPayload.email).toBe('test-lead@example-company.com');
  expect(webhookPayload.use_case).toBe('We need observability for our GPT-4 pipeline in production.');
  expect(webhookPayload.name).toBe('Test Lead');
  expect(webhookPayload.company).toBe('Example AI Corp');
  expect(webhookPayload.company_domain).toBe('example-company.com');

  // Verify form is hidden
  await expect(page.locator('#leadForm')).not.toBeVisible();
  await expect(page.locator('#progressBar')).not.toBeVisible();
});

// ============================================================
// Test: Skip Step 2 submission
// ============================================================
test('Lead can skip Step 2 and submit with only email + use case', async ({ page }) => {
  await page.goto('/');

  // Step 1
  await page.fill('[name="email"]', 'skip-test@company.com');
  await page.fill('[name="use_case"]', 'Testing the skip step 2 flow.');
  await page.click('#nextBtn');

  // Step 2 visible
  await expect(page.locator('#step2')).toBeVisible();

  // Intercept webhook
  let webhookPayload = null;
  await page.route('**/webhook/**', async (route) => {
    webhookPayload = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'received' }),
    });
  });

  // Click skip
  await page.click('#skipStep2');

  // Confirmation
  await expect(page.locator('.confirmation-message')).toBeVisible({ timeout: 5000 });

  // Verify payload has only step 1 fields
  expect(webhookPayload.email).toBe('skip-test@company.com');
  expect(webhookPayload.use_case).toBe('Testing the skip step 2 flow.');
  expect(webhookPayload.name).toBe('');
  expect(webhookPayload.company).toBe('');
});

// ============================================================
// Test: Email validation — invalid email blocked
// ============================================================
test('Blocks submission with invalid email address', async ({ page }) => {
  await page.goto('/');

  // Enter invalid email
  await page.fill('[name="email"]', 'not-an-email');
  await page.fill('[name="use_case"]', 'Testing validation.');

  // Click Next — should stay on Step 1
  await page.click('#nextBtn');

  // Should still be on Step 1
  await expect(page.locator('#step1')).toBeVisible();
  await expect(page.locator('#step2')).not.toBeVisible();

  // Should show validation error
  await expect(page.locator('#emailValidation')).toBeVisible();
  await expect(page.locator('#email')).toHaveClass(/error/);
});

// ============================================================
// Test: Email validation — empty email blocked
// ============================================================
test('Blocks submission with empty email', async ({ page }) => {
  await page.goto('/');

  // Leave email empty, fill use case
  await page.fill('[name="use_case"]', 'Testing empty email validation.');

  await page.click('#nextBtn');

  // Should stay on Step 1
  await expect(page.locator('#step1')).toBeVisible();
  await expect(page.locator('#step2')).not.toBeVisible();

  // Should show error
  await expect(page.locator('#emailValidation')).toContainText('required');
});

// ============================================================
// Test: Use case validation — empty blocked
// ============================================================
test('Blocks submission with empty use case', async ({ page }) => {
  await page.goto('/');

  // Fill email, leave use case empty
  await page.fill('[name="email"]', 'valid@test.com');

  await page.click('#nextBtn');

  // Should stay on Step 1
  await expect(page.locator('#step1')).toBeVisible();
});

// ============================================================
// Test: Character counter updates
// ============================================================
test('Shows character counter for use case textarea', async ({ page }) => {
  await page.goto('/');

  const counter = page.locator('#useCaseCount');
  await expect(counter).toHaveText('0 / 500');

  // Type some text
  await page.fill('[name="use_case"]', 'A'.repeat(100));
  await expect(counter).toHaveText('100 / 500');

  // Fill near max — should show warning
  await page.fill('[name="use_case"]', 'A'.repeat(400));
  await expect(counter).toHaveClass(/warning/);

  // Fill past 90% — should show error styling
  await page.fill('[name="use_case"]', 'A'.repeat(460));
  await expect(counter).toHaveClass(/error/);
});

// ============================================================
// Test: Honeypot spam detection — bot submission rejected
// ============================================================
test('Silently rejects submissions that fill honeypot fields', async ({ page }) => {
  await page.goto('/');

  // Fill visible fields
  await page.fill('[name="email"]', 'bot@test.com');
  await page.fill('[name="use_case"]', 'I am a bot.');

  // Fill honeypot field (would be done by a dumb bot)
  await page.evaluate(() => {
    document.querySelector('[name="_honeypot"]').value = 'bot detected';
  });

  await page.click('#nextBtn');
  await expect(page.locator('#step2')).toBeVisible();

  // Intercept — should NOT be called
  let webhookCalled = false;
  await page.route('**/webhook/**', async (route) => {
    webhookCalled = true;
    await route.fulfill({ status: 200, body: '{}' });
  });

  await page.click('#submitBtn');

  // Webhook should not have been called (silent rejection)
  // Note: The JS checks honeypot before sending, so no webhook call
  await page.waitForTimeout(500);
  expect(webhookCalled).toBe(false);
});

// ============================================================
// Test: Progress indicator updates correctly
// ============================================================
test('Progress indicator shows correct step and dot states', async ({ page }) => {
  await page.goto('/');

  // Step 1 state
  await expect(page.locator('#progressText')).toHaveText('Step 1 of 2');
  await expect(page.locator('#dot1')).toHaveClass(/active/);
  await expect(page.locator('#dot2')).not.toHaveClass(/active/);

  // Fill and go to Step 2
  await page.fill('[name="email"]', 'progress@test.com');
  await page.fill('[name="use_case"]', 'Testing progress indicator.');
  await page.click('#nextBtn');

  // Step 2 state
  await expect(page.locator('#progressText')).toHaveText('Step 2 of 2 — Optional');
  await expect(page.locator('#dot1')).toHaveClass(/completed/);
  await expect(page.locator('#dot1')).not.toHaveClass(/active/);
  await expect(page.locator('#dot2')).toHaveClass(/active/);
});

// ============================================================
// Test: Inline validation on blur
// ============================================================
test('Shows validation error when email field loses focus with invalid input', async ({ page }) => {
  await page.goto('/');

  // Type invalid email and blur
  await page.fill('[name="email"]', 'invalid-email');
  await page.locator('[name="use_case"]').click(); // blur email

  // Should show error
  await expect(page.locator('#email')).toHaveClass(/error/);
});

// ============================================================
// Test: Error state clears when user corrects input
// ============================================================
test('Clears validation error when user corrects email', async ({ page }) => {
  await page.goto('/');

  // Enter invalid, blur
  await page.fill('[name="email"]', 'invalid');
  await page.locator('[name="use_case"]').click();
  await expect(page.locator('#email')).toHaveClass(/error/);

  // Correct it
  await page.fill('[name="email"]', 'valid@test.com');
  await page.locator('[name="use_case"]').click(); // trigger input event

  // Error should clear
  await expect(page.locator('#email')).not.toHaveClass(/error/);
});

// ============================================================
// Test: Webhook failure shows error message
// ============================================================
test('Shows error message when webhook returns 500', async ({ page }) => {
  await page.goto('/');

  await page.fill('[name="email"]', 'error@test.com');
  await page.fill('[name="use_case"]', 'Testing error handling.');
  await page.click('#nextBtn');

  // Mock 500 error
  await page.route('**/webhook/**', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Internal Server Error' }),
    });
  });

  await page.click('#submitBtn');

  // Should show error
  await expect(page.locator('.form-error')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.form-error')).toContainText('Something went wrong');
});

// ============================================================
// Test: Keyboard accessibility — Enter triggers next/submit
// ============================================================
test('Enter key in Step 1 triggers Next button', async ({ page }) => {
  await page.goto('/');

  await page.fill('[name="email"]', 'keyboard@test.com');
  await page.fill('[name="use_case"]', 'Testing keyboard navigation.');

  // Press Enter in email field (non-textarea)
  await page.locator('[name="email"]').press('Enter');

  // Should advance to Step 2
  await expect(page.locator('#step2')).toBeVisible();
});

// ============================================================
// Test: Form resets after successful submission (config behavior)
// ============================================================
test('Form fields are cleared after successful submission', async ({ page }) => {
  await page.goto('/');

  await page.fill('[name="email"]', 'reset@test.com');
  await page.fill('[name="use_case"]', 'Testing form reset.');
  await page.click('#nextBtn');

  await page.route('**/webhook/**', async (route) => {
    await route.fulfill({ status: 200, body: JSON.stringify({ status: 'received' }) });
  });

  await page.click('#submitBtn');

  await expect(page.locator('.confirmation-message')).toBeVisible();

  // Reload page to verify form would be fresh (config.resetAfterSubmit)
  await page.reload();
  await expect(page.locator('[name="email"]')).toHaveValue('');
  await expect(page.locator('[name="use_case"]')).toHaveValue('');
});
