#!/usr/bin/env python3
"""
Optimized script to map specificItem IDs from ore_coordinates.csv to their English translations.
Builds indices first for faster lookups.
"""

import csv
import json
import os
import re
import sys
import argparse
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

        # Convert item_id to int for lookup (IDs from CSV are strings, index has int keys)
        try:
            item_id_int = int(item_id)
        except (ValueError, TypeError):
            print(f"  ✗ Invalid ID format")
            not_found.append((item_id, "invalid_id_format"))
            continue

        # Step 1: Find the .asset file with this AssetGuid
        asset_file = asset_guid_index.get(item_id_int)
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
    # Set up argument parser
    parser = argparse.ArgumentParser(
        description='Extract item translations from ExportedProject',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  # Use absolute path to ExportedProject
  python extract_item_translations.py --exported-project /path/to/ExportedProject

  # Specify all paths
  python extract_item_translations.py --exported-project /path/to/ExportedProject \\
      --csv-path ./src/assets/item_coordinates.csv \\
      --output ./src/assets/item_translations.json
        '''
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
        help='Output path for translations JSON (default: ../src/assets/item_translations.json)'
    )

    args = parser.parse_args()

    # Get script directory
    script_dir = Path(__file__).resolve().parent

    # Determine ExportedProject path
    if args.exported_project:
        # Use provided path (can be absolute or relative)
        exported_project_dir = Path(args.exported_project).resolve()
    else:
        # Try to find ExportedProject in parent directory
        exported_project_dir = script_dir.parent / 'ExportedProject'
        if not exported_project_dir.exists():
            print("Error: ExportedProject directory not found.")
            print("Please specify the path using --exported-project argument:")
            print("  python extract_item_translations.py --exported-project /absolute/path/to/ExportedProject")
            print("\nOr set EXPORTED_PROJECT_PATH environment variable:")
            print("  export EXPORTED_PROJECT_PATH=/absolute/path/to/ExportedProject")
            sys.exit(1)

    # Make exported_project_dir absolute
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
        output_path = script_dir.parent / 'src' / 'assets' / 'item_translations.json'
        output_path = output_path.resolve()

    # Also save to root directory for backward compatibility
    root_output_path = script_dir.parent / 'item_id_to_translation.json'
    root_output_path = root_output_path.resolve()

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
        print("Please provide the correct path using --exported-project argument")
        sys.exit(1)

    if not exported_project_dir.is_dir():
        print(f"Error: {exported_project_dir} is not a directory")
        sys.exit(1)

    # Build the mapping
    mapping = build_id_to_translation_mapping(csv_path, exported_project_dir)

    # Save to file
    if mapping:
        save_mapping_to_file(mapping, output_path)
        save_mapping_to_file(mapping, root_output_path)
        print(f"✓ Also saved to {root_output_path}")

        # Print sample mappings
        print("\nSample mappings:")
        for idx, (item_id, translation) in enumerate(list(mapping.items())[:10], 1):
            print(f"  {idx}. {item_id} -> {translation}")
    else:
        print("\n✗ No mappings were created")


if __name__ == '__main__':
    main()
