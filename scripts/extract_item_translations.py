#!/usr/bin/env python3
"""
Optimized script to map specificItem IDs from ore_coordinates.csv to their English translations.
Builds indices first for faster lookups.
"""

import csv
import json
import os
import re
from pathlib import Path
from collections import defaultdict


def extract_specific_item_ids(csv_path):
    """Extract all unique specificItem IDs from the ore_coordinates.csv Drop column."""
    specific_items = set()

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            drop_data = row.get('Drop', '')
            if drop_data:
                try:
                    drop_json = json.loads(drop_data)
                    for group in drop_json.get('groups', []):
                        for item in group.get('items', []):
                            for item_id in item.get('specificItem', []):
                                if item_id:
                                    specific_items.add(item_id)
                except json.JSONDecodeError:
                    continue

    return specific_items


def build_asset_guid_index(search_dir):
    """Build an index mapping AssetGuid values to .asset file paths."""
    print("Building AssetGuid index...")
    index = {}
    asset_files = list(Path(search_dir).rglob('*.asset'))
    total = len(asset_files)

    for idx, asset_file in enumerate(asset_files, 1):
        if idx % 1000 == 0:
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


def build_meta_guid_index(search_dir):
    """Build an index mapping guid values to .asset.meta file paths."""
    print("Building meta file guid index...")
    index = {}
    meta_files = list(Path(search_dir).rglob('*.asset.meta'))
    total = len(meta_files)

    for idx, meta_file in enumerate(meta_files, 1):
        if idx % 1000 == 0:
            print(f"  Indexing meta files: {idx}/{total}")
        try:
            with open(meta_file, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                match = re.search(r'^guid:\s*([a-f0-9]+)\s*$', content, re.MULTILINE)
                if match:
                    guid = match.group(1)
                    index[guid] = meta_file
        except Exception:
            continue

    print(f"✓ Indexed {len(index)} meta files with guid")
    return index


def extract_item_name_msg_guid(asset_file):
    """Extract the ItemNameMsg guid from an asset file."""
    try:
        with open(asset_file, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            match = re.search(r'ItemNameMsg:\s*\{[^}]*guid:\s*([a-f0-9]+)', content)
            if match:
                return match.group(1)
    except Exception:
        pass
    return None


def extract_english_translation(asset_file):
    """Extract the English translation from an asset file."""
    try:
        with open(asset_file, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            match = re.search(r'English:\s*(.+)', content)
            if match:
                return match.group(1).strip()
    except Exception:
        pass
    return None


def build_id_to_translation_mapping(csv_path, exported_project_dir):
    """Build the complete mapping from specificItem IDs to English translations."""
    print(f"Extracting specificItem IDs from {csv_path}...")
    specific_items = extract_specific_item_ids(csv_path)
    print(f"Found {len(specific_items)} unique specificItem IDs\n")

    # Build indices for fast lookups
    asset_guid_index = build_asset_guid_index(exported_project_dir)
    meta_guid_index = build_meta_guid_index(exported_project_dir)

    print(f"\nProcessing {len(specific_items)} items...\n")

    id_to_translation = {}
    not_found = []

    for idx, item_id in enumerate(sorted(specific_items), 1):
        print(f"[{idx}/{len(specific_items)}] Processing ID: {item_id}")

        # Step 1: Find the .asset file with this AssetGuid
        asset_file = asset_guid_index.get(item_id)
        if not asset_file:
            print(f"  ✗ No .asset file found")
            not_found.append((item_id, "asset_file_not_found"))
            continue
        print(f"  ✓ Asset: {asset_file.name}")

        # Step 2: Extract ItemNameMsg guid
        name_msg_guid = extract_item_name_msg_guid(asset_file)
        if not name_msg_guid:
            print(f"  ✗ No ItemNameMsg guid found")
            not_found.append((item_id, "item_name_msg_not_found"))
            continue
        print(f"  ✓ Guid: {name_msg_guid}")

        # Step 3: Find the .asset.meta file with this guid
        meta_file = meta_guid_index.get(name_msg_guid)
        if not meta_file:
            print(f"  ✗ No .asset.meta file found")
            not_found.append((item_id, "meta_file_not_found"))
            continue
        print(f"  ✓ Meta: {meta_file.name}")

        # Step 4: Get the corresponding .asset file
        translation_file = meta_file.with_suffix('')
        if not translation_file.exists():
            print(f"  ✗ Translation file does not exist")
            not_found.append((item_id, "translation_file_not_found"))
            continue

        # Step 5: Extract English translation
        translation = extract_english_translation(translation_file)
        if not translation:
            print(f"  ✗ No English translation found")
            not_found.append((item_id, "translation_not_found"))
            continue
        print(f"  ✓ English: {translation}\n")

        id_to_translation[item_id] = translation

    # Print summary
    print("="*80)
    print("SUMMARY")
    print("="*80)
    print(f"Total IDs processed: {len(specific_items)}")
    print(f"Successfully mapped: {len(id_to_translation)}")
    print(f"Not found: {len(not_found)}")

    if not_found:
        print("\nIDs that could not be mapped:")
        for item_id, reason in not_found:
            print(f"  {item_id}: {reason}")

    return id_to_translation


def save_mapping_to_file(mapping, output_path):
    """Save the ID to translation mapping to a JSON file."""
    with open(output_path, 'w', encoding='utf-8') as f:
        # Convert integer keys to strings for JSON
        json.dump({str(k): v for k, v in mapping.items()}, f, indent=2, ensure_ascii=False)
    print(f"\n✓ Mapping saved to {output_path}")


def main():
    # Define paths
    project_root = Path(__file__).parent
    csv_path = project_root / 'nrftw-interactive-map' / 'src' / 'assets' / 'item_coordinates.csv'
    exported_project_dir = project_root / 'ExportedProject'
    output_path = project_root / 'item_id_to_translation.json'
    interactive_map_output = project_root / 'nrftw-interactive-map' / 'src' / 'assets' / 'item_translations.json'

    # Verify paths exist
    if not csv_path.exists():
        print(f"Error: CSV file not found at {csv_path}")
        return

    if not exported_project_dir.exists():
        print(f"Error: ExportedProject directory not found at {exported_project_dir}")
        return

    # Build the mapping
    mapping = build_id_to_translation_mapping(csv_path, exported_project_dir)

    # Save to file
    if mapping:
        save_mapping_to_file(mapping, output_path)
        save_mapping_to_file(mapping, interactive_map_output)
        print(f"✓ Also saved to {interactive_map_output}")

        # Print sample mappings
        print("\nSample mappings:")
        for idx, (item_id, translation) in enumerate(list(mapping.items())[:10], 1):
            print(f"  {idx}. {item_id} -> {translation}")
    else:
        print("\n✗ No mappings were created")


if __name__ == '__main__':
    main()
