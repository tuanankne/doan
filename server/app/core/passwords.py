from __future__ import annotations

import hashlib
import hmac
import secrets


def hash_secret(secret: str, iterations: int = 120_000) -> str:
    """Hash a secret using PBKDF2-HMAC-SHA256 with random salt."""
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        secret.encode("utf-8"),
        salt.encode("utf-8"),
        iterations,
    )
    return f"pbkdf2_sha256${iterations}${salt}${dk.hex()}"


def verify_secret(secret: str, stored_hash: str) -> bool:
    """Verify plaintext secret against stored pbkdf2 hash string."""
    try:
        algo, raw_iterations, salt, expected_hash = stored_hash.split("$", 3)
        if algo != "pbkdf2_sha256":
            return False

        iterations = int(raw_iterations)
        dk = hashlib.pbkdf2_hmac(
            "sha256",
            secret.encode("utf-8"),
            salt.encode("utf-8"),
            iterations,
        )
        return hmac.compare_digest(dk.hex(), expected_hash)
    except Exception:
        return False
