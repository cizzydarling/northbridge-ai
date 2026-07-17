import { expect, test } from "@playwright/test";


test("new user registers, signs in, and accepts required disclosures", async ({
  page,
}) => {
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
});
