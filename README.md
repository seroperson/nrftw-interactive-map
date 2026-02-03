# No Rest for The Wicked - Interactive Map

A client-only interactive web map application for exploring resource locations
in "No Rest for the Wicked".

## Features

- **Interactive Canvas-Based Map Rendering**: Custom renderer with pan and zoom,
  no external mapping libraries
- **Resource Filtering**: Show/hide different resource types (Iron, Copper,
  Gold, Silver, Cerim, etc.)
- **Custom Markers**: Add and label your own markers on the map
- **URL State Sharing**: Share your current view and selections with others via
  URL
- **LocalStorage Persistence**: Your settings are automatically saved
- **Coordinate Display**: Real-time world coordinates as you hover over the map
- **Optimized Rendering**: Viewport culling for efficient performance with large
  datasets

## Tech Stack

- **TypeScript**: Type-safe development
- **Vite**: Fast build tool and dev server
- **OpenLayers**: Professional mapping library for static image display
- **No external dependencies beyond OpenLayers**: Lightweight and efficient

## Project Structure

```
interactive-map/
├── src/
│   ├── types.ts              # TypeScript type definitions
│   ├── coordinateConverter.ts # World-to-image coordinate conversion
│   ├── resourceData.ts        # Resource type definitions and colors
│   ├── mapRenderer.ts         # Canvas-based map renderer
│   ├── stateManager.ts        # State management with URL/localStorage
│   ├── ui.ts                  # UI component management
│   ├── main.ts               # Application entry point
│   └── styles.css            # Application styles
├── index.html                # HTML entry point
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript configuration
└── vite.config.ts            # Vite configuration
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd interactive-map
npm install
```

### 2. Prepare Data Files

The application expects the following files in the parent directory:

- `ore_coordinates.csv` - Resource locations (required)
- `region_transforms.csv` - Region transformation parameters (optional)

**ore_coordinates.csv format:**

```csv
Name,Region,World_X,World_Z,File_Path
Iron Ore,sacrament,123.45,678.90,worlds/isolaSacra/sacrament/loot/loot.unity
Copper Ore,coast,-456.78,234.56,worlds/isolaSacra/coast/loot/loot.unity
```

**region_transforms.csv format:**

```csv
Region,Offset_X,Offset_Z,Scale_X,Scale_Z,Flip_X,Flip_Z
sacrament,6144,6144,1.0,1.0,false,true
coast,6144,6144,1.0,1.0,false,true
```

If these files are not found, the application will use sample data for
demonstration.

### 3. (Optional) Add Map Image

To display the actual map background, place your map image in the `public`
folder and modify [`main.ts`](src/main.ts:151) to load it:

```typescript
await this.renderer.loadMapImage("/map.png");
```

The map should be in PNG format. Large maps (12288x12288) are supported with
optimized rendering.

## Development

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Building for Production

Create an optimized production build:

```bash
npm run build
```

The output will be in the `dist` folder, ready to be deployed to any static
hosting service.

Preview the production build:

```bash
npm run preview
```

## Usage

### Map Navigation

- **Pan**: Click and drag on the map
- **Zoom**: Use mouse wheel to zoom in/out
- **Coordinates**: Hover over the map to see world coordinates

### Filtering Resources

- Use the checkboxes in the sidebar to show/hide resource types
- Resource counts are displayed next to each type
- Colors match the markers on the map

### Adding Custom Markers

1. Click "Add Marker Mode" button
2. Click on the map where you want to place a marker
3. Edit the marker label in the sidebar
4. Click the trash icon to remove a marker

### Sharing Your View

Click "Copy Shareable URL" to get a URL that includes:

- Current viewport position and zoom level
- Selected resource types
- Custom markers

Anyone opening this URL will see the same view.

## Coordinate System

The application uses the game's world coordinate system and converts it to image
coordinates using transformation parameters:

1. **World Coordinates**: Game engine coordinates (X, Z)
2. **Image Coordinates**: Pixel coordinates on the map image

Transformation formula:

```
imageX = (worldX * flipX * scaleX) + offsetX
imageY = (worldZ * flipZ * scaleZ) + offsetZ
```

See [`coordinateConverter.ts`](src/coordinateConverter.ts) for implementation
details.

## Rendering Optimization

The map renderer includes several optimizations:

- **Viewport Culling**: Only renders markers within the visible area
- **Efficient Transforms**: Uses canvas transformations for pan/zoom
- **Partial Rendering**: Doesn't need to load the entire map into memory
- **Throttled Updates**: Viewport state saves are throttled to reduce overhead

## Architecture

### CoordinateConverter

Handles conversion between world coordinates and image coordinates, supporting
per-region transformations.

### MapRenderer

Canvas-based renderer with pan, zoom, and optimized marker rendering. Handles
viewport culling and event management.

### StateManager

Manages application state with persistence to URL and localStorage. Provides
observable state updates.

### UIManager

Manages sidebar UI, including resource filters, custom markers, and control
buttons.

## Browser Support

Requires a modern browser with support for:

- ES2020
- Canvas API
- LocalStorage
- Clipboard API (for URL sharing)

## Troubleshooting

### Resources not loading

- Check that `ore_coordinates.csv` is in the correct location (parent directory)
- Check browser console for error messages
- Verify CSV file format matches expected structure

### Map image not displaying

- Ensure the image path in [`main.ts`](src/main.ts:151) is correct
- Check that the image file exists in the `public` folder
- Verify image format is supported (PNG, JPEG, WebP)

### Performance issues

- Reduce the zoom level to decrease the number of visible markers
- Filter out resource types you don't need
- Consider using a smaller map image

## Future Enhancements

Possible improvements:

- Search functionality for locations
- Distance measurement tool
- Route planning between markers
- Multiple map layers (regions)
- Export/import marker collections
- Heatmap mode for resource density
- Mobile touch controls optimization

## License

This tool is for personal use with "No Rest for the Wicked" game assets.

## Credits

Built using coordinate conversion logic from the Python analysis scripts:

- `extract_all_resources.py` - Resource extraction patterns
- `plot_mines_on_map.py` - Coordinate conversion and visualization logic
