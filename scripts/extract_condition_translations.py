#!/usr/bin/env python3
"""
Script to extract quest, quest step, and world event translations from ExportedProject.
Parses the SpawnConditions column to find IDs and maps them to human-readable names.
"""

import csv
import json
import os
import re
import sys
import argparse
from pathlib import Path
from collections import defaultdict


def extract_condition_ids(csv_path):
    """Extract all unique quest/questStep/worldEvent IDs from the SpawnConditions column."""
    quest_ids = set()
    quest_step_ids = set()
    world_event_ids = set()

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            spawn_conditions = row.get('SpawnConditions', '')
            if spawn_conditions:
                try:
                    conditions_json = json.loads(spawn_conditions)

                    # Extract from all three condition sets
                    for condition_set_name in ['requiredSpawnConditions', 'disableConditions', 'respawnConditions']:
                        condition_set = conditions_json.get(condition_set_name, {})
                        if not condition_set:
                            continue

                        # Extract quest IDs
                        quests = condition_set.get('quests', [])
                        if quests:
                            for quest in quests:
                                quest_guid = quest.get('questGuid')
                                if quest_guid:
                                    quest_ids.add(quest_guid)

                        # Extract quest step IDs
                        quest_steps = condition_set.get('questSteps', [])
                        if quest_steps:
                            for step in quest_steps:
                                step_guid = step.get('questGuid')
                                if step_guid:
                                    quest_step_ids.add(step_guid)

                        # Extract world event IDs
                        world_events = condition_set.get('worldEvents', [])
                        if world_events:
                            for event in world_events:
                                event_guid = event.get('eventGuid')
                                if event_guid:
                                    world_event_ids.add(event_guid)

                except json.JSONDecodeError:
                    continue

    return quest_ids, quest_step_ids, world_event_ids


