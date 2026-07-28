module.exports = {
  packagerConfig: {
    asar: true,
    icon: './assets/icon',
    extendInfo: {
      // Registers Llama Amp as an alternate (non-default) handler so it shows up
      // in Finder's "Open With" list without needing "Other..." each time, and
      // so double-clicking a file after picking it once actually launches with
      // that file (see the open-file handling in src/main/main.js).
      CFBundleDocumentTypes: [
        {
          CFBundleTypeName: 'Audio File',
          CFBundleTypeRole: 'Viewer',
          LSHandlerRank: 'Alternate',
          LSItemContentTypes: [
            'public.mp3',
            'com.apple.m4a-audio',
            'com.microsoft.waveform-audio',
            'org.xiph.ogg-audio',
            'org.xiph.flac',
            'org.xiph.opus',
          ],
        },
      ],
      // ogg/flac/opus have no Apple-owned UTI, so Llama Amp declares them itself
      // (conforming to public.audio) to make the LSItemContentTypes above resolve.
      UTImportedTypeDeclarations: [
        {
          UTTypeIdentifier: 'org.xiph.ogg-audio',
          UTTypeConformsTo: ['public.audio'],
          UTTypeDescription: 'Ogg Audio',
          UTTypeTagSpecification: { 'public.filename-extension': ['ogg', 'oga'] },
        },
        {
          UTTypeIdentifier: 'org.xiph.flac',
          UTTypeConformsTo: ['public.audio'],
          UTTypeDescription: 'FLAC Audio',
          UTTypeTagSpecification: { 'public.filename-extension': ['flac'] },
        },
        {
          UTTypeIdentifier: 'org.xiph.opus',
          UTTypeConformsTo: ['public.audio'],
          UTTypeDescription: 'Opus Audio',
          UTTypeTagSpecification: { 'public.filename-extension': ['opus', 'weba'] },
        },
      ],
    },
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {},
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
        // If you are familiar with Vite configuration, it will look really familiar.
        build: [
          {
            // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
            entry: 'src/main/main.js',
            config: 'vite.main.config.mjs',
            target: 'main',
          },
          {
            entry: 'src/preload/preload.js',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
        ],
        renderer: [
          {
            name: 'main_window',
            config: 'vite.renderer.config.mjs',
          },
        ],
      },
    },
  ],
};
