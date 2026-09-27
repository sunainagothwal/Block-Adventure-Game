module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo automatically injects `react-native-worklets/plugin`
    // (the Reanimated 4 worklet transform) when react-native-worklets is
    // installed, so it must stay last and must not be added twice.
    presets: ['babel-preset-expo'],
  };
};
