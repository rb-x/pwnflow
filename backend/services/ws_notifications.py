from fastapi import WebSocket
from typing import Dict, Set
import asyncio
from datetime import datetime


class NotificationManager:
    def __init__(self):
        # Map project_id to set of websockets
        self.connections: Dict[str, Set[WebSocket]] = {}
        # Map websocket to user_id for validation
        self.authenticated_users: Dict[WebSocket, str] = {}
    
    async def connect(self, websocket: WebSocket, project_id: str, user_id: str):
        """Add WebSocket connection to project room"""
        # Don't accept here - already accepted in the endpoint
        
        if project_id not in self.connections:
            self.connections[project_id] = set()
        self.connections[project_id].add(websocket)
        self.authenticated_users[websocket] = user_id
        
        # Send initial connection confirmation
        await websocket.send_json({
            "type": "connected",
            "project_id": project_id,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    def disconnect(self, websocket: WebSocket, project_id: str):
        """Remove WebSocket from project room"""
        if project_id in self.connections:
            self.connections[project_id].discard(websocket)
            if not self.connections[project_id]:
                del self.connections[project_id]
        # Clean up authentication
        self.authenticated_users.pop(websocket, None)
    
    async def notify_project(self, project_id: str, event_type: str, data: dict = None):
        """Send a refresh signal to all connected clients for a project"""
        if project_id in self.connections:
            dead_connections = set()
            message = {
                "type": event_type,
                "project_id": project_id,
                "timestamp": datetime.utcnow().isoformat()
            }
            if data:
                message["data"] = data
            
            # Send to all connections in parallel
            tasks = []
            for connection in self.connections[project_id]:
                tasks.append(self._send_to_connection(connection, message, dead_connections))
            
            await asyncio.gather(*tasks, return_exceptions=True)
            
            # Clean up dead connections
            for conn in dead_connections:
                self.connections[project_id].discard(conn)
    
    async def _send_to_connection(self, connection: WebSocket, message: dict, dead_connections: Set[WebSocket]):
        """Send message to a single connection, track dead connections"""
        try:
            await connection.send_json(message)
        except Exception:
            dead_connections.add(connection)
    
    def get_connection_count(self, project_id: str) -> int:
        """Get number of active connections for a project"""
        return len(self.connections.get(project_id, set()))


# Global instance
notification_manager = NotificationManager()