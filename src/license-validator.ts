// Copyright (c) 2024-2026 Soumya Debnath <soumyadebnath1619@gmail.com>. All rights reserved.
// Business Source License 1.1 (BSL 1.1) — Commercial License Key Validator

export interface LicenseValidationOptions {
  licenseKey?: string;
  allowEval?: boolean;
}

export class LicenseValidator {
  private static readonly AUTHOR = "Soumya Debnath";
  private static readonly CONTACT = "soumyadebnath1619@gmail.com";

  public static validate(options?: LicenseValidationOptions): boolean {
    const key = options?.licenseKey || (typeof process !== "undefined" ? process.env.COMMERCIAL_LICENSE_KEY : undefined);

    // Development / Localhost evaluation bypass
    const isDev = typeof window !== "undefined" 
      ? window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      : typeof process !== "undefined" && process.env.NODE_ENV !== "production";

    if (isDev || options?.allowEval) {
      return true;
    }

    if (!key || !key.startsWith("BSL11-")) {
      // This warning is emitted once per GhostSearch instance, inside the
      // consumer's browser console and their log/error-reporting pipeline.
      // Two deliberate changes from the previous message:
      //   1. No personal phone number. Shipping one in dist/ turns every
      //      downstream deployment into a third-party PII disclosure.
      //   2. No "DMCA § 1201" assertion. That section governs circumvention of
      //      technical protection measures, not unlicensed use; the operative
      //      terms are ordinary copyright plus the BSL 1.1 grant in LICENSE.
      console.warn(
        `GhostSearch: production use requires a commercial license under the ` +
        `Business Source License 1.1. See LICENSE and COMMERCIAL_LICENSE.md, or ` +
        `contact ${LicenseValidator.CONTACT} to obtain a key. ` +
        `Set COMMERCIAL_LICENSE_KEY to silence this warning.`
      );
      return false;
    }

    return true;
  }
}
