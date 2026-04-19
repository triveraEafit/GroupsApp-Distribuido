import grpc
from concurrent import futures
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.config import SECRET_KEY, ALGORITHM, GRPC_PORT
from app.database import SessionLocal
from app.models import User

import auth_pb2
import auth_pb2_grpc


class AuthServicer(auth_pb2_grpc.AuthServiceServicer):

    def ValidateToken(self, request, context):
        try:
            payload = jwt.decode(request.token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = int(payload.get("sub"))

            db = SessionLocal()
            user = db.query(User).filter(User.id == user_id).first()
            db.close()

            if not user:
                return auth_pb2.ValidateTokenResponse(valid=False, error="User not found")

            return auth_pb2.ValidateTokenResponse(
                valid=True,
                user_id=user.id,
                username=user.username
            )

        except JWTError as e:
            return auth_pb2.ValidateTokenResponse(valid=False, error=str(e))

    def GetUser(self, request, context):
        db = SessionLocal()
        user = db.query(User).filter(User.id == request.user_id).first()
        db.close()

        if not user:
            return auth_pb2.GetUserResponse(found=False)

        return auth_pb2.GetUserResponse(
            found=True,
            user_id=user.id,
            username=user.username,
            email=user.email
        )


def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    auth_pb2_grpc.add_AuthServiceServicer_to_server(AuthServicer(), server)
    server.add_insecure_port(f"0.0.0.0:{GRPC_PORT}")
    server.start()
    print(f"gRPC server running on port {GRPC_PORT}")
    server.wait_for_termination()