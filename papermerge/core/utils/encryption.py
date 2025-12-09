"""
File encryption utilities for password-protected documents.

Uses Fernet (symmetric encryption) from cryptography library for file encryption.
Passwords are hashed using bcrypt for secure storage.
"""
import io
import os
import logging
from typing import Optional

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
import bcrypt
import base64

logger = logging.getLogger(__name__)


def derive_key_from_password(password: str, salt: bytes) -> bytes:
    """
    Derive an encryption key from a password using PBKDF2.
    
    Args:
        password: The password string
        salt: Random salt bytes
        
    Returns:
        A 32-byte key suitable for Fernet encryption
    """
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
        backend=default_backend()
    )
    key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
    return key


def encrypt_file_content(content: bytes, password: str) -> tuple[bytes, bytes]:
    """
    Encrypt file content using a password.
    
    Args:
        content: The file content to encrypt
        password: The password to use for encryption
        
    Returns:
        Tuple of (encrypted_content, salt) where salt is needed for decryption
    """
    # Generate a random salt
    salt = os.urandom(16)
    
    # Derive key from password
    key = derive_key_from_password(password, salt)
    
    # Create Fernet cipher
    fernet = Fernet(key)
    
    # Encrypt the content
    encrypted_content = fernet.encrypt(content)
    
    return encrypted_content, salt


def decrypt_file_content(encrypted_content: bytes, password: str, salt: bytes) -> bytes:
    """
    Decrypt file content using a password and salt.
    
    Args:
        encrypted_content: The encrypted file content
        password: The password used for encryption
        salt: The salt used during encryption
        
    Returns:
        Decrypted file content
        
    Raises:
        ValueError: If password is incorrect or decryption fails
    """
    try:
        # Derive key from password using the same salt
        key = derive_key_from_password(password, salt)
        
        # Create Fernet cipher
        fernet = Fernet(key)
        
        # Decrypt the content
        decrypted_content = fernet.decrypt(encrypted_content)
        
        return decrypted_content
    except Exception as e:
        logger.error(f"Decryption failed: {e}")
        raise ValueError("Incorrect password or corrupted encrypted data")


def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt for storage in database.
    
    Args:
        password: The password to hash
        
    Returns:
        Bcrypt hash string
    """
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def verify_password(password: str, password_hash: str) -> bool:
    """
    Verify a password against a stored hash.
    
    Args:
        password: The password to verify
        password_hash: The stored bcrypt hash
        
    Returns:
        True if password matches, False otherwise
    """
    try:
        return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
    except Exception as e:
        logger.error(f"Password verification failed: {e}")
        return False

