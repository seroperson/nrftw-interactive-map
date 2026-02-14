using Il2Cpp;
using Il2CppInterop.Runtime;
using Il2CppInterop.Runtime.Runtime;
using Il2CppMoon.Forsaken;
using Il2CppMoon.Forsaken.Test;
using Il2CppQuantum;
using MelonLoader;
using nrftw_loot_dumper.Helpers;
using System.Text.Json;
using UnityEngine;
using UnityEngine.SceneManagement;
using static Il2CppMoon.Problems.ProblemWatchDog;

[assembly: MelonInfo(typeof(nrftw_loot_dumper.Core), "nrftw-loot-dumper", "1.0.0", "seroperson", null)]
[assembly: MelonGame("Moon Studios", "NoRestForTheWicked")]

namespace nrftw_loot_dumper;

public class Core : MelonMod
{
    private bool loggingEnabled = false;
    private bool dumpEnabled = true;

    private System.Collections.Generic.HashSet<string> existingIds;
    private string csvPath = "entity_dump.csv";

    struct LootSpawnInfo
    {
        public bool shiny { get; set; }
        public bool specialShiny { get; set; }
        public bool smallChest { get; set; }
        public bool mediumChest { get; set; }
        public bool largeChest { get; set; }
        public bool specialChest { get; set; }
        public float respawnChance { get; set; }
        public string respawnFreq { get; set; }
        public string spawnCondition { get; set; }
    }

    struct Drop
    {
        public List<DropGroup> groups { get; set; }

        public Drop()
        {
            groups = new List<DropGroup>();
        }
    }

    struct DropGroup
    {
        public List<DropChances> chances { get; set; }
        public List<DropItems> items { get; set; }


        public DropGroup()
        {
            chances = new List<DropChances>();
            items = new List<DropItems>();
        }
    }

    struct DropChances
    {
        public int chance { get; set; }
        public int count { get; set; }

        public DropChances(int chance, int count)
        {
            this.chance = chance;
            this.count = count;
        }
    }

    struct DropItems
    {
        public List<string/* AssetGuid */> specificItem { get; set; }

        public List<string> filterPool { get; set; }
        public DropItems()
        {
            specificItem = new List<string>();
            filterPool = new List<string>();
        }
    }


    public override void OnInitializeMelon()
    {
        Msg("Entity Dumper Mod Initialized!");
        Msg("Press F9 to dump all entities in the current scene");

        InitializeCsv();
    }

    public override void OnUpdate()
    {
        if (UnityEngine.Input.GetKeyDown(UnityEngine.KeyCode.F9))
        {
            loggingEnabled = !loggingEnabled;
        }
        if (UnityEngine.Input.GetKeyDown(UnityEngine.KeyCode.F10))
        {
            dumpEnabled = !dumpEnabled;
        }
    }

    public override void OnSceneWasLoaded(int buildIndex, string sceneName)
    {
        Msg($"Scene Loaded: {sceneName} (Index: {buildIndex}). Loaded scene count: {SceneManager.loadedSceneCount}. Scene count: {SceneManager.sceneCount}");

        if (dumpEnabled)
        {
            existingIds = LoadExistingIds();
            Scene scene = SceneManager.GetSceneAt(SceneManager.loadedSceneCount - 1);
            DumpAllEntities(scene);
        }
    }

    private void DumpAllEntities(Scene scene)
    {
        try
        {
            if (scene.name.Contains("interactive") || scene.name.Contains("loot") || scene.name.Contains("shinies") /*|| scene.name.Contains("npcs") || scene.name.Contains("enemies") || scene.name.Contains("castle")*/)
            {
                MelonLogger.Msg($"Dumping scene {scene.name}; Path: {scene.path}");
                DumpScene(scene);
            }
            else
            {
                Msg($"Skipping scene dump {scene.name}; Path: {scene.path}");
            }
        }
        catch (System.Exception ex)
        {
            MelonLogger.Error($"Error during entity dump: {ex.Message}");
            MelonLogger.Error($"Stack Trace: {ex.StackTrace}");
        }
    }

