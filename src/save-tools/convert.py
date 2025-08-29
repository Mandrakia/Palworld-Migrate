#!/usr/bin/env python3

import argparse
import json
import os
from typing import Optional
from datetime import datetime, timedelta, timezone
from palworld_save_tools.gvas import GvasFile
from palworld_save_tools.json_tools import CustomEncoder
from palworld_save_tools.palsav import compress_gvas_to_sav, decompress_sav_to_gvas
from palworld_save_tools.paltypes import (
    DISABLED_PROPERTIES,
    PALWORLD_CUSTOM_PROPERTIES,
    PALWORLD_TYPE_HINTS,
)

# FastAPI server imports
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from starlette.responses import Response
import uvicorn
from fastapi.middleware.gzip import GZipMiddleware


def main():
    parser = argparse.ArgumentParser(
        prog="palworld-save-tools",
        description="Converts Palworld save files to and from JSON",
    )
    parser.add_argument("filename", nargs="?", default=None)
    parser.add_argument(
        "--to-json",
        action="store_true",
        help="Override heuristics and convert SAV file to JSON",
    )
    parser.add_argument(
        "--from-json",
        action="store_true",
        help="Override heuristics and convert JSON file to SAV",
    )
    parser.add_argument(
        "--output",
        "-o",
        help="Output file (default: <filename>.json or <filename>.sav)",
    )
    parser.add_argument(
        "--force",
        "-f",
        action="store_true",
        help="Force overwriting output file if it already exists without prompting",
    )
    parser.add_argument(
        "--library",
        "-l",
        choices=["zlib", "libooz"],
        default="libooz",
        help="Compression library used to convert JSON files to SAV files. 'zlib' for zlib compression, 'libooz' for libooz compression (default: libooz)",
    )
    parser.add_argument(
        "--convert-nan-to-null",
        action="store_true",
        help="Convert NaN/Inf/-Inf floats to null when converting from SAV to JSON. This will lose information in the event Inf/-Inf is in the sav file (default: false)",
    )
    parser.add_argument(
        "--custom-properties",
        default=",".join(set(PALWORLD_CUSTOM_PROPERTIES.keys()) - DISABLED_PROPERTIES),
        type=lambda t: [s.strip() for s in t.split(",")],
        help="Comma-separated list of custom properties to decode, or 'all' for all known properties. This can be used to speed up processing by excluding properties that are not of interest. (default: all)",
    )
    parser.add_argument("--minify-json", action="store_true", help="Minify JSON output")

    # Server mode args
    parser.add_argument("--serve", action="store_true", help="Start REST server")
    parser.add_argument("--host", default="127.0.0.1", help="Server host (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8009, help="Server port (default: 8009)")
    parser.add_argument(
        "--workers",
        type=int,
        default=0,
        help="Number of worker processes for the REST server (0 = auto)",
    )

    args = parser.parse_args()

    if args.to_json and args.from_json:
        print("Cannot specify both --to-json and --from-json")
        exit(1)

    # If serving, start the REST server and return
    if args.serve:
        run_server(args.host, args.port, args.workers)
        return

    if args.filename is None:
        print("filename is required unless --serve is specified")
        exit(1)

    if not os.path.exists(args.filename):
        print(f"{args.filename} does not exist")
        exit(1)
    if not os.path.isfile(args.filename):
        print(f"{args.filename} is not a file")
        exit(1)

    if args.to_json or args.filename.endswith(".sav"):
        if not args.output:
            output_path = args.filename + ".json"
        else:
            output_path = args.output
        convert_sav_to_json(
            args.filename,
            output_path,
            force=args.force,
            minify=args.minify_json,
            allow_nan=(not args.convert_nan_to_null),
            custom_properties_keys=args.custom_properties,
        )

    if args.from_json or args.filename.endswith(".json"):
        if not args.output:
            output_path = args.filename.replace(".json", "")
        else:
            output_path = args.output
        convert_json_to_sav(args.filename, output_path, force=args.force, zlib=(args.library == "zlib"))


def convert_sav_to_json(
    filename,
    output_path,
    force=False,
    minify=False,
    allow_nan=True,
    custom_properties_keys=["all"],
):
    print(f"Converting {filename} to JSON, saving to {output_path}")
    if os.path.exists(output_path):
        print(f"{output_path} already exists, this will overwrite the file")
        if not force:
            if not confirm_prompt("Are you sure you want to continue?"):
                exit(1)
    print(f"Decompressing sav file")
    with open(filename, "rb") as f:
        data = f.read()
        raw_gvas, _ = decompress_sav_to_gvas(data)
    print(f"Loading GVAS file")
    custom_properties = {}
    if len(custom_properties_keys) > 0 and custom_properties_keys[0] == "all":
        custom_properties = PALWORLD_CUSTOM_PROPERTIES
    else:
        for prop in PALWORLD_CUSTOM_PROPERTIES:
            if prop in custom_properties_keys:
                custom_properties[prop] = PALWORLD_CUSTOM_PROPERTIES[prop]
    gvas_file = GvasFile.read(
        raw_gvas, PALWORLD_TYPE_HINTS, custom_properties, allow_nan=allow_nan
    )
    print(f"Writing JSON to {output_path}")
    with open(output_path, "w", encoding="utf8") as f:
        indent = None if minify else "\t"
        json.dump(
            gvas_file.dump(), f, indent=indent, cls=CustomEncoder, allow_nan=allow_nan
        )


# ---------------- REST Server Mode ----------------
class ToJsonRequest(BaseModel):
    filename: str
    # Ensure standards-compliant JSON by default (Node JSON.parse friendly)
    convert_nan_to_null: bool = True
    # Optional pruning mode to reduce payload while keeping TS model paths intact
    mode: str | None = None  # 'server' => ServerSave DTO, 'player' => CharacterSave DTO


def _keep_only_keys(d: dict, allowed: set[str]) -> None:
    for k in list(d.keys()):
        if k not in allowed:
            d.pop(k, None)


def _prune_server_dump(doc: dict) -> None:
    # Expecting structure doc['properties']['worldSaveData']['value']
    props = doc.get('properties')
    if not isinstance(props, dict):
        return
    # Keep only 'worldSaveData' and 'Timestamp' at top-level properties
    _keep_only_keys(props, {'worldSaveData', 'Timestamp'})
    wsd = props.get('worldSaveData')
    if isinstance(wsd, dict):
        val = wsd.get('value')
        if isinstance(val, dict):
            _keep_only_keys(val, {
                'GameTimeSaveData',
                'CharacterSaveParameterMap',
                'ItemContainerSaveData',
                'CharacterContainerSaveData',
                'GroupSaveDataMap',
                'BaseCampSaveData',
                'DungeonSaveData',
                'DungeonPointMarkerSaveData',
            })


def _prune_player_dump(doc: dict) -> None:
    # Expecting structure doc['properties']['SaveData']['value']
    props = doc.get('properties')
    if not isinstance(props, dict):
        return
    _keep_only_keys(props, {'SaveData'})
    sd = props.get('SaveData')
    if isinstance(sd, dict):
        val = sd.get('value')
        if isinstance(val, dict):
            _keep_only_keys(val, {
                'PlayerUId',
                'IndividualId',
                'OtomoCharacterContainerId',
                'InventoryInfo',
                'TechnologyPoint',
                'bossTechnologyPoint',
                'PalStorageContainerId',
            })


def create_app() -> FastAPI:
    app = FastAPI()
    # Enable gzip to significantly reduce wire size for large payloads
    app.add_middleware(GZipMiddleware, minimum_size=1024)

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    @app.post("/to-json")
    async def to_json(req: ToJsonRequest):
        if not os.path.exists(req.filename) or not os.path.isfile(req.filename):
            raise HTTPException(status_code=404, detail="File not found")
        try:
            with open(req.filename, "rb") as f:
                data = f.read()
                raw_gvas, _ = decompress_sav_to_gvas(data)
            # Always decode with all known Palworld custom properties for completeness
            custom_properties = PALWORLD_CUSTOM_PROPERTIES
            gvas_file = GvasFile.read(
                raw_gvas,
                PALWORLD_TYPE_HINTS,
                custom_properties,
                allow_nan=(not req.convert_nan_to_null),
            )
            doc = gvas_file.dump()
            # If a mode is specified, return compact DTOs that correspond to TS model toJSON() output
            if req.mode == 'server':
                result = _map_server_save(doc)
            elif req.mode == 'player':
                result = _map_character_save(doc)
            else:
                result = doc
            # Minified JSON; ensure valid JSON when convert_nan_to_null is True
            json_text = json.dumps(
                result,
                separators=(",", ":"),
                cls=CustomEncoder,
                allow_nan=(not req.convert_nan_to_null),
            )
            return Response(content=json_text, media_type="application/json")
        except Exception as e:
            # Surface as 500 with message
            raise HTTPException(status_code=500, detail=str(e))

    return app

# Expose module-level app for uvicorn import string when using multiple workers
app = create_app()


def run_server(host: str, port: int, workers: int) -> None:
    if not workers or workers <= 0:
        try:
            workers = max(1, os.cpu_count() or 1)
        except Exception:
            workers = 1
    # Use import string so uvicorn can spawn multiple workers
    uvicorn.run("convert:app", host=host, port=port, workers=workers)


def convert_json_to_sav(filename, output_path, force=False, zlib=False):
    print(f"Converting {filename} to SAV, saving to {output_path}")
    if os.path.exists(output_path):
        print(f"{output_path} already exists, this will overwrite the file")
        if not force:
            if not confirm_prompt("Are you sure you want to continue?"):
                exit(1)
    print(f"Loading JSON from {filename}")
    with open(filename, "r", encoding="utf8") as f:
        data = json.load(f)
    gvas_file = GvasFile.load(data)
    print(f"Compressing SAV file")
    if (
        "Pal.PalWorldSaveGame" in gvas_file.header.save_game_class_name
        or "Pal.PalLocalWorldSaveGame" in gvas_file.header.save_game_class_name
    ):
        save_type = 0x32
    else:
        save_type = 0x31
    if zlib: save_type = 0x32 # Use double zlib compression
    sav_file = compress_gvas_to_sav(
        gvas_file.write(PALWORLD_CUSTOM_PROPERTIES), save_type, zlib=zlib
    )
    print(f"Writing SAV file to {output_path}")
    with open(output_path, "wb") as f:
        f.write(sav_file)


def confirm_prompt(question: str) -> bool:
    reply = None
    while reply not in ("y", "n"):
        reply = input(f"{question} (y/n): ").casefold()
    return reply == "y"


###############################################
# Mapping helpers -> Compact DTOs for TS models
###############################################
def _getp(obj: dict, path: list[str]):
    cur = obj
    for k in path:
        if isinstance(cur, dict):
            cur = cur.get(k)
        else:
            return None
    return cur


def _map_stat_point(node: dict):
    return {
        "Name": _getp(node, ["StatusName", "value"]),
        "Value": _getp(node, ["StatusPoint", "value"]),
    }


def _map_character(node: dict):
    val = node.get("value") if isinstance(node, dict) else None
    raw = val.get("RawData", {}).get("value", {}) if isinstance(val, dict) else {}
    obj = raw.get("object", {}) if isinstance(raw, dict) else {}
    save_param = obj.get("SaveParameter", {}).get("value", {}) if isinstance(obj, dict) else {}
    return {
        "Nickname": _getp(node, ["value", "RawData", "value", "object", "SaveParameter", "value", "NickName", "value"]),
        "FilteredNickname": _getp(node, ["value", "RawData", "value", "object", "SaveParameter", "value", "FilteredNickName", "value"]),
        "IsPlayer": _getp(node, ["value", "RawData", "value", "object", "SaveParameter", "value", "IsPlayer", "value"]),
        "PlayerId": _getp(node, ["key", "PlayerUId", "value"]),
        "InstanceId": _getp(node, ["key", "InstanceId", "value"]),
        "Level": _getp(node, ["value", "RawData", "value", "object", "SaveParameter", "value", "Level", "value", "value"]),
        "Exp": _getp(node, ["value", "RawData", "value", "object", "SaveParameter", "value", "Exp", "value"]),
        "Hp": _getp(node, ["value", "RawData", "value", "object", "SaveParameter", "value", "Hp", "value", "Value", "value"]),
        "FullStomach": _getp(node, ["value", "RawData", "value", "object", "SaveParameter", "value", "FullStomach", "value"]),
        "Stats": [
            _map_stat_point(x) for x in (_getp(node, ["value", "RawData", "value", "object", "SaveParameter", "value", "GotStatusPointList", "value", "values"]) or [])
        ],
        "GroupId": _getp(node, ["value", "RawData", "value", "group_id"]),
        "AddedStats": [
            _map_stat_point(x) for x in (_getp(node, ["value", "RawData", "value", "object", "SaveParameter", "value", "GotExStatusPointList", "value", "values"]) or [])
        ],
        # Pal-specific fields used by TS mappers
        "CharacterId": _getp(node, ["value", "RawData", "value", "object", "SaveParameter", "value", "CharacterID", "value"]),
        "Gender": _getp(node, ["value", "RawData", "value", "object", "SaveParameter", "value", "Gender", "value", "value"]),
        "EquipWaza": _getp(node, ["value", "RawData", "value", "object", "SaveParameter", "value", "EquipWaza", "value", "values"]),
        "TalentHP": _getp(node, ["value", "RawData", "value", "object", "SaveParameter", "value", "Talent_HP", "value", "value"]),
        "TalentShot": _getp(node, ["value", "RawData", "value", "object", "SaveParameter", "value", "Talent_Shot", "value", "value"]),
        "TalentDefense": _getp(node, ["value", "RawData", "value", "object", "SaveParameter", "value", "Talent_Defense", "value", "value"]),
        "PassiveSkillList": _getp(node, ["value", "RawData", "value", "object", "SaveParameter", "value", "PassiveSkillList", "value", "values"]),
        "OldOwnerPlayerUIds": _getp(node, ["value", "RawData", "value", "object", "SaveParameter", "value", "OldOwnerPlayerUIds", "value", "values"]),
        "ContainerId": _getp(node, ["value", "RawData", "value", "object", "SaveParameter", "value", "SlotId", "value", "ContainerId", "value", "ID", "value"]),
        "SlotIndex": _getp(node, ["value", "RawData", "value", "object", "SaveParameter", "value", "SlotId", "value", "SlotIndex", "value"]),
        "FriendshipPoint": _getp(node, ["value", "RawData", "value", "object", "SaveParameter", "value", "FriendshipPoint", "value"]),
        "FriendshipBasecampSec": _getp(node, ["value", "RawData", "value", "object", "SaveParameter", "value", "FriendshipBasecampSec", "value"]),
        "OwnedTime": ticks_to_date(_getp(node, ["value", "RawData", "value", "object", "SaveParameter", "value", "OwnedTime", "value"])),
        "OwnerPlayerUId": _getp(node, ["value", "RawData", "value", "object", "SaveParameter", "value", "OwnerPlayerUId", "value"]),
        "Rank": _getp(node, ["value", "RawData", "value", "object", "SaveParameter", "value", "Rank", "value", "value"]),
        "RankHp": _getp(node, ["value", "RawData", "value", "object", "SaveParameter", "value", "Rank_HP", "value", "value"]),
        "RankDefense": _getp(node, ["value", "RawData", "value", "object", "SaveParameter", "value", "Rank_Defence", "value", "value"]),
        "RankAttack": _getp(node, ["value", "RawData", "value", "object", "SaveParameter", "value", "Rank_Attack", "value", "value"]),
        "RankCraftSpeed": _getp(node, ["value", "RawData", "value", "object", "SaveParameter", "value", "Rank_CraftSpeed", "value", "value"]),
    }

def ticks_to_date(ticks: int) -> str:
    if ticks is None:
        return None
    """
    Convert .NET ticks to Python datetime.
    
    Args:
        ticks (int): Number of .NET ticks (100-nanosecond intervals since 0001-01-01).
    
    Returns:
        datetime: Python datetime object in local timezone.
    """
    # .NET ticks are from year 1, Python's datetime also supports year 1
    # But we must account for tick size (100ns)
    dt= datetime(1, 1, 1) + timedelta(microseconds=ticks / 10)
    return dt.astimezone().isoformat()

def _map_slot(node: dict):
    raw = _getp(node, ["RawData", "value"]) or {}
    return {
        "Index": raw.get("slot_index"),
        "Count": raw.get("count"),
        "ItemId": (raw.get("item") or {}).get("static_id"),
        "DynamidId": ((raw.get("item") or {}).get("dynamic_id") or {}).get("local_id_in_created_world"),
    }


def _map_item_container(node: dict):
    return {
        "Id": _getp(node, ["key", "ID", "value"]),
        "BelongToGroup": _getp(node, ["value", "BelongInfo", "value", "GroupId", "value"]),
        "ControllableByOthers": _getp(node, ["value", "BelongInfo", "value", "bControllableOthers", "value"]),
        "SlotNum": _getp(node, ["value", "SlotNum", "value"]),
        "Slots": [ _map_slot(x) for x in (_getp(node, ["value", "Slots", "value", "values"]) or []) ],
    }


def _map_character_slot(node: dict):
    return {
        "Index": _getp(node, ["SlotIndex", "value"]),
        "PlayerUId": _getp(node, ["RawData", "value", "player_uid"]),
        "InstanceId": _getp(node, ["RawData", "value", "instance_id"]),
    }


def _map_character_container(node: dict):
    return {
        "Id": _getp(node, ["key", "ID", "value"]),
        "SlotNum": _getp(node, ["value", "SlotNum", "value"]),
        "Slots": [ _map_character_slot(x) for x in (_getp(node, ["value", "Slots", "value", "values"]) or []) ],
    }


def _map_group_member(node: dict):
    return {
        "PlayerId": _getp(node, ["guid"]),
        "InstanceId": _getp(node, ["instance_id"]),
    }


def _map_group(node: dict):
    return {
        "Id": _getp(node, ["key"]),
        "Members": [ _map_group_member(x) for x in (_getp(node, ["value", "RawData", "value", "individual_character_handle_ids"]) or []) ],
        "Name": _getp(node, ["value", "RawData", "value", "group_name"]),
        "BaseIds": _getp(node, ["value", "RawData", "value", "base_ids"]),
        "MapBaseIds": _getp(node, ["value", "RawData", "value", "map_object_instance_ids_base_camp_points"]),
        "CampLevel": _getp(node, ["value", "RawData", "value", "base_camp_level"]),
        "GuildName": _getp(node, ["value", "RawData", "value", "guild_name"]),
    }


def _map_basecamp(node: dict):
    return {
        "Id": _getp(node, ["key"]),
        "ContainerId": _getp(node, ["value", "WorkerDirector", "value", "RawData", "value", "container_id"]),
        "GroupId": _getp(node, ["value", "RawData", "value", "group_id_belong_to"]),
        "OwnerInstanceId": _getp(node, ["value", "RawData", "value", "owner_map_object_instance_id"]),
        "Coords": _getp(node, ["value", "WorkerDirector", "value", "RawData", "value", "spawn_transform"]),
    }


def _map_dungeon_save(node: dict):
    return {
        "InstanceId": _getp(node, ["InstanceId", "value"]),
        "MarkerPointId": _getp(node, ["MarkerPointId", "value"]),
        "DungeonSpawnAreaId": _getp(node, ["DungeonSpawnAreaId", "value"]),
        "DungeonLevelName": _getp(node, ["DungeonLevelName", "value"]),
        "BossState": _getp(node, ["BossState", "value", "value"]),
        "EnemySpawnerDataBossRowName": _getp(node, ["EnemySpawnerDataBossRowName", "value"]),
        "DisappearTimeAt": _getp(node, ["DisappearTimeAt", "value", "Ticks", "value"]),
        "RespawnBossTimeAt": _getp(node, ["RespawnBossTimeAt", "value", "ticks", "value"]),
    }


def _map_dungeon_point_marker(node: dict):
    return {
        "MarkerPointId": _getp(node, ["MarkerPointId", "value"]),
        "NextRespawnGameTime": _getp(node, ["NextRespawnGameTime", "value", "Ticks", "value"]),
    }


def _map_server_save(doc: dict):
    props = doc.get("properties", {}) if isinstance(doc, dict) else {}
    wsd = (props.get("worldSaveData") or {}).get("value", {}) if isinstance(props, dict) else {}
    return {
        "GameTime": _getp(doc, ["properties", "worldSaveData", "value", "GameTimeSaveData", "value", "GameDateTimeTicks", "value"]),
        "RealTime": _getp(doc, ["properties", "worldSaveData", "value", "GameTimeSaveData", "value", "RealDateTimeTicks", "value"]),
        "Characters": [ _map_character(x) for x in (wsd.get("CharacterSaveParameterMap", {}) or {}).get("value", []) ],
        "ItemContainers": [ _map_item_container(x) for x in (wsd.get("ItemContainerSaveData", {}) or {}).get("value", []) ],
        "Timestamp": _getp(doc, ["properties", "Timestamp", "value"]),
        "CharacterContainers": [ _map_character_container(x) for x in (wsd.get("CharacterContainerSaveData", {}) or {}).get("value", []) ],
        "Groups": [ _map_group(x) for x in (wsd.get("GroupSaveDataMap", {}) or {}).get("value", []) ],
        "BaseCamps": [ _map_basecamp(x) for x in (wsd.get("BaseCampSaveData", {}) or {}).get("value", []) ],
        "DungeonSaveData": [ _map_dungeon_save(x) for x in ((wsd.get("DungeonSaveData", {}) or {}).get("value", {}) or {}).get("values", []) ],
        "DungeonPointMarkerSaveData": [ _map_dungeon_point_marker(x) for x in ((wsd.get("DungeonPointMarkerSaveData", {}) or {}).get("value", {}) or {}).get("values", []) ],
    }


def _map_character_item_containers(node: dict):
    return {
        "CommonContainerId": _getp(node, ["CommonContainerId", "value", "ID", "value"]),
        "DropSlotContainerId": _getp(node, ["DropSlotContainerId", "value", "ID", "value"]),
        "EssentialContainerId": _getp(node, ["EssentialContainerId", "value", "ID", "value"]),
        "WeaponLoadOutContainerId": _getp(node, ["WeaponLoadOutContainerId", "value", "ID", "value"]),
        "PlayerEquipArmorContainerId": _getp(node, ["PlayerEquipArmorContainerId", "value", "ID", "value"]),
        "FoodEquipContainerId": _getp(node, ["FoodEquipContainerId", "value", "ID", "value"]),
    }


def _map_character_save(doc: dict):
    props = doc.get("properties", {}) if isinstance(doc, dict) else {}
    sd = (props.get("SaveData") or {}).get("value", {}) if isinstance(props, dict) else {}
    return {
        "PlayerUid": _getp(doc, ["properties", "SaveData", "value", "PlayerUId", "value"]),
        "PlayerUid2": _getp(doc, ["properties", "SaveData", "value", "IndividualId", "value", "PlayerUId", "value"]),
        "InstanceId": _getp(doc, ["properties", "SaveData", "value", "IndividualId", "value", "InstanceId", "value"]),
        "CharacterPalsContainerId": _getp(doc, ["properties", "SaveData", "value", "OtomoCharacterContainerId", "value", "ID", "value"]),
        "ItemContainers": _map_character_item_containers(sd.get("InventoryInfo", {}).get("value", {}) if isinstance(sd, dict) else {}),
        "TechnologyPoints": _getp(doc, ["properties", "SaveData", "value", "TechnologyPoint", "value"]),
        "AncientTechnologyPoints": _getp(doc, ["properties", "SaveData", "value", "bossTechnologyPoint", "value"]),
        "PalStorageContainerId": _getp(doc, ["properties", "SaveData", "value", "PalStorageContainerId", "value", "ID", "value"]),
    }


if __name__ == "__main__":
    main()
