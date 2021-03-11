# vscode-roblox-ts

## Features

- Remove or prefix cross-boundary imports in intellisense.
- Warn about non-type only cross-boundary imports.
- Specify network boundaries in packages.
- Remove internal fields from roblox-ts types.
- Remove deprecated entries from intellisense.
- Remove @hidden entries from intellisense.

## Known Issues

None currently

## Release Notes

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
