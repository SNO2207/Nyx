# Nyx

Nyx is a dark, tabbed desktop viewer for Dumper7 Unreal Engine JSON dumps. It gives you a fast local workspace for browsing classes, structs, functions, enums, offsets, inheritance graphs, and generated MDK-style output.

![Nyx icon](assets/nyx-icon.png)

## Features

- Browse Dumper7 classes, structs, functions, enums, and offsets.
- Keep multiple investigation tabs open at once, each with its own selected item, mode, filters, and search state.
- Search globally across names, members, params, flags, enum values, offsets, and inheritance.
- Inspect class inheritance with a graph view.
- View structured tables or generated MDK-style declarations.
- Load dumps from a server-side path, browser folder picker, or selected JSON files.
- Run as an Electron desktop app or as a local web viewer.

## Requirements

- Windows for packaged desktop releases.
- Node.js 18 or newer for development.
- A Dumper7 dump folder containing:

```text
ClassesInfo.json
StructsInfo.json
EnumsInfo.json
FunctionsInfo.json
OffsetsInfo.json
```

## Desktop App

Install dependencies:

```powershell
npm install
```

Launch Nyx:

```powershell
npm run electron
```

Launch with the default dump path script:

```powershell
npm run electron:dump
```

## Local Web Viewer

Start the local server:

```powershell
npm start
```

Then open:

```text
http://localhost:5177
```

To start with a specific dump folder:

```powershell
node server.js "C:/path/to/Dumpspace"
```

## Release Builds

Build Windows release artifacts:

```powershell
npm run dist
```

Artifacts are written to `release/`:

- `Nyx-1.0.0-portable.exe`
- `Nyx-1.0.0-setup.exe`
- `Nyx-1.0.0-installer.msi`

Local release artifacts are unsigned unless a Windows code-signing certificate is configured, so Windows SmartScreen may warn on first launch.

## Workspace Tabs

After a dump is loaded, use the `+` button to open another workspace tab. Each tab remembers its own section, selected class/struct/function owner, mode, sidebar filter, and global search state. This makes it easy to keep one class open while comparing another class's functions in a separate tab.

## Search

Sidebar search is name-only for a clean navigator experience.

Global Search can combine these scopes:

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

## Notes

Nyx runs locally. Dump JSON is read from the selected local path or files and is not uploaded by the app.
