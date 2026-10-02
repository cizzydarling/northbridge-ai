import { expect, test } from "./fixtures";


test("new user registers, accepts disclosures, and completes onboarding", async ({
  page,
}) => {
  // Real NOC scoring can take ~36s locally, in addition to the UI onboarding steps.
  test.setTimeout(180_000);
  const email = `e2e-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  const password = "Launch-test-password-2026";

  await page.goto("/auth");
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create my account", exact: true }).click();

  await expect(page.getByText("Account created successfully.", { exact: true })).toBeVisible();

  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Access my workspace", exact: true }).click();

  await expect(page).toHaveURL(/\/legal\/disclosure/);
  await expect(
    page.getByRole("heading", {
      name: "Required Disclosures and Acknowledgments",
      exact: true,
    })
  ).toBeVisible();

  const acknowledgments = page.locator('input[type="checkbox"]');
  await expect(acknowledgments).toHaveCount(7);
  const acknowledgmentTitles = [
    "Terms of Use",
    "Privacy and Data Processing Consent",
    "AI Assistance Disclaimer",
    "No Legal Advice Acknowledgment",
    "User Responsibility Acknowledgment",
    "Platform Scope and Limitation Acknowledgment",
    "Final User Certification",
  ];
  for (let index = 0; index < acknowledgmentTitles.length; index += 1) {
    await page
      .getByText(acknowledgmentTitles[index], { exact: true })
      .click();
    await expect(acknowledgments.nth(index)).toBeChecked();
  }

  await page
    .getByRole("button", { name: "Accept and Continue", exact: true })
    .click();

  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(
    page.getByRole("heading", { name: /Welcome.*set up your profile/ })
  ).toBeVisible();

  await page.locator('input[name="first_name"]').fill("Launch");
  await page.locator('input[name="last_name"]').fill("Rehearsal");
  await page.getByPlaceholder("Search nationality or country", { exact: true }).fill("France");
  await page.getByRole("button", { name: "France", exact: true }).click();
  await page.getByPlaceholder("Search or enter your country", { exact: true }).fill("France");
  await page.getByRole("button", { name: "France", exact: true }).click();
  await page.locator('input[name="current_city"]').fill("Paris");
  await page.locator('select[name="marital_status"]').selectOption("single");
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await page.locator('input[name="age"]').fill("28");
  await page.locator('select[name="education"]').selectOption("bachelor");
  await page.locator('input[name="english_language_score"]').fill("9");
  await page.locator('input[name="experience_years"]').fill("3");
  await page.locator('input[name="occupation"]').fill("Administrative officer");
  await page.locator('input[name="noc_code"]').fill("13100");
  await page.locator('select[name="preferred_province"]').selectOption("Ontario");
  await page.getByRole("button", { name: "Finish Setup", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Profile successfully completed", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Welcome back, Launch", exact: true })).toBeVisible({ timeout: 120_000 });
});
