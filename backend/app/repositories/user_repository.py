from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.db.models.user import User


class UserRepository:
    """Repositório assíncrono para manipulação da entidade User."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_username(self, username: str) -> User | None:
        query = select(User).where(User.username == username)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: str) -> User | None:
        query = select(User).where(User.id == user_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def list_all(self) -> list[User]:
        query = select(User).order_by(User.created_at.asc())
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def create(self, user: User) -> User:
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def delete_by_username(self, username: str) -> bool:
        query = delete(User).where(User.username == username)
        result = await self.session.execute(query)
        await self.session.commit()
        return bool(result.rowcount and result.rowcount > 0)


class SyncUserRepository:
    """Repositório síncrono para suporte a scripts legados e suítes de teste síncronas."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def get_by_username(self, username: str) -> User | None:
        query = select(User).where(User.username == username)
        return self.session.execute(query).scalar_one_or_none()

    def get_by_id(self, user_id: str) -> User | None:
        query = select(User).where(User.id == user_id)
        return self.session.execute(query).scalar_one_or_none()

    def list_all(self) -> list[User]:
        query = select(User).order_by(User.created_at.asc())
        return list(self.session.execute(query).scalars().all())

    def create(self, user: User) -> User:
        self.session.add(user)
        self.session.commit()
        self.session.refresh(user)
        return user

    def delete_by_username(self, username: str) -> bool:
        query = delete(User).where(User.username == username)
        result = self.session.execute(query)
        self.session.commit()
        return bool(result.rowcount and result.rowcount > 0)