def build_asset_guid_index(search_dir):
    """Build an index mapping AssetGuid values to .asset file paths."""
    print("Building AssetGuid index...")
    index = {}
    asset_files = list(Path(search_dir).rglob('*.asset'))
    total = len(asset_files)

    for idx, asset_file in enumerate(asset_files, 1):
        if idx % 5000 == 0:
            print(f"  Indexing asset files: {idx}/{total}")
        try:
            with open(asset_file, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                match = re.search(r'AssetGuid:\s*\n\s*Value:\s*(\d+)', content)
                if match:
                    guid = int(match.group(1))
                    index[guid] = asset_file
        except Exception:
            continue

    print(f"✓ Indexed {len(index)} asset files with AssetGuid")
    return index


def extract_name_from_asset(asset_file):
    """Extract the n_Name or m_Name field from an asset file."""
    try:
        with open(asset_file, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()

            # Try n_Name first (user mentioned this)
            match = re.search(r'n_Name:\s*(.+)', content)
            if match:
                return match.group(1).strip()

            # Fallback to m_Name
            match = re.search(r'm_Name:\s*(.+)', content)
            if match:
                return match.group(1).strip()
    except Exception:
        pass
    return None


def build_id_to_translation_mapping(csv_path, exported_project_dir):
    """Build the complete mapping from condition IDs to translations."""
    print(f"Extracting condition IDs from {csv_path}...")
    quest_ids, quest_step_ids, world_event_ids = extract_condition_ids(csv_path)

    print(f"Found {len(quest_ids)} unique quest IDs")
    print(f"Found {len(quest_step_ids)} unique quest step IDs")
    print(f"Found {len(world_event_ids)} unique world event IDs\n")

    # Build index for fast lookups
    asset_guid_index = build_asset_guid_index(exported_project_dir)

    # Process all condition IDs
    all_ids = {
        'quests': quest_ids,
        'questSteps': quest_step_ids,
        'worldEvents': world_event_ids
    }

    translations = {
        'quests': {},
        'questSteps': {},
        'worldEvents': {}
    }

    not_found = {
        'quests': [],
        'questSteps': [],
        'worldEvents': []
    }

    for category, ids in all_ids.items():
        if not ids:
            continue

        print(f"\nProcessing {len(ids)} {category}...\n")

        for idx, item_id in enumerate(sorted(ids), 1):
            print(f"[{idx}/{len(ids)}] Processing {category} ID: {item_id}")

            # Convert to int for lookup
            try:
                item_id_int = int(item_id)
            except (ValueError, TypeError):
                print(f"  ✗ Invalid ID format")
                not_found[category].append((item_id, "invalid_id_format"))
                continue

            # Find the .asset file with this AssetGuid
            asset_file = asset_guid_index.get(item_id_int)
            if not asset_file:
                print(f"  ✗ No .asset file found")
                not_found[category].append((item_id, "asset_file_not_found"))
                continue
            print(f"  ✓ Asset: {asset_file.name}")

            # Extract name
            name = extract_name_from_asset(asset_file)
            if not name:
                print(f"  ✗ No name found in asset")
                not_found[category].append((item_id, "name_not_found"))
                continue
            print(f"  ✓ Name: {name}\n")

            translations[category][item_id] = name

    # Print summary
    print("="*80)
    print("SUMMARY")
    print("="*80)
    for category in ['quests', 'questSteps', 'worldEvents']:
        total = len(all_ids[category])
        found = len(translations[category])
        missing = len(not_found[category])
        print(f"{category}:")
        print(f"  Total IDs: {total}")
        print(f"  Successfully mapped: {found}")
        print(f"  Not found: {missing}")

    # Print not found details
    for category in ['quests', 'questSteps', 'worldEvents']:
        if not_found[category]:
            print(f"\n{category} IDs that could not be mapped:")
            for item_id, reason in not_found[category][:10]:  # Show first 10
                print(f"  {item_id}: {reason}")
            if len(not_found[category]) > 10:
                print(f"  ... and {len(not_found[category]) - 10} more")

    return translations


def save_translations_to_file(translations, output_path):
    """Save the translations to a JSON file."""
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(translations, f, indent=2, ensure_ascii=False)
    print(f"\n✓ Translations saved to {output_path}")


def main():
    parser = argparse.ArgumentParser(
        description='Extract quest/event translations from ExportedProject'
    )

    parser.add_argument(
        '--exported-project',
        type=str,
        help='Absolute or relative path to ExportedProject directory'
    )
    parser.add_argument(
        '--csv-path',
        type=str,
        help='Path to item_coordinates.csv (default: ../src/assets/item_coordinates.csv)'
    )
    parser.add_argument(
        '--output',
        type=str,
        help='Output path for translations JSON (default: ../src/assets/condition_translations.json)'
    )

    args = parser.parse_args()

    # Get script directory
    script_dir = Path(__file__).resolve().parent

    # Determine ExportedProject path
    if args.exported_project:
        exported_project_dir = Path(args.exported_project).resolve()
    else:
        exported_project_dir = script_dir.parent / 'ExportedProject'
        if not exported_project_dir.exists():
            print("Error: ExportedProject directory not found.")
            print("Please specify the path using --exported-project argument:")
            print("  python extract_condition_translations.py --exported-project /absolute/path/to/ExportedProject")
            sys.exit(1)

    exported_project_dir = exported_project_dir.resolve()

    # Determine CSV path
    if args.csv_path:
        csv_path = Path(args.csv_path).resolve()
    else:
        csv_path = script_dir.parent / 'src' / 'assets' / 'item_coordinates.csv'
        csv_path = csv_path.resolve()

    # Determine output path
    if args.output:
        output_path = Path(args.output).resolve()
    else:
        output_path = script_dir.parent / 'src' / 'assets' / 'condition_translations.json'
        output_path = output_path.resolve()

    # Print resolved paths
    print("Using paths:")
    print(f"  ExportedProject: {exported_project_dir}")
    print(f"  CSV file: {csv_path}")
    print(f"  Output file: {output_path}")
    print()

    # Verify paths exist
    if not csv_path.exists():
        print(f"Error: CSV file not found at {csv_path}")
        sys.exit(1)

    if not exported_project_dir.exists():
        print(f"Error: ExportedProject directory not found at {exported_project_dir}")
        sys.exit(1)

    # Build the translations
    translations = build_id_to_translation_mapping(csv_path, exported_project_dir)

    # Save to file
    if any(translations.values()):
        save_translations_to_file(translations, output_path)

        # Print sample translations
        print("\nSample translations:")
        for category in ['quests', 'questSteps', 'worldEvents']:
            if translations[category]:
                print(f"\n{category}:")
                for idx, (item_id, name) in enumerate(list(translations[category].items())[:5], 1):
                    print(f"  {idx}. {item_id} -> {name}")
    else:
        print("\n✗ No translations were created")


if __name__ == '__main__':
    main()
