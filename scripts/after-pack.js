const path = require("path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;

  const { rcedit } = await import("rcedit");
  const appInfo = context.packager.appInfo;
  const exeName = `${appInfo.productFilename}.exe`;
  const exePath = path.join(context.appOutDir, exeName);
  const iconPath = path.join(context.packager.projectDir, "assets", "nyx-icon.ico");
  const version = appInfo.version || "1.0.0";

  await rcedit(exePath, {
    icon: iconPath,
    "file-version": version,
    "product-version": version,
    "requested-execution-level": "asInvoker",
    "version-string": {
      CompanyName: "Nyx",
      FileDescription: "Nyx",
      InternalName: "Nyx",
      OriginalFilename: exeName,
      ProductName: "Nyx"
    }
  });
};
