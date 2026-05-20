'use strict';

// electron-builder afterPack hook：簽章前清掉 .app 樹裡的擴充屬性。
//
// Electron Framework 下載時會帶進 resource fork / Finder info xattr，
// `codesign --options runtime` 在 Helper bundle 會失敗：
//   "resource fork, Finder information, or similar detritus not allowed"
//
// 凍結的 Python engine (extraResources → Resources/engine/) 也可能帶 xattr，
// 一併用 xattr -cr 清乾淨。

const { execFileSync } = require('child_process');

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  try {
    execFileSync('xattr', ['-cr', context.appOutDir], { stdio: 'inherit' });
    console.log(`[after-pack] xattr -cr ${context.appOutDir}`);
  } catch (err) {
    console.warn(`[after-pack] xattr 清除失敗（不致命）: ${err.message}`);
  }
};
