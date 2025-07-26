from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException, Depends
from services.ws_notifications import notification_manager
from jose import JWTError, jwt
from core.config import settings
from db.database import get_session
from neo4j import AsyncSession
from crud import project as project_crud
import logging
import json
from uuid import UUID

logger = logging.getLogger(__name__)
router = APIRouter()


async def verify_websocket_auth(token: str, project_id: str) -> tuple[bool, str]:
    """Verify token and project access for WebSocket connection"""
    try:
        # Decode token
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        
        user_id = payload.get("sub")
        if not user_id:
            return False, None
        
        # Check project access
        async for session in get_session():
            try:
                project = await project_crud.get_project(
                    session=session, 
                    project_id=UUID(project_id), 
                    owner_id=UUID(user_id)
                )
                if not project:
                    return False, None
                
                return True, user_id
            finally:
                # Session will be closed automatically
                pass
        
    except JWTError as e:
        logger.error(f"JWT decode error: {e}")
        return False, None
    except Exception as e:
        logger.error(f"WebSocket auth error: {e}")
        return False, None


@router.websocket("/ws/projects/{project_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    project_id: str
):
    """WebSocket endpoint for project refresh notifications"""
    await websocket.accept()
    
    user_id = None  # Initialize user_id to avoid UnboundLocalError
    
    try:
        # First message must be authentication
        auth_message = await websocket.receive_text()
        try:
            auth_data = json.loads(auth_message)
            token = auth_data.get("token")
        except json.JSONDecodeError:
            await websocket.close(code=4001, reason="Invalid authentication message")
            return
        
        if not token:
            await websocket.close(code=4001, reason="Missing authentication token")
            return
        
        is_authorized, user_id = await verify_websocket_auth(token, project_id)
        if not is_authorized:
            await websocket.close(code=4003, reason="Forbidden")
            return
        
        # Connect to notification manager after successful auth
        await notification_manager.connect(websocket, project_id, user_id)
        logger.info(f"WebSocket authenticated: user={user_id}, project={project_id}")
        
        # Keep connection alive and handle ping/pong
        while True:
            # Wait for any message (we don't process them, just keep alive)
            message = await websocket.receive_text()
            # Simple ping/pong response
            if message == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        notification_manager.disconnect(websocket, project_id)
        if user_id:
            logger.info(f"WebSocket disconnected: user={user_id}, project={project_id}")
        else:
            logger.info(f"WebSocket disconnected before auth: project={project_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        notification_manager.disconnect(websocket, project_id)