#!/data/data/com.termux/files/usr/bin/bash

# Function to call on successful connection
on_connected() {
    local device="$1"
    echo "🎉 Device connected: $device"
    termux-adb -s "$device" shell "echo Hello from Termux!"
}

# Check existing devices
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

# User input for new device
read -p "Enter IP: " ip
read -p "Connect Port: " cport

echo "🔗 Trying to connect $ip:$cport ..."
termux-adb connect "$ip:$cport"

connected=$(termux-adb devices | grep "$ip:$cport")

if [ -n "$connected" ]; then
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
        connected=$(termux-adb devices | grep "$ip:$cport")

        if [ -n "$connected" ]; then
            echo "✅ Connected successfully to $ip:$cport"
            on_connected "$ip:$cport"
        else
            echo "❌ Connect failed!"
        fi
    else
        echo "❌ Pairing failed!"
    fi
fi