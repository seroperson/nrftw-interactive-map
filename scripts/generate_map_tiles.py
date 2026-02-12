#!/usr/bin/env python3
"""
Generate map tiles from a large image for use with OpenLayers TileLayer.
Splits a 16384x16384 image into 512x512 JPEG tiles.
"""

from PIL import Image
import os
import math

# Disable decompression bomb protection for our legitimate large image
Image.MAX_IMAGE_PIXELS = None

def generate_tiles(input_image_path, output_dir, tile_size=512, image_size=16384):
    """
    Generate tiles from a large image.
    
    Args:
        input_image_path: Path to the input image
        output_dir: Directory to save tiles
        tile_size: Size of each tile (default: 512)
        image_size: Size of the source image (default: 16384)
    """
    print(f"Loading image: {input_image_path}")
    img = Image.open(input_image_path)
    
    # Convert RGBA to RGB if necessary (JPEG doesn't support transparency)
    if img.mode == 'RGBA':
        print("Converting RGBA to RGB...")
        rgb_img = Image.new('RGB', img.size, (0, 0, 0))
        rgb_img.paste(img, mask=img.split()[3])  # Use alpha channel as mask
        img = rgb_img
    elif img.mode != 'RGB':
        print(f"Converting {img.mode} to RGB...")
        img = img.convert('RGB')
    
    # Verify image size
    if img.size != (image_size, image_size):
        print(f"Warning: Image size is {img.size}, expected ({image_size}, {image_size})")
        print("Proceeding with actual image size...")
        image_size = img.size[0]  # Assume square image
    
    # Calculate number of tiles
    num_tiles = image_size // tile_size
    print(f"Image size: {image_size}x{image_size}")
    print(f"Tile size: {tile_size}x{tile_size}")
    print(f"Grid: {num_tiles}x{num_tiles} tiles")
    print(f"Total tiles to generate: {num_tiles * num_tiles}")
    
    # Calculate zoom levels needed
    max_zoom = int(math.log2(num_tiles)) + 1
    print(f"Max zoom level: {max_zoom}")
    
    # Create base output directory
    os.makedirs(output_dir, exist_ok=True)
    
    # Generate tiles for each zoom level
    for zoom in range(max_zoom + 1):
        zoom_dir = os.path.join(output_dir, str(zoom))
        os.makedirs(zoom_dir, exist_ok=True)
        
        # Calculate scale for this zoom level
        scale = 2 ** (max_zoom - zoom)
        scaled_size = image_size // scale
        tiles_at_zoom = 2 ** zoom
        tile_size_at_zoom = scaled_size // tiles_at_zoom
        
        print(f"\nGenerating zoom level {zoom}...")
        print(f"  Scale: 1/{scale}, Scaled image size: {scaled_size}x{scaled_size}")
        print(f"  Tiles at this zoom: {tiles_at_zoom}x{tiles_at_zoom}")
        print(f"  Tile size: {tile_size_at_zoom}x{tile_size_at_zoom}")
        
        # Scale the image for this zoom level
        if scale > 1:
            scaled_img = img.resize((scaled_size, scaled_size), Image.Resampling.LANCZOS)
        else:
            scaled_img = img
        
        # Generate tiles
        tile_count = 0
        for y in range(tiles_at_zoom):
            y_dir = os.path.join(zoom_dir, str(y))
            os.makedirs(y_dir, exist_ok=True)
            
            for x in range(tiles_at_zoom):
                # Calculate tile boundaries
                left = x * tile_size_at_zoom
                top = y * tile_size_at_zoom
                right = min(left + tile_size_at_zoom, scaled_size)
                bottom = min(top + tile_size_at_zoom, scaled_size)
                
                # Crop and save tile
                tile = scaled_img.crop((left, top, right, bottom))
                
                # If tile is smaller than expected, pad it with black
                if tile.size != (tile_size_at_zoom, tile_size_at_zoom):
                    padded = Image.new('RGB', (tile_size_at_zoom, tile_size_at_zoom), (0, 0, 0))
                    padded.paste(tile, (0, 0))
                    tile = padded
                
                # Save as JPEG with quality 85
                tile_path = os.path.join(y_dir, f"{x}.jpg")
                tile.save(tile_path, 'JPEG', quality=85, optimize=True)
                tile_count += 1
            
            if (y + 1) % 5 == 0 or y == tiles_at_zoom - 1:
                print(f"  Progress: {y + 1}/{tiles_at_zoom} rows ({tile_count} tiles)")
        
        print(f"  Completed zoom level {zoom}: {tile_count} tiles")
    
    print(f"\n✓ All tiles generated successfully in: {output_dir}")
    print(f"\nTile URL pattern: {output_dir}/{{z}}/{{y}}/{{x}}.jpg")

if __name__ == "__main__":
    # Configuration
    input_image = "map.png"
    output_directory = "tiles"
    
    print("=" * 60)
    print("Map Tile Generator")
    print("=" * 60)
    
    if not os.path.exists(input_image):
        print(f"Error: Input image not found: {input_image}")
        print("\nPlease ensure the map.png file exists in interactive-map/public/")
        exit(1)
    
    generate_tiles(input_image, output_directory, tile_size=512, image_size=16384)
    
    print("\n" + "=" * 60)
    print("To use these tiles in OpenLayers, use the XYZ source:")
    print("  url: 'tiles/{z}/{y}/{x}.jpg'")
    print("=" * 60)
