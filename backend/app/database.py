import os
import sqlite3
import time

import bcrypt

from app.config import config
from app.utils.logger import logger


class DatabaseManager:
    def __init__(self, db_path: str):
        self.db_path = db_path
        # Ensure parent directory exists
        db_dir = os.path.dirname(os.path.abspath(db_path))
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)
        self.init_db()

    def get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        # Enable foreign keys
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def init_db(self) -> None:
        logger.info("Initializing SQLite database at %s", self.db_path)
        with self.get_connection() as conn:
            # Users table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
            """)
            conn.commit()

            # Seed default user if empty
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as count FROM users")
            row = cursor.fetchone()
            if row and row["count"] == 0:
                logger.info("Seeding default user 'alice'")
                user_id = "u1"
                username = "alice"
                password_hash = bcrypt.hashpw(b"password123", bcrypt.gensalt(rounds=10)).decode(
                    "utf-8"
                )
                created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

                conn.execute(
                    "INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
                    (user_id, username, password_hash, created_at),
                )
                conn.commit()


db_manager = DatabaseManager(config.database_path)
