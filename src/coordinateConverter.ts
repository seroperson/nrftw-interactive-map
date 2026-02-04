// Coordinate conversion logic extracted from plot_mines_on_map.py

import { Coordinates, ImageCoordinates } from './types';

interface Transform {
  scaling: number;
  offset_x: number;
  offset_y: number;
  invert_x: boolean;
  invert_z: boolean;
}

export class CoordinateConverter {
  // Map dimensions - based on ortho.asset configuration (8x8 tiles of 4096x4096 pixels each)
  private readonly MAP_WIDTH = 16384;
  private readonly MAP_HEIGHT = 16384;
  
  // Default world bounds - EXTRACTED FROM ortho.asset
  // BoundsCenter: {x: 422.5, y: 0, z: 614}
  // BoundsSize: {x: 1732, y: 1732}
  private readonly DEFAULT_WORLD_BOUNDS = {
    x_min: -443.5,    // 422.5 - (1732/2)
    x_max: 1288.5,    // 422.5 + (1732/2)
    z_min: -252.0,    // 614 - (1732/2)
    z_max: 1480.0,    // 614 + (1732/2)
  };
  
  // Default transform parameters (used if no region-specific config exists)
  private readonly DEFAULT_TRANSFORM: Transform = {
    scaling: 30.0,
    offset_x: 0,
    offset_y: 0,
    invert_x: false,
    invert_z: true,
  };

  private regionTransforms: Map<string, Transform> = new Map();

  constructor() {
    this.regionTransforms.set('default', this.DEFAULT_TRANSFORM);
  }

  public setRegionTransform(region: string, transform: Transform): void {
    this.regionTransforms.set(region, transform);
  }

  public worldToImage(worldX: number, worldZ: number, region: string = 'default'): ImageCoordinates {
    const transform = this.regionTransforms.get(region) || this.DEFAULT_TRANSFORM;
    
    // Apply scaling to world bounds
    const scaling = transform.scaling;
    const worldBounds = {
      x_min: this.DEFAULT_WORLD_BOUNDS.x_min / scaling,
      x_max: this.DEFAULT_WORLD_BOUNDS.x_max / scaling,
      z_min: this.DEFAULT_WORLD_BOUNDS.z_min / scaling,
      z_max: this.DEFAULT_WORLD_BOUNDS.z_max / scaling,
    };
    
    const worldWidth = worldBounds.x_max - worldBounds.x_min;
    const worldHeight = worldBounds.z_max - worldBounds.z_min;
    
    // Normalize to 0-1 range
    let normX = (worldX - worldBounds.x_min) / worldWidth;
    let normZ = (worldZ - worldBounds.z_min) / worldHeight;
    
    // Apply inversions if configured
    if (transform.invert_x) {
      normX = 1.0 - normX;
    }
    if (transform.invert_z) {
      normZ = 1.0 - normZ;
    }
    
    // Map to pixel coordinates
    const px = Math.floor(normX * this.MAP_WIDTH) + transform.offset_x;
    const py = Math.floor(normZ * this.MAP_HEIGHT) + transform.offset_y;
    
    return { x: px, y: py };
  }

  public imageToWorld(imageX: number, imageY: number, region: string = 'default'): Coordinates {
    const transform = this.regionTransforms.get(region) || this.DEFAULT_TRANSFORM;
    
    // Remove offset
    let px = imageX - transform.offset_x;
    let py = imageY - transform.offset_y;
    
    // Normalize from pixel to 0-1 range
    let normX = px / this.MAP_WIDTH;
    let normZ = py / this.MAP_HEIGHT;
    
    // Reverse inversions
    if (transform.invert_x) {
      normX = 1.0 - normX;
    }
    if (transform.invert_z) {
      normZ = 1.0 - normZ;
    }
    
    // Apply scaling to world bounds
    const scaling = transform.scaling;
    const worldBounds = {
      x_min: this.DEFAULT_WORLD_BOUNDS.x_min / scaling,
      x_max: this.DEFAULT_WORLD_BOUNDS.x_max / scaling,
      z_min: this.DEFAULT_WORLD_BOUNDS.z_min / scaling,
      z_max: this.DEFAULT_WORLD_BOUNDS.z_max / scaling,
    };
    
    const worldWidth = worldBounds.x_max - worldBounds.x_min;
    const worldHeight = worldBounds.z_max - worldBounds.z_min;
    
    // Denormalize to world coordinates
    const x = normX * worldWidth + worldBounds.x_min;
    const z = normZ * worldHeight + worldBounds.z_min;

    return { x, z };
  }

  public loadTransformsFromCSV(csvText: string): void {
    const lines = csvText.trim().split('\n');
    
    // Skip header
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(',');
      if (parts.length < 5) continue;

      const region = parts[0].trim();
      const transform: Transform = {
        scaling: parseFloat(parts[1]),
        offset_x: parseInt(parts[2]),
        offset_y: parseInt(parts[3]),
        invert_x: parts[4].toLowerCase() === 'true',
        invert_z: parts[5].toLowerCase() === 'true'
      };

      this.setRegionTransform(region, transform);
    }
  }
}
