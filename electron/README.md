# Xebrine electron wrapper
This is a rudimental Electron wrapper of Xebrine for Linux and Windows, which gives Xebrine a better file scanner for both platforms.

For Linux, it also gives it MPRIS support. For Windows, it doesn't do much special.

The way this works is that the Electron wrapper loads up https://xebrine.com with an "electron" parameter, which is basically the "on" switch for the web app to know that it's running in Electron. This allows the webapp to use the amenities of the wrapper.

To download, see: https://xebrine.com/i/download. To build it yourself, do:

```
cd electron
npm i
npm run dist:linux # linux (duh)
npm run dist:win
```

## macOS?
Maybe. I don't have a modern Mac, so I can't test it and I don't feel comfortable blindly shipping binaries without testing. Nevertheless, tweaking the build script should take actual milliseconds.