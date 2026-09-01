from __future__ import annotations

import os
import sqlite3
import time
from collections.abc import AsyncGenerator, Generator
from contextlib import asynccontextmanager, contextmanager

import bcrypt
from sqlalchemy import create_engine, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import config
from app.db.base import Base
from app.db.models.user import User
from app.utils.logger import logger


class DatabaseManager:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._abs_db_path = os.path.abspath(db_path)

        # Garante que o diretório pai existe
        db_dir = os.path.dirname(self._abs_db_path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)

        # Configura Engine Assíncrona e Sync do SQLAlchemy 2.0
        self.async_engine = create_async_engine(
            f"sqlite+aiosqlite:///{self._abs_db_path}",
            echo=False,
            future=True,
        )
        self.async_session_factory = async_sessionmaker(
            self.async_engine,
            expire_on_commit=False,
            class_=AsyncSession,
        )

        self.sync_engine = create_engine(
            f"sqlite:///{self._abs_db_path}",
            echo=False,
            future=True,
        )
        self.sync_session_factory = sessionmaker(
            self.sync_engine,
            expire_on_commit=False,
            class_=Session,
        )

        self.init_db()

    def get_connection(self) -> sqlite3.Connection:
        """Compatibilidade com utilitários legados e conexões raw SQLite."""
        conn = sqlite3.connect(self._abs_db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    @asynccontextmanager
    async def get_async_session(self) -> AsyncGenerator[AsyncSession, None]:
        """Context manager para sessões assíncronas do SQLAlchemy."""
        async with self.async_session_factory() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    @contextmanager
    def get_sync_session(self) -> Generator[Session, None, None]:
        """Context manager para sessões síncronas do SQLAlchemy."""
        with self.sync_session_factory() as session:
            try:
                yield session
            except Exception:
                session.rollback()
                raise
            finally:
                session.close()

    def init_db(self) -> None:
        """Inicializa tabelas do schema e popula usuário default de forma idempotente."""
        logger.info("Initializing SQLite database via SQLAlchemy at %s", self.db_path)
        Base.metadata.create_all(self.sync_engine)

        with self.get_sync_session() as session:
            # Seed do usuário administrador 'alice' se tabela estiver vazia
            existing_user = session.execute(
                select(User).where(User.username == "alice")
            ).scalar_one_or_none()

            if existing_user is None:
                logger.info("Seeding default user 'alice'")
                user_id = "u1"
                username = "alice"
                password_hash = bcrypt.hashpw(b"password123", bcrypt.gensalt(rounds=10)).decode(
                    "utf-8"
                )
                created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

                alice = User(
                    id=user_id,
                    username=username,
                    password_hash=password_hash,
                    created_at=created_at,
                )
                session.add(alice)
                session.commit()


db_manager = DatabaseManager(config.database_path)
