module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '@': './src',
            '@app': './app',
          },
        },
      ],
      // Reanimated 4 uses the worklets plugin (replaces react-native-reanimated/plugin).
      // Must remain the LAST plugin in the list.
      'react-native-worklets/plugin',
    ],
  };
};
