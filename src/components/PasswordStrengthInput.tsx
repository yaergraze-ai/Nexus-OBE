"use client";

import { useState } from "react";
import { evaluatePasswordStrength } from "@/lib/auth-helpers";

interface PasswordStrengthInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  placeholder?: string;
  showMeter?: boolean;
}

const BAR_COLORS = ["#e2e8f0", "#dc2626", "#d97706", "#0284c7", "#16a34a"] as const;

export function PasswordStrengthInput({
  id,
  label,
  value,
  onChange,
  autoComplete = "new-password",
  placeholder = "Minimal 8 karakter",
  showMeter = true,
}: PasswordStrengthInputProps) {
  const [visible, setVisible] = useState(false);
  const strength = evaluatePasswordStrength(value);

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="pw-wrap">
        <input
          id={id}
          className="input pw-input"
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={8}
          maxLength={128}
          placeholder={placeholder}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="pw-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Sembunyikan sandi" : "Tampilkan sandi"}
        >
          <i className={`bi bi-eye${visible ? "-slash" : ""}`} />
        </button>
      </div>
      {showMeter && (
        <div className="pw-meter" aria-live="polite">
          <div className="pw-bars" aria-hidden="true">
            {[1, 2, 3, 4].map((step) => (
              <span
                key={step}
                style={{
                  backgroundColor:
                    strength.score >= step ? BAR_COLORS[strength.score] : "#e2e8f0",
                }}
              />
            ))}
          </div>
          <div className="pw-meta">
            <span style={{ color: strength.score ? BAR_COLORS[strength.score] : "#64748b" }}>
              {strength.label}
            </span>
            <span>
              {strength.validLength ? "✓ 8+ karakter" : `${value.length}/8 karakter`}
              {strength.hasLettersAndNumbers ? " · ✓ huruf & angka" : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

