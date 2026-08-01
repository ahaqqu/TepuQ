# TepuQ — Domain Glossary

## Core Concepts

### Family
A single household that uses TepuQ together. A Family is the unit of identity for cloud sync: all devices logged in with the same credentials share the same Family data. There is no per-person identity inside a Family.

### Device
One browser instance on one phone, tablet, or computer. Each Device keeps its own copy of the Family data in IndexedDB. A Family may have many Devices.

### Local Data
The objects, settings, photos, and voice recordings stored in a Device's browser (IndexedDB). Local Data works offline and independently of cloud sync.

### Custom Object
An object created or edited by a parent through Admin mode. Custom objects travel with ZIP export/import and cloud sync. Starter objects are not exported or synced individually; they are assumed identical on every Device.

### Starter Object
One of the bundled default objects shipped with TepuQ. Starter objects are seeded into Local Data on first run and refreshed from the app bundle on schema updates.

### Sync Store
The cloud copy of a Family's custom objects and settings. Exactly one Sync Store exists per Family. Pulling from the Sync Store overwrites the Device's Local custom data using the same merge strategy as ZIP import.

## Actions

### Push
Upload the Device's current custom objects and settings to the Family's Sync Store.

### Pull
Download the Family's Sync Store and overwrite the Device's local custom data with it.

### Export ZIP
Download a backup file (`tepuq-data.zip`) containing custom objects, settings, images, and audio. Independent of cloud sync.

### Import ZIP
Restore custom objects and settings from a ZIP file into Local Data. Replaces/merges using name/id matching; starter objects are preserved.
