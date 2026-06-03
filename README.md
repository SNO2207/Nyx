# Nyx

Desktop and local web viewer for Dumper7 Unreal Engine JSON dumps.

## Start

```powershell
npm start
```

Then open:

```text
http://localhost:5177
```

## Desktop app

```powershell
npm run electron
```

To launch the Electron app with a specific dump folder:

```powershell
npm run electron:dump
```

## Release builds

```powershell
npm run dist
```

Release artifacts are written to `release/`:

- `Nyx-1.0.0-portable.exe`
- `Nyx-1.0.0-setup.exe`
- `Nyx-1.0.0-installer.msi`

The local release artifacts are unsigned unless a Windows code-signing certificate is configured.

By default it loads:

```text
C:/Dumper-7/5.5.4-1627709-Hemingway/Dumpspace
```

To load a different dump folder:

```powershell
node server.js "C:/path/to/Dumpspace"
```

The folder must contain:

```text
ClassesInfo.json
StructsInfo.json
EnumsInfo.json
FunctionsInfo.json
OffsetsInfo.json
```

The Upload Dump button can also load those JSON files from another folder in the browser.

## Search

Section sidebar searches are name-only so the Classes list behaves like a clean class navigator.

Global Search supports combined checkbox scopes for:

- Classes
- Structs
- Functions
- Enums
- Offsets
- Class members
- Struct members
- Function params
- Function flags
- Enum values
- Inheritance

Class details include an SVG-backed Graph tab with connector lines, clickable ancestor/child nodes, and capped branches for very large inheritance trees.

## Workspace tabs

After a dump is loaded, use the `+` button to open another workspace tab. Each tab keeps its own selected section, selected class/struct/function owner, mode, sidebar filter, and global search state so you can compare multiple entries without losing your place.
