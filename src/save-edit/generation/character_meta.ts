import { EntityMeta } from "./schema";
export const EntitySchemas: Record<string, EntityMeta> = {
    "CharacterSave": {
        properties: {
            "PlayerUid": {
                path: ["properties", "SaveData", "value", "PlayerUId", "value"],
                type: "string"
            },
            "PlayerUid2": {
                path: ["properties", "SaveData", "value", "IndividualId", "value", "PlayerUId", "value"],
                type: "string"
            },
            "InstanceId": {
                path: ["properties", "SaveData", "value", "IndividualId", "value", "InstanceId", "value"],
                type: "string"
            },
            "CharacterPalsContainerId": {
                path: ["properties", "SaveData", "value", "OtomoCharacterContainerId", "value", "ID", "value"],
                type: "string"
            },
            "ItemContainers": {
                path: ["properties", "SaveData", "value", "InventoryInfo", "value"],
                type: "CharacterItemContainers"
            },
            "TechnologyPoints": {
                path: ["properties", "SaveData", "value", "TechnologyPoint", "value"],
                type: "number"
            },
            "AncientTechnologyPoints": {
                path: ["properties", "SaveData", "value", "bossTechnologyPoint", "value"],
                type: "number"
            },
            "PalStorageContainerId": {
                path: ["properties", "SaveData", "value", "PalStorageContainerId", "value", "ID", "value"],
                type: "string"
            }
        }
    },
    "CharacterItemContainers": {
        properties: {
            "CommonContainerId": {
                path: ["CommonContainerId", "value", "ID", "value"],
                type: "string"
            },
            "DropSlotContainerId": {
                path: ["DropSlotContainerId", "value", "ID", "value"],
                type: "string"
            },
            "EssentialContainerId": {
                path: ["EssentialContainerId", "value", "ID", "value"],
                type: "string"
            },
            "WeaponLoadOutContainerId": {
                path: ["WeaponLoadOutContainerId", "value", "ID", "value"],
                type: "string"
            },
            "PlayerEquipArmorContainerId": {
                path: ["PlayerEquipArmorContainerId", "value", "ID", "value"],
                type: "string"
            },
            "FoodEquipContainerId": {
                path: ["FoodEquipContainerId", "value", "ID", "value"],
                type: "string"
            },
        }
    },
    "ServerSave":{
        properties:{
            "Characters":{
                path: ["properties", "worldSaveData", "value", "CharacterSaveParameterMap", "value"],
                type: "Character[]"
            },
            "ItemContainers":{
                path: ["properties", "worldSaveData", "value", "ItemContainerSaveData", "value"],
                type: "ItemContainer[]"
            },
            "Timestamp":{
                path: ["properties", "Timestamp", "value"],
                type: "Date"
            },
            "CharacterContainers":{
                path: ["properties", "worldSaveData", "value", "CharacterContainerSaveData", "value"],
                type: "CharacterContainer[]"
            }
        }
    },
    "Character":{
        typeResolver:{
            discriminatorPath: ["value", "RawData", "value", "object", "SaveParameter", "value", "IsPlayer", "value"],
            mapping:{
                "true": "Player",
                "default": "Pal"
            }
        },
        properties:{
            "Nickname":{
                path: ["value","RawData","value","object","SaveParameter","value","NickName","value"],
                type: "string"
            },
            "FilteredNickname": {
                path: ["value","RawData","value","object","SaveParameter","value","FilteredNickName","value"],
                type: "string"
            },
            "IsPlayer":{
                path: ["value","RawData","value","object","SaveParameter","value","IsPlayer","value"],
                type: "boolean"
            },
                        "PlayerId":{
                path: ["key","PlayerUId","value"],
                type: "string"
            },
                        "InstanceId":{
          path: ["key","InstanceId","value"],
                type: "string"
            },
            "Level":{
                path: ["value","RawData","value","object","SaveParameter","value","Level","value","value"],
                type: "number"
            },
                        "Exp":{
                path: ["value","RawData","value","object","SaveParameter","value","Exp","value"],
                type: "number"
            },
                        "Hp":{
                path: ["value","RawData","value","object","SaveParameter","value","Hp","value","Value", "value"],
                type: "number"
            },
            "FullStomach":{
                path: ["value","RawData","value","object","SaveParameter","value","FullStomach","value"],
                type: "number"
            },
            "Stats":{
                path: ["value","RawData","value","object","SaveParameter","value","GotStatusPointList","value","values"],
                type: "StatPoint[]"
            },
            "GroupId":{
               path: ["value","RawData","value","group_id"],
               type: "string"
            },
            "AddedStats":{
                path: ["value","RawData","value","object","SaveParameter","value","GotExStatusPointList","value","values"],
                type: "StatPoint[]"
            },
        }
    },
    "StatPoint":{
        properties:{
            "Name":{
                path: ["StatusName", "value"],
                type : "string"
            },
            "Value":{
                path : ["StatusPoint", "value"],
                type: "number"
            }
        }
    },
    "Player":{
        baseType: "Character",
        properties:{
            "FoodRegenEffectTime":{
                path: ["value","RawData","value","object","SaveParameter","value","FoodRegeneEffectInfo","value", "EffectTime", "value"],
                type: "number"
            }
        }
    },
     "Pal": {
    baseType: "Character",
    properties: {
      "CharacterId": {
        path: [
          "value", "RawData", "value", "object", "SaveParameter", "value", "CharacterID", "value"
        ],
        type: "string"
      },
      "Gender": {
        path: [
          "value", "RawData", "value", "object", "SaveParameter", "value", "Gender", "value", "value"
        ],
        type: "string"
      },
      "Level": {
        path: [
          "value", "RawData", "value", "object", "SaveParameter", "value", "Level", "value", "value"
        ],
        type: "number"
      },
      "EquipWaza": {
        path: [
          "value", "RawData", "value", "object", "SaveParameter", "value", "EquipWaza", "value", "values"
        ],
        type: "string[]"
      },
      "TalentHP": {
        path: [
          "value", "RawData", "value", "object", "SaveParameter", "value", "Talent_HP", "value", "value"
        ],
        type: "number"
      },
      "TalentShot": {
        path: [
          "value", "RawData", "value", "object", "SaveParameter", "value", "Talent_Shot", "value", "value"
        ],
        type: "number"
      },
      "TalentDefense": {
        path: [
          "value", "RawData", "value", "object", "SaveParameter", "value", "Talent_Defense", "value", "value"
        ],
        type: "number"
      },
      "PassiveSkillList": {
        path: [
          "value", "RawData", "value", "object", "SaveParameter", "value", "PassiveSkillList", "value", "values"
        ],
        type: "string[]"
      },
      "OldOwnerPlayerUIds": {
        path: [
          "value", "RawData", "value", "object", "SaveParameter", "value", "OldOwnerPlayerUIds", "value", "values"
        ],
        type: "string[]"
      },
      "ContainerId": {
        path: [
          "value", "RawData", "value", "object", "SaveParameter", "value", "SlotId", "value", "ContainerId", "value", "ID", "value"
        ],
        type: "string"
      },
      "SlotIndex": {
        path: [
          "value", "RawData", "value", "object", "SaveParameter", "value", "SlotId", "value", "SlotIndex", "value"
        ],
        type: "number"
      },
      "FriendshipPoint": {
        path: [
          "value", "RawData", "value", "object", "SaveParameter", "value", "FriendshipPoint", "value"
        ],
        type: "number"
      },
      "FriendshipBasecampSec": {
        path: [
          "value", "RawData", "value", "object", "SaveParameter", "value", "FriendshipBasecampSec", "value"
        ],
        type: "number"
      },
      "OwnedTime":{
        path: ["value","RawData","value","object","SaveParameter","value","OwnedTime","value"],
        type: "Date"
      },
      "OwnerPlayerUId":{
        path: ["value","RawData","value","object","SaveParameter","value","OwnerPlayerUId","value"],
        type: "string"
      },
    }
  },
   "ItemContainer": {
    "properties": {
      "Id": {
        path: ["key", "ID", "value"],
        type: "string"
      },
      "BelongToGroup": {
        path: ["value", "BelongInfo", "value", "GroupId", "value"],
        type: "string"
      },
      "ControllableByOthers": {
        path: ["value", "BelongInfo", "value", "bControllableOthers", "value"],
        type: "boolean"
      },
      "SlotNum": {
        path: ["value", "SlotNum", "value"],
        type: "number"
      },
      "Slots":{
        path: ["value", "Slots", "value", "values"],
        type: "Slot[]"
      }
    }
  },
   "Slot": {
    "properties": {
      "Index": {
        path: ["RawData", "value", "slot_index"],
        type: "number"
      },
      "Count": {
        path: ["RawData", "value", "count"],
        type: "number"
      },
      "ItemId": {
        path: ["RawData", "value", "item", "static_id"],
        type: "string"
      },
      "DynamidId": {
        path: ["RawData", "value", "item", "dynamic_id", "local_id_in_created_world"],
        type: "string"
      }
    }
  },
    "CharacterContainer":{
        "properties": {
            "Id": {
                path: ["key", "ID", "value"],
                type: "string"
            },
            "SlotNum": {
                path: ["value", "SlotNum", "value"],
                type: "number"
            },
            "Slots":{
                path: ["value", "Slots", "value", "values"],
                type: "CharacterSlot[]"
            }
        }
    },
    "CharacterSlot":{
        properties: {
            "Index": {
                path: ["SlotIndex", "value"],
                type: "number"
            },
            "PlayerUId":{
                path: ["RawData", "value", "player_uid"],
                type : "string"
            },
            "InstanceId":{
                path: ["RawData", "value", "instance_id"],
                type : "string"
            }
        }
    }
}