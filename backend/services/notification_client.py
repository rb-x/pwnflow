import httpx
from typing import Any, Dict, List, Optional


class NotificationServiceError(Exception):
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(f"{status_code}: {message}")

from core.config import settings

HEADERS = {
    "X-Internal-Token": settings.NOTIFICATION_SERVICE_TOKEN,
    "Content-Type": "application/json",
}


async def _request(
    method: str,
    path: str,
    json: Any = None,
    params: Optional[Dict[str, Any]] = None,
) -> Any:
    url = settings.NOTIFICATION_SERVICE_URL.rstrip("/") + path
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.request(method, url, json=json, params=params, headers=HEADERS)
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            try:
                detail = exc.response.json().get("detail")
            except Exception:
                detail = exc.response.text
            raise NotificationServiceError(exc.response.status_code, detail)

        if response.status_code == 204:
            return None
        return response.json()


async def list_webhooks(
    *,
    scope: Optional[str] = None,
    project_id: Optional[str] = None,
    project_ids: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    params: Dict[str, Any] = {}
    if scope:
        params["scope"] = scope
    if project_id:
        params["project_id"] = project_id
    if project_ids:
        params["project_ids"] = project_ids

    data = await _request("GET", "/internal/webhooks", params=params or None)
    return data


async def list_project_webhooks(project_id: str) -> List[Dict[str, Any]]:
    data = await list_webhooks(scope="project", project_id=project_id)
    return data


async def list_global_webhooks() -> List[Dict[str, Any]]:
    data = await list_webhooks(scope="global")
    return data


async def create_project_webhook(project_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    enriched = {**payload, "scope": "project", "project_id": project_id}
    data = await _request("POST", "/internal/webhooks", json=enriched)
    return data


async def create_global_webhook(payload: Dict[str, Any]) -> Dict[str, Any]:
    enriched = {**payload, "scope": "global"}
    data = await _request("POST", "/internal/webhooks", json=enriched)
    return data


async def update_project_webhook(project_id: str, webhook_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    data = await update_webhook(webhook_id, payload)
    return data


async def delete_project_webhook(project_id: str, webhook_id: str) -> None:
    await delete_webhook(webhook_id)


async def update_webhook(webhook_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    data = await _request("PUT", f"/internal/webhooks/{webhook_id}", json=payload)
    return data


async def delete_webhook(webhook_id: str) -> None:
    await _request("DELETE", f"/internal/webhooks/{webhook_id}")


async def get_webhook(webhook_id: str) -> Dict[str, Any]:
    data = await _request("GET", f"/internal/webhooks/{webhook_id}")
    return data
