# Screen Keeper

A React-Electron application that keeps your computer active and helps you appear online in Teams and other applications. The app simulates mouse movements or keyboard presses at scheduled intervals to prevent your computer from going to sleep or appearing inactive.

## Features

- **Mouse Movement or Keyboard Press**: Choose between subtle mouse movements or keyboard presses
- **Scheduled Operation**: Set specific start and end times for automation
- **Customizable Intervals**: Configure the time between actions (minimum 10 seconds)
- **Permission Management**: User-friendly handling of system permissions
- **Cross-Platform**: Works on both macOS and Windows
- **Modern UI**: Clean and intuitive interface

## Requirements

- Node.js (v16 or higher)
- npm or yarn
- macOS or Windows operating system

### macOS Additional Requirements

On macOS, the app requires Accessibility permissions to control mouse and keyboard. The app will guide you through granting these permissions.

## Installation

1. Clone or download this repository
2. Navigate to the project directory
3. Install dependencies:

```bash
npm install
```

4. Rebuild native modules for Electron:

```bash
npm run rebuild
```

## Development

To run the app in development mode:

```bash
npm start
```

This will start both the React development server and the Electron app.

## Building

To build the app for production:

```bash
npm run build
```

To package the app for distribution:

```bash
npm run dist
```

This will create platform-specific installers in the `release` directory.

## Usage

1. **Launch the application**
2. **Grant permissions** (if required):
   - On macOS: Go to System Preferences > Security & Privacy > Privacy > Accessibility and add Screen Keeper
3. **Configure settings**:
   - Choose between mouse movement or keyboard press
   - If keyboard is selected, choose which key to press (F15-F18 are recommended as they're rarely used)
   - Set the interval between actions (minimum 10 seconds)
   - Set start and end times for when the automation should be active
4. **Start automation** by clicking the "Start Automation" button
5. **Monitor status** in the status card to see when actions are performed

## Recommended Settings

- **Action Type**: Mouse movement (less intrusive)
- **Interval**: 60-300 seconds (1-5 minutes)
- **Key Selection**: F15-F18 (if using keyboard mode) as these keys don't interfere with normal usage
- **Time Range**: Set to your working hours

## Security and Privacy

- All data is stored locally on your device
- No network communication or data collection
- The app only performs the actions you configure during the specified time periods
- You can stop the automation at any time

## Troubleshooting

### macOS Permission Issues

If you're having trouble with permissions on macOS:

1. Go to System Preferences > Security & Privacy > Privacy > Accessibility
2. Click the lock icon and enter your password
3. Find Screen Keeper in the list and check the box
4. If Screen Keeper isn't in the list, click the "+" button and add it
5. Restart the application

### Build Issues

If you encounter issues during installation or building:

1. Make sure you have the latest version of Node.js
2. Clear npm cache: `npm cache clean --force`
3. Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
4. Rebuild native modules: `npm run rebuild`

### robotjs Issues

If robotjs fails to install or build:

- On macOS: Make sure you have Xcode command line tools: `xcode-select --install`
- On Windows: Make sure you have Visual Studio Build Tools installed

## License

MIT License - feel free to use and modify as needed.

## Contributing

Feel free to submit issues and enhancement requests! 