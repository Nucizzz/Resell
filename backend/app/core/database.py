from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from .settings import get_settings


Base = declarative_base()


def _create_engine():
    settings = get_settings()
    return create_async_engine(settings.database_url, echo=False, future=True)


async_engine = _create_engine()
async_session_factory = async_sessionmaker(bind=async_engine, expire_on_commit=False, class_=AsyncSession)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session
