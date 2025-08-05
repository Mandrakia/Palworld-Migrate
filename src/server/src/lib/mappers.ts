import type {Player} from "$save-edit/models/Player";
import type {FullPlayerCardData, PalCardData, PlayerCardData} from "$lib/CharacterCardData";
import {Pal} from "$save-edit/models/Pal";
import type {ServerSave} from "$save-edit/models/ServerSave";
import type {CharacterSave} from "$save-edit/models/CharacterSave";
import {getPalData, cleanElementType, cleanSizeType, cleanTribe, Buff, getPassive} from "$lib/palDatabase";
import type {Guild} from "$save-edit/models/Guild";

export function toPlayerCard(pWorld: Player, pSave: CharacterSave, serverSave: ServerSave) : PlayerCardData{
    const pals = serverSave.Characters.filter(a => a instanceof Pal) as Pal[];
    const palCount = pals.filter(a=> a.ContainerId == pSave?.PalStorageContainerId).length;

    return {
        type: "player",
        id: pWorld.PlayerId || pSave.PlayerUid || 'unknown',
        instanceId: pWorld.InstanceId || pSave.InstanceId || 'unknown',
        name: pWorld.Nickname || pWorld.FilteredNickname || 'Unnamed Player',
        level: pWorld.Level || 1,
        stats: pWorld.Stats || [],
        addedStats: pWorld.AddedStats || [],
        palCount: palCount, // Would need to count owned pals from somewhere else
        gold: 0     // Would need to extract from inventory
    };
}

