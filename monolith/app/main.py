from fastapi import FastAPI
from app.routers import users
from app.database import engine, Base
from jose import JWTError, jwt
from datetime import datetime, timedelta
from app.routers import groups


ACCESS_TOKEN_EXPIRE_MINUTES = 60

app = FastAPI()
app.include_router(groups.router)

# Create tables when the app starts
@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)

app.include_router(users.router)

@app.get("/")
def root():
    return {"message": "GroupsApp backend running"}