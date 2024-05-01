# vscode-roblox-ts

## Features

- Remove or prefix cross-boundary imports in intellisense.
- Warn about non-type only cross-boundary imports.
- Specify network boundaries in packages.
- Status bar button to compile your project.
- Color picker.
- Remove internal fields from roblox-ts types.
- Remove deprecated entries from intellisense.
- Remove @hidden entries from intellisense.

## Release Notes

### 1.8.0
- The `Start Compiler` and `Stop Compiler` commands now supports compiling multiple roblox-ts projects at once.
- The `Start Compiler` and `Stop Compiler` commands will now work in monorepos and workspaces.
- Added support for npm scripts which can be enabled with `roblox-ts.command.npm.useNpmScripts`.

### 1.7.0
- Added `roblox-ts.boundary.diagnosticsMode` setting to adjust cross boundary import diagnostic behavior.

### 1.6.1
- Fixed inherited members not working with aliased symbols.

### 1.6.0
- All JSDoc tags can now be inherited from class implements clauses.
- Added `@hideinherited` JSDoc tag to only hide this element when it's inherited by a class.

### 1.5.5
- Fixed status bar button for projects with spaces in the path. ([#7](https://github.com/roblox-ts/vscode-roblox-ts/pull/7))

### 1.5.4
- Add support for TS 4.4.3

### 1.5.3
- Improved logic for determing whether a project is a roblox-ts project.

### 1.5.0
- Added option to change default color format for color picker.

### 1.4.0
- Added option to open output to the side. ([#5](https://github.com/roblox-ts/vscode-roblox-ts/pull/5))
- Open Output opens to the side by default.

### 1.3.1
- Color picker now works in tsx files

### 1.3.0
- Updated TS to 4.3.2
- Improved diagnostic messages for nominal types

### 1.2.0
- Added a color picker to Color3s.
	- Thanks to [@xethlyz](https://github.com/xethlyx)

### 1.1.2
- Fixed issue with output that caused text to overlap.

### 1.1.1
- Fixed roblox-ts casing

### 1.1.0
- Added config option to hide the status bar button.
	- Thanks to [@xethlyz](https://github.com/xethlyx)

### 1.0.1
- Output terminal no longer opens by default.

### 1.0.0
- Added status bar button to compile your project.
	- Thanks to [@xethlyz](https://github.com/xethlyx)

### 0.3.0
- Added the @server, @client and @shared tsdoc tags.
- Clarified nominal non-assignable diagnostic in some cases.
- Performance improvements and optimizations.

### 0.2.1
- Open Output should now work on most files.

### 0.2.0
- Added setting to remove deprecated members from intellisense (enabled by default.)
- Property declarations with the @hidden JSDoc tag are removed from intellisense.

### 0.1.2
- Removed thread.LUA_THREAD and Function.prototype

### 0.1.1
- Fixed Open Output not working on non-TS files.

### 0.1.0
- Fixed performance issue on larger projects.
- Added an "Open Output" command to open the output file of a source file.

### 0.0.8

- Errors caused by roblox-ts-extensions will no longer crash features such as intellisense.

### 0.0.1

- Initial alpha release of vscode-roblox-ts
