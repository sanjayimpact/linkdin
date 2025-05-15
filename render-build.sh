#!/usr/bin/env bash

echo "⬇️ Downloading Chromium snapshot from Google..."
mkdir -p ./chromium
curl -o chromium/chrome.zip https://storage.googleapis.com/chromium-browser-snapshots/Linux_x64/1108766/chrome-linux.zip
unzip -q chromium/chrome.zip -d chromium/
chmod +x chromium/chrome-linux/chrome
echo "✅ Chromium extracted!"
