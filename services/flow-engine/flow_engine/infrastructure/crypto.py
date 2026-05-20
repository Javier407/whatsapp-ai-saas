"""Small crypto helpers shared by Flow Engine persistence adapters."""
from __future__ import annotations

from base64 import b64decode, b64encode
from os import urandom

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

_IV_LENGTH = 12


def encrypt_aes256_gcm(plaintext: str, master_key: str) -> str:
    key = _derive_key(master_key)
    iv = urandom(_IV_LENGTH)
    ciphertext = AESGCM(key).encrypt(iv, plaintext.encode("utf-8"), None)
    return b64encode(iv + ciphertext).decode("ascii")


def decrypt_aes256_gcm(ciphertext: str, master_key: str) -> str:
    key = _derive_key(master_key)
    raw = b64decode(ciphertext)
    iv = raw[:_IV_LENGTH]
    payload = raw[_IV_LENGTH:]
    plaintext = AESGCM(key).decrypt(iv, payload, None)
    return plaintext.decode("utf-8")


def _derive_key(master_key: str) -> bytes:
    raw = master_key.encode("utf-8")
    if len(raw) >= 32:
        return raw[:32]
    return raw.ljust(32, b"\0")
