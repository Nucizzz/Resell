from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from os import getenv

DATABASE_URL = getenv("DATABASE_URL", "postgresql+psycopg://ims:sharkdrop@db:5432/imsdb")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
