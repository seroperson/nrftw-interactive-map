# No Rest for The Wicked - Interactive Map

An interactive, offline-capable Progressive Web App (PWA) for exploring
resources in the game "No Rest for The Wicked".

## ✨ Features

- 🗺️ **Interactive Map**: Pan, zoom, and explore the game world
- 📍 **Resource Markers**: View locations of ores and other resources
- 🎯 **Custom Markers**: Add your own markers for notes and discoveries
- 🔍 **Advanced Filtering**: Toggle resource types on/off
- 🔗 **Shareable URLs**: Share your map state with others
- 📱 **Installable**: Install as a standalone app on desktop and mobile
- 🌐 **Offline Mode**: Works completely offline after first visit
- 🌙 **Dark Theme**: Easy on the eyes for long gaming sessions

## 🚀 Quick Start

### Online Access

Simply visit the deployed application URL in your web browser.

### Installation

#### Desktop (Windows, macOS, Linux)

1. Open the app in Chrome, Edge, or another Chromium browser
2. Click the install icon (⊕) in the address bar
3. Click "Install" to add it to your applications

#### Mobile (Android/iOS)

1. Open in your mobile browser
2. **Android**: Menu → "Add to Home Screen"
3. **iOS**: Share → "Add to Home Screen"

See [PWA_FEATURES.md](PWA_FEATURES.md) for detailed installation instructions.

## 💻 Development

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
cd interactive-map
npm install
```

### Development Server

```bash
npm run dev
```

Opens at http://localhost:3000

### Build for Production

```bash
npm run build
```

Outputs to `dist/` directory with full PWA support.

### Preview Production Build

```bash
npm run preview
```

## 📁 Project Structure

```
interactive-map/
├── src/
│   ├── main.ts              # Application entry point
│   ├── mapRenderer.ts       # OpenLayers map configuration
│   ├── stateManager.ts      # State management & URL handling
│   ├── ui.ts               # UI controls and interactions
│   ├── coordinateConverter.ts # World-to-image coordinate conversion
│   ├── resourceData.ts      # Resource data loading
│   ├── types.ts            # TypeScript interfaces
│   └── styles.css          # Application styles
├── public/
│   ├── icon-192x192.png    # PWA icon (small)
│   ├── icon-512x512.png    # PWA icon (large)
│   ├── map.png             # Game world map (154MB)
│   ├── ore_coordinates.csv # Resource coordinate data
│   └── region_transforms.csv # Region transformation data
├── index.html              # Main HTML file
├── vite.config.ts          # Vite & PWA configuration
├── tsconfig.json           # TypeScript configuration
├── package.json            # Dependencies
├── README.md               # This file
└── PWA_FEATURES.md         # PWA documentation
```

## 🛠️ Technologies

- **TypeScript**: Type-safe JavaScript
- **OpenLayers**: Interactive mapping library
- **Vite**: Fast build tool and dev server
- **Vite PWA Plugin**: Progressive Web App capabilities
- **Workbox**: Service worker and caching strategies

## 🌐 Offline Capabilities

The application is a full Progressive Web App with:

### Cached on Installation

- Core app files (HTML, CSS, JavaScript)
- App icons and manifest
- CSV data files

### Cached on First Access

- Large map image (154MB) - cached when first loaded
- Other images - cached as needed

After your first online visit, the entire application works offline. See
[PWA_FEATURES.md](PWA_FEATURES.md) for complete details.

## 📊 Data Sources

The map data is extracted from the game files of "No Rest for The Wicked":

- **Map Image**: Exported from game assets
- **Resource Coordinates**: Extracted from Unity scene files
- **Region Transforms**: Calibrated coordinate transformations

## 🎮 Usage

### Navigating the Map

- **Pan**: Click and drag
- **Zoom**: Mouse wheel or pinch gesture
- **Coordinates**: Hover over the map to see world coordinates

### Filtering Resources

- Use the sidebar to toggle resource types on/off
- **Check All**: Show all resources
- **Uncheck All**: Hide all resources

### Custom Markers

1. Click **"Add Marker Mode"**
2. Click on the map where you want to place a marker
3. Enter a note/description
4. Your markers are saved in browser storage

### Sharing Your Map

Click **"Copy Shareable URL"** to create a link that includes:

- Current map position and zoom
- Active filters
- Custom markers

## 🔧 Configuration

### Map Settings

Edit [`src/coordinateConverter.ts`](src/coordinateConverter.ts) for:

- World bounds
- Coordinate transformations
- Map dimensions

### PWA Settings

Edit [`vite.config.ts`](vite.config.ts) for:

- Cache strategies
- Offline behavior
- Manifest configuration

### Styling

Edit [`src/styles.css`](src/styles.css) for:

- Color scheme
- Layout
- Responsive design

## 🐛 Troubleshooting

### Map Not Loading

- Ensure map.png is in the public/ directory
- Check browser console for errors
- Verify file permissions

### Coordinates Not Matching Game

- Check region_transforms.csv calibration
- Verify coordinate conversion in coordinateConverter.ts
- Recalibrate if game was updated

### PWA Not Installing

- HTTPS required (doesn't work on http://)
- Check browser compatibility
- Clear cache and try again

### Offline Mode Not Working

- Visit the app online first to cache resources
- Check service worker status in DevTools
- Large map requires one online visit to cache

For PWA-specific issues, see [PWA_FEATURES.md](PWA_FEATURES.md#troubleshooting).

## 📄 License

This is a fan-made tool for "No Rest for The Wicked" and is not affiliated with
or endorsed by the game developers.

## 🤝 Contributing

Contributions are welcome! Areas for improvement:

- Additional resource types
- Better coordinate calibration
- Performance optimizations
- Mobile UI enhancements
- Multi-language support

## 📞 Support

For issues or questions:

1. Check the troubleshooting sections
2. Review [PWA_FEATURES.md](PWA_FEATURES.md) for PWA-related questions
3. Check browser console for error messages
4. Verify you're using a supported browser

## 🎯 Roadmap

- [ ] Add more resource types (chests, NPCs, etc.)
- [ ] Implement region/zone boundaries
- [ ] Add search functionality
- [ ] Export/import custom markers
- [ ] Multiple map layers
- [ ] Quest location markers
- [ ] Achievement tracking

---

**Game**: No Rest for The Wicked  
**Version**: 1.0.0  
**Last Updated**: 2026-02-03
