/** @type {import("@electron-forge/shared-types").ForgeConfig} */
const config = {
  packagerConfig: {
    icon: "resources/icons/icon",
  },
  rebuildConfig: {
    ignoreModules: ["canvas"],
  },
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        loadingGif: "resources/install-spinner.gif",
        setupIcon: "resources/icons/icon.ico",
      },
    },
    {
      name: "@electron-forge/maker-dmg",
    },
    {
      name: "@electron-forge/maker-deb",
      config: {
        icon: "resources/icons/1024x1024.png",
      },
    },
  ],
  publishers: [
    {
      name: "@electron-forge/publisher-github",
      config: {
        repository: {
          owner: "hata6502",
          name: "gyazemon",
        },
        prerelease: false,
        draft: true,
      },
    },
  ],
};

module.exports = config;
