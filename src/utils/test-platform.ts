import { isWindows, isMacOS, isLinux } from './platform';

// Test function to verify platform detection
export const testPlatformDetection = async () => {
  console.log('Testing platform detection...');

  const isWin = await isWindows();
  const isMac = await isMacOS();
  const isLin = await isLinux();

  console.log('Windows:', isWin);
  console.log('macOS:', isMac);
  console.log('Linux:', isLin);

  if (isWin) {
    console.log('Running on Windows platform');
  } else if (isMac) {
    console.log('Running on macOS platform');
  } else if (isLin) {
    console.log('Running on Linux platform');
  } else {
    console.log('Unknown platform or running in browser');
  }
};