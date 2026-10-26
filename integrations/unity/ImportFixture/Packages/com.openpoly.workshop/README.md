# Polyspoon for Unity

Local Unity authoring for Polyspoon (`polyspoon.com`).

Install this folder as a local package: in Unity Package Manager, choose **Install package from disk** and select its `package.json`. The manifest declares minimum Unity 6000.0. The tested environment is Unity 6000.5.5f1, URP 17.5.0 and glTFast 6.20.0; other versions are not established by these checks. The manifest declares glTFast 6.20.0 and Newtonsoft JSON 3.2.2 dependencies.

The `ImportFixture` project embeds the same package for developer validation. Its machine-pinned wrapper, fixture scene and local launch infrastructure are not required in a consumer project. Configure your own checkout and Node in the window.

Open **Window > Polyspoon**. Set **Source checkout** to the Polyspoon repository and **Node executable** to your installed Node executable. That checkout must already have its npm dependencies installed. Click **Load local catalog**.

Choose one of twelve recipes, then Defaults or one of its three presets. Edit the typed shape, construction and color fields. **Build new asset** creates a scene root with a `GeneratedAsset` component and one owned `Generated` child. Save the scene after creation.

Select that root, or any descendant, and wait for its saved design to resolve through the canonical engine. Fields and **Rebuild selected** enable after successful validation. Change controls and click **Rebuild selected**. Root transforms, custom root components and separate user children are preserved. Put your additions beside `Generated`. Direct edits within `Generated` are replaced during rebuild.

The selected saved design remains the baseline for edits. Its validated migration notice and appearance survive unchanged and edited rebuilds. **Saved design** restores the resolved controls. Choosing Defaults or a preset in the same recipe changes controls while retaining saved appearance and history. Choosing a different recipe starts fresh creation and disables rebuilding the previously selected root. Deselecting also starts fresh defaults. **Build new asset** can copy a resolved edited design into a new root.

Invalid saved designs leave the existing root intact and keep its editing controls disabled. Selecting another root or reloading the catalog explicitly retries resolution. Selection changes, cancellation and window close invalidate outstanding results; a stale response cannot replace another root. Reload the catalog after changing generator source.

Centimeter fields display centimeters and convert their values to meter inputs. For example, body width 32 cm is stored as 0.32 m. Angle fields show degrees without conversion. Other control types keep their catalog units.

Create and rebuild each form one Undo transaction. Undo and Redo restore both the generated subtree and its design identity. Every successful build writes a new GLB under `Assets/WorkshopGenerated`. glTFast imports its meshes and materials as persistent subassets. Earlier GLBs are retained for Undo and existing scenes. Keep them while those references matter; this package does not automatically prune asset history.

Generation runs through the canonical TypeScript engine and exporter in a bounded local Node process. Use a trusted reviewed checkout; the bridge is not a sandbox for untrusted generators. It creates no network service and runs no shell commands. Cancel stops generation. Closing the window, reloading assemblies or exiting the Editor also cancels pending generation. Parse, validation, process, timeout and import failures retain the previous asset. Asset files are saved immediately; the Editor marks the changed scene dirty for normal scene saving.

The root serializes the design, family version, source fingerprint, current GLB path and generated-child reference. The TypeScript checkout is needed to rebuild, while saved meshes and materials remain usable without it.


## Verification scope

The current receipts cover eight Node bridge checks, actual stdin requests, thirty Editor workflow checks across twelve families and a fresh scene reopen. They include typed callbacks, centimeter conversion, degree values, canonical colors/history, Undo/Redo, async races, failure retention and persistent imported assets. Full configured gates pass for the production and fixture C# files.

Individual cottage and treasure-chest oblique import views were inspected with recorded limits. Actual interactive native menu, button and viewport review remains pending. These results do not establish all parameter combinations, other Unity/render-pipeline versions or general art-quality acceptance. See [integration receipts and developer commands](../../../README.md).