export function toPalCard(pWorld: Pal, serverSave: ServerSave, isCamp: boolean = false) : PalCardData{
    // Check if it's a boss character and clean the ID
    const originalCharacterId = pWorld.CharacterId;
    const isBossFromId = originalCharacterId.includes('BOSS_') || originalCharacterId.includes('Boss_');
    const cleanCharacterId = originalCharacterId.replace(/BOSS_/g, '').replace(/Boss_/g, '');
    
    const palData = getPalData(cleanCharacterId);
    let buff : Buff = {
        b_Attack : 0,
        b_CraftSpeed : 0,
        b_Defense : 0,
        b_MoveSpeed : 0
    };
    let displayedPassives = [];
    if(pWorld.PassiveSkillList) {
        for (let passive of pWorld.PassiveSkillList) {
            let passStat = getPassive(passive);
            buff.b_Attack += passStat.Buff.b_Attack;
            buff.b_CraftSpeed += passStat.Buff.b_CraftSpeed;
            buff.b_Defense += passStat.Buff.b_Defense;
            buff.b_MoveSpeed += passStat.Buff.b_MoveSpeed;

            displayedPassives = [...displayedPassives, {...passStat.I18n["fr"], Rating: passStat.Rating, Id: passive}];
        }
    }
    // let condenserBonus = pWorld.
    // //Final stats conversions.
    // const Health = Math.floor(Math.floor(500 + 5*pWorld.Level +palData?.Hp * 0.5 *pWorld.Level * (1 + (pWorld.TalentHP * 0.3 /100))) * (1 + HP_Bonus%) * (1+HP_SoulsBonus%) * (1+CondenserBonus%))
    // // const Attack = FLOOR(FLOOR(100 + Attack_Stat * .075 * Level * (1 + Attack_IV%)) * (1 + Attack_Bonus%) * (1 + Attack_SoulBonus%) * (1 + CondenserBonus%))
    // // const Defense = FLOOR(FLOOR(50 + Defense_Stat * 0.075 *LEVEL * (1 + Defense_IV%)) * (1 + Defense_Bonus%) * (1 + Defense_SoulBonus%) * (1 + CondenserBonus%))


    return {
        characterId: cleanCharacterId,
        isInCamp : isCamp,
        type: "pal",
        id: pWorld.PlayerId || 'unknown',
        instanceId: pWorld.InstanceId || 'unknown',
        name: pWorld.Nickname || pWorld.FilteredNickname || palData?.OverrideNameTextID || 'Unnamed Pal',
        level: pWorld.Level || 1,
        stats: pWorld.Stats,
        addedStats: pWorld.AddedStats,
        gender: pWorld.Gender || 'unknown',
        friendshipPoint: pWorld.FriendshipPoint,
        ownedTime: pWorld.OwnedTime,
        talentDefense: pWorld.TalentDefense,
        talentShot: pWorld.TalentShot,
        talentHP: pWorld.TalentHP,
        ownerPlayerId: pWorld.PlayerId || 'unknown',
        equipWaza: pWorld.EquipWaza,
        passiveSkills: displayedPassives,
        // Additional data from pals.json
        displayName: palData?.OverrideNameTextID,
        tribe: palData ? cleanTribe(palData.Tribe) : undefined,
        zukanIndex: palData?.ZukanIndex,
        size: palData ? cleanSizeType(palData.Size) : undefined,
        rarity: palData?.Rarity,
        elementType1: palData ? cleanElementType(palData.ElementType1) : undefined,
        elementType2: palData ? cleanElementType(palData.ElementType2) : undefined,
        genusCategory: palData?.GenusCategory?.replace('EPalGenusCategoryType::', ''),
        baseHp: palData?.Hp,
        baseMeleeAttack: palData?.MeleeAttack,
        baseShotAttack: palData?.ShotAttack,
        baseDefense: palData?.Defense,
        baseSupport: palData?.Support,
        baseCraftSpeed: palData?.CraftSpeed,
        workSuitabilities: palData ? {
            emitFlame: palData.WorkSuitability_EmitFlame,
            watering: palData.WorkSuitability_Watering,
            seeding: palData.WorkSuitability_Seeding,
            generateElectricity: palData.WorkSuitability_GenerateElectricity,
            handcraft: palData.WorkSuitability_Handcraft,
            collection: palData.WorkSuitability_Collection,
            deforest: palData.WorkSuitability_Deforest,
            mining: palData.WorkSuitability_Mining,
            productMedicine: palData.WorkSuitability_ProductMedicine,
            cool: palData.WorkSuitability_Cool,
            transport: palData.WorkSuitability_Transport,
            monsterFarm: palData.WorkSuitability_MonsterFarm
        } : undefined,
        isBoss: isBossFromId || palData?.IsBoss,
        price: palData?.Price,
        rank: pWorld.Rank ?? 1
    };
}

export function getPlayerPals(pWorld: Player, pSave: CharacterSave, serverSave: ServerSave) : PalCardData[] {
    let playerContainers: string[] = [pSave.CharacterPalsContainerId, pSave.PalStorageContainerId];
    let guildContainers: string[] = [];
    let guild = serverSave.Groups.find(group => group.Id === pWorld.GroupId) as Guild;
    if(guild) {
        guildContainers = guild.BaseIds.map(bId => serverSave.BaseCamps.find(x => x.Id === bId)!.ContainerId)
    }
    const inventoryPals = serverSave.Characters.filter(a => a instanceof Pal && playerContainers.includes(a.ContainerId)).map(a => toPalCard(a as Pal, serverSave));
    const campPals = serverSave.Characters.filter(a => a instanceof Pal && a.OwnerPlayerUId === pSave.PlayerUid && guildContainers.includes(a.ContainerId)).map(a => toPalCard(a as Pal, serverSave, true));
    return [...inventoryPals, ...campPals];
}
export function toFullPlayerCard(pWorld: Player, pSave: CharacterSave, serverSave: ServerSave) : FullPlayerCardData {
    // Use fallback for PlayerId - try pWorld.PlayerId first, then pSave.PlayerUid
    const playerId = pWorld.PlayerId || pSave.PlayerUid || 'unknown';
    const pals = getPlayerPals(pWorld,pSave,serverSave);
    return {...toPlayerCard(pWorld, pSave, serverSave), pals};
}