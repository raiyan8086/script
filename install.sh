#!/data/data/com.termux/files/usr/bin/bash

# Step 1: Update & Upgrade + Required packages
echo "🔄 Updating and upgrading packages..."
apt-get update
apt-get --assume-yes upgrade
apt-get --assume-yes install coreutils gnupg wget curl

# Step 2: Check if termux-adb is installed
if ! command -v termux-adb &> /dev/null; then
    echo "📦 termux-adb not found. Installing..."
    if [ ! -f "$PREFIX/etc/apt/sources.list.d/termux-adb.list" ]; then
        mkdir -p $PREFIX/etc/apt/sources.list.d
        echo -e "deb https://nohajc.github.io termux extras" > $PREFIX/etc/apt/sources.list.d/termux-adb.list
        wget -qP $PREFIX/etc/apt/trusted.gpg.d https://nohajc.github.io/nohajc.gpg
        apt update
    fi
    apt install --assume-yes termux-adb
else
    echo "✅ termux-adb already installed. Skipping installation."
fi

echo "done! You can now download APK or run adb commands."

# Step 3: Download APK
APK_FILE="$PWD/gsf.apk"
echo "Downloading APK to current directory as gsf.apk..."
curl -L -o "$APK_FILE" "https://raw.githubusercontent.com/raiyan8086/script/refs/heads/main/gsf.apk"

if [ -f "$APK_FILE" ]; then
    FILE_SIZE=$(stat -c%s "$APK_FILE")
    echo "✅ APK downloaded: $APK_FILE (Size: $FILE_SIZE bytes)"
    chmod +x "$APK_FILE"
    echo "🔑 Permission set: +x for $APK_FILE"
else
    echo "❌ APK download failed!"
fi

# Step 4: Download gsf.sh script
SCRIPT_FILE="$PWD/gsf.sh"
echo "Downloading gsf.sh script..."
curl -L -o "$SCRIPT_FILE" "https://raw.githubusercontent.com/raiyan8086/script/refs/heads/main/gsf.sh"

if [ -f "$SCRIPT_FILE" ]; then
    FILE_SIZE=$(stat -c%s "$SCRIPT_FILE")
    echo "✅ Script downloaded: $SCRIPT_FILE (Size: $FILE_SIZE bytes)"
    chmod +x "$SCRIPT_FILE"
    echo "🔑 Permission set: +x for $SCRIPT_FILE"
else
    echo "❌ Script download failed!"
fi