using Il2Cpp;
using Il2Cppframeworks.session;
using Il2CppInterop.Runtime;
using Il2CppInterop.Runtime.Runtime;
using Il2CppMoon;
using Il2CppMoon.Forsaken;
using Il2CppMoon.Forsaken.Test;
using Il2CppMoon.GameSession;
using Il2CppMoon.Settings;
using Il2CppPhoton.Client.StructWrapping;
using Il2CppPhoton.Deterministic;
using Il2CppQuantum;
using MelonLoader;
using nrftw_loot_dumper.Helpers;
using System.Linq;
using System.Text.Json;
using UnityEngine;
using UnityEngine.Experimental.Rendering;
using UnityEngine.SceneManagement;
using static Il2CppMoon.Problems.ProblemWatchDog;
using HarmonyLib;

[assembly: MelonInfo(typeof(nrftw_loot_dumper.Core), "nrftw-loot-dumper", "1.0.0", "seroperson", null)]
[assembly: MelonGame("Moon Studios", "NoRestForTheWicked")]

namespace nrftw_loot_dumper;

public class Core : MelonMod
{
    private bool loggingEnabled = false;
    private bool dumpEnabled = true;
    private HarmonyLib.Harmony harmonyInstance;

    private System.Collections.Generic.HashSet<string> existingIds;
    private System.Collections.Generic.List<CsvEntry> existingEntriesWithoutGuid = new System.Collections.Generic.List<CsvEntry>();
    private string csvPath = "entity_dump.csv";
    private string csvPathUnsorted = "entity_dump_unsorted.csv";
    private string sceneStatsPath = "scene_stats.csv";
    private System.Collections.Generic.List<CsvEntry> pendingSortedEntries = new System.Collections.Generic.List<CsvEntry>();
    private System.Collections.Generic.List<CsvEntry> pendingUnsortedEntries = new System.Collections.Generic.List<CsvEntry>();
    private System.Collections.Generic.List<CsvEntry> pendingUpdatedEntries = new System.Collections.Generic.List<CsvEntry>();
    private System.Collections.Generic.Dictionary<string, SceneStats> sceneStatistics = new System.Collections.Generic.Dictionary<string, SceneStats>();
    private string currentScenePath = "";
    private int currentSceneWrittenCount = 0;
    private bool currentSceneHasUnknownObjects = false;

    struct SceneStats
    {
        public int objectCount { get; set; }
        public bool hasUnknownObjects { get; set; }
    }

    struct CsvEntry
    {
        public string type { get; set; }
        public string subtype { get; set; }
        public string name { get; set; }
        public string file { get; set; }
        public int rawX { get; set; }
        public int rawY { get; set; }
        public int rawZ { get; set; }
        public string id { get; set; }
        public string dropJson { get; set; }
        public string lootSpawnInfoJson { get; set; }
        public string spawnConditionsJson { get; set; }
        public string clazz { get; set; }
        public bool hasMoonGuid { get; set; }

        public string ToCsvLine()
        {
            return $"{type},{subtype},{name},{file},{rawX},{rawY},{rawZ},\"{id}\",\"{dropJson}\",\"{lootSpawnInfoJson}\",\"{spawnConditionsJson}\",{clazz}";
        }

        public bool MatchesAllValues(CsvEntry other)
        {
            return type == other.type &&
                   subtype == other.subtype &&
                   name == other.name &&
                   file == other.file &&
                   rawX == other.rawX &&
                   rawY == other.rawY &&
                   rawZ == other.rawZ &&
                   clazz == other.clazz;
        }
    }

    struct LootSpawnInfo
    {
        public string respawnFreq { get; set; }

        // New fields to capture more DynamicSpawner info
        public float missChance { get; set; }
        public System.Collections.Generic.List<string> anyTags { get; set; }
        public System.Collections.Generic.List<string> allTags { get; set; }
        public System.Collections.Generic.List<string> noneTags { get; set; }
        public System.Collections.Generic.List<string> spawnConditions { get; set; }
    }

    struct SpawnConditions
    {
        public ConditionData? requiredSpawnConditions { get; set; }
        public ConditionData? disableConditions { get; set; }
        public ConditionData? respawnConditions { get; set; }
    }

    struct ConditionData
    {
        public System.Collections.Generic.List<QuestStepConditionData> questSteps { get; set; }
        public System.Collections.Generic.List<QuestConditionData> quests { get; set; }
        public System.Collections.Generic.List<WorldEventConditionData> worldEvents { get; set; }
        public System.Collections.Generic.List<TimeOfDayConditionData> timesOfDay { get; set; }
        public System.Collections.Generic.List<HasItemConditionData> hasItems { get; set; }
        public System.Collections.Generic.List<HasModifierConditionData> hasModifiers { get; set; }
        public System.Collections.Generic.List<ActivityConditionData> activities { get; set; }
        public System.Collections.Generic.List<BoonConditionData> boons { get; set; }
        public HasGoldConditionData? hasGold { get; set; }
    }

    struct QuestStepConditionData
    {
        public string questGuid { get; set; }
        public string state { get; set; }
        public string conditionType { get; set; }
    }

    struct QuestConditionData
    {
        public string questGuid { get; set; }
        public string state { get; set; }
        public string conditionType { get; set; }
    }

    struct WorldEventConditionData
    {
        public string eventGuid { get; set; }
        public string state { get; set; }
        public string conditionType { get; set; }
    }

    struct TimeOfDayConditionData
    {
        public string timeOfDay { get; set; }
        public string conditionType { get; set; }
    }

    struct HasItemConditionData
    {
        public string itemGuid { get; set; }
        public string conditionType { get; set; }
    }

    struct HasModifierConditionData
    {
        public string modifierTag { get; set; }
        public string conditionType { get; set; }
    }

    struct ActivityConditionData
    {
        public string activityGuid { get; set; }
        public string activityType { get; set; }
        public string state { get; set; }
        public string conditionType { get; set; }
    }

    struct BoonConditionData
    {
        public string boonGuid { get; set; }
        public string conditionType { get; set; }
    }

    struct HasGoldConditionData
    {
        public int gold { get; set; }
    }

