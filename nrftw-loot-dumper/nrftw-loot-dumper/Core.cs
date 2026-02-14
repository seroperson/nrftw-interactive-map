using Il2Cpp;
using Il2CppInterop.Runtime;
using Il2CppInterop.Runtime.Runtime;
using Il2CppMoon;
using Il2CppMoon.Forsaken;
using Il2CppMoon.Forsaken.Test;
using Il2CppQuantum;
using MelonLoader;
using nrftw_loot_dumper.Helpers;
using System.Linq;
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
    private string csvPathUnsorted = "entity_dump_unsorted.csv";
    private string sceneStatsPath = "scene_stats.csv";
    private System.Collections.Generic.List<string> pendingSortedEntries = new System.Collections.Generic.List<string>();
    private System.Collections.Generic.Dictionary<string, SceneStats> sceneStatistics = new System.Collections.Generic.Dictionary<string, SceneStats>();
    private string currentScenePath = "";
    private int currentSceneWrittenCount = 0;
    private bool currentSceneHasUnknownObjects = false;

    struct SceneStats
    {
        public int objectCount { get; set; }
        public bool hasUnknownObjects { get; set; }
    }

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
        LoadSceneStats();
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
            // Initialize tracking for current scene
            currentScenePath = scene.path;
            currentSceneWrittenCount = 0;
            currentSceneHasUnknownObjects = false;

            // Check if we should skip this scene
            if (sceneStatistics.ContainsKey(currentScenePath))
            {
                var stats = sceneStatistics[currentScenePath];
                if (!stats.hasUnknownObjects && stats.objectCount == 0)
                {
                    MelonLogger.Msg($"Skipping scene {scene.name}; Path: {scene.path} (no unknown objects and nothing written previously)");
                    return;
                }
            }

            MelonLogger.Msg($"Dumping scene {scene.name}; Path: {scene.path}");
            DumpScene(scene);
            FlushPendingEntriesToSortedCsv();

            // Update and save scene statistics
            var newStats = new SceneStats
            {
                objectCount = currentSceneWrittenCount,
                hasUnknownObjects = currentSceneHasUnknownObjects
            };
            sceneStatistics[currentScenePath] = newStats;
            SaveSceneStats();
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
                foreach (var childMonoBehaviour in components)
                {
                    if (!IsIl2CppInstance("Moon.Forsaken.PooledObject", childMonoBehaviour))
                    {
                        DumpMonoBehaviour(child, scene, level + 2, childsCount, maxDepth, childPosition, childMonoBehaviour);
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
            }
            else if (IsIl2CppInstance("Moon.Forsaken.ContainerView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<ContainerView>(objPtr);
                var drop = DumpLoot(casted, casted.Data.Loot, monoLevel);
                WriteToCsv("loot_spawn", "loot_spawn", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), drop, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.BonfireView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<BonfireView>(objPtr);
                WriteToCsv("bonfire", "bonfire", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.RopeView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<RopeView>(objPtr);
                WriteToCsv("interactible", "ladder", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.MovingPlatformView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<MovingPlatformView>(objPtr);
                WriteToCsv("interactible", "platform", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.BalakTawElevatorControllerView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<BalakTawElevatorControllerView>(objPtr);
                WriteToCsv("interactible", "platform", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.LadderView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<LadderView>(objPtr);
                WriteToCsv("interactible", "ladder", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.DoorView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<DoorView>(objPtr);
                WriteToCsv("interactible", "door", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.GroundLeverView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<GroundLeverView>(objPtr);
                WriteToCsv("interactible", "lever", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.ToggleLeverView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<ToggleLeverView>(objPtr);
                WriteToCsv("interactible", "lever", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.WallLeverView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<WallLeverView>(objPtr);
                WriteToCsv("interactible", "lever", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.TurnWheelView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<TurnWheelView>(objPtr);
                WriteToCsv("interactible", "lever", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.LeverView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<LeverView>(objPtr);
                WriteToCsv("interactible", "lever", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.EventLeverView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<EventLeverView>(objPtr);
                WriteToCsv("interactible", "lever", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.DamageReceivingLeverView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<DamageReceivingLeverView>(objPtr);
                WriteToCsv("interactible", "lever", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.PushCogView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<PushCogView>(objPtr);
                WriteToCsv("interactible", "lever", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.GeneralReadableView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<GeneralReadableView>(objPtr);
                WriteToCsv("interactible", "readable", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.GeneralInteractableView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<GeneralInteractableView>(objPtr);
                WriteToCsv("interactible", "other", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.PuzzleView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<PuzzleView>(objPtr);
                WriteToCsv("interactible", "entrance", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.InteractableTeleport", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<InteractableTeleport>(objPtr);
                WriteToCsv("interactible", "entrance", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.HouseEntrance", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<HouseEntrance>(objPtr);
                WriteToCsv("interactible", "house_entrance", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.TriggerZoneView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<TriggerZoneView>(objPtr);
                if (casted.QuantumData.Type == TriggerZoneType.Teleport)
                {
                    WriteToCsv("interactible", "entrance", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
                }
            }
            else if (IsIl2CppInstance("Moon.Forsaken.SurfaceInfo", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<SurfaceInfo>(objPtr);
                if (casted.WallClimbable)
                {
                    WriteToCsv("interactible", "wall_climb", child.name, scene.path, childPosition, null, casted.GetInstanceID(), null, null, monoScript);
                }
            }
            else if (IsIl2CppInstance("Moon.Forsaken.DestructibleView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<DestructibleView>(objPtr);
                var lowerName = casted.name.ToLower();
                var t = "";
                if (lowerName.Contains("wall"))
                {
                    t = "wall";
                }
                else if (lowerName.Contains("door"))
                {
                    t = "des_door";
                }

                if (!t.Equals(""))
                {
                    WriteToCsv("destructible", t, child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
                }
            }
            else if (IsIl2CppInstance("Moon.Forsaken.NpcInstance", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<NpcInstance>(objPtr);
                var lowerName = casted.name.ToLower();
                if (!lowerName.Contains("squirrel") && !lowerName.Contains("cata_patrol") && !lowerName.Contains("catapatrol") && !lowerName.Contains("dogpet"))
                {
                    /*try
                    {
                        MelonLogger.Msg("Loggin NPC");
                        IL2CPPInspector.InspectComponent(casted);
                        if (casted.SpawnedEntityView is not null)
                        {
                            MelonLogger.Msg("Loggin NPC View");
                            IL2CPPInspector.InspectComponent(casted.SpawnedEntityView);
                        }
                        IL2CPPInspector.InspectComponent(casted.SpawnerEntity);
                    }
                    catch (System.Exception e)
                    {
                        MelonLogger.Msg($"Error: {e}");
                    }*/

                    var t = "npc_other";
                    if (lowerName.Contains("boss"))
                    {
                        t = "boss";
                    }
                    else if (lowerName.Contains("boarskin"))
                    {
                        t = "boarskin";
                    }
                    else if (lowerName.Contains("boar") || lowerName.Contains("bear"))
                    {
                        t = "animal";
                    }
                    else if (lowerName.Contains("critt"))
                    {
                        t = "critter";
                    }
                    else if (lowerName.Contains("balaktaw"))
                    {
                        t = "balak_taw";
                    }
                    MelonLogger.Msg($"Logging {child.name} with type: {t}");
                    WriteToCsv("npc", t, child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, monoScript);
                }
            }
            else
            {
                var monoScriptLower = monoScript.ToLower();
                var whatToDump = monoScriptLower.Contains("view") || monoScriptLower.Contains("interact") || monoScriptLower.Contains("Entity") || monoScriptLower.Contains("npc");
                var dumpSkip = new List<string>();
                dumpSkip.Add("actionview");
                dumpSkip.Add("reactivetree");
                dumpSkip.Add("stuntpoint");
                dumpSkip.Add("hintzone");
                dumpSkip.Add("avatar");
                dumpSkip.Add("settingsconsumer");
                dumpSkip.Add("preview");
                dumpSkip.Add("houseitemview");
                dumpSkip.Add("eventhandler");
                dumpSkip.Add("rendering.interaction");
                dumpSkip.Add("moon.forsaken.entityview");
                dumpSkip.Add("moon.forsaken.bedview");
                dumpSkip.Add("moon.forsaken.housechestview");
                dumpSkip.Add("moon.forsaken.storagerugview");
                dumpSkip.Add("meleeattackview");
                dumpSkip.Add("viewphysicsplatform");
                dumpSkip.Add("simplecinematicsetupview");
                dumpSkip.Add("enemyshieldview");
                dumpSkip.Add("npccameratarget");

                dumpSkip.Add("activateviewbasedoncondition");
                // SlowDownZoneView
                // PlagueStatueView
                // RespecStatueView
                if (whatToDump && dumpSkip.Select(x => !monoScriptLower.Contains(x)).All(x => x))
                {
                    MelonLogger.Msg($"Unknown object: {child.name}, {monoScript}");
                    currentSceneHasUnknownObjects = true;
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
        var header = "Type,Subtype,Name,File,RawX,RawY,RawZ,id,Drop,LootSpawnInfo,Clazz\n";

        if (!System.IO.File.Exists(csvPath))
        {
            System.IO.File.WriteAllText(csvPath, header);
            Msg($"Created sorted CSV file: {csvPath}");
        }

        if (!System.IO.File.Exists(csvPathUnsorted))
        {
            System.IO.File.WriteAllText(csvPathUnsorted, header);
            Msg($"Created unsorted CSV file: {csvPathUnsorted}");
        }
    }

    private System.Collections.Generic.HashSet<string> LoadExistingIds()
    {
        var existingIds = new System.Collections.Generic.HashSet<string>();

        // Load from sorted CSV
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
        }

        // Load from unsorted CSV (in case it has entries not in sorted)
        if (System.IO.File.Exists(csvPathUnsorted))
        {
            var lines = System.IO.File.ReadAllLines(csvPathUnsorted);
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
        }

        Msg($"Loaded {existingIds.Count} existing entity IDs from CSV files");
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
            MelonLogger.Msg($"Skipping {name} because it's already saved");
            currentSceneWrittenCount++;
            return;
        }

        if (position.x == 0.0f || position.y == 0.0f || position.z == 0.0f)
        {
            MelonLogger.Msg($"Skipping {name} because it has likely unset position: {position}");
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

        var newLine = $"{type},{subtype},{name},{file},{rawX},{rawY},{rawZ},\"{resultId}\",\"{dropJson}\",\"{lootSpawnInfoJson}\",{clazz}";

        // Write to unsorted CSV file (just append)
        System.IO.File.AppendAllText(csvPathUnsorted, newLine + "\n");

        // Add to pending entries for sorted CSV (will be flushed after scene dump)
        pendingSortedEntries.Add(newLine);

        existingIds.Add(resultId);

        // Increment written count for current scene
        currentSceneWrittenCount++;
    }

    private void FlushPendingEntriesToSortedCsv()
    {
        if (pendingSortedEntries.Count == 0)
        {
            return;
        }

        Msg($"Flushing {pendingSortedEntries.Count} pending entries to sorted CSV...");

        // Read all existing lines from sorted CSV
        var lines = new System.Collections.Generic.List<string>();
        if (System.IO.File.Exists(csvPath))
        {
            lines.AddRange(System.IO.File.ReadAllLines(csvPath));
        }

        // Add header if file is empty
        if (lines.Count == 0)
        {
            lines.Add("Type,Subtype,Name,File,RawX,RawY,RawZ,id,Drop,LootSpawnInfo,Clazz");
        }

        // Add all pending entries
        lines.AddRange(pendingSortedEntries);

        // Sort all lines except header by id column
        var header = lines[0];
        var dataLines = lines.Skip(1).ToList();

        // Sort by extracting id from each line
        dataLines.Sort((a, b) =>
        {
            var idA = ExtractIdFromCsvLine(a);
            var idB = ExtractIdFromCsvLine(b);
            return string.Compare(idA, idB, System.StringComparison.Ordinal);
        });

        // Write sorted lines back to file
        var sortedLines = new System.Collections.Generic.List<string> { header };
        sortedLines.AddRange(dataLines);
        System.IO.File.WriteAllLines(csvPath, sortedLines);

        Msg($"Flushed {pendingSortedEntries.Count} entries to sorted CSV");

        // Clear pending entries
        pendingSortedEntries.Clear();
    }

    private string ExtractIdFromCsvLine(string line)
    {
        var parts = ParseCsvLine(line);
        if (parts.Count >= 8)
        {
            return parts[7].Trim('"');
        }
        return "";
    }

    private void LoadSceneStats()
    {
        sceneStatistics.Clear();

        if (!System.IO.File.Exists(sceneStatsPath))
        {
            Msg("No scene stats file found, starting fresh");
            return;
        }

        try
        {
            var lines = System.IO.File.ReadAllLines(sceneStatsPath);
            // Skip header
            for (int i = 1; i < lines.Length; i++)
            {
                var parts = lines[i].Split(',');
                if (parts.Length >= 3)
                {
                    var scenePath = parts[0];
                    if (int.TryParse(parts[1], out int objectCount) && bool.TryParse(parts[2], out bool hasUnknownObjects))
                    {
                        sceneStatistics[scenePath] = new SceneStats
                        {
                            objectCount = objectCount,
                            hasUnknownObjects = hasUnknownObjects
                        };
                    }
                }
            }

            MelonLogger.Msg($"Loaded scene stats for {sceneStatistics.Count} scenes");
        }
        catch (System.Exception ex)
        {
            MelonLogger.Error($"Error loading scene stats: {ex.Message}");
        }
    }

    private void SaveSceneStats()
    {
        try
        {
            var lines = new System.Collections.Generic.List<string>();
            lines.Add("ScenePath,ObjectCount,HasUnknownObjects");

            foreach (var kvp in sceneStatistics)
            {
                lines.Add($"{kvp.Key},{kvp.Value.objectCount},{kvp.Value.hasUnknownObjects}");
            }

            System.IO.File.WriteAllLines(sceneStatsPath, lines);
            Msg($"Saved scene stats for {sceneStatistics.Count} scenes");
        }
        catch (System.Exception ex)
        {
            MelonLogger.Error($"Error saving scene stats: {ex.Message}");
        }
    }

    private void Msg(string msg)
    {
        if (loggingEnabled)
        {
            MelonLogger.Msg(msg);
        }
    }

}