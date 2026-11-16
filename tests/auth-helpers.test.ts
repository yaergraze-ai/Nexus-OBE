import test from "node:test";
import assert from "node:assert/strict";
import {
  authErrorMessage,
  cleanOtpToken,
  evaluatePasswordStrength,
  isValidIdentifier,
  isValidOtpToken,
  mapOAuthCallbackError,
  parseInitialAuthMode,
  safeNextPath,
} from "../src/lib/auth-helpers";

test("safeNextPath allows local paths and blocks open redirects", () => {
  assert.equal(safeNextPath("/pengaturan/keamanan"), "/pengaturan/keamanan");
  assert.equal(safeNextPath("/dashboard?tab=1"), "/dashboard?tab=1");
  assert.equal(safeNextPath("https://evil.example"), "/dashboard");
  assert.equal(safeNextPath("//evil.example"), "/dashboard");
  assert.equal(safeNextPath("/\\evil.example"), "/dashboard");
  assert.equal(safeNextPath(null), "/dashboard");
});

test("identifier and OTP validators handle campus emails, NIMs, NIDNs, and numeric tokens", () => {
  assert.equal(isValidIdentifier("mahasiswa@hananuttt.my.id"), true);
  assert.equal(isValidIdentifier("0421117105"), true);
  assert.equal(isValidIdentifier("240511088"), true);
  assert.equal(isValidIdentifier("ab"), false);
  assert.equal(isValidIdentifier("invalid-email"), false);

  assert.equal(cleanOtpToken(" 12a-34 56 "), "123456");
  assert.equal(isValidOtpToken("123456"), true);
  assert.equal(isValidOtpToken("12345678"), true);
  assert.equal(isValidOtpToken("12345"), false);
});

test("password strength enforces minimum 8 chars and scores complexity", () => {
  assert.equal(evaluatePasswordStrength("1234567").validLength, false);
  assert.equal(evaluatePasswordStrength("12345678").validLength, true);
  assert.equal(evaluatePasswordStrength("Dosen2026!").score >= 3, true);
  assert.equal(evaluatePasswordStrength("DosenHebat#2026").score, 4);
});

test("OAuth and auth error mapping returns safe user-facing messages", () => {
  assert.equal(mapOAuthCallbackError("access_denied", null), "cancelled");
  assert.equal(
    mapOAuthCallbackError("server_error", "Akun harus diundang oleh admin kampus"),
    "unregistered"
  );
  assert.equal(mapOAuthCallbackError("server_error", "unexpected"), "auth");
  assert.match(authErrorMessage("unregistered"), /belum terdaftar/i);
  assert.equal(authErrorMessage(undefined), "");
  assert.equal(parseInitialAuthMode("recovery"), "recovery");
  assert.equal(parseInitialAuthMode("register"), "register");
  assert.equal(parseInitialAuthMode("invalid"), "password");
});
