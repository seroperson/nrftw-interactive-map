# Interactive Map for "No Rest for The Wicked"

An offline-capable interactive map for "No Rest for The Wicked". Many things are
Clauded, so code probably smells.

Live at **🗺 [nrftw.seroperson.me][1]**.

# Why another map?

This map is completely extracted from game resources, so it's the most complete
map at the moment. Still some things could be inaccurate, as my algorithm
probably isn't perfect, resource misreads are possible, and there is quite a lot
of game logic which must be treated properly to project everyhing on the map.

As it's extracted from game resources, you can notice the following features:

- Currently there are around 2000 objects on the map, including: chest, shiny,
  item spawn points; lore readables; interactables, like doors or ladders; and
  many others.
- Objects on this map contain the exact coordinates, so you can distinguish
  whether something is located deeply in cave or at high ground.
- You can now see drop chances and loot pools on farmable resources.
- Likely it would be easy to update this map when further game updates come.

# More things to implement

Still there is a lot of work to be done, such as:

- Displaying enemy spawn points. They're actually easy to extract, but it
  requires some additional effort to find out how exactly they're triggered.
  There is really a lot of spawn points in game, but most of them are inactive
  for some reason.
- Loot spawn points tuning: currently there are some objects which don't exist
  visually in game, but exist in memory (or vice-versa). I guess again there is
  some logic which conditionally hides them.
- Region offset extracting: currently I manually calibrated some offsets to
  project object correctly on the map. Ideally this offset must be extracted
  from the game.

# How to build it

The process is actually challenging, but in a nutshell there is no rocket
science:

- Unpack all resources using [AssetRipper][2]. They're necessary to get the map
  and extract some information from assets (such as translations).
- Install [MelonLoader][3]. It allows you to execute custom code at runtime and
  extract the necessary data.
- Install [il2CppDumper][4] and [Ghidra][5]. Follow [this tutorial][6] to
  disassemble the code. This way you can find the exact logic, find some
  necessary constants and so on.

After configuring the setup, everything left is to find the necessary game
objects, dump them and put them on the map.

All necessary code is already in this repository:

- `nrftw-loot-dumper/` - is a mod to dump game objects.
- `scripts/generate_map_tiles.py` - converts high-resolution map into the tiles
  for OpenLayers.
- `scripts/extract_item_translations.py` - extacts item names from `.asset`
  files.
- The rest code in this repository is an actual interactive web map.

To compile a bundle, just run `npm run build`.

# License

This project is free for use and is not affiliated with or endorsed by the game
developers.

```text
MIT License

Copyright (c) 2026 Daniil Sivak

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

[1]: https://nrftw.seroperson.me/
[2]: https://github.com/AssetRipper/AssetRipper
[3]: https://github.com/LavaGang/MelonLoader
[4]: https://github.com/Perfare/Il2CppDumper
[5]: https://github.com/NationalSecurityAgency/ghidra
[6]: https://gist.github.com/toasterparty/57a50eddc2203fc6ca24cf96789f5dd2
