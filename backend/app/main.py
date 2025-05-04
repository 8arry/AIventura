from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import trips, messages
from contextlib import asynccontextmanager
from app.init_db import init_models

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_models()
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(trips.router, prefix="/api/trips", tags=["trips"])
app.include_router(messages.router, prefix="/api", tags=["messages"])
