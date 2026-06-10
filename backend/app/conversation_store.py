# Conversation history store for the chat UI.
#
# Two backends, chosen at import time by the presence of MDB_MCP_CONNECTION_STRING
# (mirrors the customer-profile persistence pattern in app/agent.py):
#   - set   -> MongoDB Atlas, db "sea_team_lead", collection "conversations"
#   - unset -> local JSON files under data/conversations/<user>/<conv>.json
#
# All operations are scoped by user_id so a user can only ever read/write their
# own conversations. Documents store the rendered chat transcript (the same Msg[]
# the frontend renders), so reloading a conversation re-renders the cards exactly.

import json
import os
import re
from datetime import datetime, timezone

_MONGO_URI = os.environ.get("MDB_MCP_CONNECTION_STRING", "").strip()
_DB_NAME = "sea_team_lead"
_COLL_NAME = "conversations"

_DATA_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data",
    "conversations",
)

# Whether the Mongo backend is configured. The client itself connects lazily on
# first use so import never blocks on a network round-trip.
USE_MONGO = bool(_MONGO_URI)

_collection = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sanitize(value: str) -> str:
    """Filesystem-safe token for the JSON fallback (uids / session ids)."""
    return re.sub(r"[^A-Za-z0-9_.-]", "_", value)[:128] or "_"


def _doc_id(user_id: str, conv_id: str) -> str:
    return f"{user_id}:{conv_id}"


def _get_collection():
    global _collection
    if _collection is not None:
        return _collection
    from pymongo import MongoClient

    client = MongoClient(
        _MONGO_URI,
        serverSelectionTimeoutMS=6000,
        connectTimeoutMS=6000,
    )
    _collection = client[_DB_NAME][_COLL_NAME]
    return _collection


def _summary(doc: dict) -> dict:
    return {
        "conv_id": doc.get("conv_id"),
        "title": doc.get("title") or "Konversation",
        "updated_at": doc.get("updated_at"),
        "message_count": doc.get("message_count", len(doc.get("messages", []) or [])),
    }


# --- JSON fallback helpers ---


def _user_dir(user_id: str) -> str:
    return os.path.join(_DATA_DIR, _sanitize(user_id))


def _json_path(user_id: str, conv_id: str) -> str:
    return os.path.join(_user_dir(user_id), _sanitize(conv_id) + ".json")


# --- Public API ---


def list_conversations(user_id: str) -> list[dict]:
    if USE_MONGO:
        coll = _get_collection()
        cursor = (
            coll.find({"user_id": user_id}, {"messages": 0})
            .sort("updated_at", -1)
            .limit(200)
        )
        return [_summary(d) for d in cursor]

    user_dir = _user_dir(user_id)
    if not os.path.isdir(user_dir):
        return []
    docs = []
    for name in os.listdir(user_dir):
        if not name.endswith(".json"):
            continue
        try:
            with open(os.path.join(user_dir, name), encoding="utf-8") as f:
                docs.append(json.load(f))
        except Exception:
            continue
    docs.sort(key=lambda d: d.get("updated_at", ""), reverse=True)
    return [_summary(d) for d in docs]


def get_conversation(user_id: str, conv_id: str) -> dict | None:
    if USE_MONGO:
        coll = _get_collection()
        doc = coll.find_one({"_id": _doc_id(user_id, conv_id)})
        if doc:
            doc.pop("_id", None)
        return doc

    path = _json_path(user_id, conv_id)
    if not os.path.isfile(path):
        return None
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def save_conversation(
    user_id: str,
    conv_id: str,
    title: str,
    messages: list,
    download: str | None = None,
) -> dict:
    now = _now_iso()
    record = {
        "user_id": user_id,
        "conv_id": conv_id,
        "title": (title or "Konversation")[:120],
        "messages": messages,
        "message_count": len(messages or []),
        "download": download,
        "updated_at": now,
    }

    if USE_MONGO:
        coll = _get_collection()
        coll.update_one(
            {"_id": _doc_id(user_id, conv_id)},
            {"$set": record, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )
        return _summary(record)

    user_dir = _user_dir(user_id)
    os.makedirs(user_dir, exist_ok=True)
    path = _json_path(user_id, conv_id)
    if not os.path.isfile(path):
        record["created_at"] = now
    with open(path, "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=2)
    return _summary(record)


def delete_conversation(user_id: str, conv_id: str) -> None:
    if USE_MONGO:
        coll = _get_collection()
        coll.delete_one({"_id": _doc_id(user_id, conv_id)})
        return

    path = _json_path(user_id, conv_id)
    if os.path.isfile(path):
        os.remove(path)
