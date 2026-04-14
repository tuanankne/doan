from __future__ import annotations

import base64
import json
import logging
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# In-memory cache: order_id -> (violation_id, created_timestamp)
_order_cache: Dict[str, tuple[str, float]] = {}
ORDER_EXPIRY_SECONDS = 600  # 10 minutes


def cleanup_expired_orders() -> None:
    """Xoá các order hết hạn từ cache."""
    current_time = time.time()
    expired = [
        order_id for order_id, (_, created_at) 
        in _order_cache.items() 
        if current_time - created_at > ORDER_EXPIRY_SECONDS
    ]
    for order_id in expired:
        logger.info(f"Order {order_id} expired, removing from cache")
        del _order_cache[order_id]


@dataclass(frozen=True)
class PaypalService:
    client_id: str
    client_secret: str
    base_url: str
    return_url: str
    cancel_url: str

    def is_configured(self) -> bool:
        return all(
            [
                self.client_id.strip(),
                self.client_secret.strip(),
                self.base_url.strip(),
                self.return_url.strip(),
                self.cancel_url.strip(),
            ]
        )

    def _request(self, method: str, url: str, headers: Dict[str, str], body: bytes | None = None) -> Dict[str, Any]:
        request = urllib.request.Request(url, data=body, headers=headers, method=method)
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read().decode("utf-8")
        return json.loads(raw)

    def _get_access_token(self) -> str:
        auth = base64.b64encode(f"{self.client_id}:{self.client_secret}".encode("utf-8")).decode("utf-8")
        response = self._request(
            "POST",
            f"{self.base_url}/v1/oauth2/token",
            {
                "Authorization": f"Basic {auth}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body=b"grant_type=client_credentials",
        )
        token = str(response.get("access_token") or "").strip()
        if not token:
            raise RuntimeError("Không lấy được access token PayPal")
        return token

    def create_order(self, amount_vnd: int, order_info: str, violation_id: str) -> Dict[str, Any]:
        if not self.is_configured():
            raise RuntimeError(
                "Thiếu cấu hình PayPal. Cần PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_BASE_URL, PAYPAL_RETURN_URL, PAYPAL_CANCEL_URL."
            )

        if amount_vnd <= 0:
            raise ValueError("Số tiền thanh toán không hợp lệ")

        token = self._get_access_token()
        amount_usd = max(amount_vnd / 25000.0, 0.01)

        payload: Dict[str, Any] = {
            "intent": "CAPTURE",
            "purchase_units": [
                {
                    "custom_id": violation_id,
                    "description": order_info,
                    "amount": {
                        "currency_code": "USD",
                        "value": f"{amount_usd:.2f}",
                    },
                }
            ],
            "application_context": {
                "return_url": self.return_url,
                "cancel_url": self.cancel_url,
                "user_action": "PAY_NOW",
            },
        }

        response = self._request(
            "POST",
            f"{self.base_url}/v2/checkout/orders",
            {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            body=json.dumps(payload).encode("utf-8"),
        )

        order_id = str(response.get("id") or "").strip()
        approve_url = ""
        for link in response.get("links") or []:
            if str(link.get("rel") or "").lower() == "approve":
                approve_url = str(link.get("href") or "").strip()
                break

        if not order_id or not approve_url:
            raise RuntimeError("Không tạo được link thanh toán PayPal")

        # Lưu mapping order_id -> violation_id vào cache
        _order_cache[order_id] = (violation_id, time.time())
        logger.info(f"Created PayPal order {order_id} for violation {violation_id}")

        qr_code_url = (
            "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data="
            + urllib.parse.quote_plus(approve_url)
        )

        return {
            "order_id": order_id,
            "approve_url": approve_url,
            "qr_code_url": qr_code_url,
        }

    def capture_order(self, order_id: str) -> Dict[str, Any]:
        token = self._get_access_token()
        return self._request(
            "POST",
            f"{self.base_url}/v2/checkout/orders/{order_id}/capture",
            {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            body=b"{}",
        )

    def get_violation_id_for_order(self, order_id: str) -> Optional[str]:
        """Lấy violation_id từ cache order."""
        cleanup_expired_orders()
        
        if order_id in _order_cache:
            violation_id, created_at = _order_cache[order_id]
            current_time = time.time()
            
            # Kiểm tra xem order đã hết hạn chưa
            if current_time - created_at > ORDER_EXPIRY_SECONDS:
                logger.warning(f"Order {order_id} expired (created {current_time - created_at:.0f}s ago)")
                del _order_cache[order_id]
                return None
            
            return violation_id
        
        logger.warning(f"Order {order_id} not found in cache")
        return None