    private bool IsConditionDataEmpty(ConditionData data)
    {
        return (data.questSteps == null || data.questSteps.Count == 0) &&
               (data.quests == null || data.quests.Count == 0) &&
               (data.worldEvents == null || data.worldEvents.Count == 0) &&
               (data.timesOfDay == null || data.timesOfDay.Count == 0) &&
               (data.hasItems == null || data.hasItems.Count == 0) &&
               (data.hasModifiers == null || data.hasModifiers.Count == 0) &&
               (data.activities == null || data.activities.Count == 0) &&
               (data.boons == null || data.boons.Count == 0) &&
               !data.hasGold.HasValue;
    }

    private bool IsConditionDataEmpty(ConditionData? data)
    {
        if (!data.HasValue)
            return true;

        return IsConditionDataEmpty(data.Value);
    }

    private bool IsSpawnConditionsEmpty(SpawnConditions? spawnConditions)
    {
        if (!spawnConditions.HasValue)
            return true;

        var sc = spawnConditions.Value;
        return IsConditionDataEmpty(sc.requiredSpawnConditions) &&
               IsConditionDataEmpty(sc.disableConditions) &&
               IsConditionDataEmpty(sc.respawnConditions);
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
        Msg("Press F9 to toggle entity logging");
        Msg("Press F10 to toggle entity dumping");

        // Initialize Harmony and apply patches to make isDebugBuild return true
        harmonyInstance = new HarmonyLib.Harmony("me.seroperson.nrftw");
        harmonyInstance.PatchAll();
        MelonLogger.Msg("Harmony patches applied - isDebugBuild will always return true");

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

            if (scene.path.Contains("captainRandolphActivities") || scene.path.Contains("mainMenu"))
            {
                return;
            }

            // Check if we should skip this scene
            if (sceneStatistics.ContainsKey(currentScenePath) && !scene.path.Contains("interactives"))
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
            FlushPendingEntriesToCsv();

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
        var game = GameSessionControlAPI.WaitForGameIsReady().Result.m_game;
        var sceneRootObjects = scene.GetRootGameObjects();
        foreach (var rootObject in sceneRootObjects)
        {
            Msg($"Root object: {rootObject.name}, {rootObject.GetType()}");
            var monoBehaviours = rootObject.GetComponents<MonoBehaviour>();

            foreach (var childMonoBehaviour in monoBehaviours)
            {
                DumpMonoBehaviour(childMonoBehaviour, scene, Vector3.zero, childMonoBehaviour, game);
            }

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
                    DumpTransformAndItsChilds(casted, scene, game);
                }
            }
        }
    }

    private void DumpMonoBehaviour(Component child, Scene scene, Vector3 childPosition, MonoBehaviour monoBehaviour, MoonQuantumGame game)
    {
        if (monoBehaviour != null && monoBehaviour.enabled)
        {
            var objPtr = IL2CPP.Il2CppObjectBaseToPtrNotNull(monoBehaviour);
            var childNameLower = child.name.ToLower();
            var monoScript = GetIl2CppClassName(monoBehaviour);
            if (IsIl2CppInstance("Moon.Forsaken.DigSpotView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<DigSpotView>(objPtr);
                var drop = DumpLoot(casted);

                var conditions = casted.Data.RequiredSpawnConditionsData;
                if (!conditions.HasAnyCondition && casted.Data.RequiredSpawnConditions.HasAnyCondition)
                {
                    conditions = casted.Data.RequiredSpawnConditions;
                }
                var spawnConditions = new SpawnConditions
                {
                    requiredSpawnConditions = ConvertConditionsToData(game, conditions),
                };

                WriteToCsv("digging", "digging", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), drop, null, spawnConditions, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.StaticPickupView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<StaticPickupView>(objPtr);
                var drop = DumpLoot(casted, casted.Data.LootSource);

                var mainGroup = "herb";
                var t = "artemisia";
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

                var conditions = casted.Data.RequiredSpawnConditionsData;
                if (!conditions.HasAnyCondition && casted.Data.RequiredSpawnConditions.HasAnyCondition)
                {
                    conditions = casted.Data.RequiredSpawnConditions;
                }
                var spawnConditions = new SpawnConditions
                {
                    requiredSpawnConditions = ConvertConditionsToData(game, conditions),
                };

                WriteToCsv(mainGroup, t, child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), drop, null, spawnConditions, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.OreVeinView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<OreVeinView>(objPtr);
                var drop = DumpLoot(casted);
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

                var conditions = casted.Data.RequiredSpawnConditionsData;
                if (!conditions.HasAnyCondition && casted.Data.RequiredSpawnConditions.HasAnyCondition)
                {
                    conditions = casted.Data.RequiredSpawnConditions;
                }
                var spawnConditions = new SpawnConditions
                {
                    requiredSpawnConditions = ConvertConditionsToData(game, conditions),
                };

                WriteToCsv("ore", oreType, child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), drop, null, spawnConditions, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.CuttableTreeView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<CuttableTreeView>(objPtr);
                var drop = DumpLoot(casted);
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

                var conditions = casted.Data.RequiredSpawnConditionsData;
                if (!conditions.HasAnyCondition && casted.Data.RequiredSpawnConditions.HasAnyCondition)
                {
                    conditions = casted.Data.RequiredSpawnConditions;
                }
                var spawnConditions = new SpawnConditions
                {
                    requiredSpawnConditions = ConvertConditionsToData(game, conditions),
                };

                WriteToCsv("wood", woodType, child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), drop, null, spawnConditions, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.CerimWhisperView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<CerimWhisperView>(objPtr);
                var spawnConditions = new SpawnConditions
                {
                    requiredSpawnConditions = ConvertConditionsToData(game, casted.Data.WarpEnableConditions),
                };

                WriteToCsv("whisper", "whisper", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, spawnConditions, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.FarmableResourceView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<FarmableResourceView>(objPtr);
                var drop = DumpLoot(casted);
                var mainGroup = "fishing";
                var t = "carp";
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

                var conditions = casted.Data.RequiredSpawnConditionsData;
                if (!conditions.HasAnyCondition && casted.Data.RequiredSpawnConditions.HasAnyCondition)
                {
                    conditions = casted.Data.RequiredSpawnConditions;
                }
                var spawnConditions = new SpawnConditions
                {
                    requiredSpawnConditions = ConvertConditionsToData(game, conditions),
                };

                WriteToCsv(mainGroup, t, child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), drop, null, spawnConditions, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.PooledObject", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<PooledObject>(objPtr);
                var components = casted.GetComponents<MonoBehaviour>();
                foreach (var childMonoBehaviour in components)
                {
                    if (!IsIl2CppInstance("Moon.Forsaken.PooledObject", childMonoBehaviour))
                    {
                        DumpMonoBehaviour(child, scene, childPosition, childMonoBehaviour, game);
                    }
                }
            }
            else if (IsIl2CppInstance("DynamicSpawner", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<DynamicSpawner>(objPtr);

                var anyTags = casted.SpawnerAnyTags.AsEnumerable().Select(v => v.Tag);
                var noneTags = casted.SpawnerNoneTags.AsEnumerable().Select(v => v.Tag);
                var allTags = casted.SpawnerAllTags.AsEnumerable().Select(v => v.Tag);

                // Build detailed loot/spawn info
                var lootSpawnInfo = new LootSpawnInfo();
                lootSpawnInfo.missChance = casted.MissChance;
                lootSpawnInfo.respawnFreq = casted.RespawnFrequency.ToString();

                // Capture tags as strings
                lootSpawnInfo.anyTags = anyTags.Select(t => t.ToString()).ToList();
                lootSpawnInfo.allTags = allTags.Select(t => t.ToString()).ToList();
                lootSpawnInfo.noneTags = noneTags.Select(t => t.ToString()).ToList();

                // Capture spawn condition types
                lootSpawnInfo.spawnConditions = casted.SpawnConditions.AsEnumerable().Select(v => v.Condition.GetIl2CppType().FullNameOrDefault ?? v.Condition.GetIl2CppType().ToString()).ToList();

                var mainGroup = "spawner";
                var t = "spawner";

                var hasLootInAny = anyTags.Count(value => value >= MarkupTag.Loot && value < MarkupTag.Region) > 0;
                var hasLootInAll = allTags.Count(value => value >= MarkupTag.Loot && value < MarkupTag.Region) > 0;

                var hasEnemiesInAny = anyTags.Count(value => value >= MarkupTag.Enemy && value < MarkupTag.Npc) > 0;
                var hasEnemiesInAll = allTags.Count(value => value >= MarkupTag.Enemy && value < MarkupTag.Npc) > 0;

                var hasCrittersInAny = anyTags.Count(value => value == MarkupTag.Critters) > 0;
                var hasCrittersInAll = allTags.Count(value => value == MarkupTag.Critters) > 0;

                if (hasCrittersInAll || hasCrittersInAny)
                {
                    mainGroup = "npc";
                    t = "animal";
                } else if (hasEnemiesInAll || hasEnemiesInAny)
                {
                    mainGroup = "npc";
                    t = "enemies";
                }

                WriteToCsv(mainGroup, t, child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, lootSpawnInfo, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.ContainerView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<ContainerView>(objPtr);
                var drop = DumpLoot(casted, casted.Data.Loot);

                var conditions = casted.Data.RequiredSpawnConditionsData;
                if (!conditions.HasAnyCondition && casted.Data.RequiredSpawnConditions.HasAnyCondition)
                {
                    conditions = casted.Data.RequiredSpawnConditions;
                }
                var spawnConditions = new SpawnConditions
                {
                    requiredSpawnConditions = ConvertConditionsToData(game, conditions),
                };

                WriteToCsv("spawner", "spawner", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), drop, null, spawnConditions, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.BonfireView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<BonfireView>(objPtr);
                WriteToCsv("bonfire", "bonfire", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.RopeView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<RopeView>(objPtr);
                var spawnConditions = new SpawnConditions
                {
                    requiredSpawnConditions = ConvertConditionsToData(game, casted.Data.KickDownConditions),
                };

                WriteToCsv("interactible", "ladder", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, spawnConditions, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.MovingPlatformView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<MovingPlatformView>(objPtr);
                var spawnConditions = new SpawnConditions
                {
                    requiredSpawnConditions = ConvertConditionsToData(game, casted.Data.ActivationConditionCollection),
                };

                WriteToCsv("interactible", "platform", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, spawnConditions, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.BalakTawElevatorControllerView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<BalakTawElevatorControllerView>(objPtr);
                WriteToCsv("interactible", "platform", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.LadderView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<LadderView>(objPtr);
                var spawnConditions = new SpawnConditions
                {
                    requiredSpawnConditions = ConvertConditionsToData(game, casted.Data.KickDownConditions),
                };

                WriteToCsv("interactible", "ladder", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, spawnConditions, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.DoorView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<DoorView>(objPtr);
                var spawnConditions = new SpawnConditions
                {
                    requiredSpawnConditions = ConvertConditionsToData(game, casted.Data.Conditions),
                };

                WriteToCsv("interactible", "door", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, spawnConditions, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.GroundLeverView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<GroundLeverView>(objPtr);
                WriteToCsv("interactible", "lever", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.ToggleLeverView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<ToggleLeverView>(objPtr);
                WriteToCsv("interactible", "lever", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.WallLeverView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<WallLeverView>(objPtr);
                WriteToCsv("interactible", "lever", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.TurnWheelView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<TurnWheelView>(objPtr);
                WriteToCsv("interactible", "lever", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.LeverView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<LeverView>(objPtr);
                var spawnConditions = new SpawnConditions
                {
                    requiredSpawnConditions = ConvertConditionsToData(game, casted.Data.Conditions),
                };

                WriteToCsv("interactible", "lever", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, spawnConditions, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.EventLeverView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<EventLeverView>(objPtr);
                var spawnConditions = new SpawnConditions
                {
                    requiredSpawnConditions = ConvertConditionsToData(game, casted.Data.ActivationConditions),
                };

                WriteToCsv("interactible", "lever", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, spawnConditions, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.DamageReceivingLeverView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<DamageReceivingLeverView>(objPtr);

                var conditions = casted.Data.RequiredSpawnConditionsData;
                if (!conditions.HasAnyCondition && casted.Data.RequiredSpawnConditions.HasAnyCondition)
                {
                    conditions = casted.Data.RequiredSpawnConditions;
                }
                var spawnConditions = new SpawnConditions
                {
                    requiredSpawnConditions = ConvertConditionsToData(game, conditions),
                };

                WriteToCsv("interactible", "lever", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, spawnConditions, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.PushCogView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<PushCogView>(objPtr);
                WriteToCsv("interactible", "lever", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.GeneralReadableView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<GeneralReadableView>(objPtr);
                var spawnConditions = new SpawnConditions
                {
                    requiredSpawnConditions = ConvertConditionsToData(game, casted.Data.Conditions),
                };

                WriteToCsv("interactible", "readable", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, spawnConditions, monoScript);
            }
            else if (IsIl2CppInstance("Moon.ReadmeView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<ReadmeView>(objPtr);
                WriteToCsv("interactible", "readable", child.name, scene.path, childPosition, null, casted.GetInstanceID(), null, null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.GeneralInteractableView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<GeneralInteractableView>(objPtr);
                var spawnConditions = new SpawnConditions
                {
                    requiredSpawnConditions = ConvertConditionsToData(game, casted.Data.Conditions),
                };

                WriteToCsv("interactible", "other", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, spawnConditions, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.ResourceRefineryView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<ResourceRefineryView>(objPtr);
                WriteToCsv("interactible", "other", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.RespecStatueView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<RespecStatueView>(objPtr);
                WriteToCsv("interactible", "other", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.PlagueStatueView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<PlagueStatueView>(objPtr);
                WriteToCsv("interactible", "other", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.PuzzleView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<PuzzleView>(objPtr);
                WriteToCsv("interactible", "entrance", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.InteractableTeleport", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<InteractableTeleport>(objPtr);
                var spawnConditions = new SpawnConditions
                {
                    requiredSpawnConditions = ConvertConditionsToData(game, casted.Data.RequireConditions),
                };

                WriteToCsv("interactible", "entrance", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, spawnConditions, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.HouseEntrance", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<HouseEntrance>(objPtr);
                WriteToCsv("interactible", "house_entrance", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, null, monoScript);
            }
            else if (IsIl2CppInstance("Moon.Forsaken.TriggerZoneView", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<TriggerZoneView>(objPtr);
                if (casted.QuantumData.Type == TriggerZoneType.Teleport)
                {
                    var spawnConditions = new SpawnConditions
                    {
                        requiredSpawnConditions = ConvertConditionsToData(game, casted.QuantumData.Conditions),
                    };

                    WriteToCsv("interactible", "entrance", child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, spawnConditions, monoScript);
                }
            }
            else if (IsIl2CppInstance("Moon.Forsaken.SurfaceInfo", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<SurfaceInfo>(objPtr);
                if (casted.WallClimbable)
                {
                    WriteToCsv("interactible", "wall_climb", child.name, scene.path, childPosition, null, casted.GetInstanceID(), null, null, null, monoScript);
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

                var conditions = casted.Data.RequiredSpawnConditionsData;
                if (!conditions.HasAnyCondition && casted.Data.RequiredSpawnConditions.HasAnyCondition)
                {
                    conditions = casted.Data.RequiredSpawnConditions;
                }
                var spawnConditions = new SpawnConditions
                {
                    requiredSpawnConditions = ConvertConditionsToData(game, conditions),
                };


                if (!t.Equals(""))
                {
                    WriteToCsv("destructible", t, child.name, scene.path, childPosition, casted.MoonGuid, casted.GetInstanceID(), null, null, spawnConditions, monoScript);
                }
            }
            else if (IsIl2CppInstance("Moon.Forsaken.NpcInstance", monoBehaviour))
            {
                var casted = Il2CppObjectPool.Get<NpcInstance>(objPtr);
                var lowerName = casted.name.ToLower();
                if (!lowerName.Contains("squirrel") && !lowerName.Contains("cata_patrol") && !lowerName.Contains("catapatrol") && !lowerName.Contains("dogpet"))
                {
                    var t = "npc_other";
                    if (lowerName.Contains("boss"))
                    {
                        t = "boss";
                    }
                    else if (lowerName.Contains("npcbabyknight") || lowerName.Contains("npcduelist") || lowerName.Contains("npcbondedwitch") || lowerName.Contains("snakeleg") || lowerName.Contains("npclumberjacks") || lowerName.Contains("npcwarrick") || lowerName.Contains("npcchanningbysewergate") || lowerName.Contains("npcswamp") || lowerName.Contains("npcrisen") || lowerName.Contains("npcnith") || lowerName.Contains("siren") || lowerName.Contains("shackledbrute") || lowerName.Contains("prisonerwolf") || lowerName.Contains("npcworm") || lowerName.Contains("npcplagued") || lowerName.Contains("npcinverted") || lowerName.Contains("npctorn") || lowerName.Contains("balaktaw") || lowerName.Contains("boarskin") || lowerName.Contains("creep"))
                    {
                        t = "enemies";
                    }
                    else if (lowerName.Contains("npcwolf") || lowerName.Contains("boar") || lowerName.Contains("bear") || lowerName.Contains("critt") || lowerName.Contains("sheep"))
                    {
                        t = "animal";
                    }

                    var instanceData = casted.InstanceData;

                    DumpConditions(game, instanceData.RequiredSpawnConditions, casted.name, "spawned");
                    DumpConditions(game, instanceData.DisableConditions, casted.name, "disabled");
                    DumpConditions(game, instanceData.RespawnConditions, casted.name, "re-spawned");

                    // Convert spawn conditions to data structures for CSV
                    var spawnConditions = new SpawnConditions
                    {
                        requiredSpawnConditions = ConvertConditionsToData(game, instanceData.RequiredSpawnConditions),
                        disableConditions = ConvertConditionsToData(game, instanceData.DisableConditions),
                        respawnConditions = ConvertConditionsToData(game, instanceData.RespawnConditions)
                    };

                    var overridePosition = childPosition;
                    if (overridePosition.x == 0.0f || overridePosition.y == 0.0f || overridePosition.z == 0.0f)
                    {
                        overridePosition = casted.GetPosition();
                    }

                    if (overridePosition.x == 0.0f || overridePosition.y == 0.0f || overridePosition.z == 0.0f)
                    {
                        overridePosition = new Vector3();
                        overridePosition.x = casted.Settings.Position.X.AsFloat;
                        overridePosition.y = casted.Settings.Position.Y.AsFloat;
                        overridePosition.z = casted.Settings.Position.Z.AsFloat;
                    }

                    if (overridePosition.x == 0.0f || overridePosition.y == 0.0f || overridePosition.z == 0.0f)
                    {
                        overridePosition = new Vector3();
                        overridePosition.x = casted.InstanceData.Position.X.AsFloat;
                        overridePosition.y = casted.InstanceData.Position.Y.AsFloat;
                        overridePosition.z = casted.InstanceData.Position.Z.AsFloat;
                    }

                    WriteToCsv("npc", t, child.name, scene.path, overridePosition, casted.MoonGuid, casted.GetInstanceID(), null, null, spawnConditions, monoScript);
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

    private ConditionData? ConvertConditionsToData(MoonQuantumGame game, ConditionCollection conditions)
    {
        var data = new ConditionData
        {
            questSteps = new System.Collections.Generic.List<QuestStepConditionData>(),
            quests = new System.Collections.Generic.List<QuestConditionData>(),
            worldEvents = new System.Collections.Generic.List<WorldEventConditionData>(),
            timesOfDay = new System.Collections.Generic.List<TimeOfDayConditionData>(),
            hasItems = new System.Collections.Generic.List<HasItemConditionData>(),
            hasModifiers = new System.Collections.Generic.List<HasModifierConditionData>(),
            activities = new System.Collections.Generic.List<ActivityConditionData>(),
            boons = new System.Collections.Generic.List<BoonConditionData>(),
            hasGold = null
        };

        // Quest steps
        for (int i = 0; i < conditions.QuestSteps.Count; i++)
        {
            var quest = conditions.QuestSteps[i];
            var questStep = quest.Step.Get(game.AssetResolver);
            if (questStep is not null)
            {
                data.questSteps.Add(new QuestStepConditionData
                {
                    questGuid = questStep.Guid.Value.ToString(),
                    state = quest.State.ToString(),
                    conditionType = quest.ConditionType.ToString()
                });
            }
        }

        // Quests
        for (int i = 0; i < conditions.Quests.Count; i++)
        {
            var quest = conditions.Quests[i];
            var questStep = quest.Step.Get(game.AssetResolver);
            if (questStep is not null)
            {
                var questData = questStep.QuestId.Get(game.AssetResolver);
                if (questData is not null)
                {
                    data.quests.Add(new QuestConditionData
                    {
                        questGuid = questData.Guid.Value.ToString(),
                        state = quest.State.ToString(),
                        conditionType = quest.ConditionType.ToString()
                    });
                }
            }
        }

        // World events
        for (int i = 0; i < conditions.WorldEvents.Count; i++)
        {
            var worldEvent = conditions.WorldEvents[i];
            var worldEventData = worldEvent.EventDataLink.Get(game.AssetResolver);
            if (worldEventData is not null)
            {
                data.worldEvents.Add(new WorldEventConditionData
                {
                    eventGuid = worldEventData.Guid.Value.ToString(),
                    state = worldEvent.EventState.ToString(),
                    conditionType = worldEvent.ConditionType.ToString()
                });
            }
        }

        // Times of day
        for (int i = 0; i < conditions.TimesOfDay.Count; i++)
        {
            var timeOfDay = conditions.TimesOfDay[i];
            data.timesOfDay.Add(new TimeOfDayConditionData
            {
                timeOfDay = timeOfDay.TimeOfDay.ToString(),
                conditionType = timeOfDay.ConditionType.ToString()
            });
        }

        // Has items
        for (int i = 0; i < conditions.HasItems.Count; i++)
        {
            var item = conditions.HasItems[i];
            var itemData = item.Item2.Get(game.AssetResolver);
            if (itemData is not null)
            {
                data.hasItems.Add(new HasItemConditionData
                {
                    itemGuid = itemData.Guid.Value.ToString(),
                    conditionType = item.ConditionType.ToString()
                });
            }
        }

        // Has modifiers
        for (int i = 0; i < conditions.HasModifiers.Count; i++)
        {
            var modifier = conditions.HasModifiers[i];
            var modifierData = modifier.Modifier.Get(game.AssetResolver);
            if (modifierData is not null)
            {
                data.hasModifiers.Add(new HasModifierConditionData
                {
                    modifierTag = modifierData.Tag.ToString(),
                    conditionType = modifier.ConditionType.ToString()
                });
            }
        }

        // Activities
        for (int i = 0; i < conditions.Activities.Count; i++)
        {
            var activity = conditions.Activities[i];
            var activityData = activity.Activity.Get(game.AssetResolver);
            if (activityData is not null)
            {
                data.activities.Add(new ActivityConditionData
                {
                    activityGuid = activityData.Guid.Value.ToString(),
                    activityType = activityData.ActivityType.ToString(),
                    state = activity.State.ToString(),
                    conditionType = activity.ConditionType.ToString()
                });
            }
        }

        // Boons
        for (int i = 0; i < conditions.Boons.Count; i++)
        {
            var boon = conditions.Boons[i];
            var boonData = boon.Boon.Get(game.AssetResolver);
            if (boonData is not null)
            {
                data.boons.Add(new BoonConditionData
                {
                    boonGuid = boonData.Guid.Value.ToString(),
                    conditionType = boon.ConditionType.ToString()
                });
            }
        }

        // Has gold
        if (!conditions.HasGold.IsDefault)
        {
            data.hasGold = new HasGoldConditionData
            {
                gold = conditions.HasGold.Gold
            };
        }

        // Return null if all fields are empty
        if (IsConditionDataEmpty(data))
        {
            return null;
        }

        return data;
    }

    private void DumpConditions(MoonQuantumGame game, ConditionCollection conditions, string loggingName, string whatIs)
    {
        for (int i = 0; i < conditions.QuestSteps.Count; i++)
        {
            // handle: quest.Invert
            var quest = conditions.QuestSteps[i];
            var questState = quest.State;
            var questStep = quest.Step.Get(game.AssetResolver);
            if (questStep is not null)
            {
                var questGuidValue = questStep.Guid.Value;
                Msg($"NPC {loggingName} is {whatIs} if quest {questGuidValue} is {questState}");
                if (i != conditions.QuestSteps.Count - 1)
                {
                    Msg($"{quest.ConditionType}");
                }
            }
        }

        for (int i = 0; i < conditions.Quests.Count; i++)
        {
            // handle: quest.Invert
            var quest = conditions.Quests[i];
            var questState = quest.State;
            var questStep = quest.Step.Get(game.AssetResolver);
            if (questStep is not null)
            {
                var questData = questStep.QuestId.Get(game.AssetResolver);
                if (questData is not null)
                {
                    var questGuidValue = questData.Guid.Value;
                    Msg($"NPC {loggingName} is {whatIs} if quest {questGuidValue} is {questState}");
                    if (i != conditions.Quests.Count - 1)
                    {
                        Msg($"{quest.ConditionType}");
                    }
                }
            }
        }

        for (int i = 0; i < conditions.WorldEvents.Count; i++)
        {
            // handle: worldEvent.Invert
            var worldEvent = conditions.WorldEvents[i];
            var worldEventData = worldEvent.EventDataLink.Get(game.AssetResolver);
            if (worldEventData is not null)
            {
                var worldEventGuid = worldEventData.Guid.Value;
                var worldEventState = worldEvent.EventState;
                Msg($"NPC {loggingName} is {whatIs} if worldEvent {worldEventGuid} is in state {worldEventState}");
                if (i != conditions.WorldEvents.Count - 1)
                {
                    Msg($"{worldEvent.ConditionType}");
                }
            }
        }

        for (int i = 0; i < conditions.TimesOfDay.Count; i++)
        {
            // handle: worldEvent.Invert
            var timeOfDay = conditions.TimesOfDay[i];
            Msg($"NPC {loggingName} is {whatIs} if timeOfDay is {timeOfDay.TimeOfDay}");
            if (i != conditions.TimesOfDay.Count - 1)
            {
                Msg($"{timeOfDay.ConditionType}");
            }
        }

        for (int i = 0; i < conditions.HasItems.Count; i++)
        {
            // handle: item.Invert
            var item = conditions.HasItems[i];
            var itemData = item.Item2.Get(game.AssetResolver);
            if (itemData is not null)
            {
                Msg($"NPC {loggingName} is {whatIs} if has item {itemData.Guid.Value}");
                if (i != conditions.HasItems.Count - 1)
                {
                    Msg($"{item.ConditionType}");
                }
            }
        }

        for (int i = 0; i < conditions.HasModifiers.Count; i++)
        {
            // handle: modifier.Invert
            var modifier = conditions.HasModifiers[i];
            var modifierData = modifier.Modifier.Get(game.AssetResolver);
            if (modifierData is not null)
            {

                Msg($"NPC {loggingName} is {whatIs} if has modifier {modifierData.Tag}");
                if (i != conditions.HasModifiers.Count - 1)
                {
                    Msg($"{modifier.ConditionType}");
                }
            }
        }

        for (int i = 0; i < conditions.Activities.Count; i++)
        {
            // handle: activity.Invert
            var activity = conditions.Activities[i];
            var activityData = activity.Activity.Get(game.AssetResolver);
            if (activityData is not null)
            {
                Msg($"NPC {loggingName} is {whatIs} if activity ({activityData.Guid.Value}, {activityData.ActivityType}) is in state {activity.State}");
                if (i != conditions.Activities.Count - 1)
                {
                    Msg($"{activity.ConditionType}");
                }
            }
        }

        for (int i = 0; i < conditions.Boons.Count; i++)
        {
            // handle: boon.Invert
            var boon = conditions.Boons[i];
            var boonData = boon.Boon.Get(game.AssetResolver);
            if (boonData is not null)
            {
                Msg($"NPC {loggingName} is {whatIs} if has boon {boonData.Guid.Value}");
                if (i != conditions.Activities.Count - 1)
                {
                    Msg($"{boon.ConditionType}");
                }
            }
        }

        if (!conditions.HasGold.IsDefault)
        {
            Msg($"NPC {loggingName} is {whatIs} if has gold {conditions.HasGold.Gold}");
        }
    }

    private void DumpTransformAndItsChilds(Transform obj, Scene scene, MoonQuantumGame game)
    {
        var childCount = obj.childCount;
        for (int j = 0; j < childCount; j++)
        {
            var child = obj.GetChild(j);

            var childPosition = child.position;
            var childLocalPosition = child.localPosition;
            var childScale = child.localScale;
            var childType = child.GetIl2CppType().FullNameOrDefault;
            var childsCount = child.childCount;
            Msg($"- {child.name} ({childsCount})");
            try
            {
                var monoBehaviour = child.GetComponents<MonoBehaviour>();
                foreach (var childMonoBehaviour in monoBehaviour)
                {
                    DumpMonoBehaviour(child, scene, childPosition, childMonoBehaviour, game);
                }
            }
            catch (System.Exception e)
            {
                MelonLogger.Msg($"Error: {e}");
            }
            DumpTransformAndItsChilds(child, scene, game);
        }
    }

    private Drop DumpLoot(FarmableResourceView casted)
    {
        return DumpLoot(casted, casted.Data.LootSource);
    }

    private Drop DumpLoot(DigSpotView casted)
    {
        return DumpLoot(casted, casted.Data.LootSource);
    }

    private Drop DumpLoot(OreVeinView casted)
    {
        return DumpLoot(casted, casted.Data.LootSource);
    }

    private Drop DumpLoot(CuttableTreeView casted)
    {
        return DumpLoot(casted, casted.Data.LootSource);
    }


    private Drop DumpLoot(InteractableLinkedEntityView casted, LootSource lootSource)
    {
        var game = casted.VerifiedFrame.Game;
        var assetResolver = game.AssetResolver;

        var drop = new Drop();

        Msg($"- {casted}, GUID: {casted.MoonGuid.A}, {casted.MoonGuid.B}, {casted.MoonGuid.C}, {casted.MoonGuid.D}");
        foreach (var x in lootSource.Sources)
        {
            foreach (var group in x.Get(assetResolver).Groups)
            {
                var currentDropGroup = new DropGroup();

                Msg($"- Loot count: {group.Loots.Count}; LootCount count: {group.LootCountEntries.Count}");
                for (int j = 0; j < group.LootCountEntries.Count; j++)
                {
                    var lootFreq = group.LootCountEntries[j];
                    Msg($"  - Loot freq: {lootFreq.Count}, {lootFreq.Frequency}");

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
                            Msg($"  - Specific loot, generic item loot: {genericItemData}, ({genericItemData.Guid.Type}, {genericItemData.Guid}, {genericItemData.Guid.Value})");
                        }
                        else
                        {
                            currentDropItems.specificItem.Add(data.Guid.Value.ToString());
                            Msg($"  - Specific loot, but not GenericItemData: {data.GetIl2CppType().FullName}");
                        }
                    }
                    else if (IsIl2CppInstance("Quantum.FilteredItemLoot", loot))
                    {
                        var filteredItemLoot = CastIl2Cpp<FilteredItemLoot>(loot);
                        currentDropItems.filterPool.Add(filteredItemLoot.Filter.ToString());
                        Msg($"  - Filtered loot: {filteredItemLoot.Filter}");
                    }
                    else if (IsIl2CppInstance("Quantum.GenericItemData", loot))
                    {
                        var genericItemData = CastIl2Cpp<GenericItemData>(loot);
                        currentDropItems.specificItem.Add(genericItemData.Guid.Value.ToString());

                        Msg($"  - Generic item loot: {genericItemData}, ({genericItemData.Guid.Type}, {genericItemData.Guid}, {genericItemData.Guid.Value})");
                    }
                    else
                    {
                        Msg($"  - Unspecified loot: {loot.GetIl2CppType().FullName}");
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
        var header = "Type,Subtype,Name,File,RawX,RawY,RawZ,id,Drop,LootSpawnInfo,SpawnConditions,Clazz\n";

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
        existingEntriesWithoutGuid.Clear();

        void ProcessLine(string line)
        {
            var parts = ParseCsvLine(line);
            if (parts.Count >= 12)
            {
                var id = parts[7].Trim('"');
                existingIds.Add(id);

                // Check if this entry doesn't have a MoonGuid (just an instanceId)
                bool hasMoonGuid = id.Contains(",");
                if (!hasMoonGuid)
                {
                    // Store the full entry for value-based comparison
                    var entry = new CsvEntry
                    {
                        type = parts[0],
                        subtype = parts[1],
                        name = parts[2],
                        file = parts[3],
                        rawX = int.TryParse(parts[4], out int x) ? x : 0,
                        rawY = int.TryParse(parts[5], out int y) ? y : 0,
                        rawZ = int.TryParse(parts[6], out int z) ? z : 0,
                        id = id,
                        dropJson = parts[8].Trim('"').Replace("\"\"", "\""),
                        lootSpawnInfoJson = parts[9].Trim('"').Replace("\"\"", "\""),
                        spawnConditionsJson = parts[10].Trim('"').Replace("\"\"", "\""),
                        clazz = parts[11],
                        hasMoonGuid = false
                    };
                    existingEntriesWithoutGuid.Add(entry);
                }
            }
            else if (parts.Count >= 11)
            {
                // Handle old CSV format without SpawnConditions column
                var id = parts[7].Trim('"');
                existingIds.Add(id);

                bool hasMoonGuid = id.Contains(",");
                if (!hasMoonGuid)
                {
                    var entry = new CsvEntry
                    {
                        type = parts[0],
                        subtype = parts[1],
                        name = parts[2],
                        file = parts[3],
                        rawX = int.TryParse(parts[4], out int x) ? x : 0,
                        rawY = int.TryParse(parts[5], out int y) ? y : 0,
                        rawZ = int.TryParse(parts[6], out int z) ? z : 0,
                        id = id,
                        dropJson = parts[8].Trim('"').Replace("\"\"", "\""),
                        lootSpawnInfoJson = parts[9].Trim('"').Replace("\"\"", "\""),
                        spawnConditionsJson = "",
                        clazz = parts[10],
                        hasMoonGuid = false
                    };
                    existingEntriesWithoutGuid.Add(entry);
                }
            }
        }

        // Load from sorted CSV
        if (System.IO.File.Exists(csvPath))
        {
            var lines = System.IO.File.ReadAllLines(csvPath);
            // Skip header
            for (int i = 1; i < lines.Length; i++)
            {
                ProcessLine(lines[i]);
            }
        }

        // Load from unsorted CSV (in case it has entries not in sorted)
        if (System.IO.File.Exists(csvPathUnsorted))
        {
            var lines = System.IO.File.ReadAllLines(csvPathUnsorted);
            // Skip header
            for (int i = 1; i < lines.Length; i++)
            {
                ProcessLine(lines[i]);
            }
        }

        Msg($"Loaded {existingIds.Count} existing entity IDs from CSV files ({existingEntriesWithoutGuid.Count} without MoonGuid)");
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

    private void WriteToCsv(string type, string subtype, string name, string file, Vector3 position, MoonGuid id, int instanceId, Drop? drop, LootSpawnInfo? lootSpawnInfo, SpawnConditions? spawnConditions, string clazz)
    {
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

        // Serialize Drop, LootSpawnInfo, and SpawnConditions to JSON if present
        string dropJson = drop.HasValue ? JsonSerializer.Serialize(drop.Value).Replace("\"", "\"\"") : "";
        string lootSpawnInfoJson = lootSpawnInfo.HasValue ? JsonSerializer.Serialize(lootSpawnInfo.Value).Replace("\"", "\"\"") : "";
        string spawnConditionsJson = IsSpawnConditionsEmpty(spawnConditions) ? "" : JsonSerializer.Serialize(spawnConditions.Value).Replace("\"", "\"\"");

        var resultId = "";
        bool hasMoonGuid = false;
        if (id is not null)
        {
            resultId = $"{id.A},{id.B},{id.C},{id.D}";
            hasMoonGuid = true;
        }
        else
        {
            resultId = $"{instanceId}";
        }

        // Create CSV entry
        var entry = new CsvEntry
        {
            type = type,
            subtype = subtype,
            name = name,
            file = file,
            rawX = rawX,
            rawY = rawY,
            rawZ = rawZ,
            id = resultId,
            dropJson = dropJson,
            lootSpawnInfoJson = lootSpawnInfoJson,
            spawnConditionsJson = spawnConditionsJson,
            clazz = clazz,
            hasMoonGuid = hasMoonGuid
        };

        // Check if already exists
        bool isUpdate = false;
        if (hasMoonGuid)
        {
            // For MoonGuid, just check by ID
            if (existingIds.Contains(resultId))
            {
                Msg($"Updating {name} because it's already saved (MoonGuid match)");
                isUpdate = true;
            }
        }
        else
        {
            // For instanceId, check by all values since instanceId isn't stable
            bool isDuplicate = existingEntriesWithoutGuid.Any(e => e.MatchesAllValues(entry));
            if (isDuplicate)
            {
                Msg($"Updating {name} because it's already saved (value match)");
                isUpdate = true;
            }
            else
            {
                // Also check in pending entries
                isDuplicate = pendingSortedEntries.Any(e => !e.hasMoonGuid && e.MatchesAllValues(entry));
                if (isDuplicate)
                {
                    Msg($"Skipping {name} because it's in pending entries (value match)");
                    currentSceneWrittenCount++;
                    return;
                }

                // Add to tracking list for future comparisons
                existingEntriesWithoutGuid.Add(entry);
            }
        }

        if (isUpdate)
        {
            // Add to pending updates (will be flushed after scene dump)
            pendingUpdatedEntries.Add(entry);

            // Update the tracking list for entries without GUID so future checks see the updated data
            if (!hasMoonGuid)
            {
                // Remove old entry and add updated one
                existingEntriesWithoutGuid.RemoveAll(e => e.MatchesAllValues(entry));
                existingEntriesWithoutGuid.Add(entry);
            }

            currentSceneWrittenCount++;
        }
        else
        {
            // Add to pending entries (will be flushed after scene dump)
            pendingUnsortedEntries.Add(entry);
            pendingSortedEntries.Add(entry);
            existingIds.Add(resultId);
            currentSceneWrittenCount++;
        }
    }

    private void FlushPendingEntriesToCsv()
    {
        if (pendingSortedEntries.Count == 0 && pendingUnsortedEntries.Count == 0 && pendingUpdatedEntries.Count == 0)
        {
            return;
        }

        Msg($"Flushing {pendingSortedEntries.Count} new entries and {pendingUpdatedEntries.Count} updates to CSV files...");

        // Process updates and new entries for unsorted CSV
        if (pendingUnsortedEntries.Count > 0 || pendingUpdatedEntries.Count > 0)
        {
            var lines = new System.Collections.Generic.List<string>();
            if (System.IO.File.Exists(csvPathUnsorted))
            {
                lines.AddRange(System.IO.File.ReadAllLines(csvPathUnsorted));
            }

            // Update existing entries
            if (pendingUpdatedEntries.Count > 0)
            {
                for (int i = 1; i < lines.Count; i++)
                {
                    var parts = ParseCsvLine(lines[i]);
                    if (parts.Count >= 8)
                    {
                        var lineId = parts[7].Trim('"');
                        var updateEntry = pendingUpdatedEntries.FirstOrDefault(e => e.id == lineId);

                        if (updateEntry.id != null)
                        {
                            lines[i] = updateEntry.ToCsvLine();
                        }
                        else if (parts.Count >= 11)
                        {
                            // Try value-based match for entries without MoonGuid
                            var lineEntry = new CsvEntry
                            {
                                type = parts[0],
                                subtype = parts[1],
                                name = parts[2],
                                file = parts[3],
                                rawX = int.TryParse(parts[4], out int x) ? x : 0,
                                rawY = int.TryParse(parts[5], out int y) ? y : 0,
                                rawZ = int.TryParse(parts[6], out int z) ? z : 0,
                                clazz = parts.Count >= 12 ? parts[11] : parts[10]
                            };

                            updateEntry = pendingUpdatedEntries.FirstOrDefault(e => !e.hasMoonGuid && e.MatchesAllValues(lineEntry));
                            if (updateEntry.id != null)
                            {
                                lines[i] = updateEntry.ToCsvLine();
                            }
                        }
                    }
                }
            }

            // Append new entries
            if (pendingUnsortedEntries.Count > 0)
            {
                lines.AddRange(pendingUnsortedEntries.Select(e => e.ToCsvLine()));
            }

            System.IO.File.WriteAllLines(csvPathUnsorted, lines);
            pendingUnsortedEntries.Clear();
        }

        // Process updates and new entries for sorted CSV
        if (pendingSortedEntries.Count > 0 || pendingUpdatedEntries.Count > 0)
        {
            // Read all existing lines from sorted CSV
            var lines = new System.Collections.Generic.List<string>();
            if (System.IO.File.Exists(csvPath))
            {
                lines.AddRange(System.IO.File.ReadAllLines(csvPath));
            }

            // Add header if file is empty
            if (lines.Count == 0)
            {
                lines.Add("Type,Subtype,Name,File,RawX,RawY,RawZ,id,Drop,LootSpawnInfo,SpawnConditions,Clazz");
            }

            var header = lines[0];
            var dataLines = lines.Skip(1).ToList();

            // Update existing entries
            if (pendingUpdatedEntries.Count > 0)
            {
                for (int i = 0; i < dataLines.Count; i++)
                {
                    var parts = ParseCsvLine(dataLines[i]);
                    if (parts.Count >= 8)
                    {
                        var lineId = parts[7].Trim('"');
                        var updateEntry = pendingUpdatedEntries.FirstOrDefault(e => e.id == lineId);

                        if (updateEntry.id != null)
                        {
                            dataLines[i] = updateEntry.ToCsvLine();
                        }
                        else if (parts.Count >= 11)
                        {
                            // Try value-based match for entries without MoonGuid
                            var lineEntry = new CsvEntry
                            {
                                type = parts[0],
                                subtype = parts[1],
                                name = parts[2],
                                file = parts[3],
                                rawX = int.TryParse(parts[4], out int x) ? x : 0,
                                rawY = int.TryParse(parts[5], out int y) ? y : 0,
                                rawZ = int.TryParse(parts[6], out int z) ? z : 0,
                                clazz = parts.Count >= 12 ? parts[11] : parts[10]
                            };

                            updateEntry = pendingUpdatedEntries.FirstOrDefault(e => !e.hasMoonGuid && e.MatchesAllValues(lineEntry));
                            if (updateEntry.id != null)
                            {
                                dataLines[i] = updateEntry.ToCsvLine();
                            }
                        }
                    }
                }
            }

            // Add all pending new entries as CSV lines
            if (pendingSortedEntries.Count > 0)
            {
                dataLines.AddRange(pendingSortedEntries.Select(e => e.ToCsvLine()));
            }

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

            Msg($"Flushed {pendingSortedEntries.Count} new entries and {pendingUpdatedEntries.Count} updates to sorted CSV");

            // Clear pending entries
            pendingSortedEntries.Clear();
            pendingUpdatedEntries.Clear();
        }
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

// Harmony patch to make isDebugBuild always return true
[HarmonyPatch(typeof(UnityEngine.Debug), "get_isDebugBuild")]
public class DebugBuildPatch
{
    static bool Prefix(ref bool __result)
    {
        __result = true;
        return false; // Skip original method
    }
}