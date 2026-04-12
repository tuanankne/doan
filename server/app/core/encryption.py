"""
AES-256-GCM encryption utility for sensitive fields in profiles, vehicles, driver_licenses.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import os
from typing import Optional

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


class EncryptionService:
    """
    Provides AES-256-GCM encryption/decryption for sensitive data.
    Uses SHA256 hash of master key for consistent key derivation.
    """

    def __init__(self, master_key: str) -> None:
        """
        Initialize the encryption service.

        Args:
            master_key: Master encryption key from environment
        """
        self.master_key = master_key.encode() if isinstance(master_key, str) else master_key

    def _derive_key(self) -> bytes:
        """Derive a 32-byte key from master key using SHA256."""
        # Hash master key twice to get deterministic 32-byte key
        return hashlib.sha256(self.master_key + b"doan_app").digest()

    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt plaintext using AES-256-GCM.

        Args:
            plaintext: Plain text to encrypt

        Returns:
            Base64-encoded ciphertext with nonce prepended
        """
        if not plaintext:
            return plaintext

        key = self._derive_key()
        nonce = os.urandom(12)  # 96-bit nonce for GCM
        cipher = AESGCM(key)

        plaintext_bytes = plaintext.encode("utf-8")
        ciphertext = cipher.encrypt(nonce, plaintext_bytes, None)

        # Combine nonce + ciphertext and encode as base64
        encrypted_data = nonce + ciphertext
        return base64.b64encode(encrypted_data).decode("utf-8")

    def decrypt(self, encrypted: str) -> str:
        """
        Decrypt AES-256-GCM ciphertext.

        Args:
            encrypted: Base64-encoded ciphertext with nonce

        Returns:
            Decrypted plaintext
        """
        if not encrypted:
            return encrypted

        try:
            key = self._derive_key()
            encrypted_data = base64.b64decode(encrypted)

            # Extract nonce (first 12 bytes) and ciphertext
            nonce = encrypted_data[:12]
            ciphertext = encrypted_data[12:]

            cipher = AESGCM(key)
            plaintext_bytes = cipher.decrypt(nonce, ciphertext, None)
            return plaintext_bytes.decode("utf-8")
        except (ValueError, binascii.Error, Exception) as e:
            raise ValueError(f"Decryption failed: {e}") from e


# Global encryption service instance
_encryption_service: Optional[EncryptionService] = None


def init_encryption(master_key: str) -> None:
    """Initialize global encryption service."""
    global _encryption_service
    _encryption_service = EncryptionService(master_key)


def get_encryption_service() -> EncryptionService:
    """Get the global encryption service."""
    if _encryption_service is None:
        raise RuntimeError("Encryption service not initialized. Call init_encryption() first.")
    return _encryption_service


def encrypt_field(value: str) -> str:
    """Encrypt a single field."""
    if not value:
        return value
    return get_encryption_service().encrypt(value)


def decrypt_field(value: str) -> str:
    """Decrypt a single field."""
    if not value:
        return value
    return get_encryption_service().decrypt(value)