    private void DumpScene(Scene scene)
    {
        var sceneRootObjects = scene.GetRootGameObjects();
        foreach (var rootObject in sceneRootObjects)
        {
            Msg($"Root object: {rootObject.name}, {rootObject.GetType()}");

            var name = rootObject.name;
            var componentCount = rootObject.GetComponentCount();
            for (int i = 0; i < componentCount; i++)
            {
                var component = rootObject.GetComponentAtIndex(i);
                var t = component.GetIl2CppType().FullNameOrDefault;
                if (t.Contains("UnityEngine.Transform"))
                {
                    var casted = rootObject.GetComponentAtIndex<Transform>(i);
                    var childCount = casted.childCount;
                    Msg($"- {component.name} ({childCount}), {t}");
                    DumpTransformAndItsChilds(casted, 1, 10, scene);
                }
            }
        }
    }

    private void DumpMonoBehaviour(Transform child, Scene scene, int level, int childsCount, int maxDepth, Vector3 childPosition, MonoBehaviour monoBehaviour)
    {
        if (monoBehaviour != null && monoBehaviour.enabled)
        {
            var objPtr = IL2CPP.Il2CppObjectBaseToPtrNotNull(monoBehaviour);
            var monoLevel = System.String.Concat(Enumerable.Repeat("  ", level + 1));
            var childNameLower = child.name.ToLower();
            var monoScript = GetIl2CppClassName(monoBehaviour);
            if (IsIl2CppInstance("Moon.Forsaken.DigSpotView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<DigSpotView>(objPtr);
                var drop = DumpLoot(casted, monoLevel);
                WriteToCsv("digging", "digging", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), drop, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.StaticPickupView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<StaticPickupView>(objPtr);
                var drop = DumpLoot(casted, casted.Data.LootSource, monoLevel);

                var mainGroup = "loot_spawn";
                var t = "loot_spawn";
                if (childNameLower.Contains("artemisia"))
                {
                    mainGroup = "herb";
                    t = "artemisia";
                }
                else if (childNameLower.Contains("dracaena"))
                {
                    mainGroup = "herb";
                    t = "dracaena";
                }
                else if (childNameLower.Contains("lithops"))
                {
                    mainGroup = "herb";
                    t = "lithops";
                }
                else if (childNameLower.Contains("mushroom"))
                {
                    mainGroup = "herb";
                    t = "mushroom";
                }
                else if (childNameLower.Contains("blueberry"))
                {
                    mainGroup = "food";
                    t = "blueberry";
                }
                else if (childNameLower.Contains("firebrandberry"))
                {
                    mainGroup = "food";
                    t = "firebrandberry";
                }
                else if (childNameLower.Contains("crab"))
                {
                    mainGroup = "food";
                    t = "horseshoe_crab";
                }
                else if (childNameLower.Contains("potato"))
                {
                    mainGroup = "food";
                    t = "potato";
                }
                else if (childNameLower.Contains("tomato"))
                {
                    mainGroup = "food";
                    t = "tomato";
                }

                WriteToCsv(mainGroup, t, child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), drop, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.OreVeinView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<OreVeinView>(objPtr);
                var drop = DumpLoot(casted, monoLevel);
                var oreType = "";
                if (childNameLower.Contains("copper"))
                {
                    oreType = "copper";
                }
                else if (childNameLower.Contains("silver"))
                {
                    oreType = "silver";
                }
                else if (childNameLower.Contains("iron"))
                {
                    oreType = "iron";
                }

                WriteToCsv("ore", oreType, child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), drop, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.CuttableTreeView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<CuttableTreeView>(objPtr);
                var drop = DumpLoot(casted, monoLevel);
                var woodType = "";
                if (childNameLower.Contains("birch"))
                {
                    woodType = "birch";
                }
                else if (childNameLower.Contains("spruce"))
                {
                    woodType = "spruce";
                }
                else if (childNameLower.Contains("pine"))
                {
                    woodType = "pine";
                }

                WriteToCsv("wood", woodType, child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), drop, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.CerimWhisperView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<CerimWhisperView>(objPtr);
                Msg($"{monoLevel}- {casted}, GUID: {casted.MoonGuid.A}, {casted.MoonGuid.B}, {casted.MoonGuid.C}, {casted.MoonGuid.D}");
                WriteToCsv("whisper", "whisper", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.FarmableResourceView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<FarmableResourceView>(objPtr);
                var drop = DumpLoot(casted, monoLevel);
                var mainGroup = "fishing";
                var t = "";
                if (childNameLower.Contains("carp"))
                {
                    t = "carp";
                }
                else if (childNameLower.Contains("bass"))
                {
                    t = "bass";
                }
                else if (childNameLower.Contains("trout"))
                {
                    t = "trout";
                }
                else
                {
                    mainGroup = "loot_spawn";
                    t = "loot_spawn";
                }
                WriteToCsv(mainGroup, t, child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), drop, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.PooledObject", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<PooledObject>(objPtr);
                var components = casted.GetComponents<MonoBehaviour>();
                Msg($"{monoLevel}- {casted}, Pooled object: {casted}, componentsCount: {components.Count}");
                foreach (var childMonoBehaviour in components)
                {
                    if (!IsIl2CppInstance("Moon.Forsaken.PooledObject", childMonoBehaviour))
                    {
                        DumpMonoBehaviour(child, scene, level + 2, childsCount, maxDepth, childPosition, childMonoBehaviour);
                    }
                    else
                    {
                        Msg($"{monoLevel}- Skipping child pooled monoBehaviour {childMonoBehaviour.name}");
                    }
                }
            }
            else if (IsIl2CppInstance("DynamicSpawner", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<DynamicSpawner>(objPtr);
                var anyTags = casted.SpawnerAnyTags.AsEnumerable().Select(v => v.Tag);
                var anyTagsStr = string.Join(",", anyTags);
                var noneTags = casted.SpawnerNoneTags.AsEnumerable().Select(v => v.Tag);
                var noneTagsStr = string.Join(",", noneTags);
                var allTags = casted.SpawnerAllTags.AsEnumerable().Select(v => v.Tag);
                var allTagsStr = string.Join(",", allTags);

                if (childNameLower.Contains("shiny") || childNameLower.Contains("chest") || childNameLower.Contains("loot"))
                {
                    var lootSpawnInfo = new LootSpawnInfo();
                    lootSpawnInfo.shiny = anyTags.Contains(MarkupTag.Shiny) || allTags.Contains(MarkupTag.Shiny);
                    lootSpawnInfo.specialShiny = anyTags.Contains(MarkupTag.SpecialShiny) || allTags.Contains(MarkupTag.SpecialShiny);
                    lootSpawnInfo.smallChest = anyTags.Contains(MarkupTag.SmallChest) || allTags.Contains(MarkupTag.SmallChest);
                    lootSpawnInfo.mediumChest = anyTags.Contains(MarkupTag.MediumChest) || allTags.Contains(MarkupTag.MediumChest);
                    lootSpawnInfo.largeChest = anyTags.Contains(MarkupTag.LargeChest) || allTags.Contains(MarkupTag.LargeChest);
                    lootSpawnInfo.specialChest = anyTags.Contains(MarkupTag.SpecialChest) || allTags.Contains(MarkupTag.SpecialChest);
                    lootSpawnInfo.respawnChance = 1.0f - casted.MissChance;
                    lootSpawnInfo.respawnFreq = casted.RespawnFrequency.ToString();
                    lootSpawnInfo.spawnCondition = string.Join(",", casted.SpawnConditions.AsEnumerable().Select(v => v.Condition.GetIl2CppType()));

                    Msg($"{monoLevel}- Got LootSpawner {casted}, Miss chance: {casted.MissChance}, SpawnerAllTags: {allTagsStr}, SpawnerNoneTags: {noneTagsStr}, SpawnerAnyTags: {anyTagsStr}, GUID: {casted.MoonGuid.A}, {casted.MoonGuid.B}, {casted.MoonGuid.C}, {casted.MoonGuid.D}");
                    WriteToCsv("loot_spawn", "loot_spawn", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, lootSpawnInfo, monoScript);
                }
                else
                {
                    /* var lootSpawnInfo = new LootSpawnInfo();
                    lootSpawnInfo.shiny = false;
                    lootSpawnInfo.specialShiny = false;
                    lootSpawnInfo.smallChest = false;
                    lootSpawnInfo.mediumChest = false;
                    lootSpawnInfo.largeChest = false;
                    lootSpawnInfo.specialChest = false;
                    lootSpawnInfo.enemies = noneTags.Select(v => v.ToString()).Concat(anyTags.Select(v => v.ToString()).Concat(allTags.Select(v => v.ToString()))).ToList();
                    lootSpawnInfo.respawnChance = 1.0f - casted.MissChance;
                    lootSpawnInfo.respawnFreq = casted.RespawnFrequency.ToString();
                    lootSpawnInfo.spawnCondition = string.Join(",", casted.SpawnConditions.AsEnumerable().Select(v => v.Condition.GetIl2CppType().FullName));
                    WriteToCsv("enemy", "enemy", child.name, scene.path, childPosition, casted.MoonGuid, null, lootSpawnInfo); */

                    Msg($"{monoLevel}- Probably an EnemySpawner {casted}, Miss chance: {casted.MissChance}, SpawnerAllTags: {allTagsStr}, SpawnerNoneTags: {noneTagsStr}, SpawnerAnyTags: {anyTagsStr}, GUID: {casted.MoonGuid.A}, {casted.MoonGuid.B}, {casted.MoonGuid.C}, {casted.MoonGuid.D}");
                }
            }
            else if (IsIl2CppInstance("Moon.Forsaken.ContainerView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<ContainerView>(objPtr);
                Msg($"{monoLevel}- {casted}, GUID: {casted.MoonGuid.A}, {casted.MoonGuid.B}, {casted.MoonGuid.C}, {casted.MoonGuid.D}");
                var drop = DumpLoot(casted, casted.Data.Loot, monoLevel);
                WriteToCsv("loot_spawn", "loot_spawn", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), drop, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.BonfireView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<BonfireView>(objPtr);
                Msg($"{monoLevel}- {casted}, GUID: {casted.MoonGuid.A}, {casted.MoonGuid.B}, {casted.MoonGuid.C}, {casted.MoonGuid.D}");
                WriteToCsv("bonfire", "bonfire", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.RopeView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<RopeView>(objPtr);
                Msg($"{monoLevel}- {casted}, GUID: {casted.MoonGuid.A}, {casted.MoonGuid.B}, {casted.MoonGuid.C}, {casted.MoonGuid.D}");
                WriteToCsv("interactible", "ladder", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.MovingPlatformView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<MovingPlatformView>(objPtr);
                MelonLogger.Msg($"Got Forsaken.MovingPlatform: {child.name}, {child.GetIl2CppType().FullName}");
                WriteToCsv("interactible", "platform", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.BalakTawElevatorControllerView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<BalakTawElevatorControllerView>(objPtr);
                MelonLogger.Msg($"Got Forsaken.BalakTawElevatorControllerView: {child.name}, {child.GetIl2CppType().FullName}");
                WriteToCsv("interactible", "platform", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.LadderView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<LadderView>(objPtr);
                Msg($"{monoLevel}- {casted}, GUID: {casted.MoonGuid.A}, {casted.MoonGuid.B}, {casted.MoonGuid.C}, {casted.MoonGuid.D}");
                WriteToCsv("interactible", "ladder", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.DoorView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<DoorView>(objPtr);
                Msg($"{monoLevel}- {casted}, GUID: {casted.MoonGuid.A}, {casted.MoonGuid.B}, {casted.MoonGuid.C}, {casted.MoonGuid.D}");
                WriteToCsv("interactible", "door", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.GroundLeverView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<GroundLeverView>(objPtr);
                Msg($"{monoLevel}- {casted}, GUID: {casted.MoonGuid.A}, {casted.MoonGuid.B}, {casted.MoonGuid.C}, {casted.MoonGuid.D}");
                WriteToCsv("interactible", "lever", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.ToggleLeverView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<ToggleLeverView>(objPtr);
                Msg($"{monoLevel}- {casted}, GUID: {casted.MoonGuid.A}, {casted.MoonGuid.B}, {casted.MoonGuid.C}, {casted.MoonGuid.D}");
                WriteToCsv("interactible", "lever", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.WallLeverView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<WallLeverView>(objPtr);
                Msg($"{monoLevel}- {casted}, GUID: {casted.MoonGuid.A}, {casted.MoonGuid.B}, {casted.MoonGuid.C}, {casted.MoonGuid.D}");
                WriteToCsv("interactible", "lever", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.TurnWheelView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<TurnWheelView>(objPtr);
                Msg($"{monoLevel}- {casted}, GUID: {casted.MoonGuid.A}, {casted.MoonGuid.B}, {casted.MoonGuid.C}, {casted.MoonGuid.D}");
                WriteToCsv("interactible", "lever", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.LeverView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<LeverView>(objPtr);
                Msg($"{monoLevel}- {casted}, GUID: {casted.MoonGuid.A}, {casted.MoonGuid.B}, {casted.MoonGuid.C}, {casted.MoonGuid.D}");
                WriteToCsv("interactible", "lever", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.EventLeverView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<EventLeverView>(objPtr);
                Msg($"{monoLevel}- {casted}, GUID: {casted.MoonGuid.A}, {casted.MoonGuid.B}, {casted.MoonGuid.C}, {casted.MoonGuid.D}");
                WriteToCsv("interactible", "lever", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.DamageReceivingLeverView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<DamageReceivingLeverView>(objPtr);
                Msg($"{monoLevel}- {casted}, GUID: {casted.MoonGuid.A}, {casted.MoonGuid.B}, {casted.MoonGuid.C}, {casted.MoonGuid.D}");
                WriteToCsv("interactible", "lever", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.PushCogView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<PushCogView>(objPtr);
                Msg($"{monoLevel}- {casted}, GUID: {casted.MoonGuid.A}, {casted.MoonGuid.B}, {casted.MoonGuid.C}, {casted.MoonGuid.D}");
                WriteToCsv("interactible", "lever", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.GeneralReadableView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<GeneralReadableView>(objPtr);
                Msg($"{monoLevel}- {casted}, GUID: {casted.MoonGuid.A}, {casted.MoonGuid.B}, {casted.MoonGuid.C}, {casted.MoonGuid.D}");
                WriteToCsv("interactible", "readable", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.GeneralInteractableView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<GeneralInteractableView>(objPtr);
                Msg($"{monoLevel}- {casted}, GUID: {casted.MoonGuid.A}, {casted.MoonGuid.B}, {casted.MoonGuid.C}, {casted.MoonGuid.D}");
                WriteToCsv("interactible", "other", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.PuzzleView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<PuzzleView>(objPtr);
                Msg($"{monoLevel}- {casted}, GUID: {casted.MoonGuid.A}, {casted.MoonGuid.B}, {casted.MoonGuid.C}, {casted.MoonGuid.D}");
                WriteToCsv("interactible", "entrance", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.InteractableTeleport", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<InteractableTeleport>(objPtr);
                Msg($"Got Forsaken.InteractableTeleport: {child.name}, {child.GetIl2CppType().FullName}");
                WriteToCsv("interactible", "entrance", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.HouseEntrance", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<HouseEntrance>(objPtr);
                Msg($"Got Forsaken.HouseEntrance: {child.name}, {child.GetIl2CppType().FullName}");
                WriteToCsv("interactible", "house_entrance", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.TriggerZoneView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<TriggerZoneView>(objPtr);
                if (casted.QuantumData.Type == TriggerZoneType.Teleport)
                {
                    // MelonLogger.Msg($"Got Teleport! {child.name}, ShouldExistOnViewSide: {casted.ShouldExistOnViewSide}, {casted.QuantumData.Type}, linked entities size: {casted.LinkedEntities.Count}");
                    WriteToCsv("interactible", "entrance", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
                }
                else
                {
                    // MelonLogger.Msg($"Got Not teleport: {child.name}, ShouldExistOnViewSide: {casted.ShouldExistOnViewSide}, {casted.QuantumData.Type}");
                }
            }
            else if (IsIl2CppInstance("Moon.Forsaken.SurfaceInfo", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<SurfaceInfo>(objPtr);
                if (casted.WallClimbable)
                {
                    MelonLogger.Msg($"SurfaceInfo {child.name}, {casted.Type}, isNavigable {casted.Navigable}, isWallClimbable {casted.WallClimbable}, isEdgeClimbable {casted.EdgeClimbable}, id: {casted.GetInstanceID()}, clazz: {monoScript}");
                    WriteToCsv("interactible", "wall_climb", child.name, scene.path, childPosition, null, casted.GetInstanceID(), null, null, monoScript);
                }
            }
            else
            {
                if (monoScript.ToLower().Contains("view") || monoScript.ToLower().Contains("interact") || monoScript.ToLower().Contains("Entity") || monoScript.ToLower().Contains("npc"))
                {
                    MelonLogger.Msg($"Unknown object: {child.name}, {monoScript}");
                }
            }
        }
    }

    private void DumpTransformAndItsChilds(Transform obj, int level, int maxDepth, Scene scene)
    {
        if (level > maxDepth)
        {
            return;
        }
        var childCount = obj.childCount;
        for (int j = 0; j < childCount; j++)
        {
            var child = obj.GetChild(j);

            var childPosition = child.position;
            var childLocalPosition = child.localPosition;
            var childScale = child.localScale;
            var childType = child.GetIl2CppType().FullNameOrDefault;
            var childsCount = child.childCount;
            var currentLevel = System.String.Concat(Enumerable.Repeat("  ", level));

            Msg($"{currentLevel}- {child.name} ({childsCount})");
            try
            {
                var monoBehaviour = child.GetComponents<MonoBehaviour>();
                foreach (var childMonoBehaviour in monoBehaviour)
                {
                    DumpMonoBehaviour(child, scene, level, childsCount, maxDepth, childPosition, childMonoBehaviour);
                }
            }
            catch (System.Exception e)
            {
                MelonLogger.Msg($"Error: {e}");
            }
            DumpTransformAndItsChilds(child, level + 1, maxDepth, scene);
        }
    }

    private Drop DumpLoot(FarmableResourceView casted, string monoLevel)
    {
        return DumpLoot(casted, casted.Data.LootSource, monoLevel);
    }

    private Drop DumpLoot(DigSpotView casted, string monoLevel)
    {
        return DumpLoot(casted, casted.Data.LootSource, monoLevel);
    }

    private Drop DumpLoot(OreVeinView casted, string monoLevel)
    {
        return DumpLoot(casted, casted.Data.LootSource, monoLevel);
    }

    private Drop DumpLoot(CuttableTreeView casted, string monoLevel)
    {
        return DumpLoot(casted, casted.Data.LootSource, monoLevel);
    }


    private Drop DumpLoot(InteractableLinkedEntityView casted, LootSource lootSource, string monoLevel)
    {
        var game = casted.VerifiedFrame.Game;
        var assetResolver = game.AssetResolver;

        var drop = new Drop();

        Msg($"{monoLevel}- {casted}, GUID: {casted.MoonGuid.A}, {casted.MoonGuid.B}, {casted.MoonGuid.C}, {casted.MoonGuid.D}");
        foreach (var x in lootSource.Sources)
        {
            foreach (var group in x.Get(assetResolver).Groups)
            {
                var currentDropGroup = new DropGroup();

                Msg($"{monoLevel}- Loot count: {group.Loots.Count}; LootCount count: {group.LootCountEntries.Count}");
                for (int j = 0; j < group.LootCountEntries.Count; j++)
                {
                    var lootFreq = group.LootCountEntries[j];
                    Msg($"{monoLevel}  - Loot freq: {lootFreq.Count}, {lootFreq.Frequency}");

                    currentDropGroup.chances.Add(new DropChances(lootFreq.Frequency.AsInt, lootFreq.Count));
                }
                for (int i = 0; i < group.Loots.Count; i++)
                {
                    var loot = group.Loots[i];
                    var currentDropItems = new DropItems();
                    if (IsIl2CppInstance("Quantum.SpecificItemLoot", loot))
                    {
                        var specificItemLoot = CastIl2Cpp<SpecificItemLoot>(loot);
                        HeroItemData data = specificItemLoot.SpecificItem.Get(assetResolver);
                        if (IsIl2CppInstance("Quantum.GenericItemData", data))
                        {
                            var genericItemData = CastIl2Cpp<GenericItemData>(data);
                            currentDropItems.specificItem.Add(genericItemData.Guid.Value.ToString());
                            Msg($"{monoLevel}  - Specific loot, generic item loot: {genericItemData}, ({genericItemData.Guid.Type}, {genericItemData.Guid}, {genericItemData.Guid.Value})");
                        }
                        else
                        {
                            currentDropItems.specificItem.Add(data.Guid.Value.ToString());
                            Msg($"{monoLevel}  - Specific loot, but not GenericItemData: {data.GetIl2CppType().FullName}");
                        }
                    }
                    else if (IsIl2CppInstance("Quantum.FilteredItemLoot", loot))
                    {
                        var filteredItemLoot = CastIl2Cpp<FilteredItemLoot>(loot);
                        currentDropItems.filterPool.Add(filteredItemLoot.Filter.ToString());
                        Msg($"{monoLevel}  - Filtered loot: {filteredItemLoot.Filter}");
                    }
                    else if (IsIl2CppInstance("Quantum.GenericItemData", loot))
                    {
                        var genericItemData = CastIl2Cpp<GenericItemData>(loot);
                        currentDropItems.specificItem.Add(genericItemData.Guid.Value.ToString());

                        Msg($"{monoLevel}  - Generic item loot: {genericItemData}, ({genericItemData.Guid.Type}, {genericItemData.Guid}, {genericItemData.Guid.Value})");
                    }
                    else
                    {
                        Msg($"{monoLevel}  - Unspecified loot: {loot.GetIl2CppType().FullName}");
                    }
                    currentDropGroup.items.Add(currentDropItems);
                }
                drop.groups.Add(currentDropGroup);
            }
        }

        return drop;
    }

    private T CastIl2Cpp<T>(Il2CppSystem.Object o)
    {
        var objPtr = IL2CPP.Il2CppObjectBaseToPtrNotNull(o);
        return Il2CppObjectPool.Get<T>(objPtr);
    }

    private T TryCastIl2Cpp<T>(string clazz, Il2CppSystem.Object o)
    {
        if (Il2CppSystem.Type.GetType(clazz).IsInstanceOfType(o))
        {
            var objPtr = IL2CPP.Il2CppObjectBaseToPtrNotNull(o);
            return Il2CppObjectPool.Get<T>(objPtr);
        }
        return default;
    }
    private string GetIl2CppClassName(Il2CppSystem.Object o)
    {
        IntPtr objPtr = IL2CPP.Il2CppObjectBaseToPtrNotNull(o);
        IntPtr classPtr = IL2CPP.il2cpp_object_get_class(objPtr);
        string className = IL2CPP.il2cpp_class_get_name_(classPtr);
        string nameSpace = IL2CPP.il2cpp_class_get_namespace_(classPtr);
        return $"{nameSpace}.{className}";
    }

    private bool IsIl2CppInstance(string clazz, Il2CppSystem.Object o)
    {
        return Il2CppSystem.Type.GetType(clazz).IsInstanceOfType(o);
    }

    private void InitializeCsv()
    {
        if (!System.IO.File.Exists(csvPath))
        {
            var header = "Type,Subtype,Name,File,RawX,RawY,RawZ,id,Drop,LootSpawnInfo,Clazz\n";
            System.IO.File.WriteAllText(csvPath, header);
            Msg($"Created CSV file: {csvPath}");
        }
    }

    private System.Collections.Generic.HashSet<string> LoadExistingIds()
    {
        var existingIds = new System.Collections.Generic.HashSet<string>();
        if (System.IO.File.Exists(csvPath))
        {
            var lines = System.IO.File.ReadAllLines(csvPath);
            // Skip header
            for (int i = 1; i < lines.Length; i++)
            {
                var parts = ParseCsvLine(lines[i]);
                if (parts.Count >= 8)
                {
                    // Remove quotes from id field if present
                    var id = parts[7].Trim('"');
                    existingIds.Add(id);
                }
            }
            Msg($"Loaded {existingIds.Count} existing entity IDs from CSV");
        }
        return existingIds;
    }

    private System.Collections.Generic.List<string> ParseCsvLine(string line)
    {
        var result = new System.Collections.Generic.List<string>();
        var current = new System.Text.StringBuilder();
        bool inQuotes = false;

        for (int i = 0; i < line.Length; i++)
        {
            char c = line[i];
            char? nextChar = i + 1 < line.Length ? line[i + 1] : (char?)null;

            if (c == '"')
            {
                if (inQuotes && nextChar == '"')
                {
                    // Escaped quote
                    current.Append('"');
                    i++; // Skip next quote
                }
                else
                {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                }
            }
            else if (c == ',' && !inQuotes)
            {
                // Field separator
                result.Add(current.ToString());
                current.Clear();
            }
            else
            {
                current.Append(c);
            }
        }

        // Add last field
        result.Add(current.ToString());
        return result;
    }

    private void WriteToCsv(string type, string subtype, string name, string file, Vector3 position, MoonGuid id, int instanceId, Drop? drop, LootSpawnInfo? lootSpawnInfo, string clazz)
    {
        var resultId = "";
        if (id is not null)
        {
            resultId = $"{id.A},{id.B},{id.C},{id.D}";
        }
        else
        {
            resultId = $"{instanceId}";
        }
        if (existingIds.Contains(resultId))
        {
            return;
        }

        if (position.x == 0.0f || position.y == 0.0f || position.z == 0.0f)
        {
            return;
        }

        // Magic number from decompiled Moon.Forsaken.EntityView$$UpdateTransformSync
        var backToRawValue = 0.000015258789;

        // Convert floats to raw integer representation
        int rawX = (int)(position.x / backToRawValue);
        int rawY = (int)(position.y / backToRawValue);
        int rawZ = (int)(position.z / backToRawValue);

        // Serialize Drop and LootSpawnInfo to JSON if present
        string dropJson = drop.HasValue ? JsonSerializer.Serialize(drop.Value).Replace("\"", "\"\"") : "";
        string lootSpawnInfoJson = lootSpawnInfo.HasValue ? JsonSerializer.Serialize(lootSpawnInfo.Value).Replace("\"", "\"\"") : "";

        var csvLine = $"{type},{subtype},{name},{file},{rawX},{rawY},{rawZ},\"{resultId}\",\"{dropJson}\",\"{lootSpawnInfoJson}\",{clazz}\n";
        System.IO.File.AppendAllText(csvPath, csvLine);
        existingIds.Add(resultId);
    }

    private void Msg(string msg)
    {
        if (loggingEnabled)
        {
            MelonLogger.Msg(msg);
        }
    }

}