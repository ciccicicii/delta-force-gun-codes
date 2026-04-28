from __future__ import annotations

import json
import threading
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


HOST = "127.0.0.1"
PORT = 8001
DATA_FILE = Path("三角洲改枪码_步枪_全网合并.json")
WRITE_LOCK = threading.Lock()

WEAPON_ALIAS_MAP = {
    "AK-12突击步枪": "AK-12",
    "AKM突击步枪": "AKM",
    "AS Val突击步枪": "AS Val",
    "ASh-12战斗步枪": "ASh-12",
    "AUG突击步枪": "AUG",
    "G3战斗步枪": "G3",
    "K416突击步枪": "K416",
    "KC17突击步枪": "KC17",
    "MCX LT突击步枪": "MCX LT",
    "M16A4突击步枪": "M16A4",
    "M7战斗步枪": "M7",
    "MK47突击步枪": "MK47",
    "PTR-32突击步枪": "PTR-32",
    "QBZ95-1突击步枪": "QBZ95-1",
    "SCAR-H战斗步枪": "SCAR-H",
}

RIFLE_NAMES = {
    "AS Val",
    "ASh-12",
    "K416",
    "K437",
    "KC17",
    "AK-12",
    "AKM",
    "AKS-74U",
    "M4A1",
    "CAR-15",
    "QBZ95-1",
    "SCAR-H",
    "SG552",
    "PTR-32",
}


def read_items() -> list[dict]:
    with DATA_FILE.open("r", encoding="utf-8") as file:
        return json.load(file)


def write_items(items: list[dict]) -> None:
    with DATA_FILE.open("w", encoding="utf-8", newline="\n") as file:
        json.dump(items, file, ensure_ascii=False, indent=2)


def canonicalize_weapon_name(raw_weapon_name: str) -> str:
    if raw_weapon_name in WEAPON_ALIAS_MAP:
        return WEAPON_ALIAS_MAP[raw_weapon_name]

    normalized = raw_weapon_name
    for suffix in (
        "紧凑突击步枪",
        "突击步枪",
        "战斗步枪",
        "射手步枪",
        "狙击步枪",
        "冲锋枪",
        "霰弹枪",
        "轻机枪",
        "通用机枪",
    ):
        if normalized.endswith(suffix):
            normalized = normalized[: -len(suffix)]
            break
    return normalized.strip()


def detect_weapon_type(raw_weapon_name: str) -> str:
    if "冲锋枪" in raw_weapon_name:
        return "smg"
    if "狙击步枪" in raw_weapon_name or "射手步枪" in raw_weapon_name:
        return "sniper"
    if "霰弹枪" in raw_weapon_name:
        return "shotgun"
    if "轻机枪" in raw_weapon_name or "通用机枪" in raw_weapon_name:
        return "mg"
    if "步枪" in raw_weapon_name or raw_weapon_name in RIFLE_NAMES:
        return "rifle"
    return "other"


def normalize_build_code(build_code: str) -> str:
    return build_code.strip().lower()


def build_item_id(weapon_name: str, build_code: str, source: str) -> str:
    safe_weapon = normalize_build_code(weapon_name).replace(" ", "-")
    safe_code = normalize_build_code(build_code).replace(" ", "-")
    return f"{source}-{safe_weapon}-{safe_code}"


def json_response(handler: "ApiHandler", status: int, payload: dict | list) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class ApiHandler(SimpleHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/api/data":
            with WRITE_LOCK:
                items = read_items()
            json_response(self, HTTPStatus.OK, items)
            return

        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path != "/api/uploads":
            self.send_error(HTTPStatus.NOT_FOUND, "Not Found")
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length)
        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError:
            json_response(self, HTTPStatus.BAD_REQUEST, {"error": "请求体不是合法 JSON。"})
            return

        weapon_type = str(payload.get("weaponType", "")).strip()
        weapon_name = str(payload.get("weaponName", "")).strip()
        build_code = str(payload.get("buildCode", "")).strip()
        description = str(payload.get("description", "")).strip() or "用户上传"
        price = str(payload.get("price", "")).strip() or "未知"

        if not weapon_type or not weapon_name or not build_code:
            json_response(self, HTTPStatus.BAD_REQUEST, {"error": "武器类别、武器名称、改枪码不能为空。"})
            return

        canonical_name = canonicalize_weapon_name(weapon_name)
        normalized_code = normalize_build_code(build_code)

        with WRITE_LOCK:
            items = read_items()
            duplicate_exists = any(
                detect_weapon_type(str(item.get("枪械名称", "")).strip()) == weapon_type
                and canonicalize_weapon_name(str(item.get("枪械名称", "")).strip()) == canonical_name
                and normalize_build_code(str(item.get("改枪码", "")).strip()) == normalized_code
                for item in items
            )
            if duplicate_exists:
                json_response(self, HTTPStatus.CONFLICT, {"error": f"已存在 {canonical_name} 的重复改枪码。"})
                return

            record = {
                "ID": build_item_id(weapon_name, build_code, "user_upload"),
                "枪械名称": weapon_name,
                "改枪码": build_code,
                "改装描述": description,
                "枪械价格": price,
                "来源": "user_upload",
                "武器大类": weapon_type,
                "审核状态": "pending",
            }
            items.append(record)
            write_items(items)

        json_response(self, HTTPStatus.CREATED, record)

    def do_DELETE(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        prefix = "/api/uploads/"
        if not parsed.path.startswith(prefix):
            self.send_error(HTTPStatus.NOT_FOUND, "Not Found")
            return

        item_id = unquote(parsed.path[len(prefix) :]).strip()
        if not item_id:
            json_response(self, HTTPStatus.BAD_REQUEST, {"error": "缺少要删除的 ID。"})
            return

        with WRITE_LOCK:
            items = read_items()
            original_length = len(items)
            items = [
                item
                for item in items
                if not (
                    str(item.get("ID", "")).strip() == item_id
                    and str(item.get("来源", "")).strip() == "user_upload"
                )
            ]
            if len(items) == original_length:
                json_response(self, HTTPStatus.NOT_FOUND, {"error": "未找到可删除的用户上传记录。"})
                return
            write_items(items)

        json_response(self, HTTPStatus.OK, {"ok": True, "id": item_id})

    def log_message(self, format: str, *args) -> None:  # noqa: A003
        return


def run() -> None:
    server = ThreadingHTTPServer((HOST, PORT), ApiHandler)
    print(f"Server running at http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    run()
